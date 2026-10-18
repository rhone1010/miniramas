import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import * as contracts from '../../public/gift-wizard/contracts.next';
import * as backend from '../../public/gift-wizard/backend.next';
import * as state from '../../public/gift-wizard/backend-state.next';
import * as live from '../../public/gift-wizard/live.next';
const local=JSON.parse(fs.readFileSync('public/gift-wizard/catalog.next.json','utf8'));
function project(orderState='awaiting_artwork'){
 const opt=local.products.find((p:any)=>p.id==='framed').options.find((o:any)=>o.size==='12x18');
 return {contractVersion:1,sessionId:'project',source:{sourceRef:'source',series:'portraits',width:768,height:768,peopleCount:null},lines:[{lineId:'line',productId:'framed:12x18',size:'12x18',copies:1}],geometries:[{lineId:'line',productId:'framed:12x18',sku:opt.sku,requiredPx:opt.requiredPx}],batches:[],usedEffectIds:[],entitlement:{freeBatchesTotal:2,freeBatchesUsed:0,paidPacksAvailable:0},nextBatch:{kind:'free'},expiresAt:'2099-01-01',catalogVersion:'test',order:{orderId:'order',state:orderState,freeBatchesGranted:2,approvedAt:null,unlockPortfolioId:null,totalCents:12300,disclosureVersion:'v1'},artworkPreviewId:null,compositions:[]};
}
const catalog={contractVersion:1,products:local.products.flatMap((p:any)=>p.options.map((o:any)=>({productId:p.id+':'+o.size,family:p.id,status:p.available?'launch':'disabled',selectable:p.available,sku:o.sku,size:o.size,label:o.label,retailCents:o.retailCents,attributes:o.attributes,requirements:{picturePx:{w:o.imageWidthIn*300,h:o.imageHeightIn*300},ppi:300,finalPx:o.requiredPx}})))};
async function boot(query:string,response:any=project(),status=200){
 const dom=new JSDOM(fs.readFileSync('public/gift-wizard.next.html','utf8'),{url:'https://liten.invalid/gift-wizard.next.html?'+query,runScripts:'outside-only'});
 const win=dom.window as any,calls:string[]=[];
 win.matchMedia=()=>({matches:query.includes('mobile=1'),addEventListener(){}});win.ResizeObserver=class{observe(){}disconnect(){}};win.scrollTo=()=>{};win.structuredClone=structuredClone;win.AbortController=AbortController;win.Response=Response;
 win.require=(name:string)=>name.includes('contracts.next')?contracts:name.includes('backend-state')?state:name.includes('backend.next')?backend:live;
 win.fetch=async(url:string)=>{calls.push(String(url));const data=String(url).endsWith('/auth/me')?{user:{id:'test-account'}}:String(url).endsWith('/orders/confirm')?response.confirmation:String(url).includes('/mockup?')?(response.mockups?.[String(url).split('/lines/')[1]?.split('/')[0]]||response.mockup):String(url).includes('/api/v1/print/catalog')?catalog:String(url).includes('/api/v1/gift/')?response:String(url).includes('catalog.next')?local:String(url).includes('fixtures.next')?[]:{effects:{},base:'/previews/'};return new Response(JSON.stringify(data),{status:String(url).includes('/api/v1/gift/')?status:200})};
 let code=fs.readFileSync('public/gift-wizard/wizard.next.ts','utf8').replace('import.meta.url',"'https://liten.invalid/gift-wizard/wizard.next.js'").replace('await import(path);',"window.EFFECT_REGISTRY={silos:[{id:'first',label:'First'}],effects:[{id:'jade',label:'Jade',category:'first',body:'live'}]};").replace(/start\(\);\s*$/,"globalThis.started=start();globalThis.navigate=go;");
 win.Error=Error;win.exports={};vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,dom.getInternalVMContext());
 await win.started;return {dom,win,calls};
}
test('fixture layout stays offline even with a project or Stripe query',async()=>{const {win,calls,dom}=await boot('layoutReview=payment-verified&sessionId=project&paid=true&redirect_status=succeeded');assert.ok(win.document.body.textContent.includes('LAYOUT REVIEW'));assert.equal(calls.some(x=>x.includes('/api/v1/gift/')),false);assert.equal(win.document.getElementById('primary').disabled,true);dom.window.close()});
test('redirect claims do not unlock an unpaid server project',async()=>{const {win,dom}=await boot('sessionId=project&paid=true&redirect_status=succeeded',project('checkout_open'));assert.equal(win.document.getElementById('primary').textContent.includes('Choose Your Effects'),false);win.navigate('effects');assert.equal(win.document.getElementById('screen').dataset.view,'payment');dom.window.close()});
test('needs_attention remains blocked and visible',async()=>{const {win,dom}=await boot('sessionId=project',project('needs_attention'));assert.equal(win.document.getElementById('primary').textContent,'Concierge');win.navigate('effects');assert.equal(win.document.getElementById('screen').dataset.view,'payment');dom.window.close()});
test('verified restoration uses server products, total and generation permission',async()=>{const {win,calls,dom}=await boot('sessionId=project');assert.ok(calls.includes('/api/v1/gift/sessions/project'));assert.ok(calls.includes('/api/v1/print/catalog'));assert.equal(calls.some(x=>x.includes('fixtures.next')),false);assert.equal(win.document.getElementById('primary').disabled,false);assert.ok(win.document.getElementById('right').textContent.includes('$123.00'));win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'effects');assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close()});
test('authentication failure never shows confirmation',async()=>{const {win,dom}=await boot('sessionId=project',{error:'sign_in_required'},401);assert.ok(win.document.getElementById('screen').textContent.includes('Sign in'));assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close()});
test('configuration mismatch fails restoration without exposing create art',async()=>{const s=project();s.geometries[0].sku='bad';const {win,dom}=await boot('sessionId=project',s);assert.equal(win.document.getElementById('error').textContent,'purchased_configuration_mismatch');win.navigate('effects');assert.equal(win.document.getElementById('screen').dataset.view,'payment');dom.window.close()});

