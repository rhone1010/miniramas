// lib/v1/wallpapers/wallpapers-generator.ts
//
// Orchestrator for the Mobile Wallpapers silo.
//
//   Stage 1  NB2 generate at 9:16
//   Stage 2  Stability outpaint — ONLY if the render came back short
//   Stage 3  (none)
//
// ── NO SCORING, DELIBERATELY ───────────────────────────────────────────
//
// Groups scores per-figure likeness and retries once. Wallpapers do not,
// for now, because a $2.99 download cannot carry the cost of a second NB2
// call plus two vision calls on every render, and because the scorer this
// repo has is a likeness scorer — the wrong question for an effect where
// the subject may be a pet, an action scene, or whatever Open Studio was
// asked for.
//
// This means a bad wallpaper ships. That is the same open item raised in
// three Portraits carryovers and still unruled: failed renders return
// ok=true and land in the collection. Wallpapers make it cheaper to be
// wrong, not acceptable.
//
// ── OUTPAINT IS A FALLBACK ─────────────────────────────────────────────
//
// NB2 is asked for 9:16 directly and usually gives it, in which case
// outpaintToPhone returns `already_tall_enough` and the original buffer
// untouched — no Stability call, no cost, no invented pixels. The stage
// only does work when a render comes back shorter than the phone aspect.
//
// If outpaint starts firing on most renders, the fix is the composition
// clause or the aspect being sent, not this stage.

import {
  buildWallpaperPrompt,
  WALLPAPER_ASPECT,
  getWallpaperEffect,
} from './wallpapers-registry'
import { outpaintToPhone } from '../shared/outpaint'

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000

/** NB2's own ceiling. Wallpapers rarely need more than one source, but the
 *  limit is shared with Groups and there is no reason to differ. */
const MAX_SOURCE_IMAGES = 14

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

export interface WallpaperGenerateRequest {
  /** Optional. Open Studio may be text-only — see the note in
   *  wallpapers-shared.ts, which is Rich's ruling to make. */
  source_image_b64?:      string
  additional_images_b64?: string[]
  effect_id:              string
  /** Open Studio only: the customer's own prompt, already through the
   *  builder. Ignored for catalog effects. */
  freeform_prompt?:       string
  is_preview?:            boolean
}

export interface WallpaperGenerateResult {
  ok:            boolean
  image_b64:     string | null
  prompt_used:   string
  effect:        string
  outpainted:    boolean
  outpaint_ms:   number | null
  outpaint_skip: string | null
  fatal_error:   string | null
  error_code?:   string
  retryable?:    boolean
  duration_ms:   number
}

export interface GenerateWallpaperInput {
  request:           WallpaperGenerateRequest
  replicateApiToken: string
  stabilityApiKey?:  string
}

export async function generateWallpaper(
  input: GenerateWallpaperInput,
): Promise<WallpaperGenerateResult> {

  const t0  = Date.now()
  const req = input.request

  const effect = getWallpaperEffect(req.effect_id)
  if (!effect && !req.freeform_prompt) {
    return fatal({
      msg: `unknown wallpaper effect: ${req.effect_id}`,
      effectId: req.effect_id,
      prompt: '',
      t0,
      code: 'unknown_effect',
      retryable: false,
    })
  }

  const prompt = buildWallpaperPrompt({
    effectId:       req.effect_id,
    freeformPrompt: req.freeform_prompt,
  })

  console.log(
    `[wallpapers] effect=${req.effect_id} chars=${prompt.length} ` +
    `sources=${req.source_image_b64 ? 1 + (req.additional_images_b64?.length || 0) : 0}`,
  )

  // ── Stage 1: NB2 ──
  let imageB64: string
  try {
    imageB64 = await callNB2({
      prompt,
      sourceImageB64:      req.source_image_b64,
      additionalImagesB64: req.additional_images_b64 || [],
      aspectRatio:         WALLPAPER_ASPECT,
      replicateApiToken:   input.replicateApiToken,
    })
  } catch (e: any) {
    const msg = e?.message || 'NB2 generate failed'
    console.error(`[wallpapers] NB2 failed: ${msg}`)
    return fatal({
      msg, effectId: req.effect_id, prompt, t0,
      code: 'nb2_failed', retryable: true,
    })
  }

  // ── Stage 2: outpaint, only if short ──
  let outpainted   = false
  let outpaintMs:   number | null = null
  let outpaintSkip: string | null = null

  if (input.stabilityApiKey) {
    const opT0 = Date.now()
    try {
      const buf  = Buffer.from(imageB64, 'base64')
      const dims = readJpegDimensions(buf)
      if (!dims) {
        outpaintSkip = 'dimensions_unreadable'
      } else {
        const r = await outpaintToPhone({
          image:           buf,
          width:           dims.width,
          height:          dims.height,
          stabilityApiKey: input.stabilityApiKey,
        })
        if (r.outpainted) {
          imageB64    = r.image.toString('base64')
          outpainted  = true
          outpaintMs  = Date.now() - opT0
        } else {
          outpaintSkip = r.reason || 'unknown'
        }
      }
    } catch (e: any) {
      console.warn(`[wallpapers] outpaint hard fail (non-fatal): ${e?.message}`)
      outpaintSkip = `error: ${e?.message}`
    }
  } else {
    outpaintSkip = 'STABILITY_API_KEY not set'
  }

  console.log(
    `[wallpapers] done in ${Date.now() - t0}ms — ` +
    `outpainted=${outpainted} skip=${outpaintSkip ?? '-'}`,
  )

  return {
    ok:            true,
    image_b64:     imageB64,
    prompt_used:   prompt,
    effect:        req.effect_id,
    outpainted,
    outpaint_ms:   outpaintMs,
    outpaint_skip: outpaintSkip,
    fatal_error:   null,
    duration_ms:   Date.now() - t0,
  }
}

