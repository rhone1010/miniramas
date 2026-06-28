// lib/v1/portraits/portraits-pass2.ts
//
// Pass 2 of the Portraits silo — gpt-image-1 surface-refine pass.
//
// 2026-05 v2 — REWRITTEN to drop the source-photo input. The earlier version
// (which passed source + render together to gpt-image-1 with input_fidelity:
// 'high') was reinterpreting the face on every render. Two failure modes
// observed:
//
//   1. Photo-paste — gpt-image-1 treated the source photo as a face-region
//      texture to composite into the sculpture, producing renders with
//      photorealistic skin floating on a carved body.
//
//   2. Idealization — even when the material register held across the face,
//      gpt-image-1 reinterpreted features (smoothed wrinkles, regularized
//      asymmetries, swapped hair color, dropped age cues) toward a sculptural
//      "ideal." Identity drift, by a different mechanism than #1.
//
// The diagnosis: gpt-image-1 with a face-related multi-image input has a
// strong prior to "fix" the face. Removing the source eliminates failure
// mode #1 entirely and constrains the model to refining what's already
// carved. The prompt no longer mentions "the person" or "the subject" or
// "the source" — it treats the face strictly as CARVED GEOMETRY to preserve,
// not as a face to refine.
//
// input_fidelity: 'high' is kept — with only the render as input, it now
// anchors gpt-image-1 to the SCULPTURE'S identity rather than a photo's.

import OpenAI, { toFile } from 'openai'
import type { PortraitsPresetId, LocationId } from './portraits-shared'

// ── PASS 2 BLOCKS ─────────────────────────────────────────────

const PASS2_CORE = `This image shows a handcrafted physical sculpture mounted as a gallery piece. The sculpture is COMPLETE and FINAL. Your only job is to produce the same sculpture photographed at higher gallery-catalog quality — same subject, same material, same composition, same staging. You are a photographer, not a sculptor: do not re-carve the figure.

PRESERVE EXACTLY (every line below is non-negotiable):
- All carved facial geometry as it appears in this image — every feature, every wrinkle, every asymmetry, every chisel mark, every contour. The face IS the carved geometry you see. Do not smooth it. Do not idealize it. Do not regularize it. Do not "improve" it.
- Hairline shape and hair pattern as carved
- Facial-hair pattern, density, and edge as carved
- Mouth shape and expression as carved
- Eye position, eye shape, eye spacing as carved
- Material register across the entire sculpture — the face is the same material as the body and base; do not introduce photorealistic skin to the face region
- Composition, framing, camera angle
- Background staging, lighting direction, atmospheric character
- The plaque, its text, and its placement

REFINE ONLY (this is the totality of your job):
- Material surface tactility — grain, polish, patina, weathering at miniature scale
- Edge crispness at carved transitions and contact points
- Micro-shadow density under brow, nose, chin, jaw, and at material seams
- Background atmospheric depth, depth-of-field softness
- Photographic register — sharpness, contrast, color balance of the photograph itself (not of the sculpture's coloring)

NEVER:
- Regenerate the face — it is fixed carved geometry, not a face waiting to be refined
- Modify any feature proportion, position, or character
- Substitute the carved material with photorealistic skin anywhere on the figure
- Change the apparent age, weight, or body type of the figure
- Change material, composition, framing, lighting, or staging
- Alter the plaque text`

