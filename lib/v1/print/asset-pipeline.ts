// lib/v1/print/asset-pipeline.ts
//
// Print asset pipeline: crafted piece → 1K → upscale → sRGB JPEG → Supabase →
// signed URL for Prodigi to fetch.
//
// CUI V25 · 2026-08-03 · REWRITTEN
//
//   WHAT CHANGED AND WHY
//
//   1 · STABILITY IS GONE. It was retired on 2026-07-27 along with BFL and
//       Runware, and this file was the last thing still calling it. Real-ESRGAN
//       on Replicate now — same vendor as the craft, same billing, same token.
//
//   2 · WE SEND 1K, NOT 2K. Rich's finding: the upscaler produces a better
//       result from a smaller, cleaner input than from a larger one. A 2K
//       source was being pre-resized down to 1MP by the old Stability cap
//       anyway; this does it deliberately and at a known size.
//
//   3 · THE SCALE IS PER SKU, NOT A CONSTANT. A fixed 4× cleared the old
//       rectangular sizes and clears almost nothing in the square catalogue:
//
//         8×8    wants 2400px   →  2.4× from 1024
//         12×12  wants 3600px   →  3.6×
//         16×16  wants 4800px   →  4.7×
//         20×20  wants 6000px   →  5.9×
//         CFPM   wants 1800px   →  1.8×  (the picture is smaller than the frame)
//
//       Measured at 1.8s for 4×, so the difference between 2.4 and 5.9 costs
//       seconds rather than architecture. It still runs inline in the webhook.
//
//   4 · THE OUTPUT IS JPEG. Real-ESRGAN returns PNG, and a 6000² PNG is about
//       30MB. The same image as sRGB JPEG at 92 is nearer 4MB. Quality 92 with
//       4:4:4 chroma, not the 82 used for collection thumbnails — that is fine
//       on a 400px card and visible on a twenty-inch print, particularly in
//       the linework effects.
//
//   5 · THE FINAL SIZE IS EXACT. Whatever the upscaler returns is resized to
//       the SKU's requiredPx with lanczos3. An asset a few pixels short of
//       Prodigi's stated requirement is a rejected order after the money has
//       moved.
//
// Caching: uploads are keyed `{renderId}/{finish}-{size}.jpg`. The old key was
// `{renderId}/{size}.jpg`, which collided — the same piece at 12×12 on canvas
// and 12×12 framed wanted different pixel counts and overwrote each other.
//
// Env vars required:
//   REPLICATE_API_TOKEN              (already in use for the craft)
//   NEXT_PUBLIC_SUPABASE_URL         (or SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY        (server-only; bypasses RLS for uploads)

import sharp from 'sharp'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSku, type PrintSize, type PrintFinish } from './sku-map'

const BUCKET                = 'print-assets'
const SIGNED_URL_EXPIRY_SEC = 7 * 24 * 60 * 60   // 7 days; Prodigi fetches within minutes

/* What we hand the upscaler. Rich's finding, 2026-08-03: it works better from
   a clean 1K than from a larger source. */
const UPSCALE_INPUT_EDGE = 1024

/* Replicate caps scale at 10. Nothing in the catalogue needs beyond 6. */
const MAX_SCALE = 10

const REPLICATE_MODEL = 'nightmareai/real-esrgan'
const REPLICATE_URL   = `https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`

/* Print quality, not thumbnail quality. */
const JPEG_QUALITY = 92

// ── SUPABASE CLIENT (server-side, service role) ───────────────
let _supabase: SupabaseClient | null = null
function supabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in env'
    )
  }
  _supabase = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _supabase
}

// ── THE INPUT ─────────────────────────────────────────────────
/**
 * Down to a clean 1K square-ish input, as JPEG at high quality. The upscaler
 * reads detail, not artefacts, so this is 95 rather than the output's 92.
 */
async function toUpscaleInput(imageB64: string): Promise<{ buf: Buffer; w: number; h: number }> {
  const src = Buffer.from(imageB64, 'base64')
  const meta = await sharp(src).metadata()
  const w = meta.width || 0
  const h = meta.height || 0
  const longEdge = Math.max(w, h)

  if (!longEdge) throw new Error('could not read the source image dimensions')

  // Already at or below 1K — send it as it is rather than enlarging twice.
  if (longEdge <= UPSCALE_INPUT_EDGE) {
    const buf = await sharp(src).toColourspace('srgb').jpeg({ quality: 95 }).toBuffer()
    return { buf, w, h }
  }

  const scale = UPSCALE_INPUT_EDGE / longEdge
  const nw = Math.round(w * scale)
  const nh = Math.round(h * scale)
  console.log(`[asset-pipeline] input ${w}×${h} → ${nw}×${nh} for the upscaler`)
  const buf = await sharp(src)
    .resize(nw, nh, { kernel: 'lanczos3' })
    .toColourspace('srgb')
    .jpeg({ quality: 95 })
    .toBuffer()
  return { buf, w: nw, h: nh }
}

// ── THE UPSCALE ───────────────────────────────────────────────
/**
 * Real-ESRGAN, synchronous. `Prefer: wait` holds the connection until the
 * prediction finishes, which at these sizes is seconds — measured at 1.8s for
 * 4× on 2026-08-03. No queue, no job row, no second round trip.
 *
 * face_enhance is deliberately OFF. Most of this catalogue is bronze, stone,
 * glass and impasto; a face model applied to a bronze bust recovers skin
 * texture that was never meant to be there and undoes the effect.
 */
