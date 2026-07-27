// houses-curiosities.ts
// lib/v1/houses-curiosities.ts
//
// INTERPRETIVE CURIOSITIES — Houses silo. Five own-scene presets that
// bypass the standard block stack (collectible anchor / camera / plinth
// composition / environment / lighting / night override) and ship a full
// custom prompt instead, exactly mirroring houses-artists.ts.
//
// These carry `ownScene: true` in the registry. The generator forces the
// refine pass AND the Stability outpaint stage OFF for them (same gate as
// artists presets) — outpainting a flat woodblock print, a silvered plate,
// or a fractured cubist plane fills the margin photorealistically and
// breaks the medium at the seam.
//
// What they KEEP from the standard stack:
//   STRUCTURE_FIDELITY_BLOCK — verbatim. It is the architectural analog of
//   the Portraits likeness tail. The medium interprets the SURFACE and the
//   ORNAMENT; the building's mass, roofline, and feature placement stay
//   exact. (Cubism is the special case — see its block: every distinctive
//   feature still appears, recombined across simultaneous viewpoints.)
//
// VOCABULARY DISCIPLINE (inherited from houses-blocks.ts):
//   BANNED:   spotlight, lamp, fixture, pendant, shaft, beam, streams down
//   REQUIRED: atmospheric haze, luminous quality, diffused,
//             "slightly brighter toward the back-upper area"
//
// Assembled prompts target the 2,800–3,300 char safe zone.

import { STRUCTURE_FIDELITY_BLOCK, REFINEMENT_GUARD_BLOCK } from './houses-blocks'

// ── PRESET IDS ────────────────────────────────────────────────
export const HOUSES_CURIOSITIES_PRESET_IDS = [
  'ukiyo_e',
  'art_nouveau',
  'cubism',
  'daguerreotype',
  'art_deco',
] as const

export type HousesCuriositiesPresetId =
  (typeof HOUSES_CURIOSITIES_PRESET_IDS)[number]

export function isHousesCuriositiesPreset(
  id: string
): id is HousesCuriositiesPresetId {
  return (HOUSES_CURIOSITIES_PRESET_IDS as readonly string[]).includes(id)
}

// ── UNIVERSAL OBJECT ANCHOR ───────────────────────────────────
// Flexible object anchor — some of these media are flat (a woodblock
// print, a silvered plate) and some are dimensional (deco relief, nouveau
// panel). Each transformation block establishes its own flat-vs-dimensional
// register; this anchor only asserts "real hand-made artwork, photographed
// as an object," never a flat digital illustration.
const CURIOSITIES_OBJECT_ANCHOR = `
This is a real, hand-made work of art photographed as a physical object — tangible, lit and shadowed in real space, with the texture and imperfection of the actual medium described below. Museum-collectible craftsmanship. Never a flat digital illustration, never a toy, never a photorealistic scale model — the building rendered as an artwork in the medium described below.
`.trim()

// ── PER-PRESET BLOCKS ─────────────────────────────────────────
type HousesCuriositiesBlocks = {
  transformation: string
  avoid:          string
  tail:           string
}

const HOUSES_CURIOSITIES_BLOCKS: Record<
  HousesCuriositiesPresetId,
  HousesCuriositiesBlocks
