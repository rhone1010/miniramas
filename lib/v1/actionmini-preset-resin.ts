// actionmini-preset-resin.ts
// lib/v1/actionmini-preset-resin.ts
//
// PRESET: PAINTED RESIN (the existing/default material)
// SCENE:  OUTDOOR — the action's native environment from the source photo
//
// This is the canonical Action Mini: a painted resin miniature on a walnut
// plinth, photographed in the real-world setting that the source photograph
// was taken in. Volumetric light, atmospheric depth, found-object editorial.
//
// Refactored from the original actionmini-insitu.ts to share scene/blocks
// with the other 8 presets.

import {
  ActionMiniSharedInput,
  KINETIC_INTENSITY_BLOCK,
  MEDIUM_EFFECTS,
  buildPoseBlock,
  buildSecondaryBlock,
  buildIdentityLines,
  CORE_HIERARCHY_OUTDOOR,
  buildOutdoorScene,
  CAMERA_OUTDOOR,
  COMPOSITION_OUTDOOR,
  buildFeaturesBlock,
  buildNotesBlock,
} from './actionmini-shared'

// ── MATERIAL: PAINTED RESIN ─────────────────────────────────
const MATERIAL_BLOCK = `MATERIAL — PAINTED RESIN MINIATURE:

The figure and the sculpted scene are rendered as MUSEUM-QUALITY PAINTED RESIN — the standard medium of premium hobby and commemorative figures.

SURFACE READ:
- Skin: matte-to-satin painted resin with subtle highlights at cheekbone, brow, and knuckle
- Hair: sculpted strands or mass-form, painted with correct color, slight satin sheen
- Eyes: glossy resin with small catchlights — the darkest darks in the figure
- Clothing and gear: simplified sculpted forms with crisp painted color edges; slight brush-stroke read at close inspection
- Edges where paint meets paint: clean but not surgical — the hand of a skilled hobby painter

KINETIC EFFECT MATERIAL:
All sculpted spray, dust, particulate, water, and terrain on the plate are also resin — translucent green-blue resin in calmer water, opaque white aerated resin in foam, fine resin chips for dust, sculpted resin pebbles. The whole sculpt is one unified medium.

MOOD-LIGHTING TARGET:
Volumetric mood light from the surrounding environment lights the figure on its key side; the shadow side stays warm-soft because of bounce light from the sculpted base. Speculars on the resin are clean and intentional.`

// ── MOOD + VOLUMETRIC LIGHTING (outdoor variant) ────────────
const MOODS: Record<string, string> = {
  golden: `MOOD: Warm golden light — late afternoon sun raking through the expansive environment, honey highlights on the resin, long warm shadows, nostalgic atmosphere.

VOLUMETRIC LIGHTING:
A substantial visible sunbeam / god-ray streams through the environment from upper portion of frame — a dominant shaft of warm golden light cutting through atmospheric depth above and around the diorama. Physically visible in the air over significant frame area.
Where the beam intersects sculpted spray or particulate, it LIGHTS UP — backlit droplets and motes glow golden.
Atmospheric haze throughout mid and far environment. Dust motes drifting in the beam.`,

  dramatic: `MOOD: Dramatic — charged weather, intense directional light, emotionally weighted atmosphere.

VOLUMETRIC LIGHTING:
A single dramatic shaft of light breaks through heavy cloud or dark canopy and lands on the diorama — a theatrical spotlight cutting through expansive atmospheric haze. Beam physically visible over substantial frame area.
Where the beam meets sculpted spray or particulate, droplets and motes spark with backlit intensity.
Moody atmospheric haze throughout — heavy, charged, weather-bearing.`,

  vivid: `MOOD: Bright and vivid — peak midday clarity, saturated color, the action at its most alive.

VOLUMETRIC LIGHTING:
A clean bright sunbeam cuts through light haze with substantial volumetric presence. Environment has bright clean depth.
Where sunlight hits sculpted spray or particulate, droplets and motes gleam sharp and bright.`,
}

// ── PHOTOGRAPHIC FRAME ──────────────────────────────────────
const PHOTO_FRAME = `PHOTOGRAPHIC STYLE — EDITORIAL CINEMATIC SCENE:

LIGHTING:
Soft directional key consistent with the mood's volumetric beam. Painted resin on the diorama catches specular highlights where the beam touches it. Environment softens into atmospheric haze.

LENS:
Medium-format macro equivalent. Diorama front razor sharp, back edge with very slight natural DOF softening. Background softens with depth.

COLOR:
Film-adjacent grading — lifted blacks, warm midtones, restrained highlights.

QUALITY:
Editorial product photography for a premium commemorative collectible — cinematic, natural, intentional, and kinetically alive.`

// ── IDENTITY LOCK (resin-specific header) ───────────────────
function buildIdentityLock(input: ActionMiniSharedInput): string {
  const lines = buildIdentityLines(input.hero)
  if (lines.length === 0) {
    return `HERO — PAINTED RESIN MINIATURE FIGURE:
Render as a museum-quality painted resin miniature appropriate to the source photograph. Gestalt-level likeness — recognizable by general features, age, skin tone, hair, gear — not photographic identity.`
  }

  return `HERO — PAINTED RESIN MINIATURE FIGURE (GESTALT-LEVEL LIKENESS):

At this small scale the hero is recognized by GEAR COLORS, POSE, and ACTION — not photographic face identity.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- GEAR COLORS are the primary identity anchor. Every named color carries through exactly.
- POSE is the secondary anchor. Every limb angle, grip, lean preserved from source.
- Age, skin tone, hair color preserved as paint base.
- Face reads as competent painted miniature — clean features, expression preserved.`
}

// ── MAIN BUILDER ────────────────────────────────────────────
export function buildResinPrompt(input: ActionMiniSharedInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const envBlock  = buildOutdoorScene(input.environment)
  const features  = buildFeaturesBlock(input.distinctiveFeatures)
  const notes     = buildNotesBlock(input.notes)

  return [
    'Transform the provided image into a museum-quality painted resin collectible action diorama on a wide oval walnut display plate, photographed in a real-world outdoor environment with intense kinetic detail. The diorama is sized for KINETIC IMPACT — the action should read clearly while the environment surrounds it as a substantial atmospheric co-subject. A single volumetric sunbeam cuts through the atmospheric depth above.',
    CORE_HIERARCHY_OUTDOOR,
    MATERIAL_BLOCK,
    identity,
    pose,
    KINETIC_INTENSITY_BLOCK,
    effects,
    secondary,
    features,
    envBlock,
    COMPOSITION_OUTDOOR,
    CAMERA_OUTDOOR,
    mood,
    PHOTO_FRAME,
    notes,
  ].filter(Boolean).join('\n\n')
}
