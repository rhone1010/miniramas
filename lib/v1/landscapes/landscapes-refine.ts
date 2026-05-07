// lib/v1/landscapes/landscapes-refine.ts
//
// Pass 2 of the 2-pass Landscape pipeline.
//
// Pass 1 (NB2 / google/nano-banana-2) handles structure, composition,
// camera, containment, circular-base logic, and environment selection.
// Pass 2 (this module, gpt-image-1) takes Pass 1's output and refines
// material realism, micro-texture, and lighting depth — without
// overriding the composition or environment Pass 1 established.
//
// Pass 1 = structure. Pass 2 = paint. Lighting is shared across both:
// Pass 1 establishes direction, atmosphere, and which features are
// brightest; Pass 2 refines how convincingly that lighting renders.
// If Pass 2's prompt contradicts Pass 1's lighting direction, Pass 2
// (the painter) wins because it has the last word on the surface.
// PASS2_LIGHTING is therefore phrased to PRESERVE Pass 1's atmospheric
// phenomena, not constrain them.
//
// REVISION HISTORY:
//   • r1: Pass 2 added (separate from Pass 1 NB2 generation)
//   • r2: env-aware reinforcement (controlled vs in_situ) added because
//         gpt-image-1's product-photo prior was reintroducing wood tables
//         under outdoor in-situ dioramas
//   • r3: compressed ~30% by deduping vs PASS2_ADDON, extracted
//         CONTAINMENT as a named prominent block with explicit ban on
//         glass dome / bell jar / cloche / display case, dome-canopy
//         loophole closed
//   • r4: CONTAINMENT extended to ban floating atmospheric phenomena
//         (clouds/sun-discs/halos) hovering above the diorama as filler
//   • r5: in-situ env block header → "IN-ENVIRONMENT" matching
//         user-facing label. Internal env ID stays 'in_situ' for code
//         stability.
//   • r6 (this): two coordinated changes addressing the "muted beams
//         + flat brightness" symptom in current renders.
//
//         (a) PASS2_LIGHTING flipped from constrain-down to preserve.
//             Previous wording — "atmospheric effects appear only as
//             physically justified" — was Pass 2 actively suppressing
//             the volumetric drama Pass 1 established. New wording
//             explicitly preserves Pass 1's god-rays, sun shafts,
//             moonbeams, and beam-on-mist interaction; refines for
//             miniature-scale credibility without muting. Adds
//             localized luminance shaping language matching Pass 1's
//             new focal directive ("brightest points in the frame").
//
//         (b) PASS2_REALISM plinth phrase rewritten in lockstep with
//             effects.ts new PLINTH_BLOCK. Pass 1 says "low turned-wood
//             disc with a single soft curved side wall, never tiered or
//             stacked"; Pass 2 must say the same thing or gpt-image-1
//             reverts the plinth shape. Lockstep is critical — if the
//             two passes describe the plinth differently, Pass 2 wins
//             and the regression returns.
//
// Failure of this stage is non-fatal. The caller is expected to fall
// back to the Pass 1 output if refine throws.

import OpenAI, { toFile } from 'openai'
import type { AspectRatio, PlaqueMode, ResolvedEnvironment } from './landscapes-shared'
import { buildPass2PlaqueBlock } from './landscapes-plaque'

// ──────────────────────────────────────────────────────────────
// PASS 2 PROMPT BLOCKS — named, compressed, deduped
// ──────────────────────────────────────────────────────────────

// CORE — composition lock + scope of work.
const PASS2_CORE = `Transform this miniature diorama into a gallery-quality photograph of a real handcrafted scale model. Preserve the source image's composition, camera, plinth, ground, and scene boundaries exactly. Refine realism only — no layout changes, no environment substitution, no scene redesign.`

