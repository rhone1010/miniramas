import sharp from 'sharp'
import type { SkuEntry } from './sku-map'
import { CARD, MUG } from './production-profiles'

export type Compatibility = 'recommended' | 'extension' | 'unavailable'
export function aspectCompatibility(w:number,h:number,targetW:number,targetH:number) {
  if (![w,h,targetW,targetH].every(n=>Number.isFinite(n)&&n>0)) throw new Error('invalid_print_dimensions')
  const source=w/h,target=targetW/targetH
  const extension=Math.max(source/target,target/source)-1
  const compatibility:Compatibility=extension<=0.02+1e-10?'recommended':extension<=0.20+1e-10?'extension':'unavailable'
  return {extension,compatibility}
}
export function artworkFormat(w:number,h:number): 'square'|'portrait'|'landscape'|null {
  if (!(w>0&&h>0)) return null
  const square=aspectCompatibility(w,h,1,1), rectangle=aspectCompatibility(w,h,w>h?3:2,w>h?2:3)
  if (Math.min(square.extension,rectangle.extension)>0.20+1e-10) return null
  return square.extension<=rectangle.extension?'square':w>h?'landscape':'portrait'
}
export function compositionPlan(w:number,h:number,targetW:number,targetH:number) {
  const assessment=aspectCompatibility(w,h,targetW,targetH)
  const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a
  const divisor=gcd(targetW,targetH),rw=targetW/divisor,rh=targetH/divisor
  const units=Math.ceil(Math.max(w/rw,h/rh)),width=units*rw,height=units*rh
  const dx=width-w,dy=height-h
  return {...assessment,width,height,padding:{left:Math.floor(dx/2),right:dx-Math.floor(dx/2),top:Math.floor(dy/2),bottom:dy-Math.floor(dy/2)}}
}
export function requiredUpscale(w:number,h:number,targetW:number,targetH:number) {
  if(w>=targetW && h>=targetH)return 0
  // Two pixels of headroom on both axes absorb provider integer rounding.
  const scale=Math.max((targetW+2)/w,(targetH+2)/h)
  if (scale>10) throw new Error('print_resolution_unavailable')
  return scale
}
export function printPlan(w:number,h:number,entry:SkuEntry) {
  const format=artworkFormat(w,h)
  const front={w:Math.round(entry.imageWidthIn*300),h:Math.round(entry.imageHeightIn*300)}
  const final={...entry.requiredPx}
  // The SKU's own orientation is the reference: a portrait-defined SKU turns for a landscape picture (as always), and a landscape-DEFINED SKU (the framed canvas 8x12,
  // 3654 x 2454) turns for a portrait one. Every entry that existed before is portrait-defined or square, so nothing changes for them.
  if(w!==h&&entry.requiredPx.w!==entry.requiredPx.h&&(w>h)!==(entry.requiredPx.w>entry.requiredPx.h)){[front.w,front.h]=[front.h,front.w];[final.w,final.h]=[final.h,final.w]}
  const composition=compositionPlan(w,h,front.w,front.h)
  if(!format||composition.compatibility==='unavailable')throw new Error('incompatible_print_aspect')
  if(composition.compatibility==='extension' && (w*h>9437184 || Math.max(...Object.values(composition.padding))>2000))throw new Error('print_outpaint_dimensions_unavailable')
  const dx=final.w-front.w,dy=final.h-front.h
  if(dx<0||dy<0||(entry.family!=='canvas'&&entry.family!=='framed_canvas'&&(dx||dy)))throw new Error('invalid_print_dimensions')
  const scale=requiredUpscale(composition.width,composition.height,front.w,front.h)
  return {format,front,final,composition,upscale:scale>0,scale,
    extension:{left:Math.floor(dx/2),right:dx-Math.floor(dx/2),top:Math.floor(dy/2),bottom:dy-Math.floor(dy/2)}}
}

/**
 * The plan for ANY product's picture, flat or panel. The flat families (fine art, premium, canvas, classic frame, matted frame, framed canvas) use printPlan above. The mug and the
 * card place the picture whole inside a PANEL of a larger layout (production-profiles.ts), so their picture is the panel and their orientation is never turned. The bounds are the
 * ones preparePanelComposition applies when the file is made: refused here means refused there.
 */
export function productPlan(w:number,h:number,entry:SkuEntry) {
  if(entry.family!=='mug'&&entry.family!=='card')return printPlan(w,h,entry)
  const panel=entry.family==='mug'?MUG.panel:{w:CARD.frontTrim.w,h:CARD.frontTrim.h}
  const composition=compositionPlan(w,h,panel.w,panel.h)
  if(!artworkFormat(w,h)||composition.compatibility==='unavailable')throw new Error('incompatible_print_aspect')
  if(composition.compatibility==='extension'&&(w*h>9437184||Math.max(...Object.values(composition.padding))>2000))throw new Error('print_outpaint_dimensions_unavailable')
  return {panel,composition}
}

/** Full image resize, then external reflection. Never crop or distort the front. */
export async function finishPrintPixels(buf: Buffer, plan: ReturnType<typeof printPlan>) {
  const meta=await sharp(buf).metadata()
  if (!meta.width || !meta.height || Math.abs(meta.width/meta.height-plan.front.w/plan.front.h)>0.000001) throw new Error('upscale_changed_aspect')
  const front=await sharp(buf).resize(plan.front.w,plan.front.h,{fit:'inside',kernel:'lanczos3'}).toColourspace('srgb').png().toBuffer()
  const output=await sharp(front).extend({...plan.extension,extendWith:'mirror'}).png().toBuffer()
  return {front,output}
}
