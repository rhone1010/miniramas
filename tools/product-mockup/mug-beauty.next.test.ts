import test from 'node:test';
import assert from 'node:assert/strict';
import {mugSurface} from '../../public/gift-wizard/mug-surface.next.js';
import {mugReview} from '../../public/gift-wizard/mug-beauty.next.js';
test('opposite photo view preserves artwork direction and source pixels',()=>{
 const width=21,height=5,wrapWidth=100,wrapHeight=5;
 const base=new Uint8ClampedArray(width*height*4).fill(255),mask=base.slice(),wrap=new Uint8ClampedArray(wrapWidth*wrapHeight*4);
 for(let y=0;y<wrapHeight;y++)for(let x=0;x<wrapWidth;x++)wrap.set([x*2,x*2,x*2,255],(y*wrapWidth+x)*4);
 const before=wrap.slice(),geometry={body:{centerX:.5,radiusX:.5,top:{edgeY:0,ellipseDepth:0},bottom:{edgeY:1,ellipseDepth:0}},lightingSampleY:0,wrapAngleRadians:Math.PI*2};
 for(const mirrorBody of [false,true]){
  const output=mugSurface({base,mask,wrap,width,height,wrapWidth,wrapHeight,geometry,centerX:.5,mirrorBody});
  assert.ok(output[(2*width+5)*4]<output[(2*width+15)*4], 'artwork must increase left to right in both views');
 }
 assert.deepEqual(wrap,before);
});
test('transparent mask stays transparent and full wrap is an inspection link',()=>{
 const output=mugSurface({base:new Uint8ClampedArray(16).fill(255),mask:new Uint8ClampedArray(16),wrap:new Uint8ClampedArray(16),width:2,height:2,wrapWidth:2,wrapHeight:2,geometry:{body:{}},centerX:.5});
 assert.ok(output.every(x=>x===0));
 const html=mugReview({front:'blob:front',back:'blob:back',wrap:'blob:wrap'});
 assert.match(html,/View Full Wrap/);assert.match(html,/alt="Front"/);assert.match(html,/alt="Back"/);assert.match(html,/href="blob:wrap"/);assert.doesNotMatch(html,/fetch|generationId|acceptFinish/);
});