test('mobile restoration retains the same payment gate and effects action',async()=>{const {win,dom}=await boot('sessionId=project&mobile=1');win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'effects');assert.ok(win.document.querySelector('.mobile-bottom-action'));assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close()});
test('checkout disclosure stays blocked in live mode',async()=>{const {win,dom}=await boot('sessionId=project',project('checkout_open'));win.navigate('checkout');assert.equal(win.document.getElementById('primary').disabled,true);dom.window.close()});

test('product approval uses the authenticated mockup and final release stays disabled',async()=>{
 const s:any=project();s.artworkPreviewId='preview';s.compositions=[{lineId:'line',productId:'framed:12x18',sourceArtworkId:'preview',compositionId:'comp',attempt:1,status:'ready',sku:s.geometries[0].sku,correctionsRemaining:1}];
 s.mockup={contractVersion:1,sessionId:'project',lineId:'line',productId:'framed:12x18',sourceArtworkId:'preview',compositionId:'comp',attempt:1,compositionStatus:'ready',sku:s.geometries[0].sku,watermarked:true,productionPrintFile:false,purchaseAuthorization:false,geometrySource:'frozen',url:'https://liten.invalid/signed-product.png',urlExpiresAt:'2099-01-01',width:1264,height:848};
 const {win,calls,dom}=await boot('sessionId=project',s);win.navigate('compositions');
 assert.ok(calls.some(x=>x.endsWith('/lines/line/mockup?compositionId=comp')));
 assert.equal(win.document.querySelector('#screen img').src,s.mockup.url);
 assert.equal(win.document.getElementById('primary').disabled,false);
 win.document.getElementById('order-example').click();assert.equal(win.document.getElementById('primary').textContent,'Approve My Gifts →');assert.equal(win.document.getElementById('primary').disabled,true);
 assert.equal(calls.some(x=>x.endsWith('/approve')),false);dom.window.close();
});
test('disclosure checkbox cannot enable a live payment handoff',async()=>{const {win,dom}=await boot('sessionId=project',project('checkout_open'));win.navigate('checkout');const box=win.document.getElementById('disclosure');box.checked=true;box.dispatchEvent(new win.Event('change'));assert.equal(win.document.getElementById('primary').disabled,true);dom.window.close()});

test('actual Stripe return parameter is verified by server before restoring its project',async()=>{const s:any=project();s.confirmation={confirmed:true,session:project()};const {win,calls,dom}=await boot('gift_order_session=cs_test',s);assert.ok(calls.includes('/api/v1/gift/orders/confirm'));assert.ok(calls.includes('/api/v1/gift/sessions/project'));assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close()});
test('unconfirmed Stripe return stays pending and can retry without granting access',async()=>{const s:any=project();s.confirmation={confirmed:false};const {win,calls,dom}=await boot('gift_order_session=cs_test',s);assert.equal(calls.includes('/api/v1/gift/sessions/project'),false);assert.ok(win.document.getElementById('screen').textContent.includes('Checking your payment'));win.navigate('effects');assert.equal(win.document.getElementById('screen').dataset.view,'payment');dom.window.close()});

test('stable direct URL is live and never loads fixture artwork',async()=>{
 const {win,calls,dom}=await boot('');
 assert.ok(calls.includes('/api/v1/auth/me'));assert.ok(calls.includes('/api/v1/print/catalog'));
 assert.equal(calls.some(x=>x.includes('fixtures.next')),false);
 assert.equal(win.document.getElementById('screen').dataset.view,'photo');dom.window.close();
});
test('unassociated pack return cannot fabricate a project or preview balance',async()=>{
 const {win,calls,dom}=await boot('gift_pack_session=cs_test_unknown');
 assert.equal(calls.some(x=>x.includes('/preview-pack/confirm')),false);
 assert.equal(win.document.getElementById('error').textContent,'gift_project_reference_required');dom.window.close();
});

