// actionmini-preset-mixed-metals.ts
// lib/v1/actionmini-preset-mixed-metals.ts
//
// PRESET: MIXED METALS — copper, brass, bronze, pewter, titanium
// SCENE:  GALLERY PEDESTAL
//
// A virtuoso multi-metal sculpture where different metals are used to
// distinguish different elements of the figure and scene. Curated, formal,
// gallery-grade.

import {
  ActionMiniSharedInput,
  KINETIC_INTENSITY_BLOCK,
  MEDIUM_EFFECTS,
  buildPoseBlock,
  buildSecondaryBlock,
  buildIdentityLines,
  CORE_HIERARCHY_DOMINANT,
  GALLERY_PEDESTAL_SCENE,
  CAMERA_DOMINANT,
  COMPOSITION_DOMINANT,
  buildFeaturesBlock,
  buildNotesBlock,
} from './actionmini-shared'

const MATERIAL_BLOCK = `MATERIAL — MIXED METALS SCULPTURE (COPPER, BRASS, BRONZE, PEWTER, TITANIUM):

THE CONCEIT:
This is a virtuoso multi-metal sculpture in which DIFFERENT METALS distinguish different elements of the figure and the scene. The metalsmith has chosen each material for its color, weight, and reflective character. The result reads as a fine-art-craft piece — the kind of object you'd see in a contemporary gallery's metalwork collection.

THE METAL PALETTE — APPLY DELIBERATELY:
- COPPER (warm pinkish-orange, takes verdigris in deep recesses): use for skin, exposed flesh tones, warm clothing details
- BRASS (warm yellow-gold, brighter than bronze): use for bright gear elements, helmets, polished hardware, gold-toned details from the source
- BRONZE (deep amber-brown, classical): use for the sculpted base, heavy structural elements, the plate itself
- PEWTER (cool dull silver-grey, matte): use for fabric/clothing in muted source colors, neutral garments, the kinetic effect material (spray, dust)
- TITANIUM (cool steel-blue with iridescent oil-slick highlights, slightly anodized): use for accent details, technical gear, eyewear, anything that was bright cool/blue in the source — provides visual punctuation

THE LOGIC:
Map each named color and material from the source to the closest metal in this palette. Reds and warm flesh → copper. Yellows and gold → brass. Browns and warm earth → bronze. Greys and muted neutrals → pewter. Blues and cool accents → titanium. Use this mapping consistently throughout.

SURFACE CHARACTER:
Each metal shows ITS OWN surface treatment:
- Copper: polished pink-orange high points, green verdigris in recesses
- Brass: bright golden highlights, slight tarnish in low spots
- Bronze: classical patina (warm brown to dark green), polished tool marks
- Pewter: matte silver-grey, soft surface, no high speculars
- Titanium: cool iridescent surface with oil-slick blue-purple-gold shifts where light catches

The PIECES MEET at clean joins — the metalsmith's skill is visible in how cleanly the metals butt up against each other. Slight color contrast at every join is part of the visual richness.

THE PLATE:
A wide oval BRONZE plate (consistent with bronze's role as structural metal in this palette). Rich classical bronze with patina settled in low areas; polished smooth on top where the sculpt sits.

KINETIC EFFECT MATERIAL:
Kinetic effects rendered primarily in PEWTER (cool grey, reads as misty/atmospheric) — pewter spray, pewter dust, pewter foam. This keeps the warm-metal palette concentrated on the figure and base while the kinetic energy reads as cool atmospheric haze.

LIGHTING TARGET:
Each metal responds differently to the directional gallery light — copper warm-glowing, brass bright-singing, bronze rich-tonal, pewter quietly absorbing, titanium iridescent shifting. The diorama is a small symphony of metallic surface responses.`

function buildIdentityLock(input: ActionMiniSharedInput): string {
  const lines = buildIdentityLines(input.hero)
  if (lines.length === 0) {
    return `HERO — MIXED METALS FIGURE:
Render as a virtuoso mixed-metals miniature. Different metals distinguish different parts of the figure following the metal palette logic.`
  }

  return `HERO — MIXED METALS FIGURE (GESTALT-LEVEL LIKENESS):

At this small scale the hero is recognized by POSE, SILHOUETTE, and the DELIBERATE METAL CHOICES that map source colors to the metal palette.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- POSE is the primary anchor.
- SOURCE COLOR → METAL MAPPING (apply consistently):
  - Reds, warm pinks, flesh tones → COPPER
  - Yellows, golds, bright warm gear → BRASS
  - Browns, warm earth tones → BRONZE
  - Greys, muted neutrals, fabric → PEWTER
  - Blues, cool accents, technical gear → TITANIUM
- Each named gear color from source maps to the closest metal.
- The METALS THEMSELVES are the visual identity — a viewer should be able to scan the figure and understand which metal renders which part.`
}

const MOODS: Record<string, string> = {
  golden: `MOOD: Warm gallery spotlight — slightly warm-toned overhead key. Copper and brass elements glow rich; titanium iridescence shifts gently in the warm light.`,
  dramatic: `MOOD: Sharp directional gallery spotlight from above-front, well-defined shadows. Each metal at its most sculpturally legible — bright key, deep shade, all the contrast metals hold.`,
  vivid: `MOOD: Cool clean gallery light. Each metal in true color — copper truly orange-pink, brass truly yellow, titanium truly blue-iridescent. Maximum metal palette legibility.`,
}

const PHOTO_FRAME = `PHOTOGRAPHIC STYLE — FINE ART METALWORK CATALOG:

LIGHTING per mood — gallery-grade overhead spotlight, the kind used for fine-art metalwork.

LENS: Medium-format macro. Each metal's surface character (copper warmth, brass shine, bronze patina, pewter matte, titanium iridescence) crisp at close inspection.

COLOR: The metal palette IS the color palette. Warm-cool tonal contrast across the piece, no painted color anywhere.

QUALITY: Contemporary fine-art-craft catalog quality. The piece reads as a serious metalsmith's commission, gallery-presented.`

export function buildMixedMetalsPrompt(input: ActionMiniSharedInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const features  = buildFeaturesBlock(input.distinctiveFeatures)
  const notes     = buildNotesBlock(input.notes)

  return [
    'Transform the provided image into a MIXED-METALS sculptural action diorama (copper, brass, bronze, pewter, and titanium combined) on a bronze plate, photographed on a gallery pedestal in a quiet exhibition space. Each metal distinguishes different elements of the figure following a deliberate color-to-metal mapping. Fine-art metalwork catalog quality.',
    CORE_HIERARCHY_DOMINANT,
    MATERIAL_BLOCK,
    identity,
    pose,
    KINETIC_INTENSITY_BLOCK,
    effects,
    secondary,
    features,
    GALLERY_PEDESTAL_SCENE,
    COMPOSITION_DOMINANT,
    CAMERA_DOMINANT,
    mood,
    PHOTO_FRAME,
    notes,
  ].filter(Boolean).join('\n\n')
}
