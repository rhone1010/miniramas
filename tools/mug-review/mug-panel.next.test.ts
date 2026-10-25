import test from 'node:test';
import assert from 'node:assert/strict';
import {mugPanelPixels} from '../../public/gift-wizard/mug-panel.next.js';
test('single-panel display preserves artwork and every unmasked photograph pixel',()=>{
 const width=100,height=100,base=new Uint8ClampedArray(width*height*4).fill(245),mask=new Uint8ClampedArray(base.length),art=new Uint8ClampedArray(40*60*4).fill(80);
 for(let y=20;y<80;y++)for(let x=20;x<80;x++)mask.set([255,255,255,255],(y*width+x)*4);
 const original=art.slice(),photo=base.slice(),panel={centerX:50,centerY:50,radiusX:50,maxWidth:40,maxHeight:50,curveDepth:2,lightRow:10};
 const result=mugPanelPixels({base,mask,art,width,height,artWidth:40,artHeight:60,panel});
 assert.deepEqual(art,original);assert.deepEqual(base,photo);
 for(let i=0;i<base.length;i+=4)if(!mask[i])assert.deepEqual(result.slice(i,i+4),base.slice(i,i+4));
 assert.ok(result[(50*width+50)*4]<100);
 assert.equal(result[(25*width+25)*4],245);
});
