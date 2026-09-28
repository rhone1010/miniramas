import sharp from 'sharp'
import {outpaint} from '../shared/outpaint'
import {printPlan,finishPrintPixels,requiredUpscale,compositionPlan} from './geometry'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSku, type PrintSize, type PrintFinish } from './sku-map'

const BUCKET                = 'print-assets'
const SIGNED_URL_EXPIRY_SEC = 7 * 24 * 60 * 60   // 7 days; Prodigi fetches within minutes


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
  const original=await sharp(Buffer.from(imageB64,'base64')).rotate().toBuffer()
  const meta=await sharp(original).metadata()
  const plan=printPlan(meta.width||0,meta.height||0,entry)
  const path=`${renderId}/aspect-v3-${finish}-${size}.jpg`
  let working=original, scale=0, upscaled=false
  const c=plan.composition
  if(c.compatibility==='extension'){
    if(meta.width!*meta.height!>9437184)throw new Error('print_outpaint_input_too_large')
    const result=await outpaint({image:await sharp(original).jpeg({quality:95}).toBuffer(),width:meta.width!,height:meta.height!,stabilityApiKey:process.env.STABILITY_API_KEY||'',mode:'print',padding:{left:c.padding.left,right:c.padding.right,up:c.padding.top,down:c.padding.bottom}})
    if(!result.outpainted)throw new Error('print_outpaint_failed:'+result.reason)
    const returned=await sharp(result.image).metadata()
    if(returned.width!==c.width||returned.height!==c.height)throw new Error('print_outpaint_dimensions_changed')
    // Keep the complete original composition; generated pixels belong only outside it.
    working=await sharp(result.image).composite([{input:original,left:c.padding.left,top:c.padding.top}]).png().toBuffer()
  }else if(c.width!==meta.width||c.height!==meta.height){
    working=await sharp(original).extend({...c.padding,extendWith:'mirror'}).png().toBuffer()
  }
  const prepared=await sharp(working).metadata()
  scale=requiredUpscale(prepared.width!,prepared.height!,plan.front.w,plan.front.h)
  if(scale){
    working=await upscale(await sharp(working).toColourspace('srgb').jpeg({quality:95}).toBuffer(),scale)
    const enlarged=await sharp(working).metadata()
    if(enlarged.width!<plan.front.w||enlarged.height!<plan.front.h)throw new Error('print_upscale_resolution_shortfall')
    // Provider output is integer-rounded. Restore only that pixel-scale ratio error
    // with external reflection before the strict aspect-preserving final downsample.
    const expectedW=prepared.width!*scale,expectedH=prepared.height!*scale
    if(Math.abs(enlarged.width!-expectedW)>1.01||Math.abs(enlarged.height!-expectedH)>1.01)throw new Error('print_upscale_dimensions_changed')
    const rounded=compositionPlan(enlarged.width!,enlarged.height!,plan.front.w,plan.front.h)
    if(rounded.width!==enlarged.width||rounded.height!==enlarged.height)working=await sharp(working).extend({...rounded.padding,extendWith:'mirror'}).png().toBuffer()
    upscaled=true
  }
  const pixels=await finishPrintPixels(working,plan)
  const jpeg=await sharp(pixels.output).toColourspace('srgb').jpeg({quality:JPEG_QUALITY,chromaSubsampling:'4:4:4',progressive:false,mozjpeg:true}).toBuffer()
  const print={buf:jpeg,w:plan.final.w,h:plan.final.h}
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
