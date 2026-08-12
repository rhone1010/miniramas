// lib/v1/wallpapers/studio-generator.ts
//
// THE STUDIO. Four dropdowns, no photograph, no prompt box, no LLM.
//
//   Stage 1  studio-prompt.buildRound -> four prompts
//   Stage 2  flux-schnell, four calls in parallel
//   Stage 3  watermark burned into each preview
//
// No NB2, no outpaint, no scoring. The Studio shares nothing with
// wallpapers-generator.ts except the silo it lives in — different model,
// different price, no source image, and its composition block is inside
// studio-prompt.ts rather than appended from wallpapers-shared.
//
// ── THE MODEL STRING IS HARDCODED AND MUST STAY THAT WAY ───────────────
//
// flux-schnell is Apache-2.0 and sellable. flux-dev is NON-COMMERCIAL, ten
// times the price, and one word away in the same namespace.
//
// If that string ever came from config or an environment variable, a typo
// would mean selling images we have no right to sell — and NOTHING IN THE
// PRODUCT WOULD LOOK WRONG. The images would be good, the page would work,
// and the fault would surface as a letter rather than an error.
//
// Do not parameterise this. Do not read it from env. Do not add a model
// argument "for testing".
//
// ── FOUR CALLS, NOT ONE CALL FOR FOUR ──────────────────────────────────
//
// flux-schnell takes num_outputs, but the four images in a round are four
// DIFFERENT prompts — buildRound spreads the Energy axis so the round is
// four different pictures rather than four samples of one. So it is four
// predictions, fired together.
//
// They are returned in buildRound's order and settled independently: the
// page shows each as it lands, and one failure costs one tile rather than
// the round.

import sharp from 'sharp'
import { buildRound, isValid, remix, REMIXES, type Choice } from './studio-prompt'
import { litenMarkGroup, LITEN_MARK_ASPECT } from './liten-mark'

// ── HARDCODED. SEE THE HEADER. ──
const FLUX_URL =
  'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions'

/** 9:16. Previews and kept files are the same pixels — the only difference
 *  is the watermark. See the note on regenerateAtFullSize below. */
export const STUDIO_WIDTH  = 768
export const STUDIO_HEIGHT = 1344

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 20
const POLL_DELAY_MS     = 1000

export interface StudioImage {
  /** Stable within a round. The id `keep` is called back with. */
  id:       string
  energy:   string
  prompt:   string
  seed:     number
  /** Watermarked. This is what the page is shown. */
  preview:  Buffer
  /** Clean. NEVER returned to a browser before keep is paid. */
  clean:    Buffer
}

export interface StudioRoundResult {
  ok:      boolean
  images:  StudioImage[]
  /** One entry per prompt that failed. A partial round still returns ok. */
  errors:  { index: number; message: string }[]
  duration_ms: number
}

export interface GenerateStudioRoundInput {
  choice:            Choice
  /** Optional remix id from REMIXES. Anything unknown is ignored rather
   *  than refused — a stale button on a cached page is not an error. */
  remixId?:          string
  /** Accepted and ignored until Rich's vocabulary lands. Present so the
   *  page can ship first. */
  season?:           string | null
  replicateApiToken: string
  /** Burned-in watermark. Omit ONLY for internal shoots. */
  watermark?:        boolean
}

export async function generateStudioRound(
  input: GenerateStudioRoundInput,
): Promise<StudioRoundResult> {

  const t0 = Date.now()

  if (!isValid(input.choice)) {
    throw new Error('studio: invalid choice')
  }

  const round = buildRound(input.choice)

  const prompts = round.map(r => ({
    energy: r.energy,
    prompt: input.remixId ? remix(r.prompt, input.remixId) : r.prompt,
  }))

  const roundId = cryptoId()
  const wantWatermark = input.watermark !== false

  const settled = await Promise.allSettled(
    prompts.map(async (p, i) => {
      const seed  = randomSeed()
      const clean = await callFlux({
        prompt:            p.prompt,
        seed,
        replicateApiToken: input.replicateApiToken,
      })
      const preview = wantWatermark ? await watermark(clean) : clean
      return {
        id:      `${roundId}-${i}`,
        energy:  p.energy,
        prompt:  p.prompt,
        seed,
        preview,
        clean,
      } as StudioImage
    }),
  )

  const images: StudioImage[] = []
  const errors: { index: number; message: string }[] = []

  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') images.push(s.value)
    else errors.push({ index: i, message: s.reason?.message || 'flux failed' })
  })

  console.log(
    `[studio] round in ${Date.now() - t0}ms — ` +
    `world=${input.choice.world} mood=${input.choice.mood} ` +
    `energy=${input.choice.energy} palette=${input.choice.palette} ` +
    `remix=${input.remixId ?? '-'} ok=${images.length}/4`,
  )

  return {
    ok:          images.length > 0,
    images,
    errors,
    duration_ms: Date.now() - t0,
  }
}

