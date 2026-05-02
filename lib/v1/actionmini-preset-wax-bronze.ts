// actionmini-preset-wax-bronze.ts
// lib/v1/actionmini-preset-wax-bronze.ts
//
// PRESET: WAX MINIATURE ON BRONZE BASE
// SCENE:  CURATOR'S STUDY DESK
//
// Wax is translucent and waxy — light penetrates the surface a few millimeters
// before scattering, giving the figure a subtle inner glow. The figure rests
// on a polished bronze base (replacing the walnut plate for this preset only).

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

const MATERIAL_BLOCK = `MATERIAL — WAX MINIATURE ON A BRONZE BASE:

THE FIGURE AND SCULPTED SCENE — WAX:
The hero figure and the kinetic scene are rendered as MUSEUM-QUALITY SCULPTED WAX, in the tradition of small wax presentation pieces and anatomical wax models. The wax is warm-toned, slightly translucent — light penetrates 1-2 millimeters into the surface before scattering, giving the wax a SUBSURFACE GLOW that is the defining property of the medium.

WAX SURFACE READ:
- Skin: warm pale wax (cream, faint pink, soft beige) with subsurface translucency — the cheek, ear, knuckle tips show a faint warm inner glow where light passes through thin areas
- Hair: sculpted wax mass, slightly darker tone, finer surface striation showing tool marks
- Clothing and gear: opaque tinted wax — color present but slightly muted by the wax's diffusing quality
- Eyes: tiny enamel inserts or paint, glossy, sharper than the surrounding wax
- Edges: SUBTLY ROUNDED at silhouette — wax cannot hold a knife-edge the way resin does; small radii at every corner
- The whole figure has a SOFT GLOW from within when backlit by directional light

THE PLATE — POLISHED BRONZE:
For this preset the display base is NOT walnut — it is a wide oval POLISHED BRONZE PLATE, the same proportions as the walnut plate in other presets but cast and polished to a soft golden-brown sheen with darker patina settled in low areas. The wax sculpt sits atop this bronze plate.

KINETIC EFFECT MATERIAL — ALSO WAX:
Spray, dust, particulate, water sculpted on the plate are also rendered in wax — translucent pale wax for water, white opaque wax for foam, fine wax shavings for dust. The whole sculpt above the bronze base is one unified wax medium.

LIGHTING TARGET:
The directional key light passes through the thinnest areas of the wax (ears, fingers, edges of fabric) producing visible subsurface scatter. Bronze base catches warm specular highlights along the rim. The contrast between waxy figure and metallic base is part of the appeal.`

function buildIdentityLock(input: ActionMiniSharedInput): string {
  const lines = buildIdentityLines(input.hero)
  if (lines.length === 0) {
    return `HERO — WAX MINIATURE FIGURE:
Render as a museum-quality wax miniature appropriate to the source photograph. Wax tradition — gestalt-level likeness, warm subsurface glow, sculptor's marks visible at close inspection.`
  }

  return `HERO — WAX MINIATURE FIGURE (GESTALT-LEVEL LIKENESS):

At this small scale the hero is recognized by POSE, GEAR FORMS, and ACTION — and at extreme close range by the SUBSURFACE GLOW unique to wax.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- POSE is the primary anchor. Every limb angle preserved from source.
- GEAR FORMS sculpted in wax with tinted color; colors slightly muted by the wax medium.
- Skin tone: warm wax-pale base; subsurface glow where light penetrates thin areas.
- Face reads as competent wax sculpture — clean features, slight softening at all edges (wax cannot hold sharp edges).`
}

const MOODS: Record<string, string> = {
  golden: `MOOD: Warm afternoon sunlight from off-screen window-left. Strong directional warmth, the wax glowing internally where the beam strikes thin areas. The bronze base picks up rich warm specular highlights. Long soft warm shadows on the desk. The room behind glows with sun-bounce.`,
  dramatic: `MOOD: Strong directional sunlight from off-screen window-left, well-defined shadows. The wax catches dramatic subsurface glow on its key side; the shadow side falls into deeper shade but stays legible thanks to bounce light. Bronze base reads almost ember-like where the key light hits.`,
  vivid: `MOOD: Bright cool morning sunlight from off-screen window-left. Crisp clear directional light, the wax's warmth contrasting with the cool ambient. Bronze base catches clean cool-warm contrast highlights. The room is bright and fresh.`,
}

const PHOTO_FRAME = `PHOTOGRAPHIC STYLE — STUDIO PRODUCT PHOTOGRAPHY:

LIGHTING per the mood block. Subsurface scatter on the wax is the signature visual property — visible where directional light strikes thin features.

LENS: Medium-format macro equivalent. Wax surface details and bronze patina both crisp.

COLOR: Refined product-photography grading. Wax warmth, bronze warmth, neutral surround.

QUALITY: Luxury collectibles brand catalog — tactile, considered, quietly precious.`

export function buildWaxBronzePrompt(input: ActionMiniSharedInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const features  = buildFeaturesBlock(input.distinctiveFeatures)
  const notes     = buildNotesBlock(input.notes)

  return [
    'Transform the provided image into a museum-quality WAX MINIATURE collectible action diorama mounted on a POLISHED BRONZE PLATE, photographed as a precious object on a polished walnut desk in a curator\'s study. The wax figure shows characteristic subsurface glow where directional light passes through thin areas. The bronze plate replaces the usual walnut.',
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
