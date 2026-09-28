import {it,expect} from 'vitest'
import sharp from 'sharp'
import {printPlan,finishPrintPixels} from './geometry'
import {getLaunchSku} from './sku-map'

for(const [w,h] of [[2400,2400],[2400,3600],[3600,2400]])it(`prepares full-resolution Canvas ${w}x${h} with preserved front`,async()=>{
 const plan=printPlan(w,h,getLaunchSku(w===h?'8x8':'8x12','canvas'))
 const source=await sharp({create:{width:w,height:h,channels:3,background:'#7c3239'}}).png().toBuffer()
 const {front,output}=await finishPrintPixels(source,plan)
 const md=await sharp(output).metadata()
 expect([md.width,md.height]).toEqual([w+54,h+54]);expect(plan.upscale).toBe(false)
 const center=await sharp(output).extract({left:27,top:27,width:w,height:h}).raw().toBuffer()
 expect(center.equals(await sharp(front).raw().toBuffer())).toBe(true)
 const jpeg=await sharp(output).toColourspace('srgb').jpeg({quality:92,chromaSubsampling:'4:4:4'}).toBuffer()
 const j=await sharp(jpeg).metadata();expect(j.space).toBe('srgb');expect([j.width,j.height]).toEqual([w+54,h+54])
},20000)
