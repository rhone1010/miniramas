import {it,expect} from 'vitest';import sharp from 'sharp';import fs from 'node:fs';
import {buildMugWrap,mockupInputFor} from '../print/product-layout.visual.next';import {mugPanelRects} from '../print/production-profiles';import {realMockupRenderer} from './mockup-real';
it('feathers outside both mug pictures without changing panel pixels, margins or wrap size',async()=>{
const art=await sharp('public/previews/_flat/bronze_1.jpg').resize(1024,1024).png().toBuffer();
const wrap=await buildMugWrap(art);const m=await sharp(wrap).metadata();expect([m.width,m.height]).toEqual([2670,1110]);
for(const r of mugPanelRects()){expect(r.y).toBe(100);const expected=await sharp(art).resize(r.w,r.h,{fit:'fill',kernel:'lanczos3'}).removeAlpha().raw().toBuffer();const actual=await sharp(wrap).extract({left:r.x,top:r.y,width:r.w,height:r.h}).removeAlpha().raw().toBuffer();expect(actual.equals(expected)).toBe(true);}
const input=await mockupInputFor('mug',art);const rendered=await realMockupRenderer.render({templateId:'ceramic-mug',productFamily:'mug',size:'11oz',sku:'GLOBAL-MUG-W',artworkId:'transition-candidate',artwork:input});
if(process.env.GIFT_VISUAL_REVIEW_DIR)fs.writeFileSync(process.env.GIFT_VISUAL_REVIEW_DIR+'/mug-transition-candidate.png',rendered.png);
},60000);