function artworkProject(){
 const s:any=project();s.artworkPreviewId='favorite';s.entitlement.freeBatchesUsed=2;s.usedEffectIds=['jade'];s.nextBatch={kind:'payment_required',amountCents:299,currency:'USD'};
 s.batches=[1,2].map(n=>({batchIndex:n,kind:'free',complete:true,previews:Array.from({length:6},(_,i)=>({previewId:n===1&&i===4?'favorite':n+'-'+i,effectId:'jade',slot:i+1,status:'ready',url:'https://liten.invalid/art-'+n+'-'+i+'.jpg',width:768,height:1024,retryable:false}))}));
 s.compositions=[{lineId:'line',productId:'framed:12x18',sourceArtworkId:'favorite',compositionId:'comp',attempt:1,status:'ready',sku:s.geometries[0].sku,correctionsRemaining:1}];
 s.mockup={contractVersion:1,sessionId:'project',lineId:'line',productId:'framed:12x18',sourceArtworkId:'favorite',compositionId:'comp',attempt:1,compositionStatus:'ready',sku:s.geometries[0].sku,watermarked:true,productionPrintFile:false,purchaseAuthorization:false,geometrySource:'frozen',url:'https://liten.invalid/signed-product.png',urlExpiresAt:'2099-01-01',width:1264,height:848};return s;
}
test('restored favorite in first batch reaches its existing mockup with no writes',async()=>{
 const {win,calls,dom}=await boot('sessionId=project',artworkProject());
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'effects');assert.equal(win.document.querySelector('[data-effect="jade"]').disabled,true);
 win.document.getElementById('existing-previews').click();assert.equal(win.document.querySelector('[data-art="favorite"]').getAttribute('aria-pressed'),'true');
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'compositions');assert.equal(win.document.querySelector('#screen img').src,'https://liten.invalid/signed-product.png');
 assert.equal(calls.some(x=>/\/(artwork|compositions|batches|approve)$/.test(x)),false);dom.window.close();
});
test('both existing batches are reachable on mobile without generating or selecting artwork',async()=>{
 const {win,calls,dom}=await boot('sessionId=project&mobile=1',artworkProject());win.navigate('review');
 win.document.querySelector('[data-batch="1"]').click();assert.equal(win.document.querySelectorAll('[data-art]').length,6);assert.ok(win.document.querySelector('[data-art="2-0"]'));
 win.document.querySelector('[data-batch="0"]').click();win.document.querySelector('[data-art="favorite"]').click();assert.equal(win.document.querySelectorAll('#screen img').length,1);assert.equal(win.document.querySelectorAll('#right img').length,0);
 assert.equal(calls.some(x=>x.endsWith('/batches')||x.endsWith('/artwork')),false);dom.window.close();
});
test('mixed-aspect purchased lines retain individual mockups and navigation never approves',async()=>{
 const s=artworkProject(),o=local.products.find((p:any)=>p.id==='canvas').options.find((o:any)=>o.size==='8x8');
 s.lines.push({lineId:'square',productId:'canvas:8x8',size:'8x8',copies:1});s.geometries.push({lineId:'square',productId:'canvas:8x8',sku:o.sku,requiredPx:o.requiredPx});
 s.compositions.push({...s.compositions[0],lineId:'square',productId:'canvas:8x8',compositionId:'square-comp',sku:o.sku});
 s.mockups={line:s.mockup,square:{...s.mockup,lineId:'square',productId:'canvas:8x8',compositionId:'square-comp',sku:o.sku,url:'https://liten.invalid/square-product.png'}};
 const {win,calls,dom}=await boot('sessionId=project',s);win.navigate('compositions');
 win.document.getElementById('next-product').click();assert.equal(win.document.querySelector('#screen img').src,s.mockups.square.url);assert.ok(win.document.getElementById('screen').textContent.includes('Gift 2 of 2'));
 win.document.getElementById('previous-product').click();assert.equal(win.document.querySelector('#screen img').src,s.mockup.url);
 win.document.getElementById('next-product').click();win.document.getElementById('order-example').click();assert.equal(win.document.getElementById('primary').disabled,true);assert.equal(calls.some(x=>x.endsWith('/approve')),false);dom.window.close();
});
test('expired or stale mockups cannot unlock individual approval',async()=>{
 for(const change of [{urlExpiresAt:'2000-01-01'},{compositionId:'old-comp'}]){const s=artworkProject();Object.assign(s.mockup,change);const {win,dom}=await boot('sessionId=project',s);win.navigate('compositions');assert.equal(win.document.getElementById('primary').disabled,true);assert.equal(win.document.querySelector('#screen img'),null);dom.window.close()}
});
