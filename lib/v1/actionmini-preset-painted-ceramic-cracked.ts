// actionmini-preset-painted-ceramic-cracked.ts
// lib/v1/actionmini-preset-painted-ceramic-cracked.ts
//
// PRESET: PAINTED CERAMIC SCULPTURE WITH CRACKS, TIMELESS
// SCENE:  CURATOR'S STUDY DESK
//
// Glazed-and-painted ceramic figure showing CRAQUELURE — the fine network of
// hairline cracks in old porcelain glazes. Painted color is intact; the glaze
// has aged. Like Royal Doulton or Meissen pieces a century old.

import {
  ActionMiniSharedInput,
  KINETIC_INTENSITY_BLOCK,
  MEDIUM_EFFECTS,
  buildPoseBlock,
  buildSecondaryBlock,
  buildIdentityLines,
  CORE_HIERARCHY_DOMINANT,
  MUSEUM_DESK_SCENE,
  CAMERA_DOMINANT,
  COMPOSITION_DOMINANT,
  buildFeaturesBlock,
  buildNotesBlock,
} from './actionmini-shared'

const MATERIAL_BLOCK = `MATERIAL — PAINTED GLAZED CERAMIC WITH CRAQUELURE (TIMELESS):

THE CONCEIT:
The figure and sculpted scene are rendered as a FINE PAINTED GLAZED CERAMIC sculpture in the tradition of Royal Doulton, Meissen, or Capodimonte figurines — but a CENTURY OLD, with the unmistakable network of hairline cracks (CRAQUELURE) in the glaze. The painted color beneath is intact and vivid; the glaze on top has crazed with age. The piece reads as a treasured antique heirloom.

CERAMIC SURFACE READ:
- Glazed surface: smooth, slightly glossy ceramic glaze covering the sculpted form
- Painted color: vivid colors visible UNDER the glaze — hand-painted detail with the small brushwork inconsistencies of a Victorian or Edwardian-era ceramic painter
- CRAQUELURE: a fine WEB OF HAIRLINE CRACKS across the entire glazed surface, forming an irregular polygon network. The cracks are SHALLOW (in the glaze, not the ceramic body underneath) but clearly visible — they look like the surface of an old oil painting or antique porcelain
- Color depth: the glaze gives painted areas a slight WET LOOK at full saturation, like color seen through a thin layer of glass
- Edges: clean, crisp — ceramic CAN hold a sharp edge — fabric folds and gear contours are well-defined
- Highlights: glossy speculars where the glaze catches the key light — focused, bright, almost wet-looking
- Hand-painted character: the small irregularities of a hand painter — slightly varying line weights, occasional tiny paint pool, small color variations within a single area
- DO NOT make the piece appear damaged or aged into ugliness — the craquelure is the BEAUTY of the antique state, like a fine wine maturing

THE PLATE:
Same wide oval walnut display plate. The plate stays walnut for this preset (the antique-ceramic figurine sits on the same warm wooden base it would in a curator's display case).

KINETIC EFFECT MATERIAL — ALSO GLAZED CERAMIC:
Spray, dust, particulate, water sculpted on the plate are also rendered in painted glazed ceramic — translucent blue-green glazed ceramic for water with foam in white-glazed ceramic, fine glazed ceramic dust particles, painted ceramic foam. The whole sculpt above the walnut is unified in the painted-ceramic medium, with craquelure visible on every glazed surface.

LIGHTING TARGET:
The directional key light produces sharp small specular highlights where it strikes the glaze — almost wet-looking pinpoints. The craquelure network catches in oblique light and reads as fine darker lines across the colored surfaces. The painted color depth feels rich and aged.`

function buildIdentityLock(input: ActionMiniSharedInput): string {
  const lines = buildIdentityLines(input.hero)
  if (lines.length === 0) {
    return `HERO — PAINTED GLAZED CERAMIC FIGURE (CRAQUELURE):
Render as a fine antique painted ceramic miniature in the tradition of Royal Doulton or Meissen — but with the network of hairline cracks (craquelure) of a century-old glaze. Color intact and vivid; glaze aged.`
  }

  return `HERO — ANTIQUE PAINTED CERAMIC FIGURE (GESTALT-LEVEL LIKENESS):

At this small scale the hero is recognized by GEAR COLORS painted under the glaze, POSE, and the unmistakable hand-painted character of antique ceramic figurines.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- GEAR COLORS are the primary identity anchor — every named source color carries through as hand-painted color under the glaze.
- POSE is the secondary anchor.
- Hand-painted character: small painter\'s irregularities are part of the charm, not a flaw.
- Face reads as a fine antique ceramic figurine face — small hand-painted features, slightly idealized in the Victorian/Edwardian convention.
- Craquelure is on EVERY glazed surface — universal across the figure, not localized.`
}

const MOODS: Record<string, string> = {
  golden: `MOOD: Warm afternoon sunlight from off-screen window-left. The glaze catches focused warm specular highlights; the craquelure network reads delicate against the warm-painted color. Long warm shadows on the desk. The room glows.`,
  dramatic: `MOOD: Strong directional sunlight from off-screen window-left. The glaze speculars are bright and tight; the craquelure shows in oblique light against the painted color; shadows deep enough to give the figurine full sculptural weight. Antique drama.`,
  vivid: `MOOD: Bright clean morning light from off-screen window-left. Painted colors at full saturation under the aged glaze; craquelure crisp against the vivid surface; the antique character at its most legible.`,
}

const PHOTO_FRAME = `PHOTOGRAPHIC STYLE — ANTIQUES AUCTION CATALOG:

LIGHTING per mood. The interplay of bright glaze speculars with the fine craquelure network is the surface signature.

LENS: Medium-format macro. Painted brushwork detail and craquelure cracks both crisp at close inspection.

COLOR: Painted color under the aged glaze — vivid, depth-rich, slightly mellowed by time. Warm desk and curator's-study tones around it.

QUALITY: Like a photograph from a Sotheby\'s catalog of antique European ceramics — refined, treasured, quietly precious.`

export function buildPaintedCeramicCrackedPrompt(input: ActionMiniSharedInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const features  = buildFeaturesBlock(input.distinctiveFeatures)
  const notes     = buildNotesBlock(input.notes)

  return [
    'Transform the provided image into a fine PAINTED GLAZED CERAMIC action diorama on a wide oval walnut display plate, photographed as a treasured antique on a polished walnut desk in a curator\'s study. The piece shows characteristic CRAQUELURE — the network of fine hairline cracks in a century-old glaze. Painted color underneath is intact and vivid. Like an antique Royal Doulton or Meissen figurine matured into beauty.',
    CORE_HIERARCHY_DOMINANT,
    MATERIAL_BLOCK,
    identity,
    pose,
    KINETIC_INTENSITY_BLOCK,
    effects,
    secondary,
    features,
    MUSEUM_DESK_SCENE,
    COMPOSITION_DOMINANT,
    CAMERA_DOMINANT,
    mood,
    PHOTO_FRAME,
    notes,
  ].filter(Boolean).join('\n\n')
}
