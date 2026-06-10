// lib/v1/groups/groups-pass2.ts
//
// Pass 2 of the Groups silo — gpt-image-1 polish pass.
//
// Pass 1 (NB2) establishes everything: subject identity, arrangement,
// material, the location/staging, and how the material is used (intact
// figures with character at the base, or transformation language on the
// figures themselves — whatever Pass 1 produced). Pass 2 refines surface
// tactility and miniature-scale credibility WITHOUT overriding any of
// Pass 1's structural decisions.
//
// Pass 2 fires for Realistic + Resolving (per STYLE_PIPELINE.passTwoEnabled).
// Tribal styles use gpt-image-1 directly as the primary generator and don't
// need a refine pass.
//
// IMPORTANT: this prompt is DESIGN-AGNOSTIC. It tells Pass 2 to preserve
// whatever Pass 1 produced, NOT to enforce a specific camera angle, a
// specific emergence pattern, or any other structural decision. Any
// material-specific structural language belongs in Pass 1 prompts, not here.

import OpenAI, { toFile } from 'openai'
import type { GroupsPresetId, LocationId } from './groups-shared'

// ── PASS 2 BLOCKS ─────────────────────────────────────────────

const PASS2_CORE = `Refine this multi-figure sculpture render into a gallery-quality photograph of a real handcrafted physical 3D sculpture. Pass 1 has already established every structural decision: subject identity and arrangement, every figure's pose and expression, the material register and how it is used (whether figures are intact with character at the base, or transformation language on the figures themselves — whatever Pass 1 produced), the location staging, and the lighting and atmospheric character. Pass 2's ONLY job is to refine surface tactility, edge crispness, and miniature-scale credibility while PRESERVING all of Pass 1's structural decisions exactly.

PRESERVE EXACTLY (do not modify whatever Pass 1 produced):
- Camera angle, perspective, framing — keep whatever Pass 1 chose; never re-frame
- Subject count, identities, arrangement, per-figure heights, eye-lines, poses, expressions
- The material's structural treatment exactly as Pass 1 placed it (intact figures, transformation register, where the material character lives — figures or base)
- Background staging, location elements, lighting direction, atmospheric character

REFINE (this is your only job):
- Surface texture and material tactility
- Edge crispness at facial features and contact points between figures
- Micro-shadow density under brow, nose, chin, and between merging figures
- Material grain, polish, weathering, patina — richer at miniature scale
- Subtle anti-aliasing of fine detail

NEVER:
- Change camera angle, perspective, or framing
- Add, remove, or relocate figures
- Restructure how the material is used (do not impose a different transformation language than what Pass 1 produced)
- Substitute the environment or location elements
- Change lighting direction or atmospheric character
- Apply any material treatment to faces, heads, hair, necks, or shoulders unless Pass 1 already showed it there`

const PASS2_FIGURE_PRESERVATION = `MULTI-SUBJECT FIGURE PRESERVATION (NON-NEGOTIABLE):
EVERY subject's face, body, anatomy, pose, and expression match Pass 1 exactly. Pass 2 refines surface detail and material rendering only — never restructure ANY figure.

PER-FIGURE FACE: each subject's identity, expression, head angle preserved exactly. Refine surface texture (skin or material), edge sharpness around eyes and lips, micro-shadow under brow, chin, and nose. NEVER alter facial proportions, age read, eye position, or mouth shape on ANY figure. NEVER swap one face for another. NEVER blend two subjects' features together.

PER-FIGURE HANDS: every finger fully articulated as in Pass 1 across every subject. NEVER fuse fingers, NEVER simplify gestures, NEVER substitute hand poses.

GROUP ARRANGEMENT: the spatial relationship between figures is locked. Subjects stay in their Pass 1 positions, at their Pass 1 heights, with their Pass 1 eye-lines and physical contact. Refine surface detail at points where bodies touch — never relocate the figures.

HEIGHT CLASS: adult figures stay at adult proportions, child figures stay at child proportions, infants stay at infant proportions. NEVER scale a child figure up to adult height in the refinement. If Pass 1 rendered a 5-person family with a clear child figure, Pass 2 keeps that child figure at child scale.`

