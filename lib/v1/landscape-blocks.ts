// landscape-blocks.ts
// lib/v1/landscape-blocks.ts
//
// All prompt blocks for the Landscape silo. Rewritten to target the
// GPT-image-1 reference aesthetic — descriptive, declarative voice that
// describes the artifact rather than enumerating rules. Anti-instruction
// lists are gone; failure modes are displaced through positive description
// (a scene "rising freely into open air with terrain wrapping the plinth lip"
// can't be rendered as a domed enclosure).
//
// Categories:
//   1. Always-on stack (5 blocks, every render)
//   2. Environment blocks (3 — selected per render)
//   3. Atmosphere blocks (10 — selected per render; only golden exposed v1)
//   4. Per-preset material rules + lighting recipes
//
// VOCABULARY DISCIPLINE — inherited from action-minis-locked.md and
// houses-blocks.ts. Same NB2 model, same instruction-following profile.
//   BANNED:   spotlight (as visible fixture), pendant, shaft, beam,
//             streams down, HEAVILY VOLUMETRIC, "light source inside particles",
//             "light from below", glass dome, snowglobe, cloche, bell jar,
//             enclosure, transparent shell
//   PREFERRED: atmospheric haze, luminous quality, diffused,
//              "slightly brighter toward the back-upper area"
//
// Assembled prompt size: ~3,000–3,500 chars depending on atmosphere.

import type { EnvironmentId, AtmosphereId } from './landscape-shared'

// ═══════════════════════════════════════════════════════════════
// 1. ALWAYS-ON STACK
// ═══════════════════════════════════════════════════════════════

// COLLECTIBLE ANCHOR — sets the register. The artifact is a serious display
// piece, not a toy. The phrase "captured moment, frozen in time" is the
// product framing.
export const COLLECTIBLE_ANCHOR_BLOCK = `
This is a precision handcrafted miniature — a keepsake object. A real physical scale model: sculpted, painted, built. The kind that sits on a collector's shelf or a curated mantle. Every surface has the tactile authority of a real material. The miniature captures a moment of a specific real place, frozen in time, presented as a precious display piece.
`.trim()

// PLINTH BLOCK — the product's defining visual element. The "trophy base"
// framing pulls NB2 toward gallery-collectible priors. The "scene rises
// freely into open air" language displaces the snowglobe instinct
// architecturally rather than through negation. The EDGE TREATMENT
// section is new in this rewrite — addresses the GPT-winner signature
// where terrain wraps over the plinth lip.
export const PLINTH_BLOCK = `
PLINTH:
The scene sits on a circular dark walnut plinth — turned wood, thick and substantial, with a clean rounded edge profile like a trophy base or museum display block. Warm chocolate-brown grain visible. The full plinth is in frame including its bottom rim, never cropped at any edge.

The scene rises freely from the plinth top into open air. Trees, terrain, water, and structures extend up and outward into the open space above. The plinth holds the moment up; it does not contain it.

EDGE TREATMENT:
The terrain is grown into the plinth, not glued onto it. Ground material — grass, soil, sand, moss, gravel as the place dictates — wraps slightly over the upper lip of the plinth, with a few blades of grass, a small root, or a stone or two extending just past the rim. The scene and the plinth feel like one continuous handcrafted object.
`.trim()

// SUBJECT COMMAND — pulls the place's defining feature into a dominant
// position on the plinth. New in the rewrite. Addresses cases where the
// subject was off-center and the scene looked accidental rather than composed.
export const SUBJECT_COMMAND_BLOCK = `
THE SUBJECT COMMANDS THE SCENE:
The defining feature of the place — the bridge, the ruin, the pier, the path, the standing tree, whatever the source's hero element is — sits dominant and central on the plinth. Surrounding terrain composes around it as supporting cast: leading lines toward it, framing vegetation around it, complementary materials beneath it. The hero element reads first; everything else supports.
`.trim()

// PLACE FIDELITY — Landscapes analog of Houses' STRUCTURE_FIDELITY_BLOCK.
// Backstops the pixel inheritance NB2 image-to-image already provides.
// Without this NB2 drifts toward generic-example-of-category outputs.
export const PLACE_FIDELITY_BLOCK = `
PLACE IDENTITY:
The source image is the absolute ground truth. Preserve what makes THIS specific place identifiable — the specific colors, the specific surface character, the unique structural or geological quirks, the overall mood. If the source shows a sea grotto, render THIS sea grotto with its specific arch and water color, not a generic example of its category. Distinctive features take priority over softening from style or scale.
`.trim()

