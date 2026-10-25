/** Local-only owner-artwork review. No network, generation, orders or database. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {MUG} from '../../lib/v1/print/production-profiles';
import {buildMugFullWrap,mockupInputFor} from '../../lib/v1/print/product-layout';
import {mugSurface} from '../../public/gift-wizard/mug-surface.next.js';
async function main(){
const root=path.resolve('public/gift-wizard/beauty-scenes/mug');
const output=path.resolve('.temp/mug-beauty-review');
const sources='H:/Groups Mug Wrap';
await fs.mkdir(output,{recursive:true});
const geometry=JSON.parse(await fs.readFile(path.join(root,'surface.next.json'),'utf8'));
const [base,mask]=await Promise.all([
 sharp(path.join(root,'product_beauty_mug.jpeg')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
 sharp(path.join(root,'cutout.next.svg')).ensureAlpha().raw().toBuffer({resolveWithObject:true})
]);
const manifest=[];
for(const file of (await fs.readdir(sources)).filter(x=>/^groups_219_.*\.png$/.test(x)).sort()){
 const id=file.replace('.png',''),dir=path.join(output,id);await fs.mkdir(dir,{recursive:true});
 const original=await fs.readFile(path.join(sources,file)),meta=await sharp(original).metadata();
 const w=meta.width!,h=meta.height!,ratio=MUG.fullWrap.printable.w/MUG.fullWrap.printable.h;
 const cw=Math.min(w,Math.round(h*ratio)),ch=Math.min(h,Math.round(w/ratio));
 const trim=1-(cw*ch)/(w*h);if(trim>.101)throw Error('Source exceeds existing ten percent conformity bound: '+file);
 const crop={left:Math.floor((w-cw)/2),top:Math.floor((h-ch)/2),width:cw,height:ch};
 const band=await sharp(original).extract(crop).resize(MUG.fullWrap.printable.w,MUG.fullWrap.printable.h).png().toBuffer();
 // Same existing backend builder used for production; its roll/margins are not recreated here.
 await fs.writeFile(path.join(dir,'beauty-input.png'),await mockupInputFor('mug',band));
 const print=await buildMugFullWrap(band,1),hash=createHash('sha256').update(print).digest('hex');
 const wrap=await sharp(print).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 await fs.writeFile(path.join(dir,'original.png'),original);await fs.writeFile(path.join(dir,'wrap.png'),print);
 for(const side of ['front','back'] as const){
  const image=mugSurface({base:base.data,mask:mask.data,wrap:wrap.data,width:base.info.width,height:base.info.height,wrapWidth:wrap.info.width,wrapHeight:wrap.info.height,geometry,centerX:(side==='front'?MUG.mockupFaceCenterX:MUG.faceCentersX[0])/MUG.wrap.w,mirrorBody:side==='back'});
  await sharp(Buffer.from(image),{raw:{width:base.info.width,height:base.info.height,channels:4}}).png().toFile(path.join(dir,side+'.png'));
 }
 const record={id,file,sourceSha256:createHash('sha256').update(original).digest('hex'),wrapSha256:hash,width:MUG.wrap.w,height:MUG.wrap.h,crop,trimFraction:trim,marginPx:MUG.fullWrap.marginPx,faceCenters:MUG.faceCentersX,geometry,displayOnly:true};
 await fs.writeFile(path.join(dir,'meta.json'),JSON.stringify(record,null,2));manifest.push(record);console.log(id+' '+(trim*100).toFixed(2)+'% conformity trim');
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
const labels:Record<string,string>={impressionist:'Impressionism',jade:'Jade',layered_paper:'Layered Paper',mosaic:'Mosaic',pencil:'Pencil',plushy:'Plushy'};
const cards=manifest.map(m=>{const parts=m.id.match(/groups_219_(.+)_(\d+)/)!;return `<section id="${m.id}"><h2>${labels[parts[1]]} · ${Number(parts[2])} subjects</h2><div class="pair">${['front','back'].map(s=>`<figure><a href="${m.id}/${s}.png" target="_blank"><img src="${m.id}/${s}.png" alt="${s} mug" loading="lazy"></a><figcaption>${s==='front'?'Front':'Back'}</figcaption></figure>`).join('')}</div><details><summary>View Full Wrap</summary><a href="${m.id}/wrap.png" target="_blank"><img class="wrap" src="${m.id}/wrap.png" alt="Complete print layout"></a><p>2670 × 1110 · 38px margins · Same wrap for both views</p></details><details open><summary>Original 21:9 artwork</summary><a href="${m.id}/original.png" target="_blank"><img class="wrap" src="${m.id}/original.png" alt="Unmodified original artwork" loading="lazy"></a></details><p class="note">Existing print-layout conformity: ${(m.trimFraction*100).toFixed(2)}% centered trim. Original file unchanged. <a href="${m.id}/meta.json">Identity and geometry</a></p></section>`}).join('');
await fs.writeFile(path.join(output,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ceramic Mug · Product Review</title><style>body{margin:0;background:#f7f3ea;color:#293c2c;font-family:Georgia,serif}header,main{max-width:1200px;margin:auto;padding:24px}h1{font-size:42px;font-weight:400}h2{font-size:30px;font-weight:400}p{font-size:18px;line-height:1.5}.note{font:14px/1.5 sans-serif;color:#555}section{border-top:1px solid #bdae99;padding:24px 0 40px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{margin:0;text-align:center}figure img{width:100%;display:block}figcaption,summary{font-size:24px}a{color:inherit}.wrap{width:100%;height:auto;margin-top:16px}summary{cursor:pointer;padding:16px 0}details{margin-top:16px}img{max-width:100%}@media(max-width:600px){.pair{grid-template-columns:1fr;gap:16px}header,main{padding:16px}h1{font-size:32px}}</style></head><body><header><h1>Ceramic Mug</h1><p>Front, Back and Full Wrap</p><p class="note">Local visual review · Original owner artwork · No generation or manufacturing submission. Body mapping is a photographic approximation awaiting a physical sample. Click any image for full-resolution inspection.</p></header><main>${cards}</main></body></html>`);

}
main().catch(e=>{console.error(e);process.exitCode=1});
