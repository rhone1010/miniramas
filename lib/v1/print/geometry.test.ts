import {describe,it,expect} from 'vitest'
import sharp from 'sharp'
import {artworkFormat,printPlan,finishPrintPixels,catalogFor} from './geometry'
import {getLaunchSku,SKU_MAP,type PrintSize} from './sku-map'

describe('native print composition and external MirrorWrap',()=>{
  for(const [w,h] of [[24,36],[36,24],[24,24]])it(`preserves every front pixel and reflects only outside ${w}×${h}`,async()=>{
    const square=w===h
    const entry={...getLaunchSku(square?'8x8':'8x12','canvas'),imageWidthIn:24/300,imageHeightIn:(square?24:36)/300,requiredPx:{w:30,h:square?30:42}}
    const raw=Buffer.alloc(w*h*3);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=(y*w+x)*3;raw[at]=x*5;raw[at+1]=y*5;raw[at+2]=(x+y)*2}
    const src=await sharp(raw,{raw:{width:w,height:h,channels:3}}).png().toBuffer()
    const plan=printPlan(w,h,entry),{front,output}=await finishPrintPixels(src,plan)
    const frontRaw=await sharp(front).raw().toBuffer();expect(frontRaw.equals(raw)).toBe(true)
    const extracted=await sharp(output).extract({left:3,top:3,width:w,height:h}).raw().toBuffer();expect(extracted.equals(raw)).toBe(true)
    const {data,info}=await sharp(output).raw().toBuffer({resolveWithObject:true})
    expect([info.width,info.height]).toEqual([w+6,h+6])
    const px=(x:number,y:number)=>Array.from(data.subarray((y*info.width+x)*3,(y*info.width+x)*3+3))
    expect(px(2,10)).toEqual(px(3,10));expect(px(1,10)).toEqual(px(4,10));expect(px(0,10)).toEqual(px(5,10))
    expect(px(10,2)).toEqual(px(10,3));expect(px(10,1)).toEqual(px(10,4))
    expect(plan.front.w/plan.front.h).toBe(w/h)
  })
  for(const size of ['8x8','12x12','16x16','20x20','8x12','12x18','16x24','20x30'] as PrintSize[])it(`uses exact verified dimensions for ${size}`,()=>{
    const e=getLaunchSku(size,'canvas'),square=e.imageWidthIn===e.imageHeightIn
    for(const [w,h] of square?[[1024,1024]]:[[1024,1536],[1536,1024]]){const p=printPlan(w,h,e);expect(p.front.w/p.front.h).toBe(w/h);expect(p.final).toEqual(w>h?{w:e.requiredPx.h,h:e.requiredPx.w}:e.requiredPx);expect(Object.values(p.extension)).toEqual([27,27,27,27])}
  })
  it('scales the whole front without cropping or stretching',async()=>{
    const e={...getLaunchSku('8x12','fine_art'),imageWidthIn:48/300,imageHeightIn:72/300,requiredPx:{w:48,h:72}}
    const src=await sharp({create:{width:24,height:36,channels:3,background:'#ff0000'}}).composite([{input:await sharp({create:{width:6,height:6,channels:3,background:'#00ff00'}}).png().toBuffer(),left:18,top:30}]).png().toBuffer()
    const {front}=await finishPrintPixels(src,printPlan(24,36,e));const {data,info}=await sharp(front).raw().toBuffer({resolveWithObject:true});expect([info.width,info.height]).toEqual([48,72]);expect(data[0]).toBe(255);expect(data[data.length-info.channels+1]).toBeGreaterThan(240)
  })
  it('checks original resolution on both axes and skips unnecessary upscale',()=>{const e=getLaunchSku('8x12','canvas');expect(printPlan(2400,3600,e).upscale).toBe(false);expect(printPlan(1200,1800,e).upscale).toBe(true);expect(printPlan(3600,2400,e).upscale).toBe(false)})
  it('rejects incompatible ratios and upscale distortion',async()=>{expect(artworkFormat(1024,1280)).toBeNull();expect(()=>printPlan(1024,1024,getLaunchSku('8x12','fine_art'))).toThrow();const src=await sharp({create:{width:25,height:36,channels:3,background:'red'}}).png().toBuffer();await expect(finishPrintPixels(src,printPlan(24,36,getLaunchSku('8x12','fine_art')))).rejects.toThrow('upscale_changed_aspect')})
  it('serves only four families from canonical prices; preserves hidden data',()=>{for(const [w,h]of [[1024,1024],[1024,1536],[1536,1024]]){const families=catalogFor(w,h);expect(families.map(f=>f!.id)).toEqual(['fine_art','premium','canvas','framed']);expect(families.every(f=>f!.sizes.length===4)).toBe(true)}expect(getLaunchSku('20x30','canvas').retailCents).toBe(13900);expect(()=>getLaunchSku('8x8','matted')).toThrow();expect(SKU_MAP.matted['8x8']).toBeTruthy();expect(SKU_MAP.framed_canvas['8x8']).toBeTruthy()})
})