// CAMERA — same product photography register as Houses. The `standard` profile
// is the proven 35-50° angle used in the GPT winners. The `low_profile` profile
// is operator-tagged compensation for sources where the subject is wide and
// ground-level (road, beach, flat horizon). NB2 image-to-image preserves source
// proportions, so a flat-horizon source tends to render with a 2D backdrop prop
// in the upper canvas (the source itself reproduced as a panel painting). The
// low-profile camera tilts steeper to push the horizon down and adds explicit
// language: foreground is the hero, no invented backdrops.
export function buildCameraBlock(profile: 'standard' | 'low_profile' = 'standard'): string {
  if (profile === 'low_profile') {
    return `
CAMERA:
Macro product photography. Camera positioned 45–60 degrees above the plinth, angled steeply downward. The plinth top reads as a clear oval — the top surfaces of the model dominate the frame. The plinth and model in razor-sharp focus; the environment beyond softly out of focus. Foreground crisp, midground softening, background dissolved into atmospheric depth.

LOW-PROFILE SCENE:
The source's subject is naturally low-profile — horizontal and ground-level (a road, a beach, a path, a flat horizon). The miniature reads as a 3D landscape filling the plinth surface in depth: terrain, ground material, paths, low vegetation, scattered features arranged across the plinth top. The foreground IS the hero. Do not invent vertical structures, mountain ranges, building skylines, or background panels not present in the source. Do not render any portion of the scene as a 2D print, painting, photograph, panel, or backdrop standing on the plinth — every element of the miniature is fully sculpted in three dimensions. The upper canvas above the model fades into the room's atmospheric depth and bokeh.
`.trim()
  }
  return `
CAMERA:
Macro product photography. Camera positioned 35–50 degrees above the plinth, angled downward. Top surfaces visible (treetops, water surface, plinth top reading as oval). The plinth and model in razor-sharp focus; the environment beyond softly out of focus. Foreground crisp, midground softening, background dissolved into atmospheric depth.
`.trim()
}

// Legacy alias for any code still importing CAMERA_BLOCK as a constant.
export const CAMERA_BLOCK = buildCameraBlock('standard')

// COMPOSITION — canvas-relative scale. Plinth-internal ratios (scene-on-plinth)
// intentionally left to NB2.
export function buildCompositionBlock(scaleId: 'close_up' | 'zoom_out'): string {
  const scaleSpec = scaleId === 'close_up'
    ? 'The model and its plinth together occupy approximately 80% of the image canvas width — the subject fills most of the frame, close and intimate, every material detail readable. About 10% breathing room on each side between the plinth edge and the image edge.'
    : 'The model and its plinth together occupy approximately 65% of the image canvas width — the subject sits centered with generous space around it, room to breathe and read the surrounding environment. About 17–18% breathing room on each side.'
  return `
COMPOSITION:
${scaleSpec}

The full circular plinth is visible — never cropped at any edge.
`.trim()
}

// ═══════════════════════════════════════════════════════════════
// 2. ENVIRONMENT BLOCKS
// ═══════════════════════════════════════════════════════════════

const IN_SITU_BLOCK = `
ENVIRONMENT — IN SITU AT THE PLACE:
The plinth sits directly on the ground at the place itself — on rock, sand, forest floor, the actual terrain that surrounds this scene in the real world. A sea grotto's plinth sits on wet dark rock; a forest scene's plinth sits on leaf-litter and earth; a beach's plinth sits on sand.

Beyond the plinth, the actual full-scale environment recedes into atmospheric depth — the same place the miniature depicts, extending out into soft painterly bokeh. Recognizable as the place but not in detail. The miniature is a captured moment of the place, displayed within the place itself.
`.trim()

const DESK_BLOCK = `
ENVIRONMENT — ON DESK:
The plinth sits on a large dark walnut desk — book-matched grain, deep satin finish, the desk surface extending well beyond the plinth in every direction. The desk surface holds a soft reflection of the plinth and the lower part of the model. A hardcover book lies open to one side, reading glasses folded nearby.

The room beyond is a warm study softly out of focus — bookshelves, framed paintings, the edge of a chair visible — everything in soft warm bokeh, subordinate to the artifact. Warm directional daylight wraps the model from one side. No visible light fixtures in the frame.
`.trim()

