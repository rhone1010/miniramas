// actionmini-preset-plushy.ts
// lib/v1/actionmini-preset-plushy.ts
//
// PRESET: PLUSHY (soft fabric toy)
// SCENE:  WARM DOMESTIC INTERIOR
//
// Stuffed-fabric figure with kinetic action stylized in soft materials —
// felt spray, embroidered dust trails, fluffy cotton-batting plumes.

import {
  ActionMiniSharedInput,
  KINETIC_INTENSITY_BLOCK,
  MEDIUM_EFFECTS,
  buildPoseBlock,
  buildSecondaryBlock,
  buildIdentityLines,
  CORE_HIERARCHY_DOMINANT,
  DOMESTIC_SOFT_SCENE,
  CAMERA_DOMINANT,
  COMPOSITION_DOMINANT,
  buildFeaturesBlock,
  buildNotesBlock,
} from './actionmini-shared'

const MATERIAL_BLOCK = `MATERIAL — SOFT PLUSH FABRIC TOY (HIGH-END HANDMADE):

THE FIGURE — STUFFED FABRIC:
The hero figure is rendered as a HIGH-END HANDMADE PLUSHY — the kind of considered, well-constructed soft toy you find at a specialty children's boutique, not a bargain shelf. Stuffed fabric construction with visible seams and stitching, soft body that compresses slightly at contact points, all the cuteness of a plushy without losing the dynamic action of the source pose.

PLUSH SURFACE READ:
- Body fabric: soft minky, cotton, or felt with visible fiber texture at close inspection — slight fuzz, soft sheen where light catches the pile
- Skin areas: pale fabric with embroidered facial features (small stitched eyes with white catchlight thread, embroidered nose dot, optional simple mouth stitching)
- Hair: yarn loops, felt panels, or sewn fabric mass — suggesting hairstyle without strand-by-strand detail
- Clothing and gear: separate fabric panels with visible seams — felt for stiff items (helmets, boards), patterned fabric for clothing, contrasting thread for stitched detail
- Edges: ALWAYS soft and slightly rounded — fabric cannot hold a sharp edge
- Construction: visible stitching at seams (small running-stitch or whip-stitch in contrasting thread) reads as part of the charm
- Slight asymmetry tolerable — handmade quality, not factory-perfect

KINETIC EFFECT MATERIAL — TRANSLATED INTO PLUSH:
Kinetic effects are translated into PLUSH-NATIVE forms:
- Water spray → wisps of fluffy white cotton batting OR small felt droplets
- Dust → cotton-fluff puffs in pale tan or grey
- Snow → cotton wool batting forming the snow surface, with white felt snowflake shapes for spray
- Sparks/foam → tiny white felt circles with embroidered detail
- Trails behind the figure → embroidered stitch lines on the fabric base ("dotted line" trail)
The whole kinetic energy of the original moment is preserved but translated into soft, child-friendly materials.

THE PLATE:
Same wide oval walnut display plate — but for this preset the plate is upholstered or has a stitched-fabric top: a flat circular fabric panel mounted in the wood frame, with the kinetic scene built up from fabric/felt above it. Walnut rim still visible at the edge.

LIGHTING TARGET:
Soft warm domestic light catches the fabric pile and creates gentle highlight gradients. No hard speculars — fabric diffuses light fully. Subtle shadows in seams and folds give form.`

function buildIdentityLock(input: ActionMiniSharedInput): string {
  const lines = buildIdentityLines(input.hero)
  if (lines.length === 0) {
    return `HERO — HANDMADE PLUSH FIGURE:
Render as a high-end handmade plushy appropriate to the source photograph. Cute, cuddly, but the dynamic pose is preserved.`
  }

  return `HERO — HANDMADE PLUSH FIGURE (GESTALT-LEVEL LIKENESS):

At this small scale and in this medium, the hero is recognized by POSE, SILHOUETTE, and GEAR COLORS rendered in fabric. Plushy faces are intentionally simplified — embroidered features, no photo-real face.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- POSE is the primary anchor — even in plush form the dynamic action reads.
- GEAR COLORS carry through as fabric colors (every named color from source preserved).
- Hair color carries through as yarn or felt color.
- Face: simple embroidered eyes (with thread catchlight), embroidered nose, optional small mouth — DO NOT add a creepy or photo-real face. Plushy faces are charming through simplification.
- Slight handmade asymmetry is tolerable; factory-perfection is wrong.`
}

const MOODS: Record<string, string> = {
  golden: `MOOD: Warm late-afternoon window light. Soft golden glow on the fabric pile, long warm shadows. The room reads cozy and lived-in — a child's bedroom or family living room at the warmest hour of the day.`,
  dramatic: `MOOD: Late afternoon sun streaming through curtained window — strong directional warmth with soft edges. Fabric pile catches warm rim-light along the figure's silhouette. Slightly more contrast than "golden" but still domestic.`,
  vivid: `MOOD: Bright clean midday window light. Colors at full saturation, fabric textures crisp, the plushy looks freshly made. The room reads bright and cheerful.`,
}

const PHOTO_FRAME = `PHOTOGRAPHIC STYLE — DOMESTIC LIFESTYLE PHOTOGRAPHY:

LIGHTING per mood — soft, natural, warm. No harsh studio strobes — domestic window light only.

LENS: Medium-format macro equivalent. Fabric pile and stitching crisp at close range; warm soft DOF in the surround.

COLOR: Warm domestic palette throughout. Cream, soft butter, warm grey, pale wood tones in the room.

QUALITY: Like a photo from a high-end children's catalog — natural domestic warmth, precious-but-loved, the kind of plush toy that becomes an heirloom.`

export function buildPlushyPrompt(input: ActionMiniSharedInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const features  = buildFeaturesBlock(input.distinctiveFeatures)
  const notes     = buildNotesBlock(input.notes)

  return [
    'Transform the provided image into a HIGH-END HANDMADE PLUSHY action diorama on a wide oval walnut display plate with a stitched-fabric top, photographed in a warm domestic interior — a sun-lit living room or child\'s bedroom. The figure is a soft fabric plush toy with embroidered features and visible stitching. Kinetic effects translated into plush-native materials (cotton batting, felt, embroidered trails). Cute and cuddly but the dynamic action pose is preserved.',
    CORE_HIERARCHY_DOMINANT,
    MATERIAL_BLOCK,
    identity,
    pose,
    KINETIC_INTENSITY_BLOCK,
    effects,
    secondary,
    features,
    DOMESTIC_SOFT_SCENE,
    COMPOSITION_DOMINANT,
    CAMERA_DOMINANT,
    mood,
    PHOTO_FRAME,
    notes,
  ].filter(Boolean).join('\n\n')
}
