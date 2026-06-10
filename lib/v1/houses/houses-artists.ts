// houses-artists.ts
// lib/v1/houses-artists.ts
//
// ARTISTS GALLERY — Houses silo. Four interpretive-medium presets that
// bypass the standard block stack (collectible anchor / camera / plinth
// composition / environment / lighting / night override) and ship a full
// custom prompt instead, mirroring the Portraits Artists Gallery pattern.
//
// What they KEEP from the standard stack:
//   STRUCTURE_FIDELITY_BLOCK — verbatim. It is the architectural analog
//   of the Portraits likeness tail and remains the load-bearing block.
//   The medium interprets the SURFACE; the geometry stays exact.
//
// What they OWN per-preset:
//   Scene, lighting, framing, and depth of field are baked into each
//   transformation block. Because of that, Stability outpaint is forced
//   OFF for artists presets (see houses-generator.ts) — outpainting a
//   painterly/drawn register fills margins photorealistically and breaks
//   the medium at the seam. Same reasoning as Portraits artists_gallery
//   expandEnabled: false.
//
// VOCABULARY DISCIPLINE (inherited from houses-blocks.ts):
//   BANNED:   spotlight, lamp, fixture, pendant, shaft, beam, streams down
//   REQUIRED: atmospheric haze, luminous quality, diffused,
//             "slightly brighter toward the back-upper area"
//
// Assembled prompts target the 2,800–3,300 char safe zone.

import { STRUCTURE_FIDELITY_BLOCK, REFINEMENT_GUARD_BLOCK } from './houses-blocks'

// ── PRESET IDS ────────────────────────────────────────────────
export const HOUSES_ARTISTS_PRESET_IDS = [
  'impressionist_oil',
  'watercolor_study',
  'charcoal_chalk',
  'pen_ink',
] as const

export type HousesArtistsPresetId = (typeof HOUSES_ARTISTS_PRESET_IDS)[number]

export function isHousesArtistsPreset(id: string): id is HousesArtistsPresetId {
  return (HOUSES_ARTISTS_PRESET_IDS as readonly string[]).includes(id)
}

// ── UNIVERSAL OBJECT ANCHOR ───────────────────────────────────
// Replaces COLLECTIBLE_ANCHOR_BLOCK for the artists register. Keeps the
// "physical, dimensional, tangible" requirement (brand: Sculpted Images)
// while releasing the scale-model framing.
const ARTISTS_OBJECT_ANCHOR = `
This is a physical work of fine art photographed in the artist's own space — a dimensional, hand-crafted interpretation of a real building, tangible and weighty, lit and shadowed as an actual object in space. Museum-collectible craftsmanship throughout. Never a flat digital illustration, never a toy, never a photorealistic scale model — the building rendered as an artwork in the medium described below.
`.trim()

// ── PER-PRESET BLOCKS ─────────────────────────────────────────
type HousesArtistsBlocks = {
  transformation: string
  avoid:          string
  tail:           string
}

