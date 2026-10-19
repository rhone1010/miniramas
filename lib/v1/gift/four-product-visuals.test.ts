import {it,expect} from 'vitest';
import fs from 'node:fs';
import sharp from 'sharp';
import {getProduct} from '../print/catalog';
import {mockupArtwork} from './mockup';
import {realMockupRenderer} from './mockup-real';
it('renders verified mug/card inputs from existing artwork without cropping or enabling purchase',async()=>{
 const dir=process.env.GIFT_VISUAL_REVIEW_DIR;if(dir)fs.mkdirSync(dir,{recursive:true});
 const square=await sharp('public/previews/_flat/bronze_1.jpg').resize(1024,1024,{fit:'contain'}).png().toBuffer();
 const tall=process.env.GIFT_CARD_REVIEW_ARTWORK ? fs.readFileSync(process.env.GIFT_CARD_REVIEW_ARTWORK) : await sharp('public/previews/_flat/bronze_3.jpg').resize(800,800).extend({top:160,bottom:160,background:'#ffffff'}).png().toBuffer();
 const meta=await sharp(tall).metadata(),pad=Math.ceil(meta.height!*5/7)-meta.width!;
 const card=await sharp(tall).extend({left:Math.floor(pad/2),right:pad-Math.floor(pad/2),extendWith:'mirror'}).png().toBuffer();
 for(const [id,template,art] of [['mug:11oz','ceramic-mug',square],['card:7x5','greeting-card',card]] as const){
 const p=getProduct(id)!;expect(p.selectable).not.toBe(true);
 const input=await mockupArtwork(art,p),m=await sharp(input).metadata();
 expect([m.width,m.height]).toEqual(id.startsWith('mug')?[1335,555]:[750,1050]);
 const out=await realMockupRenderer.render({templateId:template,productFamily:p.family,size:p.size,sku:p.sku,artworkId:'offline-four-product-review',artwork:input});
 expect(out.configuration.requiredPx).toEqual(p.requirements.finalPx);expect(out.width).toBe(1264);expect(out.height).toBe(848);
 if(dir){fs.writeFileSync(dir+'/'+template+'-input.png',input);fs.writeFileSync(dir+'/'+template+'.png',out.png);}
 }
},60000);
it('retains eight cards with verified disabled four-product options',()=>{const c=JSON.parse(fs.readFileSync('public/gift-wizard/catalog.next.json','utf8'));expect(c.products).toHaveLength(8);for(const family of ['matted','framed_canvas','mug','card']){const p=c.products.find((p:any)=>p.id===family);expect(p.available).toBe(false);expect(p.options).toHaveLength(['mug','card'].includes(family)?1:8);for(const o of p.options){const backend=getProduct(family+':'+o.size)!;expect(o.sku).toBe(backend.sku);expect(o.requiredPx).toEqual(backend.requirements.finalPx);}}expect(c.products.find((p:any)=>p.id==='framed_canvas').options.find((o:any)=>o.size==='8x12').disabledReason).toBe('orientation_unverified');});
