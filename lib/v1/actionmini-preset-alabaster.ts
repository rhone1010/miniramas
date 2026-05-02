// actionmini-preset-alabaster.ts
// lib/v1/actionmini-preset-alabaster.ts
//
// PRESET: HIGHLY DETAILED ALABASTER STATUE
// SCENE:  GALLERY PEDESTAL
//
// Translucent alabaster — the stone glows from within when backlit. The single
// most luminous material in the catalog. Rendered like a Renaissance master\'s
// alabaster relief or a Greek/Roman alabastron piece.

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

const MATERIAL_BLOCK = `MATERIAL — HIGHLY DETAILED ALABASTER STATUE (LUMINOUS):

THE CONCEIT:
The figure and sculpted scene are rendered as MUSEUM-QUALITY ALABASTER — the soft, translucent stone used by Italian Renaissance sculptors and ancient Mediterranean carvers. Alabaster\'s defining property is TRANSLUCENCY: the stone is slightly transparent for several millimeters at the surface, allowing light to penetrate and scatter inside before re-emerging. This produces the unmistakable INNER GLOW that no other material in the catalog has.

ALABASTER SURFACE READ:
- Color: warm off-white with subtle natural variation — pale cream, faint honey, occasional small bands of slightly warmer or cooler veining
- Translucency: where the stone is THIN (ears, fingers, drapery edges, fabric folds, sculpted spray), light passes THROUGH and the stone GLOWS WARM from within
- Where the stone is THICK (torso, plinth, dense sculpted forms), the stone reads as solid but with a soft inner warmth
- Surface finish: highly polished — smooth, slightly satin sheen, no rough chisel marks (this is FINISHED stone, not in-progress carving)
- Detail: HIGHLY DETAILED — the alabaster carver\'s skill is visible in fabric folds, hair strands, facial features, gear texture. This is a virtuoso sculptor\'s piece.
- Edges: SHARP and clean — alabaster CAN hold an edge — fabric folds and contours are well-defined
- Veining: subtle natural stone veining visible across surfaces, more obvious in flatter areas, easy to miss in detailed regions
- DO NOT make the alabaster appear yellowed or aged unattractively — this is a fresh-from-the-studio finish, treasured for its luminous beauty

THE PLATE:
The plate IS alabaster in this preset — wide oval alabaster base, slightly thicker veining than the figure above. The same warm off-white with inner glow. Walnut DOES NOT appear in this preset — entire piece is alabaster, unified medium throughout.

KINETIC EFFECT MATERIAL — ALSO ALABASTER:
Spray, dust, particulate, water sculpted on the plate are also rendered in alabaster — and these THIN-SECTIONED kinetic elements are where the translucency SINGS. Sculpted spray, lifted dust, particulate scatter are the THINNEST parts of the piece, so they GLOW BRIGHTEST when backlit. The kinetic energy of the action becomes a halo of luminous alabaster.

LIGHTING TARGET — CRITICAL FOR THIS PRESET:
The directional gallery spotlight should illuminate the alabaster from above-front, with significant LIGHT WRAPPING AROUND the figure. The thinnest sculpted areas (spray, dust, fabric edges, ears, fingertips, sculpted particles) should GLOW PERCEPTIBLY from the subsurface scatter. This is alabaster\'s signature visual property and it must be PROMINENT in the rendering — without it the material reads as plain marble.`

function buildIdentityLock(input: ActionMiniSharedInput): string {
  const lines = buildIdentityLines(input.hero)
  if (lines.length === 0) {
    return `HERO — HIGHLY DETAILED ALABASTER FIGURE:
Render as a virtuoso alabaster miniature in the Renaissance tradition. Translucent stone glowing from within where light penetrates thin areas. Highly detailed throughout.`
  }

  return `HERO — HIGHLY DETAILED ALABASTER FIGURE (GESTALT-LEVEL LIKENESS):

At this small scale the hero is recognized by POSE, SILHOUETTE, and the LUMINOUS TRANSLUCENCY of alabaster — there is no painted color.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- POSE is the primary anchor.
- GEAR is sculpted in alabaster, identifiable by FORM not color.
- Hair sculpted with full strand-level detail in the alabaster medium.
- Face: virtuoso alabaster portrait — features competent, expression preserved, idealized in the Renaissance convention.
- Translucency is part of the identity — thin areas (ears, fingers, drapery edges) GLOW. Thick areas read solid with inner warmth.
- HIGH DETAIL throughout — no shortcut surfaces. The alabaster carver was a master.`
}

const MOODS: Record<string, string> = {
  golden: `MOOD: Warm gallery spotlight, slightly warm-toned. Alabaster\'s inner glow takes on a honey warmth; the translucent edges sing. Soft ambient room.`,
  dramatic: `MOOD: Strong directional gallery spotlight from above-front. Alabaster at its most theatrical — bright lit-side, deep shaded-side, but the THIN AREAS still glow from subsurface even on the shade side. Pure sculptural drama.`,
  vivid: `MOOD: Cool clean gallery light, slightly bluish-neutral. Alabaster reads in true color — pure warm cream against cool ambient. Maximum legibility of the translucency property.`,
}

const PHOTO_FRAME = `PHOTOGRAPHIC STYLE — RENAISSANCE GALLERY CATALOG:

LIGHTING per mood. The translucent inner glow of alabaster is the visual signature and must be prominent — this is what distinguishes alabaster from plain marble.

LENS: Medium-format macro. Detail in the carving (fabric folds, hair strands, facial features) and the veining of the stone both crisp at close inspection.

COLOR: Warm off-white alabaster against cool gallery ambient. Limited palette, infinite tonal nuance.

QUALITY: Like a photograph from a Renaissance-sculpture exhibition catalog — reverent, virtuoso, precious.`

export function buildAlabasterPrompt(input: ActionMiniSharedInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const features  = buildFeaturesBlock(input.distinctiveFeatures)
  const notes     = buildNotesBlock(input.notes)

  return [
    'Transform the provided image into a virtuoso ALABASTER STATUE action diorama on a wide oval ALABASTER plate (no walnut in this preset), photographed on a gallery pedestal in a quiet exhibition space. The translucent alabaster GLOWS FROM WITHIN where light passes through thin areas — the most luminous material in the catalog. Highly detailed Renaissance-tradition carving throughout.',
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