// REALISM — material, texture, micro-detail, natural variation.
// Plinth language must match effects.ts PLINTH_BLOCK — any mismatch
// lets gpt-image-1's product-base prior pull the plinth shape away
// from Pass 1.
const PASS2_REALISM = `REALISM:
Each material reads at miniature scale with natural imperfection. Terrain: fine grit, irregular variation. Vegetation: organic density, randomized non-repeating branching, dense chaotic micro-structure. Water (when present): depth, reflection, transparency, surface variation. Stone, soil, bark, grass, foliage: distinct miniature-scale texture. Walnut plinth: low turned-wood disc with a single soft curved side wall — never tiered, stacked, slab-like, or chunky. Richly figured grain in walnut or mahogany, deep polished sheen. Visual interest from grain, not profile. Plinth front rim stays clean — no fallen branches, twigs, or debris at the front edge. Edges read as physically constructed, not digitally generated. Atmospheric effects (mist, fog, light rays) vary spatially — localized pockets influenced by terrain and water, never uniform. Edge transitions at the diorama boundary feel naturally broken via vegetation, soil variation, rocks, or erosion. Avoid smoothing, plastic finish, repeated patterns, symmetric arrangements, sparse uniformity.`

// LIGHTING — preserve Pass 1's atmospheric phenomena, refine for
// miniature-scale credibility. Localized luminance shaping mirrors
// Pass 1's focal directive so the painter actually paints the
// hierarchy Pass 1 structured.
const PASS2_LIGHTING = `LIGHTING:
The diorama renders brighter than its surroundings with directional shadow falloff. Localized luminance shaping: hero subject, plaque, and standout features are the brightest points in the frame; surroundings are deliberately underexposed by comparison. PRESERVE Pass 1's atmospheric phenomena — visible sun shafts, god-rays, moonbeams, beam-interaction with mist and particulate, the dramatic volumetric depth Pass 1 established. Refine these for physical believability and miniature-scale credibility; do not mute, soften, or remove them.`

// CONTAINMENT — physical-vs-atmospheric containment + plinth
// geometry lock + offscreen handling + forced-perspective preservation.
// Handles four failure modes:
//   1. Physical scene (path/meadow/water) extending past plinth into a
//      forced-perspective horizon, treating the wooden ring as a
//      decorative inset on a real landscape.
//   2. Floating atmospheric phenomena (clouds/sun-discs/halos) hovering
//      above the diorama as objects.
//   3. Glass dome / canopy enclosures arching over the scene.
//   4. Wooden arch growing FROM the plinth itself (canopy-as-dome
//      loophole — the arch is technically continuous with the plinth's
//      material, so it evaded the glass-dome ban).
const PASS2_CONTAINMENT = `CONTAINMENT (CRITICAL):
The diorama is always open-air. The plinth is the only structure beneath the diorama, and the plinth's edge is the absolute boundary of the physical scene.

PHYSICAL elements — terrain, water, vegetation, structures, paths, rocks, props, figures — sit on or inside the wooden plinth. Never let physical content extend past the wooden disc, even when forced perspective or elevated angles create the illusion of a vast landscape. The foreshortening lives INSIDE the plinth, not beyond it. The plinth is not a decorative ring inset on a larger real landscape; it is the entire stage.

ATMOSPHERIC phenomena (fog, mist, light shafts, distant blur, haze) may extend past the plinth as background ambience — never as solid floating objects. No floating clouds, sun discs, halos, or fog masses hovering above the scene as filler.

PLINTH GEOMETRY: the plinth is always a flat cylindrical disc — top, bottom, and curved side wall. It NEVER extends upward into a wall, arch, half-dome, canopy, or enclosure, even when the upward extension would be wood matching the plinth itself. A wooden arch growing from the plinth is forbidden. No glass dome, bell jar, cloche, display case, transparent cover, background plates, printed scenery, sky panels, or rings.

If the source's composition forms an arch or converging shape (a road framed by tree canopies, a tunnel of branches, a corridor of rocks), reproduce that as TALL MINIATURE TREES or ROCKS standing as objects on the flat plinth — never as the diorama's enclosure. Tall elements are CROPPED BY THE IMAGE FRAME at the top if necessary, like a scale model photographed too close. Cropping is done by the camera, never by the plinth.`

