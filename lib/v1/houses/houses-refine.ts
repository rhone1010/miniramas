// houses-refine.ts
// lib/v1/houses/houses-refine.ts
//
// ⚠ RECONSTRUCTION (2026-06-06). The original of this file was
// accidentally overwritten by the Curator source analyzer (now living
// correctly at houses-analyze.ts) before it reached git. This module
// was rebuilt from its direct sibling, landscapes-refine.ts, against
// the exact contract the live houses-generator.ts calls:
//
//   refineHouse({ imageB64, aspectRatio, resolvedEnvironment,
//                 presetId, timeOfDay, openaiApiKey })
//     → { imageB64, durationMs, promptUsed }
//
// If the original surfaces in git history (`git log --oneline --
// lib/v1/houses/houses-refine.ts`), prefer it over this rebuild.
//
// ── What this stage is ──
// Pass 2 of the opt-in 2-pass Houses pipeline (request.refine === true).
// Pass 1 (NB2) owns structure, composition, camera, architectural
// fidelity, environment, and atmospheric character. Pass 2 (gpt-image-1)
// refines material micro-texture, tiered luminance, base geometry, and
// miniature-scale credibility — WITHOUT overriding Pass 1's identity.
// Per the studio's Pass 2 principle: design-agnostic. No style
// prescriptions, no scene redesign, no material substitution.
//
// Failure of this stage is non-fatal — the caller falls back to the
// Pass 1 output (houses-generator.ts soft-fail).

import OpenAI, { toFile } from 'openai'
import type { AspectRatio, EnvironmentId, PresetId, TimeOfDay } from './houses-shared'

// ──────────────────────────────────────────────────────────────
// PASS 2 PROMPT BLOCKS
// ──────────────────────────────────────────────────────────────

// CORE — composition + identity lock, scope of work.
const PASS2_CORE = `Transform this miniature architectural model into a gallery-quality photograph of a real handcrafted collectible. Preserve the source image's composition, camera angle, base, environment, and the building's architecture EXACTLY — every roofline, window, dormer, chimney, porch, and proportion stays where Pass 1 placed it. Refine realism only — no layout changes, no architectural changes, no environment substitution, no material substitution, no scene redesign.`

// REALISM — material micro-texture and miniature-scale credibility.
// Deliberately material-agnostic: it sharpens whatever material Pass 1
// rendered rather than prescribing one.
const PASS2_REALISM = `REALISM:
Every surface reads at miniature scale with natural imperfection in whatever material Pass 1 established — refine that material's character, never replace it. Roof courses, siding, brickwork, trim profiles, and window mullions carry crisp, distinct micro-texture. Glazing shows believable depth and reflection. Landscaping reads as model-grade craft: organic density, randomized non-repeating structure, fine grit in ground cover. The display base keeps its established shape and proportion — refine its material figure and finish (grain, polish, sheen) without growing it taller or wider. Edges read as physically constructed, not digitally generated. Avoid plastic smoothing, repeated tiling patterns, symmetric duplication, and sparse uniformity.`

// LIGHTING — tiered luminance, preserve Pass 1's atmosphere.
const PASS2_LIGHTING = `LIGHTING:
The model renders brighter than its surroundings with directional shadow falloff. Apply tiered localized luminance: the building itself (~1.45x exposure) is the brightest element — facade details, roof planes catching light, and any plaque; foreground grounds and near-rim landscaping (~1.2x) provide depth separation; background and surroundings remain at baseline, deliberately underexposed by comparison. Within lifted tiers, light varies locally — facets and surfaces catch at different intensities, never a uniform wash. PRESERVE Pass 1's atmospheric phenomena and mood exactly — haze, glow, weather, dramatic sky, interior window light. Refine for physical believability; do not mute, soften, or remove them.`

// INTERIOR GLOW — only meaningful when windows carry light.
const PASS2_INTERIOR = `INTERIOR LIGHT:
Where Pass 1 shows lit windows, refine the warm interior glow for credibility — light originates inside the rooms, falls off naturally, and reads warmer than the exterior light. Never add lit windows where Pass 1 shows none; never extinguish windows Pass 1 lit.`

// CONTAINMENT — 3D-physical assertion (mirrors the landscapes r10 fix).
const PASS2_CONTAINMENT = `CONTAINMENT (CRITICAL):
The model is always real 3D physical content — an actual miniature building with grounds — standing as a solid object on its base. Never a printed image, painted backdrop, billboard, curved display panel, framed picture, or display screen. No glass dome, bell jar, cloche, display case, or transparent cover unless Pass 1 already established one (snow globe). The space above the model is open air.`

