// actionmini-preset-carved-wood.ts
// lib/v1/actionmini-preset-carved-wood.ts
//
// PRESET: CARVED FROM A WOODEN LOG — figure EMERGING through the action
// SCENE:  OUTDOOR — the action's native environment from the source photo
//
// The conceit: the figure appears to be carved from a single piece of wood and
// is still partially EMERGING from the unworked log. The kinetic action of the
// pose seems to be what is "freeing" the figure from the wood. Visible chisel
// marks, raw bark/end-grain remnants in less-finished areas.

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

const MATERIAL_BLOCK = `MATERIAL — HAND-CARVED FROM A WOODEN LOG (FIGURE EMERGING):

THE CONCEIT:
The hero figure is hand-carved from a single piece of wood — and is still partially EMERGING from the unworked log, as if the kinetic energy of the action is what is freeing the figure from the material. The MOST KINETIC parts of the pose (driving leg, leading arm, pulled-back paddle) are the most fully sculpted and finished. The TRAILING parts of the pose (back leg, follow-through arm, lower torso) blend into raw, unworked log — visible bark, end-grain, chisel-mark edges where the carving has not yet reached.

WOOD CHARACTER:
- Species reads as walnut, cherry, or warm oak — rich grain visible in finished areas
- Finished areas: smooth tooled surface with polished sheen, grain reading through the form
- Transition zones: visible chisel marks, gouge cuts, lighter raw cut wood color
- Unfinished areas: raw bark or end-grain log surface, untouched by the carver
- The seam from finished to unfinished is GRADUAL — not a hard line — the figure DISSOLVES into wood

KINETIC EFFECT MATERIAL:
The kinetic spray, dust, water, and particulate around the figure are ALSO carved wood — sculpted curls of shaved wood for spray, lifted wood chips for dust, smaller carved fragments for particulate. The KINETIC ENERGY of the action is itself rendered in wood, as if the carver was capturing motion in the same medium as the figure.

THE PLATE:
Same wide oval walnut display plate as the resin preset — but for this preset the plate visibly CONTINUES UPWARD into the unworked log of the figure. The plate is base; the log rises from it; the figure emerges from the log. Single continuous piece of wood, conceptually.

LIGHTING TARGET:
Directional light raks across the carved surfaces, picking up tool marks and grain. Finished areas catch satin highlights; raw areas absorb light into texture. Unfinished bark areas have the richest shadow detail.`

function buildIdentityLock(input: ActionMiniSharedInput): string {
  const lines = buildIdentityLines(input.hero)
  if (lines.length === 0) {
    return `HERO — CARVED FROM WOOD (FIGURE EMERGING):
Render as a hand-carved wooden figure partially emerging from the unworked log. Gestalt-level likeness — the most kinetic parts of the pose are fully sculpted, the trailing parts dissolve into raw wood.`
  }

  return `HERO — CARVED WOODEN FIGURE EMERGING FROM THE LOG:

At this small scale the hero is recognized by POSE first, then GEAR FORMS sculpted into the wood. There is no painted color — the wood's natural grain and tone is the entire palette.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- POSE is the primary anchor — the EMERGING parts of the figure tell the story.
- GEAR is sculpted in the same wood, identifiable by FORM not color.
- Hair sculpted as wood mass; facial features carved competently but slightly stylized.
- Skin and clothing distinguished by DEPTH OF FINISH — skin areas more polished, fabric areas more textured.
- The trailing limbs and back of the figure intentionally fade into raw log/bark — this is desired, not a flaw.`
}

const MOODS: Record<string, string> = {
  golden: `MOOD: Warm golden afternoon light. The carved wood glows warm. Tool marks in transition areas catch long shadows. Volumetric beam from above lights the finished surfaces; raw log areas absorb deeper warm shadow.`,
  dramatic: `MOOD: Dramatic directional light. The carved figure's finished side is theatrical-bright; the emerging-from-log side falls into rich deep shadow where bark and end-grain absorb the light. High contrast, real wood drama.`,
  vivid: `MOOD: Bright clean midday light. Wood grain reads sharp; tool marks crisp; the contrast between polished and raw wood is at its most legible.`,
}

const PHOTO_FRAME = `PHOTOGRAPHIC STYLE — EDITORIAL CINEMATIC SCENE (CARVED WOOD):

LIGHTING per mood. Wood grain is the surface signature — directional light should pull the grain forward.

LENS: Medium-format macro. Tool marks, end-grain texture, and raw bark all crisp on the figure's transition zones.

COLOR: Warm wood-toned palette throughout. The figure and base are essentially monochromatic (wood) — color comes from the surrounding environment.

QUALITY: Like a small carved sculpture in a craft-show or folk-art-museum catalog — but with full editorial photography around it.`

export function buildCarvedWoodPrompt(input: ActionMiniSharedInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const envBlock  = buildOutdoorScene(input.environment)
  const features  = buildFeaturesBlock(input.distinctiveFeatures)
  const notes     = buildNotesBlock(input.notes)

  return [
    'Transform the provided image into a hand-carved wooden action diorama on a wide oval walnut display plate, photographed in a real-world outdoor environment. The hero figure is HAND-CARVED FROM A SINGLE PIECE OF WOOD and is still partially EMERGING from the unworked log — the most kinetic parts of the pose fully sculpted, the trailing parts dissolving into raw wood with visible chisel marks. The diorama is sized for kinetic impact while environment surrounds it as a substantial atmospheric co-subject.',
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