// ─── HELPERS ────────────────────────────────────────────────────

function fatal(args: {
  msg:       string
  effectId:  string
  prompt:    string
  t0:        number
  code:      string
  retryable: boolean
}): WallpaperGenerateResult {
  return {
    ok:            false,
    image_b64:     null,
    prompt_used:   args.prompt,
    effect:        args.effectId,
    outpainted:    false,
    outpaint_ms:   null,
    outpaint_skip: null,
    fatal_error:   args.msg,
    error_code:    args.code,
    retryable:     args.retryable,
    duration_ms:   Date.now() - args.t0,
  }
}

/** Width and height from a JPEG's SOF marker. Keeps sharp out of the route's
 *  dependency chain — the outpaint module takes dimensions as arguments
 *  rather than reading the buffer itself. */
function readJpegDimensions(
  buf: Buffer,
): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null

  let i = 2
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue }

    const marker = buf[i + 1]
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }

    const len = buf.readUInt16BE(i + 2)
    const isSOF =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

    if (isSOF) {
      return {
        height: buf.readUInt16BE(i + 5),
        width:  buf.readUInt16BE(i + 7),
      }
    }

    i += 2 + len
  }

  return null
}

// ─── NB2 CALL ───────────────────────────────────────────────────

async function callNB2(input: {
  prompt:              string
  sourceImageB64?:     string
  additionalImagesB64: string[]
  aspectRatio:         string
  replicateApiToken:   string
}): Promise<string> {

  const sources = [
    ...(input.sourceImageB64 ? [input.sourceImageB64] : []),
    ...input.additionalImagesB64,
  ].slice(0, MAX_SOURCE_IMAGES).map(b => `data:image/jpeg;base64,${b}`)

  const body: any = {
    input: {
      prompt:        input.prompt,
      aspect_ratio:  input.aspectRatio,
      output_format: 'jpg',
    },
  }

  // Text-to-image when no source was supplied — Open Studio's likely shape.
  if (sources.length) body.input.image_input = sources

  const res = await fetch(REPLICATE_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Token ${input.replicateApiToken}`,
      'Content-Type':  'application/json',
      'Prefer':        `wait=${SYNC_WAIT_SECONDS}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Replicate POST failed (${res.status}): ${errText.slice(0, 240)}`)
  }

  const prediction = await res.json()

  if (prediction.status === 'succeeded' && prediction.output) {
    return await fetchAndEncode(pickOutputUrl(prediction.output))
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
        return await fetchAndEncode(pickOutputUrl(polled.output))
      }
      if (polled.status === 'failed' || polled.status === 'canceled') {
        throw new Error(`prediction ${polled.status}: ${polled.error || ''}`)
      }
    }
  }

  throw new Error(`NB2 timed out — status=${prediction.status}`)
}

function pickOutputUrl(output: any): string {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && output.length > 0) return output[0]
  throw new Error('NB2 output URL not found')
}

async function fetchAndEncode(url: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`output fetch failed (${r.status})`)
  return Buffer.from(await r.arrayBuffer()).toString('base64')
}
