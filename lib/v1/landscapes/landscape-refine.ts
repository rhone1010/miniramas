// lib/v1/landscapes/landscape-refine.ts
//
// Pass 2 of the 2-pass Landscape pipeline.
//
// Pass 1 (NB2 / google/nano-banana-2) handles structure, composition,
// camera, containment, circular-base logic, and environment selection.
// Pass 2 (this module, gpt-image-1) takes Pass 1's output and refines
// material realism, micro-texture, and lighting depth — without
// overriding the environment Pass 1 established.
//
// New in this revision: Pass 2 is environment-aware. Pass 1's resolved
// environment (controlled or in_situ) is passed in and used to emit
// reinforcing language for that mode specifically. This was added because
// Pass 2's product-photography prior was reintroducing wood tables under
// dioramas that Pass 1 had correctly placed on outdoor terrain.
//
// Failure of this stage is non-fatal. The caller is expected to fall back
// to the Pass 1 output if refine throws.

import OpenAI, { toFile } from 'openai'
import type { AspectRatio, PlaqueMode, ResolvedEnvironment } from './landscape-shared'
import { buildPass2PlaqueBlock } from './landscape-plaque'

// ── PASS 2 PROMPT — BASE ──────────────────────────────────────
// Composition / structure / camera owned by Pass 1. Pass 2's job is
// realism and micro-texture. Crucial: tells Pass 2 NOT to redesign the
// layout or the surrounding environment.
const PASS2_BASE = `Transform this miniature diorama into a highly realistic, gallery-quality photographed scale model.

Preserve the exact composition, camera angle, plinth shape, scene boundaries, and object placement from the source image. Do not redesign the layout. Do not change the environment, ground type, or surrounding setting from what is shown in the source image — refine its realism only.

Enhance material realism and craftsmanship:
- terrain has fine variation, grit, irregularity, and natural imperfections
- vegetation has organic density, randomness, layered branching, and non-repeating structure
- water, if present, has depth, reflection, transparency, and surface variation
- stone, soil, sand, bark, grass, and foliage each have distinct miniature-scale texture
- the walnut plinth shows rich grain, polish, subtle wear, and realistic reflections
- all edges feel physically constructed, not digitally generated

Lighting becomes physically believable:
- the primary light source defines the diorama brightly relative to its surroundings
- shadows are directional with realistic falloff
- atmosphere appears only as subtle dust, haze, mist, or light interaction when physically justified

Increase micro-detail and tactile realism. Avoid smoothing, simplification, plastic texture, repeated patterns, or artificial symmetry.

Do not add: domes, glass covers, background plates, printed scenery, sky panels, artificial arches, enclosing rings, or new scenery outside the plinth.

Final image should feel like a professional gallery-quality photograph of a handcrafted museum miniature: rich, tactile, detailed, physically real, and emotionally memorable.`

// ── PASS 2 ADD-ON — NATURAL VARIATION & IMPERFECTION ──────────
const PASS2_ADDON = `Increase realism through natural variation and handcrafted imperfection:
- All organic elements (trees, branches, roots, grasses, terrain) must be non-uniform, asymmetrical, and non-repeating, with dense, chaotic micro-structure rather than sparse or patterned growth
- Introduce subtle handcrafted imperfections: slight warping, irregular alignment, minor wear, and uneven construction across wood, stone, and terrain surfaces
- Edge transitions at the diorama boundary should feel naturally broken and feathered using vegetation, soil variation, rocks, or erosion, avoiding clean or cut edges
- Atmospheric effects (mist, fog, light rays) must vary spatially in density and placement, forming localized pockets influenced by terrain and water, never uniform or evenly distributed

Preserve composition exactly while increasing tactile realism, micro-detail, and physical believability.`

// ── PASS 2 ENVIRONMENT REINFORCEMENT ──────────────────────────
// Mode-specific reinforcement. Without this, Pass 2's default product-
// photography prior reintroduces wood tables under in-situ dioramas.
const PASS2_ENV_BLOCKS: Record<ResolvedEnvironment, string> = {
  controlled: `ENVIRONMENT REINFORCEMENT (CONTROLLED):
The diorama sits in a richly-appointed indoor setting — bookshelves, framed prints, layered props softly out of focus behind the model. The plinth rests on a polished wood desk, stone shelf, or similar refined surface consistent with an upscale study. Reinforce material realism for the diorama itself; keep the room secondary and softly blurred. Any visible light fixtures stay positioned out of frame so their light is felt but the source is not seen.`,

  in_situ: `ENVIRONMENT REINFORCEMENT (IN-SITU — OUTDOORS ONLY):
The diorama is OUTDOORS, photographed in nature. The plinth sits directly on natural terrain (grass, dirt, sand, rock, moss, leaf litter) that continues the source environment. The background is a blurred continuation of the source scene — sky, foliage, terrain, weather.

DO NOT add or reintroduce any of the following anywhere in frame, even partially:
  • wood tables, desks, shelves, mantles, counters, or any constructed wood surface
  • tile, polished stone, painted wood, or neutral interior floors
  • room walls, ceilings, windows, doors, or any furniture
  • indoor lighting fixtures, hanging bulbs, or visible lamps
The setting beneath and around the plinth is natural ground only. If the source image shows the diorama on natural terrain, preserve that ground exactly — do not replace it with a desk or table surface.`,
}

// ── PASS 2 PLAQUE INSTRUCTION ─────────────────────────────────
// Mode-aware. Logic lives in landscapes-plaque.ts so Pass 1 and Pass 2 align.

function buildPass2Prompt(opts: {
  plaqueMode:          PlaqueMode
  plaqueText?:         string
  resolvedEnvironment: ResolvedEnvironment
}): string {
  const blocks: string[] = [
    PASS2_BASE,
    PASS2_ENV_BLOCKS[opts.resolvedEnvironment],
    PASS2_ADDON,
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
  resolvedEnvironment:  ResolvedEnvironment   // NEW — drives env reinforcement
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
