import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {frameColors,tintFramePixels} from '../../public/gift-wizard/frame-finishes.next.js';
const root=path.resolve('public/gift-wizard/beauty-scenes');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.next.json'),'utf8'));
test('supplier-supported finishes exclude grey for float frames and unframed products',()=>{
 assert.equal(frameColors('framed').length,8);assert.equal(frameColors('matted').length,8);
 assert.equal(frameColors('framed_canvas').length,6);assert.equal(frameColors('framed_canvas').includes('dark grey'),false);
 assert.deepEqual(frameColors('fine_art'),[]);assert.equal(frameColors('framed')[0],'black');
});
for(const scene of manifest.scenes.filter(s=>s.frameMask))test(scene.id+' recolors only the isolated frame for every finish',async()=>{
 const dir=path.join(root,scene.id.replace('beauty-',''));
 const read=async name=>(await sharp(path.join(dir,name)).ensureAlpha().raw().toBuffer());
 const [base,frame,art,mat]=await Promise.all([read(scene.sourceImage),read(scene.frameMask),read(scene.artworkMask),scene.matteMask?read(scene.matteMask):null]);
 for(const color of frameColors(scene.family)){
  const output=new Uint8ClampedArray(base);tintFramePixels(output,frame,art,mat,color);let changed=0;
  for(let i=0;i<base.length;i+=4){
   assert.equal(output[i+3],base[i+3]);
   if(!frame[i]||art[i]||mat?.[i])for(let c=0;c<3;c++)assert.equal(output[i+c],base[i+c]);
   if(output[i]!==base[i]||output[i+1]!==base[i+1]||output[i+2]!==base[i+2])changed++;
  }
  if(color==='natural')assert.equal(changed,0);else assert.ok(changed>0);
 }
});
