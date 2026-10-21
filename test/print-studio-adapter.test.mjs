import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {loadPrintStudioData,restorePrintState,persistPrintState,collectionReturn,connectPrintStudio} from '../public/product-studio/print.next.js';
const id='a8caca33-0a95-48ab-be74-9f13b9ba3a72';
const photos=JSON.parse(readFileSync(new URL('../public/gift-wizard/catalog.next.json',import.meta.url),'utf8'));
const sample=photos.products[0].options[0];
const catalog={contractVersion:1,artwork:{width:1024,height:1024},products:[{family:photos.products[0].id,status:'launch',size:sample.size,label:sample.label,retailCents:sample.retailCents,sku:sample.sku,attributes:{},selectable:true,requirements:{ppi:300,picturePx:sample.requiredPx}}]};
function transport(pieceId=id){const calls=[];return {calls,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('/source?')?{piece:{id:pieceId,width:1024,height:1024},fulfilment:true}:url.includes('/catalog?')?catalog:photos};}};}
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};};
test('ownership mismatch prevents all catalog and commerce requests',async()=>{
 const api=transport('00000000-0000-0000-0000-000000000000');
 await assert.rejects(loadPrintStudioData(id,api.fetch),/owned_artwork_required/);
 assert.equal(api.calls.length,1);assert.equal(api.calls[0].options.credentials,'same-origin');
});
test('catalog geometry and prices map from server; photography maps from Gift',async()=>{
 const api=transport();const d=await loadPrintStudioData(id,api.fetch);
 assert.equal(d.pieceId,id);assert.equal(d.products[0].options[0].retailCents,sample.retailCents);
 assert.equal(d.products[0].image,'/gift-wizard/'+photos.products[0].image.slice(2));
 assert.equal(api.calls.length,3);assert(api.calls.every(c=>!c.options.method));
});
test('state is artwork scoped, sanitized, and retains Collection return context',async()=>{
 const data=await loadPrintStudioData(id,transport().fetch),store=storage();
 const state={step:'review',productId:data.products[0].id,size:sample.size,copies:2,drafts:{}};
 persistPrintState(id,state,store);assert.deepEqual(restorePrintState(id,data.products,store),state);
 assert.equal(restorePrintState('other-piece',data.products,store).step,'product');
 store.setItem('liten_collection_return','/groups');assert.equal(collectionReturn(new URL('https://example.test/print'),store),'/collection?from=groups');
 assert.equal(collectionReturn(new URL('https://example.test/print?from=pets'),store),'/collection?from=pets');
 state.copies=NaN;persistPrintState(id,state,store);assert.equal(restorePrintState(id,data.products,store).copies,1);
});
test('Collection entrance validates ownership and uses the same Gift session; receipt stays separate',async()=>{
 const dom=new JSDOM('<main id="screen"></main>'),host=dom.window.document.getElementById('screen'),store=storage(),calls=[],opened=[];
 const session={contractVersion:1,sessionId:'collection-session',entrance:'collection',collection:{previewId:id,portfolioId:'portfolio'},source:{sourceRef:'source',series:'portraits',width:1024,height:1024},lines:[],geometries:[],batches:[],usedEffectIds:[],entitlement:{freeBatchesTotal:2,freeBatchesUsed:0,paidPacksAvailable:0,freeAvailable:false,freeBlockedReason:null},nextBatch:{kind:'blocked',reason:'collection_session'},expiresAt:'2099-01-01',order:{state:'none',freeBatchesGranted:0},artworkPreviewId:'favorite',compositions:[]};
 const fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(session),{status:201})};
 await connectPrintStudio(host,new URL('https://example.test/print?test_piece='+id),store,fetch,()=>{},u=>opened.push(u));
 assert.equal(calls[0].url,'/api/v1/gift/sessions/from-collection');assert.equal(calls[0].options.method,'POST');assert.deepEqual(JSON.parse(calls[0].options.body),{previewId:id});assert.equal(calls[0].options.credentials,'same-origin');assert.deepEqual(opened,['/gift-wizard.next.html?sessionId=collection-session']);assert.equal(host.hasAttribute('aria-busy'),false);
 assert.equal(await connectPrintStudio(host,new URL('https://example.test/print?session=existing'),store,fetch),null);assert.equal(calls.length,1);
 session.collection.previewId='wrong';await assert.rejects(connectPrintStudio(host,new URL('https://example.test/print?test_piece='+id),store,fetch,()=>{},()=>{}),/owned_artwork_required/);dom.window.close();
});