const PASS2_MATERIAL_REFINEMENT_BY_PRESET: Record<GroupsPresetId, string> = {
  resin: `MATERIAL REFINEMENT — HAND-PAINTED RESIN (across every subject):
Collectible-grade smooth resin with crisp hand-painted detail. Refine paint-edge crispness, satin finish variation, fine sculpted detail where Pass 1 placed it. Colors stay faithful to Pass 1 — do not repaint or recolor.`,

  plushy: `MATERIAL REFINEMENT — PLUSHY (across every subject):
Stitched fabric with visible seams, embroidered features. Refine stitch density on each face's embroidery, fabric weave variation between figures, exposed batting where Pass 1 already showed it. Plushy register stays SOFT — no hard edges, no photoreal materials.`,

  wood: `MATERIAL REFINEMENT — CARVED WOOD (across every subject):
Refine grain flow continuity across all figures, chisel-mark texture, polish variation on faces and torsos vs hand-tooled rougher zones. Wood color variation comes from grain and lighting only — NO paint, NO source-photo colors carried over.`,

  wax: `MATERIAL REFINEMENT — WAX (across every subject):
Refine translucent depth variation by thickness, surface sheen, drip detail where Pass 1 already showed it. NO painted color on faces; the wax IS the color.`,

  marble: `MATERIAL REFINEMENT — CARVED MARBLE:
Refine veining flow, polished-vs-tooled surface variation, hand-tooled edge softening. Preserve the cool stone color Pass 1 produced — never warm-shift toward cream. NO source-photo colors carried over.`,

  terracotta: `MATERIAL REFINEMENT — WEATHERED TERRACOTTA (across every subject):
Solid weathered terracotta — warm earth-orange-brown throughout. Refine pitting and erosion details where Pass 1 placed them, lighter inner clay revealed at cracks, archaeological surface variation. NO source-photo colors.`,

  bronze: `MATERIAL REFINEMENT — CAST BRONZE (across every subject):
Solid cast bronze with verdigris in recesses, polish on high points. Refine verdigris variation across figures (more weathered in shadow recesses, polished on raised features), patina depth on the base. NO painted color.`,

  iron: `MATERIAL REFINEMENT — FORGED IRON (across every subject):
Deep charcoal-black iron with a soft gunmetal sheen. Refine hammer-work texture where Pass 1 placed it, burnished highlights on raised features, oxide patina depth in recesses. NO paint, NO flesh tones, NO orange rust.`,

  alabaster: `MATERIAL REFINEMENT — TRANSLUCENT ALABASTER (across every subject):
Solid translucent alabaster — off-white to warm-cream throughout. Internal glow varies with thickness. Refine the translucent depth, polished surface micro-detail, thin glowing edges where light passes through. NO painted color; the stone IS the color.`,
}