const PASS2_MATERIAL_REFINEMENT_BY_PRESET: Record<PortraitsPresetId, string> = {
  ebony: `MATERIAL — CARVED EBONY:
Refine deep grain flow across the carved surfaces, the dramatic dark-on-dark patterns of stained ebony, polish variation on the face versus rougher hand-tooled zones at the shoulders. Burls and whorls remain visible. NO paint. NO photorealistic skin.`,

  walnut: `MATERIAL — CARVED WALNUT:
Refine the honey-brown grain flow with its full color range (chocolate to amber), polish variation on the face versus rougher hand-tooled zones. Burls and whorls remain visible. NO paint. NO photorealistic skin.`,

  bronze: `MATERIAL — CAST BRONZE:
Refine verdigris depth in shadow recesses, polish on raised features (brow ridge, cheekbones, nose tip), casting-seam character where present. The face is cast bronze surface — refine the metal, do not regenerate it as skin.`,

  alabaster: `MATERIAL — TRANSLUCENT ALABASTER:
Refine translucent depth (thinner at ears and jaw edge, denser at cranium), polished surface micro-detail, the glow at thin edges where light passes through. The stone IS the color. NO painted skin.`,

  stone: `MATERIAL — ROUGH-CHISELED STONE:
Refine the variegated color bands of the natural stone, visible chisel tool marks across surfaces, the contrast between rougher carved zones and slightly smoother face planes. The stone IS the color. NO painted skin.`,

  iron: `MATERIAL — FORGED IRON:
Refine hammer-work texture across the surfaces, subtle burnished highlights on raised features, natural oxide patina depth in recesses. The figure is forged iron throughout — NO paint, NO photorealistic skin anywhere on the figure.`,

  plushy: `MATERIAL — PLUSHY:
Refine stitch density on embroidered features, fabric weave variation, embroidered hair texture. Plushy stays SOFT — no hard edges, no photoreal materials, no skin.`,

  // New materials — Pass 2 disabled; placeholders satisfy the exhaustive
  // Record<PortraitsPresetId, …>. Replace with real refinement text if Pass 2
  // is ever enabled for these.
  pewter: `MATERIAL — PEWTER (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for this material — see STYLE_PIPELINE in portraits-shared.ts.`,

  chocolate: `MATERIAL — CHOCOLATE (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for this material — see STYLE_PIPELINE in portraits-shared.ts.`,

  stained_glass: `MATERIAL — STAINED GLASS (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for this material — see STYLE_PIPELINE in portraits-shared.ts.`,

  driftwood_resin: `MATERIAL — DRIFTWOOD RESIN (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for this material — see STYLE_PIPELINE in portraits-shared.ts.`,

  // Artists Gallery — Pass 2 is disabled for this style. These entries
  // exist only to satisfy the Record<PortraitsPresetId, …> type. If Pass 2
  // is ever re-enabled for artists, these need real refinement text.
  impressionist: `MATERIAL — IMPRESSIONIST IMPASTO (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for Artists Gallery — see STYLE_PIPELINE in portraits-shared.ts.`,

  torn_paper: `MATERIAL — TORN PAPER TOPOGRAPHY (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for Artists Gallery — see STYLE_PIPELINE in portraits-shared.ts.`,

  folded_book: `MATERIAL — FOLDED BOOK (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for Artists Gallery — see STYLE_PIPELINE in portraits-shared.ts.`,

  charcoal_chalk: `MATERIAL — CHARCOAL & CHALK (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for Artists Gallery — see STYLE_PIPELINE in portraits-shared.ts.`,

  pencil_sketch: `MATERIAL — PENCIL SKETCH (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for Artists Gallery — see STYLE_PIPELINE in portraits-shared.ts.`,

  sheet_music: `MATERIAL — SHEET MUSIC (Pass 2 disabled):
[placeholder] Pass 2 currently disabled for Artists Gallery — see STYLE_PIPELINE in portraits-shared.ts.`,
}

