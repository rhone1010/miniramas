import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import fs from 'node:fs/promises';
import {mugSinglePanelPixels} from '../../public/gift-wizard/mug-panel.next.js';
import {mockupInputFor} from '../../lib/v1/print/product-layout';import {mugSinglePanelPlacement,MUG_SINGLE_PANEL_SHAPES} from '../../lib/v1/print/production-profiles';
test('single-panel beauty uses exact backend view and preserves photographic background',async()=>{
 const root='public/gift-wizard/beauty-scenes/mug/';const base=await sharp(root+'product_beauty_mug.jpeg').ensureAlpha().raw().toBuffer({resolveWithObject:true}),mask=await sharp(root+'artwork-mask.svg').ensureAlpha().raw().toBuffer();const geometry=JSON.parse(await fs.readFile(root+'surface.next.json','utf8'));
 for(const layout of ['mug_single_panel','mug_single_panel_v2'] as const)for(const composition of ['square','landscape'] as const){const shape=MUG_SINGLE_PANEL_SHAPES[layout][composition],picture=await sharp({create:{width:shape.w,height:shape.h,channels:3,background:'#c42'}}).png().toBuffer();const view=await mockupInputFor('mug',picture,{mugLayout:layout}),wrap=await sharp(view).ensureAlpha().raw().toBuffer({resolveWithObject:true}),placement=mugSinglePanelPlacement(composition,layout),before=Buffer.from(wrap.data);
 const args={base:base.data,mask,wrap:wrap.data,width:base.info.width,height:base.info.height,wrapWidth:wrap.info.width,wrapHeight:wrap.info.height,geometry,placement};const out=mugSinglePanelPixels(args);assert.deepEqual(wrap.data,before);let changed=0;for(let i=0;i<out.length;i+=4){if(mask[i]===0)assert.equal(out[i],base.data[i]);else if(out[i]!==base.data[i])changed++}assert.ok(changed>10000);assert.throws(()=>mugSinglePanelPixels({...args,placement:{...placement,layout:'mug_two_face'}}),/single_panel_required/);assert.throws(()=>mugSinglePanelPixels({...args,wrapWidth:100}),/placement_mismatch/);
 }
});

test('single-panel surround uses ceramic colour, ignores wrap watermark outside panel, and retains white artwork',()=>{
 const width=100,height=100,base=new Uint8ClampedArray(width*height*4),mask=new Uint8ClampedArray(base.length),wrap=new Uint8ClampedArray(base.length);
 for(let i=0;i<base.length;i+=4){base.set([232,225,214,255],i);mask.set([255,255,255,255],i);wrap.set([255,255,255,255],i)}
 const geometry={body:{centerX:.5,radiusX:.5,top:{edgeY:0,ellipseDepth:0},bottom:{edgeY:1,ellipseDepth:0}},lightingSampleY:.1,wrapAngleRadians:Math.PI*2};
 const placement={layout:'mug_single_panel_v2',reverse:'white',face:'front',handle:'right',composition:'landscape',viewPx:{w:100,h:100},viewRectPx:{x:30,y:30,w:40,h:40}};
 const args={base,mask,wrap,width,height,wrapWidth:100,wrapHeight:100,geometry,placement};
 const clean=mugSinglePanelPixels(args);
 for(let y=0;y<100;y++)for(let x=0;x<100;x++)if(x<30||x>=70||y<30||y>=70)wrap.set([20,40,60,255],(y*100+x)*4);
 const marked=mugSinglePanelPixels(args);
 assert.deepEqual(marked,clean,'outside-panel watermark cannot appear on ceramic');
 assert.deepEqual([...marked.slice((50*100+50)*4,(50*100+50)*4+3)],[232,225,214],'white artwork remains ceramic-toned');
 assert.deepEqual([...marked.slice((15*100+50)*4,(15*100+50)*4+3)],[232,225,214],'surround retains photographed warm ceramic instead of pure white');
});
