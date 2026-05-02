// actionmini-preset-terracotta-cracked.ts
// lib/v1/actionmini-preset-terracotta-cracked.ts
//
// PRESET: TERRACOTTA WITH CRACKS AND MISSING PIECES
// SCENE:  ARCHAEOLOGICAL SURFACE (weathered)
//
// Unglazed earthenware figure showing the wear of centuries — cracks, missing
// fragments, exposed inner clay. The companion to the Xi'an warriors aesthetic.

import {
  ActionMiniSharedInput,
  KINETIC_INTENSITY_BLOCK,
  MEDIUM_EFFECTS,
  buildPoseBlock,
  buildSecondaryBlock,
  buildIdentityLines,
  CORE_HIERARCHY_DOMINANT,
  ARCHAEOLOGICAL_SURFACE_SCENE,
  CAMERA_DOMINANT,
  COMPOSITION_DOMINANT,
  buildFeaturesBlock,
  buildNotesBlock,
} from './actionmini-shared'

const MATERIAL_BLOCK = `MATERIAL — TERRACOTTA WITH CRACKS AND MISSING PIECES (WEATHERED):

THE CONCEIT:
The figure and sculpted scene are rendered as UNGLAZED TERRACOTTA — the warm orange-red-brown earthenware of the Xi'an warriors, ancient Mediterranean votives, and unfired pottery. The piece shows the WEAR OF CENTURIES: hairline cracks running across surfaces, small fragments missing at edges and corners, and patches where the outer slip has eroded to expose lighter inner clay.

TERRACOTTA SURFACE READ:
- Body color: warm orange-red-brown earthenware base, with natural variation across the figure (some areas slightly darker, some sun-bleached lighter)
- Surface texture: slightly grainy, the unmistakable look of fired clay — neither glazed nor polished
- Hairline cracks: a network of fine cracks across larger surfaces (back, chest, base of figure) — not destructive, but VISIBLE evidence of age
- Larger cracks: occasional deeper fissures running through limbs or fabric folds — still structurally intact but clearly aged
- MISSING FRAGMENTS: small chips at edges, corners, exposed extremities (a fingertip, a corner of fabric, the rim of a helmet, an edge of the plate). The MISSING piece reveals the slightly LIGHTER, UNSEALED INTERIOR CLAY underneath.
- Wear patterns: high points slightly polished by handling/time; low points and undercuts collect dusty residue
- DO NOT make the figure appear destroyed or grotesque — the damage is HONEST AGING, not violence. The piece is intact, beautiful, and weathered.

THE PLATE:
The plate IS terracotta in this preset — wide oval terracotta base, slightly darker fired tone than the figure above. It carries the same network of hairline cracks. A small chip at one edge of the plate is acceptable. Walnut DOES NOT appear in this preset — the entire piece is terracotta.

KINETIC EFFECT MATERIAL — ALSO TERRACOTTA:
Spray, dust, particulate, water sculpted on the plate are also rendered in terracotta — slightly lighter or sun-bleached terracotta for spray (suggesting evaporated mineral residue), pure terracotta dust for dust (which is, of course, exactly what terracotta dust looks like), small fragmentary particles. The kinetic energy is captured in clay.

LIGHTING TARGET:
Warm directional sunlight catches the slightly grainy clay surface. Cracks read as fine dark lines. Missing-piece exposures show slightly cooler-toned interior clay. The whole piece glows warm in afternoon light — sun on ancient earth.`

function buildIdentityLock(input: ActionMiniSharedInput): string {
  const lines = buildIdentityLines(input.hero)
  if (lines.length === 0) {
    return `HERO — TERRACOTTA FIGURE WITH CRACKS:
Render as a weathered terracotta miniature in the tradition of the Xi'an warriors. Hairline cracks visible; small missing fragments expose lighter inner clay. Honest aging, not damage.`
  }

  return `HERO — WEATHERED TERRACOTTA FIGURE (GESTALT-LEVEL LIKENESS):

At this small scale and in this medium, the hero is recognized by POSE and SILHOUETTE — terracotta is monochromatic, no painted color.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- POSE is the primary anchor.
- GEAR is sculpted in terracotta, identifiable by FORM not color.
- Hair sculpted as terracotta mass.
- Face: competent terracotta sculpture — features clean, expression preserved.
- Aging is part of the identity: hairline cracks and small chips at edges are expected and beautiful.
- DO NOT add destructive damage — the figure is intact, just ancient.`
}

const MOODS: Record<string, string> = {
  golden: `MOOD: Warm late-afternoon sun on weathered terracotta. The clay glows orange-gold; cracks catch slight shadow. Long warm shadows on the archaeological surface. Sense of timeless heat.`,
  dramatic: `MOOD: Strong directional afternoon sun, well-defined shadows. The terracotta's warm color sings; cracks read sharp; the contrast between sun-side and shade-side gives the figure full weight. Slight atmospheric heat haze.`,
  vivid: `MOOD: Bright clean midday sun on terracotta. The clay color at maximum — pure warm orange-red, every surface detail crisp. Less atmospheric romance, more archaeological clarity.`,
}

const PHOTO_FRAME = `PHOTOGRAPHIC STYLE — ARCHAEOLOGICAL CATALOG:

LIGHTING per mood — warm natural sunlight, the kind used for documenting field discoveries.

LENS: Medium-format macro. The slight grain of terracotta surface and the fine cracks both crisp at close inspection.

COLOR: Warm earthen palette throughout. The piece reads as one continuous warm orange-brown surface with subtle variation.

QUALITY: Like a photograph from a museum-of-antiquities catalog or an archaeological field report — but with full editorial photographic care.`

export function buildTerracottaCrackedPrompt(input: ActionMiniSharedInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const features  = buildFeaturesBlock(input.distinctiveFeatures)
  const notes     = buildNotesBlock(input.notes)

  return [
    'Transform the provided image into a WEATHERED TERRACOTTA action diorama on a wide oval TERRACOTTA plate (no walnut in this preset), photographed on an archaeological surface in warm afternoon light. The figure shows the wear of centuries: hairline cracks across surfaces, small missing fragments at edges exposing lighter inner clay, slight surface grain. Honest aging, not destruction. Like a small Xi\'an warrior captured mid-action.',
    CORE_HIERARCHY_DOMINANT,
    MATERIAL_BLOCK,
    identity,
    pose,
    KINETIC_INTENSITY_BLOCK,
    effects,
    secondary,
    features,
    ARCHAEOLOGICAL_SURFACE_SCENE,
    COMPOSITION_DOMINANT,
    CAMERA_DOMINANT,
    mood,
    PHOTO_FRAME,
    notes,
  ].filter(Boolean).join('\n\n')
}
