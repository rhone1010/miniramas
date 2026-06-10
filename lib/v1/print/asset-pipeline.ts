// lib/v1/print/asset-pipeline.ts
//
// Print asset pipeline: source image → (upscale if needed) → Supabase Storage → signed URL
// for Prodigi to fetch when placing the order.
//
// Flow:
//   1. Inspect source dimensions
//   2. If below the target SKU's required pixels, upscale via Stability Fast (4×)
//   3. Upload result to private `print-assets` bucket, keyed by render_id + size
//   4. Return a 7-day signed URL that Prodigi servers can GET
//
// Caching: uploads are keyed `{renderId}/{size}.jpg`. Re-running for the same
// renderId + size overwrites (last-write-wins) so we never grow stale duplicates
// for retries. For a fresh customer ordering multiple sizes of the same render,
// each size produces its own keyed object.
//
// Stability Fast does a 4× upscale in one sync call:
//   1024² → 4096²   (covers 8×10 and 12×16 cleanly at 300 DPI)
//   2048² → 8192²   (covers 18×24 at 300 DPI with room to spare)
// If a render is below 1024 on its long edge we still call it — output quality
// just plateaus. Source ≥ 2048 is recommended for 18×24 quality.
//
// Env vars required:
//   STABILITY_API_KEY                (already in use for expand.ts)
//   NEXT_PUBLIC_SUPABASE_URL         (your existing client uses this)
//   SUPABASE_SERVICE_ROLE_KEY        (server-only; bypasses RLS for uploads)

import sharp from 'sharp'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSku, type PrintSize, type PrintFinish } from './sku-map'

const BUCKET                = 'print-assets'
const SIGNED_URL_EXPIRY_SEC = 7 * 24 * 60 * 60   // 7 days; covers Prodigi's 30-day retention with margin
const STABILITY_FAST_URL    = 'https://api.stability.ai/v2beta/stable-image/upscale/fast'
const STABILITY_MAX_INPUT_PX = 1_048_576         // Stability Fast input cap: 1024² = 1,048,576 pixels

// ── SUPABASE CLIENT (server-side, service role) ───────────────
//
// Initialized lazily so import doesn't crash in environments without env vars
// (e.g. CI builds that compile but don't run this code).
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
  console.log(`[asset-pipeline] supabase init — url="${url}", service-key length=${service.length}`)
  _supabase = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _supabase
}