async function upscale(inputBuf: Buffer, scale: number): Promise<Buffer> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('Missing REPLICATE_API_TOKEN in env')

  const dataUri = 'data:image/jpeg;base64,' + inputBuf.toString('base64')
  const t0 = Date.now()

  const res = await fetch(REPLICATE_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer:         'wait',
    },
    body: JSON.stringify({
      input: {
        image:        dataUri,
        scale:        scale,
        face_enhance: false,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Replicate upscale failed (${res.status}): ${err.slice(0, 300)}`)
  }

  const body = await res.json()
  if (body.status === 'failed' || body.error) {
    throw new Error(`Replicate upscale failed: ${body.error || 'unknown'}`)
  }

  // The model returns a single URL.
  const out = Array.isArray(body.output) ? body.output[0] : body.output
  if (typeof out !== 'string' || !out) {
    throw new Error('Replicate returned no image — status=' + body.status)
  }

  const img = await fetch(out)
  if (!img.ok) throw new Error(`could not fetch the upscaled image: ${img.status}`)
  const buf = Buffer.from(await img.arrayBuffer())

  console.log(`[asset-pipeline] upscaled ${scale}× in ${Date.now() - t0}ms — ${buf.length} bytes (png)`)
  return buf
}

// ── TO PRINT ──────────────────────────────────────────────────
/**
 * Exactly the pixels the SKU asks for, in sRGB, as JPEG.
 *
 * The resize at the end is not decoration. Real-ESRGAN scales by a factor, so
 * a 2.4× of 1024 is 2458 and a 5.9× is 6042 — close to the target and not
 * equal to it. Prodigi states a required resolution; an asset a few pixels
 * short is a rejected order after the money has moved.
 */
async function toPrintJpeg(
  buf: Buffer,
  targetW: number,
  targetH: number,
): Promise<{ buf: Buffer; w: number; h: number }> {
  const out = await sharp(buf)
    .resize(targetW, targetH, { kernel: 'lanczos3', fit: 'fill' })
    .toColourspace('srgb')
    .jpeg({
      quality: JPEG_QUALITY,
      // 4:4:4. The default 4:2:0 throws away colour detail that survives
      // being looked at from a foot away on paper.
      chromaSubsampling: '4:4:4',
      progressive: false,   // Prodigi's fetcher, not a browser
      mozjpeg: true,
    })
    .toBuffer()

  console.log(
    `[asset-pipeline] print asset ${targetW}×${targetH} — ` +
    `${(out.length / 1024 / 1024).toFixed(1)}MB jpeg q${JPEG_QUALITY}`
  )
  return { buf: out, w: targetW, h: targetH }
}

// ── UPLOAD + SIGN ─────────────────────────────────────────────
async function uploadAndSign(buf: Buffer, path: string): Promise<string> {
  const sb = supabase()

  const { error: uploadErr } = await sb.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'image/jpeg', upsert: true })

  if (uploadErr) {
    const original = (uploadErr as any).originalError as Error | undefined
    console.error('[asset-pipeline] upload error:', {
      message: uploadErr.message,
      statusCode: (uploadErr as any).statusCode,
      original: original ? original.message : null,
    })
    throw new Error(`Supabase upload failed for ${path}: ${uploadErr.message}`)
  }

  const { data, error: signErr } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC)

  if (signErr || !data?.signedUrl) {
    throw new Error(`Supabase signed URL failed for ${path}: ${signErr?.message}`)
  }
  return data.signedUrl
}

// ── ORCHESTRATOR ──────────────────────────────────────────────
/**
 * Call this from the print webhook once payment confirms.
 *
 * @param imageB64  The crafted piece as base64 (no data: prefix)
 * @param renderId  Stable identifier — the storage key
 * @param size      '8x8' | '12x12' | '16x16' | '20x20'
 * @param finish    the SKU family
 */
export async function preparePrintAsset(input: {
  imageB64: string
  renderId: string
  size:     PrintSize
  finish:   PrintFinish
}): Promise<{
  signedUrl:   string
  width:       number
  height:      number
  upscaled:    boolean
  scale:       number
  storagePath: string
}> {
  const { imageB64, renderId, size, finish } = input
  const entry = getSku(size, finish)
  const targetW = entry.requiredPx.w
  const targetH = entry.requiredPx.h

  // The key carries the finish: the same piece at 12×12 on canvas and 12×12
  // framed need different pixel counts, and the old key collided.
  const path = `${renderId}/${finish}-${size}.jpg`

  const src = await toUpscaleInput(imageB64)
  const longEdge = Math.max(src.w, src.h)
  const targetLong = Math.max(targetW, targetH)

  let working: Buffer
  let scale = 0
  let upscaled = false

  if (longEdge >= targetLong) {
    // Nothing in the current catalogue reaches here from a 1K craft, but a
    // future larger render would, and paying for an upscale that changes
    // nothing would be silly.
    console.log(`[asset-pipeline] ${size} ${finish}: source already ${longEdge}px, no upscale`)
    working = src.buf
  } else {
    // Round up a tenth so we never land under the target and rely on the
    // resize to enlarge, which would undo the point of upscaling.
    scale = Math.min(MAX_SCALE, Math.ceil((targetLong / longEdge) * 10) / 10)
    console.log(
      `[asset-pipeline] ${size} ${finish}: ${longEdge}px → ${targetLong}px, ${scale}×`
    )
    working = await upscale(src.buf, scale)
    upscaled = true
  }

  const print = await toPrintJpeg(working, targetW, targetH)
  const signedUrl = await uploadAndSign(print.buf, path)

  return {
    signedUrl,
    width:  print.w,
    height: print.h,
    upscaled,
    scale,
    storagePath: path,
  }
}