const PASS2_LOCATION_PRESERVATION: Record<LocationId, string> = {
  mantel: `LOCATION PRESERVATION (MANTEL):
PRESERVE the upscale mantel staging Pass 1 set: white painted paneling, marble surface, gilt mirror, brass candlesticks, art books, stoneware vase with branches. Refine marble veining, brass tarnish patterns, paper texture on book spines, mirror reflection of paneling (NOT of the figure). Magazine-curated character stays intact.`,

  tea_house: `LOCATION PRESERVATION (TEA HOUSE):
PRESERVE the Japanese tea-house garden staging: dark wood post-and-beam, shoji screens, raked gravel, anchor stones with moss, twisted pine bonsai or maple. Refine raked-gravel texture, moss density on the anchor stone, wood grain on the post-and-beam, paper texture on shoji. Wabi-sabi restraint stays intact.`,

  pedestal: `LOCATION PRESERVATION (PEDESTAL — BURLED WALNUT LIBRARY):
PRESERVE the private library staging: burled walnut surface, leather-bound books receding into shadow, conservatory visible through arched window, brass desk lamp with green glass shade. Refine the burled walnut figured-grain swirl, gilt lettering on book spines, conservatory glass diffusion, brass-and-glass lamp glow.`,

  wall_mount: `LOCATION PRESERVATION (WALL MOUNT):
PRESERVE the gallery wall presentation: clean neutral wall surface, no pedestal, no shelf, generous negative space, subtle directional shadow from the mounted piece. Refine wall plaster texture, shadow softness, edge crispness of the sculpture against the wall.`,

  plushy_shelf: `LOCATION PRESERVATION (PLUSHY SHELF):
PRESERVE the child's pillow-nest staging: surrounding plushies, soft cream linens, knitted blanket, cloth-spine books, warm soft lighting. Refine fabric weave on each surrounding plushy, pillow folds, knitted texture, warm lamp glow. NO formal plinth — the plushies are the staging.`,
}

// ── BUILD THE PROMPT ─────────────────────────────────────────

export function buildPass2Prompt(input: {
  presetId:   GroupsPresetId
  locationId: LocationId
}): string {
  return [
    PASS2_CORE,
    PASS2_FIGURE_PRESERVATION,
    PASS2_MATERIAL_REFINEMENT_BY_PRESET[input.presetId] || PASS2_MATERIAL_REFINEMENT_BY_PRESET.alabaster,
    PASS2_LOCATION_PRESERVATION[input.locationId] || PASS2_LOCATION_PRESERVATION.mantel,
  ].join('\n\n')
}

// ── REFINE CALL ──────────────────────────────────────────────

export interface GroupsPass2Input {
  imageB64:     string
  presetId:     GroupsPresetId
  locationId:   LocationId
  aspectRatio:  string
  openaiApiKey: string
}

export interface GroupsPass2Output {
  imageB64:    string
  refined:     boolean
  durationMs:  number
  reason?:     string
}

const PASS2_QUALITY = 'high' as const   // gpt-image-1 high quality (~$0.19)

function aspectToSize(ar: string): '1024x1024' | '1024x1536' | '1536x1024' {
  if (ar === '2:3' || ar === '3:4') return '1024x1536'
  if (ar === '3:2' || ar === '4:3' || ar === '16:9') return '1536x1024'
  return '1024x1024'
}

export async function refineGroupsImage(
  input: GroupsPass2Input,
): Promise<GroupsPass2Output> {

  const t0 = Date.now()
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const prompt = buildPass2Prompt({
    presetId:   input.presetId,
    locationId: input.locationId,
  })

  console.log(
    `[groups/pass2] start preset=${input.presetId} loc=${input.locationId} ` +
    `prompt_chars=${prompt.length}`,
  )

  try {
    const buf = Buffer.from(input.imageB64, 'base64')
    const file = await toFile(buf, 'pass1.png', { type: 'image/png' })

    const result = await openai.images.edit({
      model:    'gpt-image-1',
      prompt,
      image:    file as any,
      size:     aspectToSize(input.aspectRatio),
      quality:  PASS2_QUALITY,
      n:        1,
    })

    const b64 = result.data?.[0]?.b64_json
    if (!b64) throw new Error('gpt-image-1 returned no b64_json')

    const durationMs = Date.now() - t0
    console.log(`[groups/pass2] refine done in ${durationMs}ms`)

    return {
      imageB64:   b64,
      refined:    true,
      durationMs,
    }
  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    console.warn(`[groups/pass2] refine failed, returning Pass 1: ${msg}`)
    return {
      imageB64:   input.imageB64,
      refined:    false,
      durationMs: Date.now() - t0,
      reason:     `error: ${msg}`,
    }
  }
}
