import sharp from 'sharp'
import {outpaint} from '../shared/outpaint'
import {printPlan,finishPrintPixels,requiredUpscale,compositionPlan} from './geometry'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSku, type PrintSize, type PrintFinish } from './sku-map'
import { REFERENCE_PPI, computeTarget, validateOutput, type Dim } from './upscale/target'
import { DEFAULT_SETTINGS, type UpscaleSettings } from './upscale/settings'
import { makeProvider, ProviderError, type UpscaleProvider } from './upscale/providers'

const BUCKET                = 'print-assets'
const SIGNED_URL_EXPIRY_SEC = 7 * 24 * 60 * 60   // 7 days; Prodigi fetches within minutes

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
// prunaai/p-image-upscale (Replicate or Pruna direct) replaced Real-ESRGAN. The provider call itself
// lives in ./upscale/providers.ts and is driven by the job processor in ./upscale/process.ts, which
// saves every step so a crash never repeats a paid call. This file keeps the geometry that
// must not change: aspect correction, bleed, canvas wrap, exact final dimensions.
//
// Enhancement is OFF by default (settings.enhance_details / enhance_realism). Most of this catalogue is
// bronze, stone, glass and impasto; a realism or face model applied to a bronze bust recovers skin
// texture that was never meant to be there and undoes the effect.

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

// ── STEP 1: THE ASPECT-CORRECTED ARTWORK ──────────────────────
export interface Composition {
  entry:        ReturnType<typeof getSku>
  plan:         ReturnType<typeof printPlan>
  /** The artwork after any outpaint or reflection, at the print's exact aspect. This is what is upscaled, and what QA compares against. */
  working:      Buffer
  width:        number
  height:       number
  /** Linear enlargement still needed to reach the requested PPI; 0 when the artwork is already big enough. */
  scale:        number
  /** The picture area the upscaled result must reach, at the requested PPI. */
  requiredFront: Dim
  outpainted:   boolean
}

/**
 * Original -> aspect-correct artwork. Extends by outpaint only inside the approved boundaries
 * (geometry.ts), otherwise by reflection. Never crops, never distorts, never touches the original pixels.
 */
export async function prepareComposition(input: {
  imageB64: string
  size:     PrintSize
  finish:   PrintFinish
  ppi?:     number
}): Promise<Composition> {
  const { imageB64, size, finish } = input
  const ppi = input.ppi ?? REFERENCE_PPI
  const entry = getSku(size, finish)
  const original=await sharp(Buffer.from(imageB64,'base64')).rotate().toBuffer()
  const meta=await sharp(original).metadata()
  const plan=printPlan(meta.width||0,meta.height||0,entry)
  let working=original, outpainted=false
  const c=plan.composition
  if(c.compatibility==='extension'){
    if(meta.width!*meta.height!>9437184)throw new Error('print_outpaint_input_too_large')
    const result=await outpaint({image:await sharp(original).jpeg({quality:95}).toBuffer(),width:meta.width!,height:meta.height!,stabilityApiKey:process.env.STABILITY_API_KEY||'',mode:'print',padding:{left:c.padding.left,right:c.padding.right,up:c.padding.top,down:c.padding.bottom}})
    if(!result.outpainted)throw new Error('print_outpaint_failed:'+result.reason)
    const returned=await sharp(result.image).metadata()
    if(returned.width!==c.width||returned.height!==c.height)throw new Error('print_outpaint_dimensions_changed')
    // Keep the complete original composition; generated pixels belong only outside it.
    working=await sharp(result.image).composite([{input:original,left:c.padding.left,top:c.padding.top}]).png().toBuffer()
    outpainted=true
  }else if(c.width!==meta.width||c.height!==meta.height){
    working=await sharp(original).extend({...c.padding,extendWith:'mirror'}).png().toBuffer()
  }
  const prepared=await sharp(working).metadata()
  const requiredFront:Dim={w:Math.round(plan.front.w*ppi/REFERENCE_PPI),h:Math.round(plan.front.h*ppi/REFERENCE_PPI)}
  const scale=requiredUpscale(prepared.width!,prepared.height!,requiredFront.w,requiredFront.h)
  return { entry, plan, working, width: prepared.width!, height: prepared.height!, scale, requiredFront, outpainted }
}

