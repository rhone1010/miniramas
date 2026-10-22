import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {giftCompositionEligibility as eligible,giftCompositionOptions} from '../../public/product-studio/gift-composition-policy.next.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../../public/gift-wizard/catalog.next.json',import.meta.url)));
const shape=(w,h)=>({imageWidthIn:w,imageHeightIn:h});
test('subject-count policy uses square/portrait/landscape rules without rotating products',()=>{
 for(const count of [1,2,3,4,5,12])for(const [w,h,allowed] of [[8,8,true],[12,18,count<=3],[18,12,count>=2]])assert.equal(eligible({id:'fine_art'},shape(w,h),count).allowed,allowed);
});
test('unknown analysis and unsupported ratios fail closed',()=>{
 for(const count of [null,undefined,0,-1,1.5,NaN])assert.equal(eligible({id:'canvas'},shape(8,8),count).reason,'subject_count_required');
 assert.equal(eligible({id:'canvas'},shape(8,10),2).reason,'unsupported_artwork_ratio');
 assert.equal(eligible({id:'canvas'},shape(0,10),2).reason,'invalid_catalog_geometry');
 assert.equal(eligible({id:'canvas'},shape(10.3,10),2).allowed,false);
});
test('real catalog keeps all eight families, prices, finishes and SKU availability unchanged',()=>{
 const before=JSON.stringify(catalog);assert.equal(catalog.products.length,8);
 for(const p of catalog.products){const rows=giftCompositionOptions(p,p.options,5);assert.equal(rows.length,p.options.length);rows.forEach((row,i)=>assert.equal(row.option,p.options[i]));}
 assert.equal(JSON.stringify(catalog),before);
 const p=catalog.products.find(p=>p.id==='matted');const row=giftCompositionOptions(p,p.options,1)[0];assert.equal(row.composition.allowed,true);assert.equal(row.option.compatible,false);assert.equal(p.available,false);
});
test('mug generation aspect and visible-area placement never replace physical wrap geometry',()=>{
 const p=catalog.products.find(p=>p.id==='mug'),o=p.options[0],r=eligible(p,o,5);
 assert.equal(r.aspect,'21:9');assert.equal(r.placement,'primary_visible_area');assert.equal(r.pictureRatio,8.9/3.7);assert.notEqual(r.pictureRatio,21/9);assert.equal(p.available,false);
});
test('card uses its actual verified orientation instead of wall-art aspect rules',()=>{
 const p=catalog.products.find(p=>p.id==='card'),r=eligible(p,p.options[0],5);
 assert.equal(r.aspect,'catalog');assert.equal(r.pictureRatio,5/7);assert.equal(r.allowed,true);assert.equal(p.available,false);
});