/** Whether a remix id is one of ours. The route validates with this rather
 *  than trusting the page. */
export function isRemixId(v: unknown): v is string {
  return typeof v === 'string' && REMIXES.some(r => r.id === v)
}

// ─── WATERMARK ──────────────────────────────────────────────────
//
// Burned in, not a CSS overlay. Anybody can screenshot past an overlay and
// the clean file is the entire thing being sold.
//
// Faint on purpose. Somebody screenshots a preview and puts it on their
// phone anyway, and a watermarked wallpaper on somebody's phone is an
// advertisement. This is not trying to make the preview useless — it is
// trying to make the clean one worth $1.99.

const WATERMARK_OPACITY = 0.22   // Rich: 18-25%
const WATERMARK_ANGLE   = -30    // degrees
const WATERMARK_WIDTH   = 0.55   // fraction of image width

/**
 * The mark, from lib/v1/wallpapers/liten-mark.ts.
 *
 * The path data is inlined there rather than read from
 * public/liten-and-co.svg, because public/ is served by the CDN and is not
 * guaranteed to be on a serverless function's disk. The watermark is the
 * only thing protecting the file being sold; it cannot depend on a read
 * that might not happen.
 *
 * The source SVG already carries "LITEN CO" as lettering paths, so nothing
 * is drawn as text here — no font has to be present on the runtime for the
 * wordmark to appear, which is one more thing that cannot silently differ
 * between local and production.
 */
function watermarkSvg(imageWidth: number, imageHeight: number): Buffer {
  const w  = imageWidth * WATERMARK_WIDTH
  const h  = w * LITEN_MARK_ASPECT
  const x  = (imageWidth  - w) / 2
  const y  = (imageHeight - h) / 2
  const cx = imageWidth  / 2
  const cy = imageHeight / 2

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${imageWidth}" height="${imageHeight}" ` +
    `viewBox="0 0 ${imageWidth} ${imageHeight}">` +
      `<g transform="rotate(${WATERMARK_ANGLE} ${cx} ${cy})" ` +
         `opacity="${WATERMARK_OPACITY}">` +
        litenMarkGroup({ x, y, width: w, fill: '#ffffff' }) +
      `</g>` +
    `</svg>`,
  )
}

async function watermark(clean: Buffer): Promise<Buffer> {
  const meta = await sharp(clean).metadata()
  const w = meta.width  || STUDIO_WIDTH
  const h = meta.height || STUDIO_HEIGHT

  return sharp(clean)
    .composite([{ input: watermarkSvg(w, h), blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer()
}

// ─── FLUX CALL ──────────────────────────────────────────────────

async function callFlux(input: {
  prompt:            string
  seed:              number
  replicateApiToken: string
}): Promise<Buffer> {

  const body = {
    input: {
      prompt:          input.prompt,
      aspect_ratio:    '9:16',
      output_format:   'jpg',
      output_quality:  95,
      num_outputs:     1,
      megapixels:      '1',
      seed:            input.seed,
      go_fast:         true,
      // Safety checker left ON. There is no free text in this product, but
      // four dropdowns are not a reason to turn a guard off.
    },
  }

  const res = await fetch(FLUX_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${input.replicateApiToken}`,
      'Content-Type':  'application/json',
      'Prefer':        `wait=${SYNC_WAIT_SECONDS}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`flux POST failed (${res.status}): ${errText.slice(0, 240)}`)
  }

  const prediction = await res.json()

  if (prediction.status === 'succeeded' && prediction.output) {
    return await fetchBuffer(pickOutputUrl(prediction.output))
  }

  if (prediction.urls?.get) {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_DELAY_MS))
      const pollRes = await fetch(prediction.urls.get, {
        headers: { 'Authorization': `Token ${input.replicateApiToken}` },
      })
      if (!pollRes.ok) throw new Error(`poll failed (${pollRes.status})`)
      const polled = await pollRes.json()
      if (polled.status === 'succeeded' && polled.output) {
        return await fetchBuffer(pickOutputUrl(polled.output))
      }
      if (polled.status === 'failed' || polled.status === 'canceled') {
        throw new Error(`prediction ${polled.status}: ${polled.error || ''}`)
      }
    }
  }

  throw new Error(`flux timed out — status=${prediction.status}`)
}

function pickOutputUrl(output: any): string {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && output.length > 0) return output[0]
  throw new Error('flux output URL not found')
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`output fetch failed (${r.status})`)
  return Buffer.from(await r.arrayBuffer())
}

// ─── SMALL HELPERS ──────────────────────────────────────────────

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647)
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10)
}