/** The artwork encoded for the upscaler: sRGB JPEG, q95, as before. */
export async function encodeForUpscale(working: Buffer): Promise<Buffer> {
  return sharp(working).toColourspace('srgb').jpeg({quality:95}).toBuffer()
}

/**
 * The same step for the products whose picture is a PANEL inside a larger layout (the mug's face panel, the card's front): the artwork is made the exact
 * shape of the panel, by outpaint inside the approved bound or by reflection, never by cropping or distortion. The layout around the panel is built
 * later, from the finished panel (product-layout.ts), so only the panel is ever upscaled.
 */
export async function preparePanelComposition(input: { imageB64: string; panel: Dim; ppi?: number }): Promise<{
  working: Buffer; width: number; height: number; scale: number; requiredFront: Dim; outpainted: boolean; fit: 'exact' | 'resample' | 'extend'
}> {
  const ppi = input.ppi ?? REFERENCE_PPI
  const original = await sharp(Buffer.from(input.imageB64, 'base64')).rotate().toBuffer()
  const meta = await sharp(original).metadata()
  const c = compositionPlan(meta.width || 0, meta.height || 0, input.panel.w, input.panel.h)
  if (c.compatibility === 'unavailable') throw new Error('incompatible_print_aspect')
  if (c.compatibility === 'extension' && (meta.width! * meta.height! > 9437184 || Math.max(...Object.values(c.padding)) > 2000)) throw new Error('print_outpaint_dimensions_unavailable')
  let working = original, outpainted = false
  if (c.compatibility === 'extension') {
    const result = await outpaint({ image: await sharp(original).jpeg({ quality: 95 }).toBuffer(), width: meta.width!, height: meta.height!, stabilityApiKey: process.env.STABILITY_API_KEY || '', mode: 'print', padding: { left: c.padding.left, right: c.padding.right, up: c.padding.top, down: c.padding.bottom } })
    if (!result.outpainted) throw new Error('print_outpaint_failed:' + result.reason)
    const returned = await sharp(result.image).metadata()
    if (returned.width !== c.width || returned.height !== c.height) throw new Error('print_outpaint_dimensions_changed')
    working = await sharp(result.image).composite([{ input: original, left: c.padding.left, top: c.padding.top }]).png().toBuffer()   // the original pixels stay; generated pixels only outside them
    outpainted = true
  } else if (c.width !== meta.width || c.height !== meta.height) {
    working = await sharp(original).extend({ ...c.padding, extendWith: 'mirror' }).png().toBuffer()
  }
  const prepared = await sharp(working).metadata()
  const requiredFront: Dim = { w: Math.round(input.panel.w * ppi / REFERENCE_PPI), h: Math.round(input.panel.h * ppi / REFERENCE_PPI) }
  const scale = requiredUpscale(prepared.width!, prepared.height!, requiredFront.w, requiredFront.h)
  return { working, width: prepared.width!, height: prepared.height!, scale, requiredFront, outpainted, fit: c.compatibility === 'recommended' ? (c.width === meta.width && c.height === meta.height ? 'exact' : 'resample') : 'extend' }
}

// ── STEP 2: UPSCALED (OR NATIVE) ARTWORK -> THE PRINT FILE ─────
export interface FinishedAsset {
  /** The picture area only, before any canvas wrap. QA compares this against the aspect-corrected artwork. */
  front:  Buffer
  /** The exact file Prodigi receives, as encoded JPEG. */
  jpeg:   Buffer
  width:  number
  height: number
}