const GALLERY_BLOCK = `
ENVIRONMENT — GALLERY DISPLAY:
The plinth sits on a clean neutral display surface in a quiet exhibition space — pale stone or polished concrete underfoot, clean walls receding into soft neutral bokeh behind. No furniture, no domestic context. The room is hushed and attentive, devoted to the object.

A single directional gallery light from above-front illuminates the model with soft falloff around the curved plinth. Atmospheric haze in the room air, slightly brighter toward the back-upper area, contributes a luminous quality. The miniature is the sole subject, presented and venerated.
`.trim()

export const ENVIRONMENT_BLOCKS: Record<EnvironmentId, string> = {
  in_situ: IN_SITU_BLOCK,
  desk:    DESK_BLOCK,
  gallery: GALLERY_BLOCK,
}

// ═══════════════════════════════════════════════════════════════
// 3. ATMOSPHERE BLOCKS
// ═══════════════════════════════════════════════════════════════
// Rewritten in the long-form descriptive voice. Each describes the light
// quality, the surface effect on the model, and the resulting mood —
// without ANTI-INSTRUCTION lists. ~250-350 chars each (down from ~400-500).
// All ten registered; only `golden` exposed in v1 UI.
//
// Common signature: warm rim accents preserved on the model even in cool
// atmospheres. The plinth's warmth + warm rim on the model is a hallmark
// of the GPT winners.

const ATMOSPHERE_GOLDEN = `
ATMOSPHERE — GOLDEN HOUR:
Warm low-angle sunlight from the back-upper area, the color of late afternoon. Long soft shadows lay across the scene at low angle. Warm orange-gold highlights on lit surfaces, cooler purple-blue tones in shadow recesses. Atmospheric haze warmed by the low sun, slightly brighter toward where the sun sits behind the scene. The luminous quality reads from warm directional light interacting with surfaces. The scene feels nostalgic, captured at its most beautiful moment.
`.trim()

const ATMOSPHERE_PEACEFUL_DAWN = `
ATMOSPHERE — PEACEFUL DAWN:
First light just breaking — soft cool light with warm undertone at the horizon. Mist rising from low areas, soft and quiet. Atmospheric haze diffused throughout, slightly brighter toward where dawn breaks. Subtle warmth on lit faces, the rest cool and shadowed. Light feels new, the world barely awake. The scene is contemplative, captured at its quietest moment. Warm rim accents remain on the model itself.
`.trim()

const ATMOSPHERE_VIVID_MIDDAY = `
ATMOSPHERE — VIVID MIDDAY:
Bright clear midday sunlight — saturated colors at peak clarity, the place at its most alive. Sun near-overhead with crisp short shadows. Atmospheric haze present but minimal, lending only slight luminous quality. The scene reads with maximum legibility, every detail crisp, color saturation high. Sky reads bright and clean. Warm tones dominate the palette.
`.trim()

const ATMOSPHERE_DUSK_BLUE_HOUR = `
ATMOSPHERE — DUSK / BLUE HOUR:
The transition from day to night — warm horizon glow meeting cool blue sky overhead. Warm orange-pink light along the western edge of the scene, cooler twilight blues elsewhere. Atmospheric haze cooler than golden hour, slightly brighter toward the horizon where the sun has set. Long soft shadows, cooler than at golden hour. The scene feels suspended between worlds — nostalgic and quiet, the day's last warm light surrendering to night's blue.
`.trim()

const ATMOSPHERE_DRAMATIC_STORM = `
ATMOSPHERE — DRAMATIC STORM:
Moody cinematic atmosphere — heavy weather, raw natural power. Dark thunderclouds above with one warm break of light cutting through cloud cover and landing on the scene. The lit area glows in the breakthrough light; surrounding areas in cool stormy shadow. Atmospheric haze charged with weather, slightly brighter where the breakthrough lands. The scene has weight and intensity, captured at a moment of natural drama. Warm rim accents preserve on the model itself.
`.trim()

const ATMOSPHERE_DEEP_NIGHT = `
ATMOSPHERE — DEEP NIGHT:
The scene at full night. Cool moonlight from above provides soft directional silver-blue illumination, picking up surfaces along its raking path. Stars visible in the sky behind. Atmospheric haze cool and diffused, slightly brighter toward the back-upper area where the moon sits. Where natural points of light exist in the place — water reflections, distant warmth — they glow as small warm accents against the cool field. The scene is held in cool blue moonlight, every surface readable but softly.
`.trim()

const ATMOSPHERE_FOG_ROLLED_IN = `
ATMOSPHERE — FOG ROLLED IN:
Heavy diffuse fog throughout the scene — soft cool light without clear directional source. Visibility drops with distance: foreground clear and detailed, background dissolving into pale grey. Atmospheric haze dominant, slightly brighter toward the back-upper area where light filters through fog density. Surface contrast muted; colors cool and desaturated. The scene feels hushed, mysterious, the place revealed in fragments rather than entirety. Warm rim accents preserve on the model itself.
`.trim()