// ── STABILITY FAST UPSCALE (4×) ───────────────────────────────
//
// Sync endpoint. Returns the upscaled image directly. ~1 credit per call.
// Docs: https://platform.stability.ai/docs/api-reference#tag/Upscale
async function upscaleFast(imageB64: string): Promise<{
  b64:    string
  width:  number
  height: number
}> {
  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) throw new Error('Missing STABILITY_API_KEY in env')

  let input = Buffer.from(imageB64, 'base64')

  // Stability Fast input cap is 1MP. Pre-resize if source exceeds.
  // Aspect ratio is preserved; the 4× upscale on the other side gives us
  // ~16MP output regardless, which is enough headroom for all three print sizes.
  const srcMeta = await sharp(input).metadata()
  const srcW = srcMeta.width  || 0
  const srcH = srcMeta.height || 0
  if (srcW * srcH > STABILITY_MAX_INPUT_PX) {
    const scale = Math.sqrt(STABILITY_MAX_INPUT_PX / (srcW * srcH))
    const newW  = Math.floor(srcW * scale)
    const newH  = Math.floor(srcH * scale)
    console.log(`[upscale] pre-resize: ${srcW}×${srcH} → ${newW}×${newH} (Stability 1MP cap)`)
    input = await sharp(input).resize(newW, newH).jpeg({ quality: 95 }).toBuffer()
  }

  const form = new FormData()
  form.append('image',         new Blob([input], { type: 'image/jpeg' }), 'image.jpg')
  form.append('output_format', 'jpeg')

  const res = await fetch(STABILITY_FAST_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept':        'image/*',
    },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Stability fast-upscale failed (${res.status}): ${err.slice(0, 200)}`)
  }

  const buf  = Buffer.from(await res.arrayBuffer())
  const meta = await sharp(buf).metadata()
  console.log(`[upscale] Stability fast 4× done — output: ${meta.width}×${meta.height}`)

  return {
    b64:    buf.toString('base64'),
    width:  meta.width  || 0,
    height: meta.height || 0,
  }
}

// ── RESOLUTION GATE ───────────────────────────────────────────
//
// Only upscale if the source's long edge falls below what the target SKU needs.
// Saves money on small prints — an 8×10 from a 2048² render skips upscale entirely.
async function ensurePrintResolution(
  imageB64: string,
  size:     PrintSize,
  finish:   PrintFinish,
): Promise<{ b64: string; width: number; height: number; upscaled: boolean }> {
  const entry = getSku(size, finish)
  const meta  = await sharp(Buffer.from(imageB64, 'base64')).metadata()
  const srcW  = meta.width  || 0
  const srcH  = meta.height || 0

  const minLongEdge = Math.max(entry.requiredPx.w, entry.requiredPx.h)
  const srcLongEdge = Math.max(srcW, srcH)

  if (srcLongEdge >= minLongEdge) {
    console.log(
      `[asset-pipeline] Source ${srcW}×${srcH} meets ${size} target ` +
      `${entry.requiredPx.w}×${entry.requiredPx.h} — skipping upscale`
    )
    return { b64: imageB64, width: srcW, height: srcH, upscaled: false }
  }

  console.log(
    `[asset-pipeline] Source ${srcW}×${srcH} below ${size} target ` +
    `${entry.requiredPx.w}×${entry.requiredPx.h} — upscaling`
  )
  const up = await upscaleFast(imageB64)
  return { ...up, upscaled: true }
}

// ── UPLOAD + SIGN ─────────────────────────────────────────────
async function uploadAndSign(
  imageB64: string,
  renderId: string,
  size:     PrintSize,
): Promise<string> {
  const sb   = supabase()
  const path = `${renderId}/${size}.jpg`
  const buf  = Buffer.from(imageB64, 'base64')

  console.log(`[asset-pipeline] upload start — bucket="${BUCKET}" path="${path}" bytes=${buf.length}`)

  const { error: uploadErr } = await sb.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: 'image/jpeg',
      upsert:      true,
    })
  if (uploadErr) {
    // Surface as much as possible — supabase-js wraps the underlying fetch error
    // in `originalError`, which itself may have a `cause`. Drill in.
    const original = (uploadErr as any).originalError as Error | undefined
    const cause    = original ? (original as any).cause : undefined
    console.error('[asset-pipeline] upload error:', {
      message:    uploadErr.message,
      name:       uploadErr.name,
      statusCode: (uploadErr as any).statusCode,
      originalError: original ? {
        message: original.message,
        name:    original.name,
        code:    (original as any).code,
        cause:   cause ? {
          message: cause.message,
          name:    cause.name,
          code:    (cause as any).code,
          errno:   (cause as any).errno,
          syscall: (cause as any).syscall,
        } : null,
        stackTop: original.stack?.split('\n').slice(0, 4).join('\n'),
      } : null,
    })
    throw new Error(`Supabase upload failed for ${path}: ${uploadErr.message}`)
  }

  const { data, error: signErr } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC)
  if (signErr || !data?.signedUrl) {
    throw new Error(`Supabase signed URL failed for ${path}: ${signErr?.message}`)
  }

  console.log(`[asset-pipeline] uploaded ${path} → signed URL (expires in ${SIGNED_URL_EXPIRY_SEC}s)`)
  return data.signedUrl
}

// ── ORCHESTRATOR ──────────────────────────────────────────────
/**
 * Main entry point. Call this from the Stripe webhook handler once payment confirms.
 *
 * Returns a public URL Prodigi can GET to fetch the print-ready asset.
 *
 * @param imageB64    Source render as base64 (no data: prefix)
 * @param renderId    Stable identifier for this render — used as storage key
 * @param size        '8x10' | '12x16' | '18x24'
 * @param finish      'unframed' | 'framed'
 */
export async function preparePrintAsset(input: {
  imageB64: string
  renderId: string
  size:     PrintSize
  finish:   PrintFinish
}): Promise<{
  signedUrl: string
  width:     number
  height:    number
  upscaled:  boolean
  storagePath: string
}> {
  const { imageB64, renderId, size, finish } = input

  // 1. Ensure resolution meets target
  const { b64, width, height, upscaled } = await ensurePrintResolution(imageB64, size, finish)

  // 2. Upload + sign
  const signedUrl = await uploadAndSign(b64, renderId, size)

  return {
    signedUrl,
    width,
    height,
    upscaled,
    storagePath: `${renderId}/${size}.jpg`,
  }
}
