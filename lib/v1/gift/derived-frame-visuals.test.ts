import {it,expect} from 'vitest';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import {getProduct} from '../print/catalog';
const adapter=createRequire(import.meta.url)('../../../tools/product-mockup/gift-visualization-adapter.next.cjs');
it('derives mat and float-canvas layers for every supported size while retaining artwork',async()=>{
 const source=await sharp('public/previews/_flat/bronze_1.jpg').resize(600,600,{fit:'contain'}).png().toBuffer();
 for(const family of ['matted','framed_canvas'])for(const size of ['8x8','12x12','16x16','20x20','8x12','12x18','16x24','20x30']){
 if(family==='framed_canvas'&&size==='8x12')continue;
 const p=getProduct(family+':'+size)!,ratio=p.requirements.picturePx.w/p.requirements.picturePx.h;
 const h=Math.round(600/ratio),art=await sharp(source).extend({top:Math.floor((h-600)/2),bottom:Math.ceil((h-600)/2),extendWith:'mirror'}).png().toBuffer();
 const templateId=(family==='matted'?'matted-frame':'framed-canvas')+(size.split('x')[0]===size.split('x')[1]?'-square':'');
 const r=await adapter.composeTemplateVisualTest({templateId,artwork:art,artworkId:'offline-specimen',size,floatGapIn:family==='framed_canvas'?.125:undefined});
 expect(r.metadata.artworkCrop).toBe(false);expect(r.metadata.provisional).toBe(true);expect(r.purchaseAuthorization).toBe(false);expect(r.metadata.canvasDepthMm).toBe(family==='framed_canvas'?38:null);
 if(process.env.GIFT_VISUAL_REVIEW_DIR&&['8x8','12x18','20x20'].includes(size))fs.writeFileSync(process.env.GIFT_VISUAL_REVIEW_DIR+'/'+family+'-'+size+'.png',r.png);
 }
},120000);
it('refuses held orientation and unspecified float gap',async()=>{const a=Buffer.from('unused');await expect(adapter.composeTemplateVisualTest({templateId:'framed-canvas',artwork:a,artworkId:'x',size:'8x12',floatGapIn:.125})).rejects.toThrow('unsupported_or_held_size');await expect(adapter.composeTemplateVisualTest({templateId:'framed-canvas-square',artwork:a,artworkId:'x',size:'8x8'})).rejects.toThrow('float_gap_unverified');});