export async function finishPrintAsset(input: {
  /** The provider's output, or the aspect-corrected artwork itself when no upscale was needed. */
  image:         Buffer
  composition:   Pick<Composition,'plan'|'width'|'height'|'requiredFront'>
  upscaled:      boolean
  targetMp?:     number
}): Promise<FinishedAsset> {
  const { composition, upscaled } = input
  const { plan } = composition
  let working = input.image
  if (upscaled) {
    const enlarged=await sharp(working).metadata()
    const check=validateOutput({w:enlarged.width||0,h:enlarged.height||0},{w:composition.width,h:composition.height},composition.requiredFront,input.targetMp ?? 128)
    // A short result is the one failure that must never be papered over by resampling.
    if(check.errors.includes('output_below_required_resolution')||check.errors.includes('output_unreadable'))throw new Error('print_upscale_resolution_shortfall')
    if(check.errors.includes('output_aspect_changed'))throw new Error('print_upscale_dimensions_changed')
    // Provider output is integer-rounded. Restore only that pixel-scale ratio error
    // with external reflection before the strict aspect-preserving final downsample.
    const rounded=compositionPlan(enlarged.width!,enlarged.height!,plan.front.w,plan.front.h)
    if(rounded.width!==enlarged.width||rounded.height!==enlarged.height)working=await sharp(working).extend({...rounded.padding,extendWith:'mirror'}).png().toBuffer()
  }
  const pixels=await finishPrintPixels(working,plan)
  const jpeg=await sharp(pixels.output).toColourspace('srgb').jpeg({quality:JPEG_QUALITY,chromaSubsampling:'4:4:4',progressive:false,mozjpeg:true}).toBuffer()
  return { front: pixels.front, jpeg, width: plan.final.w, height: plan.final.h }
}

// ── ORCHESTRATOR (synchronous; scripts and tests) ─────────────
/**
 * One-shot preparation without a job record: composition, one provider call, finish, upload.
 *
 * THE LIVE PATH DOES NOT USE THIS. Paid orders go through the resumable job processor
 * (./upscale/process.ts), which saves the prediction id so a crash cannot repeat a paid call.
 * This remains for scripts and for the geometry tests; it holds no state and is not crash-safe.
 */
export async function preparePrintAsset(input: {
  imageB64: string
  renderId: string
  size:     PrintSize
  finish:   PrintFinish
}, deps: { provider?: UpscaleProvider; settings?: UpscaleSettings; pollMs?: number; maxPolls?: number } = {}): Promise<{
  signedUrl:   string
  width:       number
  height:      number
  upscaled:    boolean
  scale:       number
  storagePath: string
}> {
  const { renderId, size, finish } = input
  const settings = deps.settings ?? DEFAULT_SETTINGS
  const comp = await prepareComposition({ imageB64: input.imageB64, size, finish, ppi: settings.target_ppi })
  const path=`${renderId}/aspect-v3-${finish}-${size}.jpg`
  let image = comp.working, upscaled = false, targetMp: number | undefined
  if(comp.scale){
    const provider = deps.provider ?? makeProvider(settings.provider)
    targetMp = computeTarget(comp.plan, settings.target_ppi, settings.max_megapixels).targetMp
    const url = await uploadAndSign(await encodeForUpscale(comp.working), `${renderId}/prepared-${finish}-${size}.jpg`)
    const { id } = await provider.start({ imageUrl: url, targetMp, settings })
    let out: string | undefined
    for (let i = 0; i < (deps.maxPolls ?? 120); i++) {
      const s = await provider.poll(id)
      if (s.status === 'succeeded' && s.outputUrl) { out = s.outputUrl; break }
      if (s.status === 'failed' || s.status === 'canceled') throw new ProviderError('rejected', `upscale ${s.status}: ${s.error || 'unknown'}`, false)
      await new Promise(r => setTimeout(r, deps.pollMs ?? 2000))
    }
    if (!out) throw new ProviderError('unavailable', 'upscale did not finish in time', true)
    image = await provider.download(out)
    upscaled = true
  }
  const finished = await finishPrintAsset({ image, composition: comp, upscaled, targetMp })
  const signedUrl = await uploadAndSign(finished.jpeg, path)
  return { signedUrl, width: finished.width, height: finished.height, upscaled, scale: comp.scale, storagePath: path }
}