const ATMOSPHERE_AFTER_RAIN = `
ATMOSPHERE — AFTER RAIN:
The rain has just stopped — surfaces wet and reflective, light breaking through clearing clouds. Warm directional sunlight from a partial break in the sky rakes across wet surfaces with strong specular highlights. Water beads on leaves, puddles reflect the breaking sky, every surface darkened and saturated by moisture. Atmospheric haze damp and luminous, slightly brighter where the sun breaks through. The scene feels fresh, washed, captured in a moment of relief.
`.trim()

const ATMOSPHERE_SNOW_FALLING = `
ATMOSPHERE — SNOW FALLING:
Active snowfall throughout the scene — soft snowflakes drifting down at varied depth, some near the camera in soft focus, others further back. Soft cool diffused light, the sky pale grey with subtle warmth where the sun pushes through. Surfaces dusted and accumulating snow. Atmospheric haze cool and luminous, slightly brighter toward the back-upper area where light filters through the snow. The scene is hushed and still, captured in the quiet of snowfall. Warm rim accents preserve on the model itself.
`.trim()

const ATMOSPHERE_AURORA_SURREAL = `
ATMOSPHERE — AURORA / SURREAL:
A night sky alive with aurora — bands of green and violet light dancing overhead, cool and otherworldly. The aurora's color reflects faintly onto the scene below, lit primarily by moonlight with aurora-tinted secondary glow. Atmospheric haze cool and luminous, picking up subtle green-violet color shifts. Stars visible behind the aurora bands. The scene feels surreal and held — a moment of natural magic. Warm rim accents preserve on the model itself.
`.trim()

export const ATMOSPHERE_BLOCKS: Record<AtmosphereId, string> = {
  golden:         ATMOSPHERE_GOLDEN,
  peaceful_dawn:  ATMOSPHERE_PEACEFUL_DAWN,
  vivid_midday:   ATMOSPHERE_VIVID_MIDDAY,
  dusk_blue_hour: ATMOSPHERE_DUSK_BLUE_HOUR,
  dramatic_storm: ATMOSPHERE_DRAMATIC_STORM,
  deep_night:     ATMOSPHERE_DEEP_NIGHT,
  fog_rolled_in:  ATMOSPHERE_FOG_ROLLED_IN,
  after_rain:     ATMOSPHERE_AFTER_RAIN,
  snow_falling:   ATMOSPHERE_SNOW_FALLING,
  aurora_surreal: ATMOSPHERE_AURORA_SURREAL,
}

// ═══════════════════════════════════════════════════════════════
// 4. PRESET MATERIAL RULES — "as itself" (Natural path)
// ═══════════════════════════════════════════════════════════════

// AS ITSELF — the realistic miniature treatment.
// Voice tightened to match the rest of the always-on stack.
export const MATERIAL_AS_ITSELF = `
MATERIAL — HONEST MINIATURE CRAFT:
The miniature is built from real scale-model materials. Water as sculpted miniature resin with depth and surface detail. Rock as sculpted painted resin with authentic weathering — mossy, lichen-marked, weathered as the source shows. Soil and sand as textured terrain materials at correct scale. Vegetation as precision miniature foliage with sculpted trunk and individual branch detail. Built elements as painted wood and resin at scale, structurally accurate to the source. Atmospheric elements (mist, light, spray) as physical effects, never as graphic overlays. Highly detailed throughout. Museum-quality craft.
`.trim()

// LIGHTING for as_itself when no environment-specific override applies.
// Governs how light reads on the model itself, distinct from the atmosphere
// block which governs the broader scene character.
export const LIGHTING_AS_ITSELF = `
LIGHTING ON THE MODEL:
Soft directional natural light wraps the model — warm on the lit faces, gradual falloff into the shaded sides. Surface materials catch the light with appropriate specularity: water surfaces with bright highlights, rock with matte reads, foliage with subtle sheen. Every miniature material reads true under the light.
`.trim()

// PALETTE — appended to all renders, regardless of atmosphere. The GPT
// winners share this signature: warm-dominant palette anchored by the
// plinth's chocolate-brown, warm rim accents preserved even in cool
// atmospheres.
export const PALETTE_BLOCK = `
PALETTE:
Warm-dominant — walnut plinth, warm light wraps, earth tones in the terrain. Even in cool atmospheres (fog, dawn, blue hour, deep night), warm rim accents remain on the model itself. The plinth's chocolate-brown grain anchors the warmth across the whole image.
`.trim()