// ENV REINFORCEMENT — two environments, matching houses-shared.ts.
// in_situ block header reads "IN-ENVIRONMENT" to match the user-facing
// label "In Environment".
const PASS2_ENV_BLOCKS: Record<EnvironmentId, string> = {
  desk: `ENVIRONMENT (STUDIO GRADIENT):
The model stands against a clean, seamless studio gradient backdrop — a smooth continuous neutral sweep with no furniture, no props, no room, no visible horizon or seam. The model is the single subject, large and centered, meeting its own soft contact shadow on a floor that blends seamlessly into the gradient. Preserve the backdrop Pass 1 established; do not add a desk, table, shelf, room, or props. Light sources stay out of frame — their light is felt, never seen.`,

  in_situ: `ENVIRONMENT (IN-ENVIRONMENT — OUTDOORS):
The model is outdoors, photographed on location. The base sits directly on natural ground that continues the scene; the background is a blurred continuation of the real setting. NEVER add desks, tables, shelves, room walls, ceilings, windows, furniture, or indoor lighting. Natural ground only beneath and around the base.`,

  room_in_house: `ENVIRONMENT (ROOM IN THIS HOUSE):
The model sits on a side table or pedestal inside an interior room of the very house it depicts — period furniture, wallpaper or paneling, framed art softly out of focus around it. The model is razor sharp; the room recedes into atmospheric blur. Preserve the room's established character and mood exactly. Light sources stay out of frame — their light is felt, never seen.`,
}

// ──────────────────────────────────────────────────────────────
// ASSEMBLER + SIZE MAPPING
// ──────────────────────────────────────────────────────────────

function buildPass2Prompt(opts: {
  resolvedEnvironment: EnvironmentId
  timeOfDay:           TimeOfDay
}): string {
  const blocks: string[] = [
    PASS2_CORE,
    PASS2_REALISM,
    PASS2_LIGHTING,
    PASS2_INTERIOR,
    PASS2_CONTAINMENT,
    PASS2_ENV_BLOCKS[opts.resolvedEnvironment],
  ]
  if (opts.timeOfDay === 'night') {
    blocks.push(`NIGHT:
This is a night scene. Preserve the established darkness, moonlight or ambient night character, and the contrast between warm interior window light and the cool exterior. Do not brighten the scene toward daylight.`)
  }
  return blocks.join('\n\n')
}

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

// ──────────────────────────────────────────────────────────────
// MAIN ENTRY POINT — contract matches the live generator call.
// ──────────────────────────────────────────────────────────────
export async function refineHouse(input: {
  imageB64:            string
  aspectRatio?:        AspectRatio
  resolvedEnvironment: EnvironmentId
  presetId:            PresetId
  timeOfDay:           TimeOfDay
  openaiApiKey:        string
}): Promise<{ imageB64: string; durationMs: number; promptUsed: string }> {

  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const size   = aspectToGptSize(input.aspectRatio)
  const prompt = buildPass2Prompt({
    resolvedEnvironment: input.resolvedEnvironment,
    timeOfDay:           input.timeOfDay,
  })

  const buf  = Buffer.from(input.imageB64, 'base64')
  const file = await toFile(buf, 'pass1.png', { type: 'image/png' })

  console.log(
    `[houses/refine] Pass 2 dispatching: preset=${input.presetId} ` +
    `env=${input.resolvedEnvironment} tod=${input.timeOfDay} ` +
    `aspect=${input.aspectRatio || 'auto'} size=${size} ` +
    `input_bytes=${buf.length} prompt_chars=${prompt.length}`,
  )

  const t0 = Date.now()

  const res = await openai.images.edit({
    model:  'gpt-image-1',
    image:  file,
    prompt,
    // gpt-image-1 accepts 1536x1024 / 1024x1536 at runtime, but the installed
    // openai types still constrain images.edit.size to the DALL·E-2 union.
    // Cast until the SDK types catch up (same drift across all gpt-image lanes).
    size:   (size === 'auto' ? undefined : size) as '1024x1024' | undefined,
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('GPT-image-1 returned no image data')
  }

  const durationMs = Date.now() - t0
  console.log(`[houses/refine] Pass 2 done in ${durationMs}ms · output_chars=${b64.length}`)

  return { imageB64: b64, durationMs, promptUsed: prompt }
}