const HOUSES_ARTISTS_BLOCKS: Record<HousesArtistsPresetId, HousesArtistsBlocks> = {

  // ── IMPRESSIONIST OIL ──────────────────────────────────────
  // Adapted from the captured Art Gallery working prompt (2026-05-13),
  // re-targeted from figures to architecture. Source colors carry through
  // as impressionist color masses so structure fidelity stays readable.
  impressionist_oil: {
    transformation: `
THE MEDIUM — SCULPTED OIL PAINT:
The building is formed entirely from thick sculpted oil paint — every wall plane, roof slope, window bay, and chimney built up in palette-knife impasto, brushstrokes visible across every surface, paint thick enough to cast its own micro-shadows. The source building's actual colors carry through, translated into a confident impressionist palette — siding, roof, trim, and door each reading as distinct color masses with warm cream highlights and muted cool shadow tones. Garden and yard rendered as loose dabs of pigment — flower beds as bursts of broken color, lawn as layered green strokes. Paint drips and pools at the base, running visibly down the front face of a polished marble pedestal.

THE SCENE: A museum gallery — warm neutral wall behind, soft diffused gallery light wrapping the piece from one upper side, gentle atmospheric haze with a warm luminous quality, slightly brighter toward the back-upper area, deep soft shadow into the negative space behind. The work occupies roughly 55-65% of frame width, photographed from a slightly elevated three-quarter view so roof planes and facade both read; the piece razor sharp, the gallery soft.
`.trim(),
    avoid: `
Avoid photorealistic materials, smooth untextured surfaces, a flat canvas painting hanging on a wall, sculpted detail in any medium other than oil paint, glossy toy finish, and substituting a generic example of the building's style for the actual structure. Every architectural feature must remain readable through the impasto — the abstraction lives in the surface treatment, never in the geometry.
`.trim(),
    tail: `
Museum-quality fine-art collectible. The hand of the painter visible in every stroke. Monet-meets-Soutine confidence. Extraordinary dimensionality. Warm, gallery-grade presentation.
`.trim(),
  },

  // ── WATERCOLOR STUDY ───────────────────────────────────────
  // The realtor-gift register elevated to dimensional sculpture. Distinct
  // from the existing `watercolor_wood` material (a painted wooden model):
  // here the building rises FROM the painting.
  watercolor_study: {
    transformation: `
THE MEDIUM — DIMENSIONAL WATERCOLOR:
The building rises from a large sheet of cold-press watercolor paper as a dimensional watercolor sculpture — translucent layered washes forming the walls and roof planes, pigment blooms and granulation visible across every surface, the source building's actual colors carried through in luminous transparent layers. Crisp darker accents define the windows, trim profiles, and rooflines. At the base, the dimensional form dissolves back into the flat painting it grew from: loose wet washes of garden and lawn bleeding outward across the sheet, soft pencil underdrawing still visible at the unfinished edges, color feathering into clean white paper.

THE SCENE: The artist's worktable — the sheet taped down at its corners, a porcelain mixing palette and round brushes resting softly out of focus beyond the sheet, a water glass faintly tinted with pigment. Soft diffused daylight from one side, gentle atmospheric haze with a cool luminous quality, slightly brighter toward the back-upper area. Photographed from a slightly elevated three-quarter view so the roof planes and facade both read clearly; the dimensional building razor sharp, the table soft.
`.trim(),
    avoid: `
Avoid opaque heavy paint, oil or acrylic texture, a purely flat painting with no dimensional form, photorealistic materials, hard digital edges, toy register, and substituting a generic example of the building's style for the actual structure. The structure stays architecturally exact; the watercolor looseness lives in the garden, the sheet, and the dissolving edges — never in the building's geometry.
`.trim(),
    tail: `
Fine-art collectible. Luminous transparency, confident brushwork, the quiet of a finished study. Gallery-grade presentation.
`.trim(),
  },

  // ── CHARCOAL & CHALK ───────────────────────────────────────
  // Label matches the Portraits Artists Gallery preset — one vocabulary
  // across the studio.
  charcoal_chalk: {
    transformation: `
THE MEDIUM — CHARCOAL AND CHALK:
The building rises from an architect's drafting sheet as a dimensional charcoal sculpture — deep velvety charcoal blacks and warm greys forming every wall and roof plane, white chalk highlights catching along the rooflines, window trim, porch posts, and chimney caps. Every surface carries the tooth of the medium: visible stroke direction, smudged shadow transitions, pressure variation in the strokes. The source building's tonal contrasts translate into the charcoal register — light siding as silvery grey, dark roofing as dense black, window glazing as a soft graphite sheen. At the base, the dimensional form dissolves back into the drawing it grew from: loose construction lines, perspective guides, eraser marks, and smudges across the sheet, the garden sketched in quick gestural strokes.

THE SCENE: A drafting table in a quiet studio — the sheet's edges visible, a stick of charcoal and a fragment of chalk resting beyond the form, soft diffused north light from one side, atmospheric haze with a cool luminous quality, slightly brighter toward the back-upper area. Slightly elevated three-quarter view so roof planes and facade both read; the dimensional building razor sharp, the table soft.
`.trim(),
    avoid: `
Avoid color anywhere except charcoal blacks, warm greys, paper warmth, and chalk whites. Avoid a purely flat drawing with no dimensional form, thin graphite-pencil rendering, photorealistic materials, toy register, and substituting a generic example of the building's style for the actual structure. The geometry stays exact; the looseness lives in the sheet, never the structure.
`.trim(),
    tail: `
Fine-art collectible. The drama of black and white, the hand of the draftsman visible throughout. Gallery-grade presentation.
`.trim(),
  },

  // ── PEN & INK ──────────────────────────────────────────────
  pen_ink: {
    transformation: `
THE MEDIUM — PEN AND INK:
The building rises from a vellum drafting sheet as a dimensional india-ink artwork — every surface built from confident crosshatching, stipple, and varied line weight. Dense hatching pools into deep shadow under the eaves and porch roofs; fine parallel strokes describe siding courses, shingle rows, and brick coursing; window glazing reads as sparse elegant linework against white. The source building's tonal hierarchy carries through purely in ink density — only blacks, warm ink sepia, and the cream of the sheet. At the base, the dimensional form dissolves back into the architect's elevation drawing it grew from: precise ruled linework, dimension marks, a hand-lettered title block hinted at the sheet's corner, the garden suggested in quick loose pen gestures.

THE SCENE: A drafting-room worktable — a nib pen and an ink bottle resting beyond the sheet, brass drawing instruments softly out of focus, warm diffused light from one side, atmospheric haze with a gentle luminous quality, slightly brighter toward the back-upper area. Slightly elevated three-quarter view so roof planes and facade both read; the dimensional building razor sharp, the table soft.
`.trim(),
    avoid: `
Avoid any color beyond ink black, warm sepia, and paper cream. Avoid a purely flat drawing with no dimensional form, mechanical digital linework, photorealistic materials, toy register, and substituting a generic example of the building's style for the actual structure. Line density carries all tone; the geometry stays exact.
`.trim(),
    tail: `
Fine-art collectible. The precision of the architect, the warmth of the hand. Gallery-grade presentation.
`.trim(),
  },
}

// ── BUILDER ───────────────────────────────────────────────────
// Composition order:
//   1. ARTISTS_OBJECT_ANCHOR   — universal — physical-artwork register
//   2. STRUCTURE_FIDELITY_BLOCK — universal — architectural likeness (verbatim)
//   3. Transformation           — per-preset — medium + scene + framing
//   4. Avoid list               — per-preset
//   5. Tail                     — per-preset
// Refinement tweak appends with the same guard block as the standard builder.
export function buildHousesArtistsPrompt(input: {
  presetId:         HousesArtistsPresetId
  refinementTweak?: string
}): string {
  const blocks = HOUSES_ARTISTS_BLOCKS[input.presetId]

  let prompt = [
    ARTISTS_OBJECT_ANCHOR,
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