// ENV REINFORCEMENT — mode-specific. Block header for in_situ reads
// "IN-ENVIRONMENT" to match the user-facing UI label "In Environment".
const PASS2_ENV_BLOCKS: Record<ResolvedEnvironment, string> = {
  controlled: `ENVIRONMENT (DESK):
Diorama sits on a polished wood desk, stone shelf, or refined surface in an upscale study — bookshelves, framed prints, layered props softly out of focus behind. The room is secondary; the diorama is the subject. Light fixtures stay positioned out of frame so their light is felt but the source is not seen.`,

  in_situ: `ENVIRONMENT (IN-ENVIRONMENT — OUTDOORS):
The diorama is outdoors, photographed in nature. The plinth sits directly on natural terrain (grass, dirt, sand, rock, moss, leaf litter) that continues the source environment. The background is a blurred continuation of the source scene — sky, foliage, terrain, weather.

NEVER add wood tables, desks, shelves, mantles, counters, tile, painted wood, room walls, ceilings, windows, doors, furniture, indoor lighting, hanging bulbs, or lamps. Natural ground only beneath and around the plinth. If the source shows the diorama on natural terrain, preserve that ground exactly.`,
}

// ──────────────────────────────────────────────────────────────
// PROMPT ASSEMBLER
// ──────────────────────────────────────────────────────────────

function buildPass2Prompt(opts: {
  plaqueMode:          PlaqueMode
  plaqueText?:         string
  resolvedEnvironment: ResolvedEnvironment
}): string {
  const blocks: string[] = [
    PASS2_CORE,
    PASS2_REALISM,
    PASS2_LIGHTING,
    PASS2_CONTAINMENT,
    PASS2_ENV_BLOCKS[opts.resolvedEnvironment],
  ]

  if (opts.plaqueMode === 'user' && opts.plaqueText?.trim()) {
    const safe = opts.plaqueText.trim().replace(/"/g, '\\"')
    blocks.push(`PLAQUE:
A small brass plaque is mounted on the front rim of the walnut plinth. The plaque reads exactly: "${safe}". Render the text clearly and legibly in engraved capitals. Do not change, abbreviate, paraphrase, or invent any other text on the plaque. Plaque text must never include timestamps, filenames, "Screenshot", or technical metadata under any condition.`)
  } else {
    blocks.push(buildPass2PlaqueBlock(opts.plaqueMode))
  }

  return blocks.join('\n\n')
}

// ── ASPECT → GPT-IMAGE-1 SIZE ─────────────────────────────────
type GptImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto'

function aspectToGptSize(aspect?: AspectRatio): GptImageSize {
  if (!aspect) return 'auto'
  const [w, h] = aspect.split(':').map(Number)
  if (!w || !h) return 'auto'
  const ratio = w / h
  if (ratio > 1.15) return '1536x1024'
  if (ratio < 0.87) return '1024x1536'
  return '1024x1024'
}

// ── INPUT/OUTPUT ──────────────────────────────────────────────
export interface RefineInput {
  imageB64:             string
  aspectRatio?:         AspectRatio
  plaqueMode:           PlaqueMode
  plaqueText?:          string
  resolvedEnvironment:  ResolvedEnvironment
  openaiApiKey:         string
}

export interface RefineOutput {
  imageB64:   string
  promptUsed: string
  size:       GptImageSize
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────
export async function refineLandscape(input: RefineInput): Promise<RefineOutput> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const size   = aspectToGptSize(input.aspectRatio)
  const prompt = buildPass2Prompt({
    plaqueMode:          input.plaqueMode,
    plaqueText:          input.plaqueText,
    resolvedEnvironment: input.resolvedEnvironment,
  })

  const buf  = Buffer.from(input.imageB64, 'base64')
  const file = await toFile(buf, 'pass1.png', { type: 'image/png' })

  console.log(
    `[landscape/refine] Pass 2 dispatching: aspect=${input.aspectRatio || 'auto'} ` +
    `size=${size} input_bytes=${buf.length} env=${input.resolvedEnvironment} ` +
    `plaque_mode=${input.plaqueMode}${input.plaqueText ? ` plaque_text="${input.plaqueText}"` : ''} ` +
    `prompt_chars=${prompt.length}`,
  )

  const t0 = Date.now()

  const res = await openai.images.edit({
    model:  'gpt-image-1',
    image:  file,
    prompt,
    size:   size === 'auto' ? undefined : size,
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('GPT-image-1 returned no image data')
  }

  console.log(
    `[landscape/refine] Pass 2 done in ${Date.now() - t0}ms · ` +
    `output_chars=${b64.length}`,
  )

  return {
    imageB64:   b64,
    promptUsed: prompt,
    size,
  }
}
