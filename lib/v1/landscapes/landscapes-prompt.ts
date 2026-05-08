// lib/v1/landscapes/landscapes-prompt.ts
//
// Pass 1 prompt assembler for the Landscapes silo (NB2 / google/nano-banana-2).
// Owns: structure, composition, camera, containment, lighting style,
// plaque text generation. Pass 2 (gpt-image-1, see landscapes-refine.ts)
// handles realism + texture + environment reinforcement.
//
// Block order:
//   SUBJECT → CORE → PLACE? → OBJECT REALISM → PLINTH → LIGHTING (addBeam-driven)
//   → ATMOSPHERE? → CAMERA → SCALE
//   → ENVIRONMENT (resolved) → CONTROLLED ENV? / IN-ENVIRONMENT?
//   → LOW VERTICAL → VEGETATION → SPATIAL RULES → PLAQUE? → NOTES? → OUTPUT
//
// Scene Feel block REMOVED in this revision — quality always equivalent
// to "dramatic", baked into LIGHTING.
//
// REV NOTE — PLINTH_BLOCK assembly fix:
//   PLINTH_BLOCK was exported from landscapes-effects.ts but was never
//   imported or assembled into this Pass 1 prompt. All plinth iteration
//   (height ceiling, two-element trim profile, no-arch rules, source-arch
//   handling) had been living only in PASS2_REALISM (refine.ts), with
//   Pass 1 receiving only the bare "circular walnut plinth" reference
//   from CORE_BLOCK. This explained the variable plinth height across
//   renders — Pass 1 was generating with NB2's pedestal prior, and Pass 2
//   was constrained to refine whatever structure Pass 1 handed it. The
//   import + blocks-array insertion (between OBJECT_REALISM and lighting)
//   restores the intended architecture: Pass 1 establishes structure,
//   Pass 2 refines surface.

import type {
  LandscapeParams,
  AtmosphereID,
  ResolvedEnvironment,
  EnvironmentMode,
} from './landscapes-shared'
import { resolveEnvironment } from './landscapes-shared'
import {
  ATMOSPHERE_EFFECTS,
  ENVIRONMENT_EFFECTS,
  SCALE_EFFECTS,
  CAMERA_EFFECTS,
  OBJECT_REALISM_BLOCK,
  PLINTH_BLOCK,
  buildLightingBlock,
  VEGETATION_BLOCK,
  SPATIAL_RULES_BLOCK,
  LOW_VERTICAL_BLOCK,
  CONTROLLED_ENVIRONMENT_BLOCK,
  IN_SITU_BLOCK,
} from './landscapes-effects'
import { buildPass1PlaqueBlock } from './landscapes-plaque'

// ── FIXED BLOCKS ──────────────────────────────────────────────

const SUBJECT_BLOCK = `SUBJECT:
"The subject" is the hero of the image.`

const CORE_BLOCK = `CORE:
Create a gallery-quality photographic image of a handcrafted physical miniature diorama. The scene is fully three-dimensional and contained within a circular walnut plinth. Terrain, vegetation, water, and structures exist as real miniature materials with tactile detail and visible craftsmanship. Preserve the identity and layout of the source while adapting it naturally to the circular composition. The scene feels complete, not cropped. Edges resolve organically using terrain, foliage, atmosphere, or natural falloff. The full plinth is always visible.`

const OUTPUT_BLOCK = `OUTPUT:
Photographed like a real collectible miniature with shallow depth-of-field, tactile realism, atmospheric depth, and strong subject emphasis.`

// ── PARAMETERIZED BLOCK BUILDERS ──────────────────────────────

function atmosphereBlock(atmosphere: AtmosphereID): string | null {
  if (atmosphere === 'natural') return null
  return `ATMOSPHERE — ${atmosphere}:
Atmosphere is the primary lighting driver: ${ATMOSPHERE_EFFECTS[atmosphere]}. It shapes light direction, tonal structure, and atmospheric depth.`
}

function cameraBlock(params: LandscapeParams): string {
  return `CAMERA — ${params.cameraAngle}:
${CAMERA_EFFECTS[params.cameraAngle]}.`
}

function scaleBlock(params: LandscapeParams): string {
  return `SCALE — ${params.scale}:
${SCALE_EFFECTS[params.scale]}. The full plinth remains visible.`
}

function environmentBlock(env: ResolvedEnvironment): string {
  // Header label uses the user-facing terminology — 'desk' / 'in-environment'
  // — for prompt-side consistency with UI.
  const headerLabel = env === 'controlled' ? 'desk' : 'in-environment'
  return `ENVIRONMENT — ${headerLabel}:
${ENVIRONMENT_EFFECTS[env]}.`
}

function placeContextBlock(params: LandscapeParams): string | null {
  const name    = params.displayName?.trim()
  const subject = params.dominantSubject?.trim()
  const water   = params.hasWater ? ', with water as a defining element' : ''

  if (!name && !subject) return null

  let line: string
  if (name && subject) {
    line = `The scene represents ${name} — ${subject}${water}.`
  } else if (subject) {
    line = `The scene represents ${subject}${water}.`
  } else {
    line = `The scene represents ${name}${water}.`
  }
  return `PLACE:\n${line}`
}

function notesBlock(params: LandscapeParams): string | null {
  const text = params.notes?.trim()
  if (!text) return null
  return `ADDITIONAL NOTES FROM THE PERSON WHO KNOWS THIS PLACE:
${text}`
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────

export interface BuildPromptOptions {
  _seed?: number
}

export interface LandscapeParamsWithMode extends LandscapeParams {
  environmentMode?: EnvironmentMode
}

export function buildLandscapePrompt(
  params: LandscapeParamsWithMode,
  _options: BuildPromptOptions = {},
): string {
  const mode = params.environmentMode ?? 'controlled'
  const resolvedEnv = resolveEnvironment(mode, params.atmosphere)

  // Lighting now takes only addBeam — Scene Feel and Focal Lighting
  // dials were removed; their quality is baked into the block.
  const lighting = buildLightingBlock({ addBeam: params.addBeam })

  const plaque = buildPass1PlaqueBlock({
    mode:        params.plaqueMode,
    text:        params.plaqueText ?? null,
    displayName: params.displayName,
    atmosphere:  params.atmosphere,
  })

  const blocks: (string | null)[] = [
    SUBJECT_BLOCK,
    CORE_BLOCK,
    placeContextBlock(params),

    OBJECT_REALISM_BLOCK,
    PLINTH_BLOCK,
    lighting,

    atmosphereBlock(params.atmosphere),

    cameraBlock(params),
    scaleBlock(params),

    environmentBlock(resolvedEnv),
    resolvedEnv === 'controlled' ? CONTROLLED_ENVIRONMENT_BLOCK : null,
    resolvedEnv === 'in_situ'    ? IN_SITU_BLOCK                : null,

    LOW_VERTICAL_BLOCK,
    VEGETATION_BLOCK,
    SPATIAL_RULES_BLOCK,

    plaque,
    notesBlock(params),

    OUTPUT_BLOCK,
  ]

  return blocks.filter(Boolean).join('\n\n').trim()
}
