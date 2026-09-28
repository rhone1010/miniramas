import sharp from 'sharp'
import { SKU_MAP, LAUNCH_FAMILIES, type SkuEntry } from './sku-map'

export function artworkFormat(w: number, h: number): 'square' | 'portrait' | 'landscape' | null {
  if (!(w > 0 && h > 0)) return null
  if (w === h) return 'square'
  if (w * 3 === h * 2) return 'portrait'
  if (w * 2 === h * 3) return 'landscape'
  return null
}

export function printPlan(w: number, h: number, entry: SkuEntry) {
  const format = artworkFormat(w, h)
  if (!format || Math.abs(Math.min(w,h)/Math.max(w,h) - entry.imageWidthIn/entry.imageHeightIn) > 0.000001) throw new Error('incompatible_print_aspect')
  const landscape = format === 'landscape'
  const front = { w: Math.round(entry.imageWidthIn * 300), h: Math.round(entry.imageHeightIn * 300) }
  const final = { ...entry.requiredPx }
  if (landscape) { [front.w,front.h]=[front.h,front.w]; [final.w,final.h]=[final.h,final.w] }
  const dx=final.w-front.w, dy=final.h-front.h
  if (dx<0 || dy<0 || (entry.family!=='canvas' && (dx || dy))) throw new Error('invalid_print_dimensions')
  return {format, front, final, upscale: w<front.w || h<front.h, scale: Math.max(front.w/w,front.h/h),
    extension:{left:Math.floor(dx/2),right:dx-Math.floor(dx/2),top:Math.floor(dy/2),bottom:dy-Math.floor(dy/2)}}
}

/** Full image resize, then external reflection. Never crop or distort the front. */
export async function finishPrintPixels(buf: Buffer, plan: ReturnType<typeof printPlan>) {
  const meta=await sharp(buf).metadata()
  if (!meta.width || !meta.height || Math.abs(meta.width/meta.height-plan.front.w/plan.front.h)>0.000001) throw new Error('upscale_changed_aspect')
  const front=await sharp(buf).resize(plan.front.w,plan.front.h,{fit:'inside',kernel:'lanczos3'}).toColourspace('srgb').png().toBuffer()
  const output=await sharp(front).extend({...plan.extension,extendWith:'mirror'}).png().toBuffer()
  return {front,output}
}

export function catalogFor(w:number,h:number){return LAUNCH_FAMILIES.map(f=>{const entries=Object.entries(SKU_MAP[f]).filter(([,e])=>{try{printPlan(w,h,e!);return true}catch{return false}});if(!entries.length)return null;const first=entries[0][1]!;return {id:f,label:first.familyLabel,note:first.familyNote,sizes:entries.map(([size,e])=>({size,finish:f,cents:e!.retailCents,label:w>h?e!.imageHeightIn+' × '+e!.imageWidthIn+'″':e!.label}))}}).filter(Boolean)}
