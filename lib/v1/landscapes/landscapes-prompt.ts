// lib/v1/landscapes/landscapes-prompt.ts
//
// Pass 1 prompt assembler for the Landscapes silo (NB2 / google/nano-banana-2).
// Owns: structure, composition, camera, containment, base logic, plaque text gen.
// Pass 2 (gpt-image-1, see landscape-refine.ts) handles realism + texture
// + environment reinforcement.
//
// Spec source: LITENCO Production Prompt v1 + lighting subsystem v1
//   + ground integration v2 + cut pass (May 2026).
//
// Block order (post-cut):
//   CORE → PLACE → OBJECT REALISM → LIGHTING → SUBJECT LIGHTING STYLE
//   → SUBJECT PRIORITY LIGHT → MICRO-CONTRAST → ATMOSPHERE? → SCENE FEEL
//   → CAMERA → SCALE → ENVIRONMENT (resolved) → IN-SITU GROUND?
//   → PLAQUE → NOTES → SPATIAL RULES → OUTPUT
//
// Removed in this pass:
//   • ENVIRONMENT_PHILOSOPHY_RULE — subsumed by the more specific
//     controlled/in_situ environment blocks.
//   • PERSPECTIVE_ENHANCEMENT_RULE — guidance with no specific failure mode.
//   • VEGETATION_INTEGRITY_RULE — duplicated by Pass 2's natural-variation addon.
//   • OUTPAINTING_BLOCK — outpainting is owned by the Stability stage.
//   • SPATIAL_RULES_BLOCK trimmed to just the no-domes line.

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
  SCENE_FEEL_EFFECTS,
  OBJECT_REALISM_BLOCK,
  LIGHTING_BLOCK,
  SUBJECT_LIGHTING_STYLE_BLOCK,
  SUBJECT_PRIORITY_LIGHT_BLOCK,
  MICRO_CONTRAST_PRESERVATION_BLOCK,
  IN_SITU_GROUND_INTEGRATION_BLOCK,
} from './landscapes-effects'
import { buildPass1PlaqueBlock } from './landscapes-plaque'

// ── FIXED BLOCKS ──────────────────────────────────────────────
const CORE_BLOCK = `Create a gallery-quality photographic image of a handcrafted 3D miniature landscape diorama. Transform the input image into a museum-quality physical miniature diorama photographed as a real object. All elements must be fully 3D, handcrafted, and physically plausible.

CORE:
The diorama is the entire scene — a fully three-dimensional physical scale model contained within a circular walnut plinth. All terrain, vegetation, water, and structures exist as physical miniature materials. The scene is the diorama itself; there is no flat imagery, no background plate, no continuation beyond the base.

The source defines identity, but the miniature is interpreted to feel cohesive within the circular form. The result should feel like the same place, elevated into a cinematic miniature — not a literal copy. The scene may compress and adapt to fit the base naturally, but feels complete, not cropped.

Edges resolve organically using terrain falloff, vegetation, rocks, soil, or atmosphere.

The full plinth is always visible.`

// Trimmed: just the no-domes sentence. Everything else this block used to
// say is covered by CORE ("no flat imagery, no background plate, no
// continuation beyond the base").
const SPATIAL_RULES_BLOCK = `SPATIAL RULES:
No domes, glass enclosures, arches, rings, or other artificial framing — unless explicitly present in the source image.`

// ── PARAMETERIZED BLOCK BUILDERS ──────────────────────────────

function atmosphereBlock(atmosphere: AtmosphereID): string | null {
  if (atmosphere === 'none') return null
  return `ATMOSPHERE — ${atmosphere}:
Atmosphere is the primary lighting driver: ${ATMOSPHERE_EFFECTS[atmosphere]}. It shapes light direction, tonal structure, and atmospheric depth. Variation in falloff, haze, and shadow complexity is welcome where it enhances realism and cinematic quality.`
}

function sceneFeelBlock(params: LandscapeParams): string {
  return `SCENE FEEL — ${params.sceneFeel}:
${SCENE_FEEL_EFFECTS[params.sceneFeel]}. Scene feel describes object quality and render richness — it is independent of weather mood (which atmosphere drives).`
}

function cameraBlock(params: LandscapeParams): string {
  return `CAMERA — ${params.cameraAngle}:
${CAMERA_EFFECTS[params.cameraAngle]}. Choose composition based on what makes this scene read best.`
}

function scaleBlock(params: LandscapeParams): string {
  return `SCALE — ${params.scale}:
${SCALE_EFFECTS[params.scale]}. The full plinth remains visible.`
}

function environmentBlock(env: ResolvedEnvironment): string {
  return `ENVIRONMENT — ${env}:
${ENVIRONMENT_EFFECTS[env]}`
}

function outputBlock(params: LandscapeParams): string {
  return `OUTPUT:
${params.aspectRatio} aspect ratio. Photographed like a real collectible — shallow depth of field with the diorama sharp and the background softly blurred. No overlays or extra text.`
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
  const mode = params.environmentMode ?? 'auto'
  const resolvedEnv = resolveEnvironment(mode, params.atmosphere)

  const plaque = buildPass1PlaqueBlock({
    mode:        params.plaqueMode,
    text:        params.plaqueText ?? null,
    displayName: params.displayName,
    atmosphere:  params.atmosphere,
  })

  const blocks: (string | null)[] = [
    CORE_BLOCK,
    placeContextBlock(params),

    // Always-on craft and lighting blocks come early — they set the
    // expectation before any axis-driven content shapes the result.
    OBJECT_REALISM_BLOCK,
    LIGHTING_BLOCK,
    SUBJECT_LIGHTING_STYLE_BLOCK,
    SUBJECT_PRIORITY_LIGHT_BLOCK,
    MICRO_CONTRAST_PRESERVATION_BLOCK,

    atmosphereBlock(params.atmosphere),
    sceneFeelBlock(params),

    cameraBlock(params),
    scaleBlock(params),

    environmentBlock(resolvedEnv),
    // Ground integration emits only when the resolver settled on in_situ —
    // applies whether the user picked it or storm/night forced the override.
    resolvedEnv === 'in_situ' ? IN_SITU_GROUND_INTEGRATION_BLOCK : null,

    plaque,
    notesBlock(params),

    SPATIAL_RULES_BLOCK,
    outputBlock(params),
  ]

  return blocks.filter(Boolean).join('\n\n').trim()
}
