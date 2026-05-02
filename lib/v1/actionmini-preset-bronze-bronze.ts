// actionmini-preset-bronze-bronze.ts
// lib/v1/actionmini-preset-bronze-bronze.ts
//
// PRESET: BRONZE MINIATURE ON A BRONZE BASE
// SCENE:  CURATOR'S STUDY DESK
//
// The classical sculptural treatment — entire piece (figure, kinetic effects,
// and base) cast in bronze with rich patina. Single unified medium throughout.

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

const MATERIAL_BLOCK = `MATERIAL — BRONZE FIGURE ON A BRONZE BASE (UNIFIED CAST):

THE WHOLE PIECE — BRONZE:
Figure, kinetic effects, sculpted scene, AND base are all CAST BRONZE. This is the classical sculptural treatment — Frederic Remington territory. The entire object is one unified bronze piece.

BRONZE SURFACE READ:
- Warm golden-brown bronze tone with rich PATINA settled in low areas (deeper green-brown, darker umber in recesses)
- High points polished to a soft golden sheen — knees, knuckles, helmet crowns, raised musculature
- Mid surfaces: softer satin bronze, slight oxidation visible
- Recesses and undercuts: darker patina, almost black-green in deepest crevices
- Edges: SHARP (bronze can hold a knife edge) — fabric folds, gear contours, tool edges all crisp
- Sculpted texture: visible TOOL MARKS from the original wax model, preserved through casting — fine ridges, chase marks, the "hand" of the sculptor

THE PLATE — POLISHED BRONZE:
For this preset the display base is NOT walnut — it is a wide oval POLISHED BRONZE PLATE, the same proportions as the walnut plate in other presets but with a smoother polished finish than the figure. The base catches a brighter golden sheen than the patinated figure above.

KINETIC EFFECT MATERIAL — ALSO BRONZE:
Spray, dust, particulate, water sculpted on the plate are also rendered in bronze — flowing bronze for water, lifted bronze chips for dust, fine bronze speckle for particulate. The kinetic energy of the action is captured as if cast in flight. The whole sculpt above the polished bronze base is one unified bronze medium.

LIGHTING TARGET:
Directional light catches the polished high points with bright specular highlights. Patinated recesses absorb and hold deep shadow detail. The contrast between polished base and patinated figure is part of the visual signature.`

function buildIdentityLock(input: ActionMiniSharedInput): string {
  const lines = buildIdentityLines(input.hero)
  if (lines.length === 0) {
    return `HERO — CAST BRONZE FIGURE:
Render as a museum-quality cast bronze miniature in the classical sculptural tradition. Gestalt-level likeness — recognizable by pose and form.`
  }

  return `HERO — CAST BRONZE FIGURE (GESTALT-LEVEL LIKENESS):

At this small scale the hero is recognized by POSE and SILHOUETTE — there is no color. Bronze identity is monochromatic.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- POSE is the primary anchor — bronze captures motion through silhouette.
- GEAR is sculpted in bronze, identifiable by FORM not color (no painted color in this preset).
- Hair sculpted as bronze mass with deeper patina.
- Skin areas polished higher than fabric/gear areas — bronze convention.
- Face reads as a competent bronze portrait — features clean, expression preserved.`
}

const MOODS: Record<string, string> = {
  golden: `MOOD: Warm afternoon sunlight from off-screen window-left. Bronze high points catch bright warm-gold speculars; patinated recesses hold deep warm shadow. The base reads almost amber where the key light hits.`,
  dramatic: `MOOD: Strong directional sunlight from off-screen window-left. Bronze drama — bright golden highlights on the key side, deep shadow on the shade side, all the tonal range bronze can hold.`,
  vivid: `MOOD: Bright cool morning light. Bronze reads in clear neutral light — every surface gradation legible, less warm-orange shift, more silver-gold neutral.`,
}

const PHOTO_FRAME = `PHOTOGRAPHIC STYLE — STUDIO PRODUCT PHOTOGRAPHY:

LIGHTING per mood. The full tonal range of bronze (polished highlights to patinated darks) is the visual subject.

LENS: Medium-format macro. Tool marks and patina texture both crisp at close inspection.

COLOR: Bronze monochromatic with mood-shifted ambient. The figure has no painted color — all character comes from form, surface, patina.

QUALITY: Auction-house catalog quality. The piece reads as a serious sculptural commission.`

export function buildBronzeBronzePrompt(input: ActionMiniSharedInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const features  = buildFeaturesBlock(input.distinctiveFeatures)
  const notes     = buildNotesBlock(input.notes)

  return [
    'Transform the provided image into a museum-quality CAST BRONZE collectible action diorama mounted on a POLISHED BRONZE PLATE, photographed as a precious sculptural object on a polished walnut desk in a curator\'s study. The figure, kinetic effects, and base are all unified bronze — patinated figure above, polished plate below. Auction-house catalog quality. The bronze plate replaces the usual walnut.',
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