const PASS2_LOCATION_PRESERVATION: Record<LocationId, string> = {
  mantel: `LOCATION (MANTEL):
Refine marble veining on the mantel surface, brass tarnish patterns on candlesticks, paper texture on art-book spines. The mirror reflection stays empty/ambient — NOT a reflection of the sculpture or any face. Quiet-luxury character intact.`,

  tea_house: `LOCATION (TEA HOUSE):
Refine tatami weave, shoji paper diffusion, cedar grain on post-and-beam framing. Warm interior glow stays gentle and directional. Wabi-sabi restraint intact.`,

  pedestal: `LOCATION (PEDESTAL — MUSEUM GALLERY):
Refine marble pedestal veining, the volumetric beam from the skylight (subtle dust in the light shaft), gallery wall plaster texture, directional shadow under the bust.`,

  gradient: `LOCATION (GRADIENT STUDIO):
Refine the smoothness of the gradient backdrop, the soft falloff into shadow at the frame edges, the gentle atmospheric haze, and the highlight separation between sculpture and surround. The backdrop color stays exactly as established.`,

  wall_mount: `LOCATION (WALL MOUNT):
Refine gallery wall plaster texture, shadow softness, edge crispness of the piece against the wall.`,

  plushy_shelf: `LOCATION (PLUSHY SHELF):
Refine fabric weave on surrounding plushies, knitted blanket texture, warm lamp glow. No formal plinth — plushies are the staging.`,
}

// ── BUILD THE PROMPT ─────────────────────────────────────────

export function buildPass2Prompt(input: {
  presetId:   PortraitsPresetId
  locationId: LocationId
}): string {
  return [
    PASS2_CORE,
    PASS2_MATERIAL_REFINEMENT_BY_PRESET[input.presetId] || PASS2_MATERIAL_REFINEMENT_BY_PRESET.alabaster,
    PASS2_LOCATION_PRESERVATION[input.locationId] || PASS2_LOCATION_PRESERVATION.mantel,
  ].join('\n\n')
}

// ── REFINE CALL ──────────────────────────────────────────────

export interface PortraitsPass2Input {
  imageB64:        string   // the Pass 1 (NB2) render to refine — SOLE input
  presetId:        PortraitsPresetId
  locationId:      LocationId
  aspectRatio:     string
  openaiApiKey:    string
}

export interface PortraitsPass2Output {
  imageB64:    string
  refined:     boolean
  durationMs:  number
  reason?:     string
}

const PASS2_QUALITY = 'high' as const   // gpt-image-1 high quality (~$0.19)

function aspectToSize(ar: string): '1024x1024' | '1024x1536' | '1536x1024' {
  if (ar === '2:3' || ar === '3:4' || ar === '9:16') return '1024x1536'
  if (ar === '3:2' || ar === '4:3' || ar === '16:9') return '1536x1024'
  return '1024x1024'
}

export async function refinePortraitsImage(
  input: PortraitsPass2Input,
): Promise<PortraitsPass2Output> {

  const t0 = Date.now()
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const prompt = buildPass2Prompt({
    presetId:   input.presetId,
    locationId: input.locationId,
  })

  console.log(
    `[portraits/pass2] start preset=${input.presetId} loc=${input.locationId} ` +
    `aspect=${input.aspectRatio} prompt_chars=${prompt.length} (render-only input)`,
  )

  try {
    // Single-image input: only the Pass 1 render. Source photo intentionally
    // NOT included — it was being used by gpt-image-1 as a face-paste target
    // (the photo-paste failure mode). input_fidelity: 'high' now anchors to
    // this render's content rather than to a separate source photo.
    const renderBuf = Buffer.from(input.imageB64, 'base64')
    const renderFile = await toFile(renderBuf, 'pass1.png', { type: 'image/png' })

    const result = await openai.images.edit({
      model:           'gpt-image-1',
      prompt,
      image:           renderFile as any,
      size:            aspectToSize(input.aspectRatio),
      quality:         PASS2_QUALITY,
      input_fidelity:  'high',     // cast through any — SDK type may lag
      n:               1,
    } as any)

    const b64 = result.data?.[0]?.b64_json
    if (!b64) throw new Error('gpt-image-1 returned no b64_json')

    const durationMs = Date.now() - t0
    console.log(`[portraits/pass2] refine done in ${durationMs}ms`)

    return {
      imageB64:   b64,
      refined:    true,
      durationMs,
    }
  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    console.warn(`[portraits/pass2] refine failed, returning Pass 1: ${msg}`)
    return {
      imageB64:   input.imageB64,
      refined:    false,
      durationMs: Date.now() - t0,
      reason:     `error: ${msg}`,
    }
  }
}