// ═══════════════════════════════════════════════════════════════
// 5. NIGHT-OVERRIDE BLOCK
// ═══════════════════════════════════════════════════════════════
// Composed in when TOD resolves to night. Mirrors houses' NIGHT_OVERRIDE_BLOCK.

export const NIGHT_OVERRIDE_BLOCK = `
TIME OF DAY — NIGHT:
The scene is at night. Cool moonlight provides primary directional silver-blue illumination on the model from above. Where natural points of warmth exist in the place (water reflections of distant light, embers in a fire scene, lit windows in an architectural element), they glow as small warm accents against the cool moonlit field. Deep night atmosphere everywhere outside the lit pools. No visible light fixtures in frame.
`.trim()

// Atmospheres that bring their own night lighting — skip the override
// to avoid double-lighting language conflict.
const NIGHT_OVERRIDE_SKIP: AtmosphereId[] = ['deep_night', 'aurora_surreal']

export function shouldApplyNightOverride(atmosphere: AtmosphereId): boolean {
  return !NIGHT_OVERRIDE_SKIP.includes(atmosphere)
}

// ═══════════════════════════════════════════════════════════════
// 6. PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════
// Houses-pattern assembly. Order matters — earlier blocks get more
// attention from NB2.
//
// Final block order:
//   1.  COLLECTIBLE_ANCHOR     — what the artifact is
//   2.  PLINTH                 — the plinth, the edge treatment
//   3.  SUBJECT_COMMAND        — composition of scene on plinth
//   4.  PLACE_FIDELITY         — preserve THIS place
//   5.  CAMERA                 — framing register
//   6.  COMPOSITION            — canvas-relative scale
//   7.  material rule          — what it's made of (per-preset)
//   8.  environment block      — where it sits
//   9.  atmosphere block       — light/weather character
//  10.  lighting on model      — how light reads on the artifact
//  11.  PALETTE                — warm-dominant signature
//  12.  NIGHT_OVERRIDE         — only if TOD resolves to night
//  13.  preset framing line    — short closing register

import type { Preset, ScaleId, TimeOfDay, SourceProfileId } from './landscape-shared'
import { resolveEnvironment, resolveTimeOfDay } from './landscape-shared'

export function buildLandscapePrompt(input: {
  preset:             Preset
  environmentId:      EnvironmentId
  atmosphereId:       AtmosphereId
  scaleId:            ScaleId
  timeOfDay:          TimeOfDay
  sourceProfileId?:   SourceProfileId
  lightingVariantId?: string
}): string {
  const env = resolveEnvironment(input.preset, input.environmentId)
  const tod = resolveTimeOfDay(input.preset, input.atmosphereId, input.timeOfDay)
  const envBlock         = ENVIRONMENT_BLOCKS[env]
  const atmosphereBlock  = ATMOSPHERE_BLOCKS[input.atmosphereId]
  const compositionBlock = buildCompositionBlock(input.scaleId)
  const cameraBlock      = buildCameraBlock(input.sourceProfileId || 'standard')

  // Resolve lighting — env-specific override > variant pick > preset default
  let lightingBlock: string
  const envLighting = input.preset.lightingByEnvironment?.[env]
  if (typeof envLighting === 'string') {
    lightingBlock = envLighting
  } else if (envLighting?.variants?.length) {
    const variant =
      envLighting.variants.find(v => v.id === input.lightingVariantId)
      || envLighting.variants[0]
    lightingBlock = variant.block
  } else {
    lightingBlock = input.preset.lighting
  }

  // Short preset framing line — mirrors action-minis/houses NB2 format.
  const presetLine =
    `highly accurate highly detailed. ${input.preset.sculptureClause} ${input.preset.styleClause} Style: premium collectible miniature landscape.`

  const blocks: string[] = [
    COLLECTIBLE_ANCHOR_BLOCK,
    PLINTH_BLOCK,
    SUBJECT_COMMAND_BLOCK,
    PLACE_FIDELITY_BLOCK,
    cameraBlock,
    compositionBlock,
    input.preset.materialRule,
    envBlock,
    atmosphereBlock,
    lightingBlock,
    PALETTE_BLOCK,
  ]

  if (tod === 'night' && shouldApplyNightOverride(input.atmosphereId)) {
    blocks.push(NIGHT_OVERRIDE_BLOCK)
  }

  blocks.push(presetLine)

  return blocks.join('\n\n')
}