> = {

  // ── UKIYO-E ────────────────────────────────────────────────
  ukiyo_e: {
    transformation: `
THE MEDIUM — JAPANESE UKIYO-E WOODBLOCK PRINT:
The building is rendered as a traditional Japanese ukiyo-e woodblock print pressed onto a sheet of warm washi paper. Flat planes of unmodulated color, confident dark key-block outlines around every form, and the subtle woodgrain texture of the printing block pressed faintly into the ink. The source building's colors translate into a restrained ukiyo-e palette — a few flat color areas, soft indigo and earth tones, the paper's cream showing through. A graded sky (bokashi) rises behind the house, a stylized flat cloud band drifting across the upper area, perhaps Mount-Fuji-style hills far behind. The garden reads as simplified flat shapes — a stylized tree, a few grasses in confident brush-line. A faint red artist's seal and hand-cut border sit at one corner of the sheet.

THE SCENE: The printed sheet lies on a clean surface, its deckled edges and slight paper curl visible, soft diffused daylight from one side, gentle atmospheric haze with a cool luminous quality, slightly brighter toward the back-upper area. Photographed slightly from above so the whole sheet reads flat and true; the print razor sharp.
`.trim(),
    avoid: `
Avoid photorealistic materials, smooth gradients within color areas, 3D dimensional relief, cast shadows on the building itself, Western perspective depth, and substituting a generic example of the building's style for the actual structure. Every architectural feature stays readable in flat woodblock shapes — the stylization lives in the medium, never in which features are present.
`.trim(),
    tail: `
Fine-art collectible. The flat confidence of Hokusai and Hiroshige, the honest texture of the block and the paper. Gallery-grade presentation.
`.trim(),
  },

  // ── ART NOUVEAU ────────────────────────────────────────────
  art_nouveau: {
    transformation: `
THE MEDIUM — ART NOUVEAU RELIEF:
The building is reinterpreted as a dimensional Art Nouveau artwork — the exact architecture kept intact, then dressed in the flowing ornament of the style. Whiplash iron vines and organic tendrils curl across the facade and frame the windows and doorway; sinuous carved lintels and floral capitals grow from the existing trim; the windows become glowing stained glass in muted jewel tones (peacock, amber, sage, plum) held in slender came. A soft gilded outline traces the building's key contours. The palette is warm and muted — patinated bronze-green, honeyed gold, soft rose. The garden echoes the style in curling wrought-iron plant forms. The whole reads as a hand-crafted relief object, dimensional and tangible, the ornament following the real structure rather than replacing it.

THE SCENE: The relief stands against a soft warm neutral ground, diffused directional light wrapping the piece from one upper side, gentle atmospheric haze with a warm luminous quality, slightly brighter toward the back-upper area. Slightly elevated three-quarter view so roof planes and facade both read; the piece razor sharp, the ground soft.
`.trim(),
    avoid: `
Avoid re-massing or re-proportioning the building, flat digital illustration, photorealistic ordinary materials, straight mechanical geometry, garish saturated color, and substituting a generic example of the building's style for the actual structure. The ornament is a layer over the exact architecture; the geometry stays exact.
`.trim(),
    tail: `
Fine-art collectible. Mucha-and-Guimard elegance, the organic line everywhere. Gallery-grade presentation.
`.trim(),
  },

  // ── CUBISM ─────────────────────────────────────────────────
  // Special fidelity case: the cubist medium fractures the building across
  // simultaneous viewpoints, so STRUCTURE_FIDELITY is honored at the level
  // of FEATURES — every distinctive element still appears — rather than a
  // single coherent viewpoint. The block states this explicitly.
  cubism: {
    transformation: `
THE MEDIUM — ANALYTICAL CUBISM:
The building is rendered as a dimensional analytical-cubist artwork — fractured into faceted planes that show the structure from several viewpoints at once, front and side and roof folded into one shifting surface. EVERY distinctive feature of the source building still appears somewhere in the composition — the bay projections, the porch, any tower or turret, the dormers, the window groupings, the chimney — but recombined and overlapped across the fractured planes rather than held in a single perspective. Faceted planes tilt and interlock, edges outlined in confident charcoal line, the forms shaded in a restrained Braque-and-Picasso palette of warm ochre, muted grey-green, umber, and soft tan, with passages of light and shadow shifting independently of any single light direction. The garden fragments into the same faceted language at the base.

THE SCENE: The faceted piece stands against a soft neutral ground, diffused light with gentle atmospheric haze and a cool luminous quality, slightly brighter toward the back-upper area. Slightly elevated view; the piece razor sharp, the ground soft.
`.trim(),
    avoid: `
Avoid dropping any distinctive architectural feature, a single flat photorealistic viewpoint, garish color, smooth untextured surfaces, and substituting a generic example of the building's style for the actual structure. The fracturing lives in how the real features are recombined — never in erasing them.
`.trim(),
    tail: `
Fine-art collectible. The restless intelligence of early Cubism, every angle held at once. Gallery-grade presentation.
`.trim(),
  },

  // ── DAGUERREOTYPE ──────────────────────────────────────────
  daguerreotype: {
    transformation: `
THE MEDIUM — EARLY DAGUERREOTYPE:
The building is rendered as an 1840s daguerreotype — a unique photographic image on a polished silvered copper plate. The image sits in delicate silvery monochrome, ghostly and precise, its tones shifting from positive to shadow-negative as the mirror-bright plate catches the light. Fine hand-detailed sharpness across the architecture; a soft vignette; faint tarnish blooms and age-spots creeping in from the edges; a hairline scratch or two in the silver. The plate is held in a small hinged case with an embossed brass mat and pressed-velvet lining, the mat's oval or rectangular window framing the house. The garden reads in the same silvered greys, slightly softened as early long-exposure foliage would blur.

THE SCENE: The cased plate rests on a dark surface, tilted so the silvered image resolves out of the mirror sheen, soft diffused light from one side, gentle atmospheric haze with a cool luminous quality, slightly brighter toward the back-upper area. The plate razor sharp where the image resolves.
`.trim(),
    avoid: `
Avoid modern color, clean digital sharpness without the silver's tonal shift, a flat printed photo on paper, 3D dimensional relief of the building, and substituting a generic example of the building's style for the actual structure. The building's every feature stays precise in the silver register; the age lives in the plate and the case.
`.trim(),
    tail: `
Fine-art collectible. The uncanny silver precision of the earliest photography, a house caught in a mirror. Gallery-grade presentation.
`.trim(),
  },

  // ── ART DECO ───────────────────────────────────────────────
  art_deco: {
    transformation: `
THE MEDIUM — ART DECO RELIEF:
The building is reinterpreted as a gilded Art Deco artwork — the exact architecture kept intact, then rendered in the geometry and materials of the style. Strong bilateral symmetry emphasized; crisp stepped and chevron motifs, sunburst fans, and fluted vertical lines applied over the existing facade and trim; the massing crowned with subtle ziggurat-stepped edges where the roofline allows. The palette is luxe and restrained — black and cream polished stone, warm gold leaf, gleaming chrome and nickel accents tracing the key lines. Windows read as sleek geometric glazing with metal muntins. The garden echoes the style in clipped symmetric forms and a geometric parterre. The whole reads as a hand-crafted relief object in lacquer, gilt, and polished stone — dimensional, weighty, the ornament following the real structure rather than replacing it.

THE SCENE: The relief stands against a soft dark neutral ground, diffused directional light wrapping the piece from one upper side, gentle atmospheric haze with a warm luminous quality, slightly brighter toward the back-upper area. Slightly elevated three-quarter view so roof planes and facade both read; the piece razor sharp, the ground soft.
`.trim(),
    avoid: `
Avoid re-massing or re-proportioning the building, flat digital illustration, photorealistic ordinary materials, organic curves, garish color, and substituting a generic example of the building's style for the actual structure. The deco geometry is a layer over the exact architecture; the underlying structure stays exact.
`.trim(),
    tail: `
Fine-art collectible. The confident glamour of the Chrysler era, symmetry and gilt throughout. Gallery-grade presentation.
`.trim(),
  },
}

// ── BUILDER ───────────────────────────────────────────────────
// Composition order mirrors buildHousesArtistsPrompt:
//   1. CURIOSITIES_OBJECT_ANCHOR — universal — physical-artwork register
//   2. STRUCTURE_FIDELITY_BLOCK  — universal — architectural likeness (verbatim)
//   3. Transformation            — per-preset — medium + scene + framing
//   4. Avoid list                — per-preset
//   5. Tail                      — per-preset
export function buildHousesCuriositiesPrompt(input: {
  presetId:         HousesCuriositiesPresetId
  refinementTweak?: string
}): string {
  const blocks = HOUSES_CURIOSITIES_BLOCKS[input.presetId]

  let prompt = [
    CURIOSITIES_OBJECT_ANCHOR,
    STRUCTURE_FIDELITY_BLOCK,
    blocks.transformation,
    blocks.avoid,
    blocks.tail,
  ].join('\n\n')

  if (input.refinementTweak?.trim()) {
    prompt += `\n\n${REFINEMENT_GUARD_BLOCK}\n\nADJUSTMENT: ${input.refinementTweak.trim()}`
  }

  return prompt
}
