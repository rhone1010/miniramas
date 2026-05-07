// lib/v1/landscapes/landscapes-prompt.ts
//
// Pass 1 prompt assembler for the Landscapes silo (NB2 / google/nano-banana-2).
// Owns: structure, composition, camera, containment, lighting style,
// plaque text generation. Pass 2 (gpt-image-1, see landscapes-refine.ts)
// handles realism + texture + environment reinforcement.
//
// Block order:
//   SUBJECT → CORE → PLACE? → OBJECT REALISM → PLINTH → LIGHTING (addBeam)
//   → ATMOSPHERE? → CAMERA → SCALE
//   → CONTROLLED ENV? / IN-ENVIRONMENT?  (no separate ENVIRONMENT line)
//   → LOW VERTICAL → VEGETATION → SPATIAL RULES → PLAQUE? → NOTES? → OUTPUT
//
// Recent semantic-density rev:
//   • PLINTH_BLOCK inserted between OBJECT_REALISM and LIGHTING — single
//     source of truth for plinth shape/profile/material/finish/extension
//     rules. Was previously split across OBJECT_REALISM (profile) and
//     SPATIAL_RULES PLINTH GEOMETRY LOCK (shape).
//   • environmentBlock() call dropped from assembly — was emitting a
//     one-line summary (ENVIRONMENT — desk:/in-environment:) that the
//     conditional CONTROLLED_ENVIRONMENT_BLOCK / IN_SITU_BLOCK already
//     elaborated. Pure redundancy.
//   • atmosphereBlock() suffix dropped — "It shapes light direction,
//     tonal structure, and atmospheric depth" was tautological
//     descriptive padding with no behavioral signal. The "primary
//     lighting driver" framing is preserved as the load-bearing weight.
//   • CORE_BLOCK gains "shallow depth-of-field" (migrated from OUTPUT).
//   • OUTPUT_BLOCK compressed — most of its content was restating CORE.
//     New version closes with anti-illustration weighting.
//
// Earlier locked decisions:
//   • Scene Feel block REMOVED — quality always equivalent to "dramatic",
//     baked into LIGHTING.

import type {
  LandscapeParams,
  AtmosphereID,
  ResolvedEnvironment,
  EnvironmentMode,
} from './landscapes-shared'
import { resolveEnvironment } from './landscapes-shared'
import {
  ATMOSPHERE_EFFECTS,
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
Create a gallery-quality photographic image of a handcrafted physical miniature diorama with shallow depth-of-field. The scene is fully three-dimensional and contained within a circular walnut plinth. Terrain, vegetation, water, and structures exist as real miniature materials with tactile detail and visible craftsmanship. Preserve the identity and layout of the source while adapting it naturally to the circular composition. The scene feels complete, not cropped. Edges resolve organically using terrain, foliage, atmosphere, or natural falloff. The full plinth is always visible.`

const OUTPUT_BLOCK = `OUTPUT:
A finished collector-grade miniature photograph — reads as a real handcrafted object, not a digital illustration or rendering.`

// ── PARAMETERIZED BLOCK BUILDERS ──────────────────────────────

function atmosphereBlock(atmosphere: AtmosphereID): string | null {
  if (atmosphere === 'natural') return null
  return `ATMOSPHERE — ${atmosphere}:
Atmosphere is the primary lighting driver — ${ATMOSPHERE_EFFECTS[atmosphere]}.`
}

function cameraBlock(params: LandscapeParams): string {
  return `CAMERA — ${params.cameraAngle}:
${CAMERA_EFFECTS[params.cameraAngle]}.`
}

function scaleBlock(params: LandscapeParams): string {
  return `SCALE — ${params.scale}:
${SCALE_EFFECTS[params.scale]}. The full plinth remains visible.`
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

  // Lighting takes only addBeam — Scene Feel and Focal Lighting dials
  // were removed; their quality is baked into the block.
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

    // No separate ENVIRONMENT line — the conditional blocks below
    // carry the full environment direction.
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
