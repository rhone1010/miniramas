import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import * as contracts from '../../public/gift-wizard/contracts.next';
import * as backend from '../../public/gift-wizard/backend.next';
import * as state from '../../public/gift-wizard/backend-state.next';
import * as compositionPolicy from '../../public/product-studio/gift-composition-policy.next';
import * as studio from '../../public/product-studio/studio.next';
import * as live from '../../public/gift-wizard/live.next';
const local=JSON.parse(fs.readFileSync('public/gift-wizard/catalog.next.json','utf8'));
function project(orderState='awaiting_artwork'){
 const opt=local.products.find((p:any)=>p.id==='framed').options.find((o:any)=>o.size==='12x18');
 return {contractVersion:1,sessionId:'project',source:{sourceRef:'source',series:'portraits',width:768,height:768,peopleCount:null},lines:[{lineId:'line',productId:'framed:12x18',size:'12x18',copies:1}],geometries:[{lineId:'line',productId:'framed:12x18',sku:opt.sku,requiredPx:opt.requiredPx}],batches:[],usedEffectIds:[],entitlement:{freeBatchesTotal:2,freeBatchesUsed:0,paidPacksAvailable:0,freeAvailable:true,freeBlockedReason:null},nextBatch:{kind:'free'},expiresAt:'2099-01-01',catalogVersion:'test',order:{orderId:'order',state:orderState,freeBatchesGranted:2,approvedAt:null,unlockPortfolioId:null,totalCents:12300,disclosureVersion:'v1'},artworkPreviewId:null,compositions:[]};
}
const catalog={contractVersion:1,products:local.products.flatMap((p:any)=>p.options.map((o:any)=>({productId:p.id+':'+o.size,family:p.id,status:p.available?'launch':'disabled',selectable:p.available,sku:o.sku,size:o.size,label:o.label,retailCents:o.retailCents,attributes:o.attributes,requirements:{picturePx:{w:o.imageWidthIn*300,h:o.imageHeightIn*300},ppi:300,finalPx:o.requiredPx}})))};
function fixtureProductPreview(s:any,url:string){
 const productId=new URL(url,'https://liten.invalid').searchParams.get('productId')!,o=catalog.products.find((p:any)=>p.productId===productId)!;
 return {contractVersion:1,status:'ready',sessionId:s.sessionId,productId,sku:o.sku,favoriteId:s.artworkPreviewId,renderer:'scene',sceneId:({fine_art:'fine-art-square',framed:'classic-framed',canvas:'gallery-canvas-square'} as any)[productId.split(':')[0]],fit:'exact',url:'https://liten.invalid/product.jpg',urlExpiresAt:'2099-01-01',width:1254,height:1254,watermarked:true,productionPrintFile:false,purchaseAuthorization:false};
}
async function boot(query:string,response:any=project(),status=200){
 const dom=new JSDOM(fs.readFileSync('public/gift-wizard.next.html','utf8'),{url:'https://liten.invalid/gift-wizard.next.html?'+query,runScripts:'outside-only'});
 const win=dom.window as any,calls:string[]=[];
 win.matchMedia=()=>({matches:query.includes('mobile=1'),addEventListener(){}});win.ResizeObserver=class{observe(){}disconnect(){}};win.scrollTo=()=>{};win.structuredClone=structuredClone;win.AbortController=AbortController;win.Response=Response;
 win.require=(name:string)=>name.includes('gift-composition-policy')?compositionPolicy:name.includes('studio.next')?studio:name.includes('contracts.next')?contracts:name.includes('backend-state')?state:name.includes('backend.next')?backend:live;
 win.fetch=async(url:string,init:any={})=>{calls.push(String(url));if(String(url).endsWith('/auth/me')&&response.authStatus===401)return new Response(JSON.stringify({error:'sign_in_required'}),{status:401});if(response.route&&String(url).includes('/api/v1/gift/')){const routed=await response.route(String(url),init);if(routed)return routed instanceof Response?routed:new Response(JSON.stringify(routed),{status:200})}const data=String(url).startsWith('/gift-wizard/mockup-scenes/')?JSON.parse(fs.readFileSync('public'+String(url),'utf8')):String(url).endsWith('/availability')?{contractVersion:1,sessionId:response.sessionId,products:catalog.products.map(p=>({productId:p.productId,purchasable:p.selectable,preview:{sceneId:p.family==='canvas'?'gallery-canvas-square':null}}))}:String(url).endsWith('/previews/effects-manifest.json')?(response.originalPortraitManifest||JSON.parse(fs.readFileSync('public/previews/effects-manifest.json','utf8'))):String(url).endsWith('/effect-previews/index.next.json')?JSON.parse(fs.readFileSync('public/gift-wizard/effect-previews/index.next.json','utf8')):String(url)==='/api/v1/gift/sessions'&&init.method==='GET'?(response.latestResponse||{contractVersion:1,current:response.resume?response:null,resume:response.resume?{sessionId:response.sessionId,suggestedStep:'previews',resumeBatches:[],runningBatches:[]}:null,recent:[]}):String(url).endsWith('/auth/me')?{user:{id:'test-account'}}:String(url).endsWith('/orders/confirm')?response.confirmation:String(url).includes('/product-preview?')?fixtureProductPreview(response,String(url)):String(url).includes('/mockup?')?(response.mockups?.[String(url).split('/lines/')[1]?.split('/')[0]]||response.mockup):String(url).includes('/api/v1/print/catalog')?catalog:String(url).includes('/api/v1/gift/')?response:String(url).includes('catalog-samples/index.next')?JSON.parse(fs.readFileSync('public/gift-wizard/catalog-samples/index.next.json','utf8')):String(url).includes('catalog.next')?local:String(url).includes('fixtures.next')?JSON.parse(fs.readFileSync('public/gift-wizard/fixtures.next.json','utf8')):{effects:{},base:'/previews/'};return new Response(JSON.stringify(data),{status:String(url).includes('/api/v1/gift/')?status:200})};
 let code=fs.readFileSync('public/gift-wizard/wizard.next.ts','utf8').replace('import.meta.url',"'https://liten.invalid/gift-wizard/wizard.next.js'").replace('await import(path);',"window.EFFECT_REGISTRY={silos:[{id:'first',label:'First'}],effects:[{id:'jade',label:'Jade',category:'first',body:'live'}]};").replace(/start\(\);\s*$/,"globalThis.started=start();globalThis.navigate=go;globalThis.uploadPhoto=upload;globalThis.refreshGift=refreshGeneration;globalThis.refreshComposition=readCompositionState;");
 if(response.storage)for(const [k,v] of Object.entries(response.storage))win.sessionStorage.setItem(k,v);
 if(response.resume)win.sessionStorage.setItem("liten-gift-resume",JSON.stringify(response.resume));
 win.Error=Error;win.exports={};vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,dom.getInternalVMContext());
 await win.started;return {dom,win,calls};
}
test('fixture layout stays offline even with a project or Stripe query',async()=>{const {win,calls,dom}=await boot('layoutReview=payment-verified&sessionId=project&paid=true&redirect_status=succeeded');assert.ok(win.document.body.textContent.includes('LAYOUT REVIEW'));assert.equal(calls.some(x=>x.includes('/api/v1/gift/')),false);assert.equal(win.document.getElementById('primary').disabled,true);dom.window.close()});
test('redirect claims do not establish payment; server free allocation enables effects',async()=>{const {win,dom}=await boot('sessionId=project&paid=true&redirect_status=succeeded',project('checkout_open'));assert.equal(win.document.getElementById('primary').textContent.includes('Choose Your Effects'),false);win.navigate('effects');assert.equal(win.document.getElementById('screen').dataset.view,'effects');assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close()});
test('needs_attention remains blocked and visible',async()=>{const {win,dom}=await boot('sessionId=project',project('needs_attention'));assert.equal(win.document.getElementById('primary').textContent,'Concierge');win.navigate('effects');assert.equal(win.document.getElementById('screen').dataset.view,'payment');dom.window.close()});
test('verified restoration uses server products, total and generation permission',async()=>{const {win,calls,dom}=await boot('sessionId=project');assert.ok(calls.includes('/api/v1/gift/sessions/project'));assert.ok(calls.includes('/api/v1/print/catalog'));assert.equal(calls.some(x=>x.includes('fixtures.next')),false);assert.equal(win.document.getElementById('primary').disabled,false);assert.ok(win.document.getElementById('right').textContent.includes('$123.00'));win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'effects');assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close()});
test('authentication failure never shows confirmation',async()=>{const {win,dom}=await boot('sessionId=project',{error:'sign_in_required'},401);assert.ok(win.document.getElementById('screen').textContent.includes('Sign in'));assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close()});
test('configuration mismatch fails restoration without exposing create art',async()=>{const s=project();s.geometries[0].sku='bad';const {win,dom}=await boot('sessionId=project',s);assert.equal(win.document.getElementById('error').textContent,'purchased_configuration_mismatch');win.navigate('effects');assert.equal(win.document.getElementById('screen').dataset.view,'payment');dom.window.close()});

test('mobile restoration retains the same payment gate and effects action',async()=>{const {win,dom}=await boot('sessionId=project&mobile=1');win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'effects');assert.ok(win.document.querySelector('.mobile-bottom-action'));assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close()});
test('checkout requires a saved favorite',async()=>{const {win,dom}=await boot('sessionId=project',project('checkout_open'));win.navigate('checkout');assert.equal(win.document.getElementById('screen').dataset.view,'effects');dom.window.close()});

test('product approval uses the authenticated mockup and final release stays disabled',async()=>{
 const s:any=project();s.artworkPreviewId='preview';s.compositions=[{lineId:'line',productId:'framed:12x18',sourceArtworkId:'preview',compositionId:'comp',attempt:1,status:'ready',sku:s.geometries[0].sku,correctionsRemaining:1}];
 s.mockup={contractVersion:1,sessionId:'project',lineId:'line',productId:'framed:12x18',sourceArtworkId:'preview',compositionId:'comp',attempt:1,compositionStatus:'ready',sku:s.geometries[0].sku,renderer:'scene',scene:{sceneId:'classic-framed'},watermarked:true,productionPrintFile:false,purchaseAuthorization:false,geometrySource:'frozen',url:'https://liten.invalid/signed-product.png',urlExpiresAt:'2099-01-01',width:1264,height:848};
 const {win,calls,dom}=await boot('sessionId=project',s);win.navigate('compositions');
 assert.ok(calls.some(x=>x.endsWith('/lines/line/mockup?compositionId=comp')));
 assert.equal(win.document.querySelector('#screen img').src,s.mockup.url);
 assert.equal(win.document.getElementById('primary').disabled,false);
 win.document.getElementById('order-example').click();assert.equal(win.document.getElementById('primary').textContent,'Approve My Gifts →');assert.equal(win.document.getElementById('primary').disabled,true);
 assert.equal(calls.some(x=>x.endsWith('/approve')),false);dom.window.close();
});
test('checkout requires valid delivery and explicit acceptance with a saved favorite',async()=>{const s=artworkProject();s.order.state='checkout_open';const {win,dom}=await boot('sessionId=project',s);win.navigate('checkout');await new Promise(r=>setTimeout(r,25));assert.equal(win.document.getElementById('primary').disabled,true);for(const [id,value] of Object.entries({email:'test@example.com',name:'Test Person',line1:'1 Test Street',city:'Test',state:'CA',postcode:'90001',countryCode:'US'})){const input=win.document.getElementById(id);input.value=value;input.dispatchEvent(new win.Event('input'))}assert.equal(win.document.getElementById('primary').disabled,true);const box=win.document.getElementById('disclosure');box.checked=true;box.dispatchEvent(new win.Event('change'));assert.equal(win.document.getElementById('primary').disabled,false);const authoritative=fs.readFileSync('lib/v1/gift/orders.ts','utf8').match(/text: "(.*)",/)[1].replace(/\\n/g,'\n');assert.equal([...win.document.querySelectorAll('#gift-disclosure p')].map((p:any)=>p.textContent).join('\n\n'),authoritative);await new Promise(r=>setTimeout(r,25));dom.window.close()});

test('actual Stripe return parameter is verified by server before restoring its project',async()=>{const s:any=project();s.confirmation={confirmed:true,session:project()};const {win,calls,dom}=await boot('gift_order_session=cs_test',s);assert.ok(calls.includes('/api/v1/gift/orders/confirm'));assert.ok(calls.includes('/api/v1/gift/sessions/project'));assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close()});
test('unconfirmed Stripe return stays pending and can retry without granting access',async()=>{const s:any=project();s.confirmation={confirmed:false};const {win,calls,dom}=await boot('gift_order_session=cs_test',s);assert.equal(calls.includes('/api/v1/gift/sessions/project'),false);assert.ok(win.document.getElementById('screen').textContent.includes('Checking your payment'));win.navigate('effects');assert.equal(win.document.getElementById('screen').dataset.view,'payment');dom.window.close()});

test('stable direct URL is live and never loads fixture artwork',async()=>{
 const {win,calls,dom}=await boot('');
 assert.ok(calls.includes('/api/v1/gift/sessions'));assert.ok(calls.includes('/api/v1/print/catalog'));
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
 s.mockup={contractVersion:1,sessionId:'project',lineId:'line',productId:'framed:12x18',sourceArtworkId:'favorite',compositionId:'comp',attempt:1,compositionStatus:'ready',sku:s.geometries[0].sku,renderer:'scene',scene:{sceneId:'classic-framed'},watermarked:true,productionPrintFile:false,purchaseAuthorization:false,geometrySource:'frozen',url:'https://liten.invalid/signed-product.png',urlExpiresAt:'2099-01-01',width:1264,height:848};return s;
}
test('restored favorite in first batch reaches its existing mockup with no writes',async()=>{
 const {win,calls,dom}=await boot('sessionId=project',artworkProject());
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'compositions');win.navigate('effects');assert.equal(win.document.querySelector('[data-effect="jade"]').disabled,true);
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
 s.compositions.push({...s.compositions[0],lineId:'square',productId:'canvas:8x8',scene:{sceneId:'gallery-canvas-square'},compositionId:'square-comp',sku:o.sku});
 s.mockups={line:s.mockup,square:{...s.mockup,lineId:'square',productId:'canvas:8x8',scene:{sceneId:'gallery-canvas-square'},compositionId:'square-comp',sku:o.sku,url:'https://liten.invalid/square-product.png'}};
 const {win,calls,dom}=await boot('sessionId=project',s);win.navigate('compositions');
 win.document.getElementById('next-product').click();assert.equal(win.document.querySelector('#screen img').src,s.mockups.square.url);assert.ok(win.document.getElementById('screen').textContent.includes('Gift 2 of 2'));
 win.document.getElementById('previous-product').click();assert.equal(win.document.querySelector('#screen img').src,s.mockup.url);
 win.document.getElementById('next-product').click();win.document.getElementById('order-example').click();assert.equal(win.document.getElementById('primary').disabled,true);assert.equal(calls.some(x=>x.endsWith('/approve')),false);dom.window.close();
});
test('expired or stale mockups cannot unlock individual approval',async()=>{
 for(const change of [{urlExpiresAt:'2000-01-01'},{compositionId:'old-comp'}]){const s=artworkProject();Object.assign(s.mockup,change);const {win,dom}=await boot('sessionId=project',s);win.navigate('compositions');assert.equal(win.document.getElementById('primary').disabled,true);assert.equal(win.document.querySelector('#screen img'),null);dom.window.close()}
});

test('preview-first fixture journey keeps favorite separate from product photography',async()=>{
 const {win,dom,calls}=await boot('layoutReview=effects&mobile=1');
 assert.equal(win.document.querySelectorAll('.progress li').length,6);
 assert.equal(win.document.querySelector('.progress [aria-current]').textContent,'Choose Effects');
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'review');
 win.document.querySelector('[data-art]').click();win.document.getElementById('primary').click();
 assert.equal(win.document.getElementById('screen').dataset.view,'products');
 assert.equal(win.document.querySelectorAll('[data-feature]').length,8);assert.equal(win.document.querySelectorAll('[data-feature]').length,8);
 const reference=win.document.querySelector('#shopping-favorite img').src;assert.ok(reference.includes('preview-1.jpg'));
 win.document.querySelector('[data-feature="fine_art"]').click();assert.ok(win.document.querySelector('.studio-media img').src.includes('mockup-scenes/fine-art-square/'));assert.equal(win.document.querySelector('#shopping-favorite img').src,reference);win.document.querySelector('[data-size]').click();
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'cart');
 assert.ok(win.document.querySelector('.cart-thumbnail img').src.includes('/mockup-scenes/'));
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'checkout');
 assert.ok(win.document.getElementById('gift-disclosure').textContent.includes('first twelve personalized artwork previews are free'));
 assert.equal(calls.some(x=>x.includes('/api/v1/gift/')),false);dom.window.close();
});
test('legacy allocation responses fail closed',async()=>{
 const s:any=project('none');delete s.entitlement.freeAvailable;
 const {win,dom,calls}=await boot('sessionId=project',s);assert.equal(win.document.getElementById('error').textContent,'invalid_entitlement_response');assert.equal(calls.some(x=>x.endsWith('/batches')),false);dom.window.close();
});

test('unpaid free batches use the server allocation and retain batch idempotency',async()=>{
 const s:any=project('checkout_open');s.order.orderId=null;s.lines=[];s.geometries=[];const bodies:any[]=[];
 s.route=(url:string,init:any)=>{if(url.endsWith('/batches')){bodies.push(JSON.parse(init.body));s.entitlement.freeBatchesUsed++;s.entitlement.freeAvailable=s.entitlement.freeBatchesUsed<2;s.entitlement.freeBlockedReason=s.entitlement.freeAvailable?null:'session_limit';s.nextBatch=s.entitlement.freeAvailable?{kind:'free'}:{kind:'payment_required',amountCents:299,currency:'USD'};s.batches=artworkProject().batches.slice(0,s.entitlement.freeBatchesUsed);return {status:'ok',batch:s.batches.at(-1),session:s}}};
 const {win,dom}=await boot('sessionId=project',s);win.navigate('effects');assert.equal(win.document.getElementById('primary').disabled,false);win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.equal(win.document.querySelectorAll('[data-art]').length,6);win.document.getElementById('another-batch').click();assert.equal(win.document.getElementById('screen').dataset.view,'effects');assert.equal(bodies.length,1);win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.equal(bodies.length,2);assert.notEqual(bodies[0].idempotencyKey,bodies[1].idempotencyKey);assert.equal(win.document.getElementById('another-batch').textContent,'Six More · $2.99');assert.equal(s.order.orderId,null);dom.window.close();
});

test('favorite persists before shopping without requesting a composition',async()=>{
 const s=artworkProject();s.order.state='none';s.order.orderId=null;s.artworkPreviewId=null;s.compositions=[];s.mockup=null;let saved='';
 s.route=(url:string,init:any)=>{if(url.endsWith('/artwork')){saved=JSON.parse(init.body).previewId;s.artworkPreviewId=saved;return s}};
 const {win,dom,calls}=await boot('sessionId=project',s);assert.equal(win.document.getElementById('primary').disabled,true);win.document.querySelector('[data-art]').click();await new Promise(r=>setTimeout(r,20));assert.equal(win.document.getElementById('screen').dataset.view,'focus');win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.ok(saved);assert.equal(win.document.getElementById('screen').dataset.view,'products');assert.equal(calls.some(x=>x.endsWith('/compositions')),false);dom.window.close();
});

test('checkout adapter sends current disclosure and delivery to test checkout only',async()=>{
 const requests:any[]=[];const api=new backend.GiftBackend(async(url,init)=>{requests.push({url,body:JSON.parse(String(init.body))});return Response.json({clientSecret:'secret',stripeSessionId:'cs_test_1',publishableKey:'pk_test_1',totals:{itemsCents:100,shippingCents:20,totalCents:120},disclosure:{version:'2026-10-18-3',text:'authoritative'}})});
 const body:any={email:'test@example.com',shippingAddress:{name:'Test',line1:'1 Street',city:'City',postcode:'12345',countryCode:'US'},disclosureAccepted:true,disclosureVersion:'2026-10-18-3',returnPath:'/gift-wizard.next.html'};
 await api.checkout('project',body);assert.deepEqual(requests[0].body,body);await assert.rejects(api.checkout('project',{...body,disclosureAccepted:false}),/disclosure_required/);assert.equal(requests.length,1);await assert.rejects(api.checkout('project',{...body,disclosureVersion:''}),/disclosure_required/);
});

test('server allocation caps, refunds and manufacturing states prevent free generation',()=>{
 for(const state of ['none','checkout_open','awaiting_artwork']){const s:any=project(state);assert.equal(live.canCraft(s),true);s.entitlement.freeAvailable=false;assert.equal(live.canCraft(s),false)}
 for(const state of ['needs_attention','approved','with_lab','refund_requested','refunded','cancelled'])assert.equal(live.canCraft(project(state) as any),false);
});

async function fillCheckout(win:any){await new Promise(r=>setTimeout(r,25));for(const [id,value] of Object.entries({email:'test@example.com',name:'Test Person',line1:'1 Test Street',city:'Test',state:'CA',postcode:'90001',countryCode:'US'})){const el=win.document.getElementById(id);el.value=value;el.dispatchEvent(new win.Event('input'))}const box=win.document.getElementById('disclosure');box.checked=true;box.dispatchEvent(new win.Event('change'))}

// The approved disclosure, written out independently of the page: the page must show exactly this and send this version.
const approvedDisclosure={version:'2026-10-18-3',text:["Your first twelve personalized artwork previews are free, provided in two sets of six. Additional sets of six are available for $2.99.", "Once you've chosen your favorite artwork, you can select and purchase the gifts you'd like us to create.", "After payment, we'll prepare your artwork for each product. You'll review a clean preview of how it looks on each gift and approve each one before production begins.", "Nothing is printed or manufactured until you've approved your gifts and submitted your order.", "After purchasing physical gifts, you may request a full refund through Concierge until your order is submitted to our print partner. Once submitted, the order is no longer eligible for this refund.", "Additional artwork preview packs are separate purchases and are not included in physical-product refunds."].join('\n\n')}

test('embedded product checkout mounts only after acceptance and confirms even with a restored project',async()=>{
 const s=artworkProject();s.order.state='checkout_open';let posted:any,completed:any,confirms=0;
 s.route=(url:string,init:any)=>{if(url.endsWith('/checkout')){posted=JSON.parse(init.body);return {clientSecret:'secret',stripeSessionId:'cs_test_1',publishableKey:'pk_test_1',totals:{itemsCents:100,shippingCents:20,totalCents:120},disclosure:{version:'2026-10-18-3',text:fs.readFileSync('lib/v1/gift/orders.ts','utf8').match(/text: "(.*)",/)[1].replace(/\\n/g,'\n')}}}if(url.endsWith('/orders/confirm')){confirms++;s.order.state='awaiting_artwork';return {confirmed:true,session:s}}};
 const {win,dom,calls}=await boot('sessionId=project',s);win.Stripe=()=>({initEmbeddedCheckout:async(options:any)=>{completed=options.onComplete;return {mount(el:any){el.textContent='Stripe test checkout'},destroy(){}}}});
 win.navigate('checkout');await fillCheckout(win);win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.equal(posted.disclosureVersion,'2026-10-18-3');assert.equal(posted.disclosureAccepted,true);assert.ok(win.document.getElementById('screen').textContent.includes('Stripe test checkout'));assert.equal(confirms,0);await completed();assert.equal(confirms,1);assert.equal(win.document.getElementById('primary').textContent,'Review Your Gifts →');assert.equal(calls.some(x=>x.endsWith('/approve')),false);dom.window.close();
});

test('changed server disclosure must be displayed and accepted again before mounting Stripe',async()=>{
 const s=artworkProject();s.order.state='checkout_open';s.route=(url:string)=>url.endsWith('/checkout')?{clientSecret:'secret',stripeSessionId:'cs_test_1',publishableKey:'pk_test_1',totals:{itemsCents:100,shippingCents:20,totalCents:120},disclosure:{version:'new-version',text:'Exact replacement server text.'}}:null;
 const {win,dom}=await boot('sessionId=project',s);let mounted=false;win.Stripe=()=>{mounted=true};win.navigate('checkout');await fillCheckout(win);win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.equal(mounted,false);assert.equal(win.document.querySelector('#gift-disclosure p').textContent,'Exact replacement server text.');assert.equal(win.document.getElementById('disclosure').checked,false);assert.equal(win.document.getElementById('primary').disabled,true);dom.window.close();
});

 test('single-photo Gift picker excludes authoritative multi-photo Groups effects',()=>{const context:any={window:{}};vm.runInNewContext(fs.readFileSync('public/groups-registry.js','utf8'),context);const registry=context.window.EFFECT_REGISTRY;const offered=contracts.liveEffects(registry);assert.ok(registry.effects.some((e:any)=>e.intake==='multi_photo'));assert.ok(offered.length>12);assert.ok(offered.every((e:any)=>e.intake==='group_photo'));assert.ok(offered.some((e:any)=>e.id==='marionettes'));});

 test('version-only disclosure change resets acceptance and requires a new explicit handoff',async()=>{
 const s=artworkProject();s.order.state='checkout_open';const posted:any[]=[];const changed={version:'next-server-version',text:approvedDisclosure.text};
 s.route=(url:string,init:any)=>{if(!url.endsWith('/checkout'))return null;posted.push(JSON.parse(init.body));return {clientSecret:'secret',stripeSessionId:'cs_test_1',publishableKey:'pk_test_1',totals:{itemsCents:100,shippingCents:20,totalCents:120},disclosure:changed}};
 const {win,dom}=await boot('sessionId=project',s);let mounts=0;win.Stripe=()=>({initEmbeddedCheckout:async()=>({mount(){mounts++},destroy(){}})});win.navigate('checkout');await fillCheckout(win);win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));
 assert.equal(posted[0].disclosureVersion,approvedDisclosure.version);assert.equal(mounts,0);assert.equal(win.document.getElementById('disclosure').checked,false);assert.equal(win.document.getElementById('primary').disabled,true);
 assert.equal([...win.document.querySelectorAll('#gift-disclosure p')].map((p:any)=>p.textContent).join('\n\n'),changed.text);
 await fillCheckout(win);win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.equal(posted[1].disclosureVersion,changed.version);assert.equal(mounts,1);dom.window.close();
 });

 test('geometry mismatch is line-scoped recovery, never an included correction or generation',async()=>{
 const s=artworkProject(),o=local.products.find((p:any)=>p.id==='canvas').options.find((o:any)=>o.size==='8x8');
 s.lines.push({lineId:'square',productId:'canvas:8x8',size:'8x8',copies:1});s.geometries.push({lineId:'square',productId:'canvas:8x8',sku:o.sku,requiredPx:o.requiredPx});
 s.compositions.push({...s.compositions[0],lineId:'square',productId:'canvas:8x8',scene:{sceneId:'gallery-canvas-square'},compositionId:'square-comp',sku:o.sku,status:'approved'});
 s.mockups={line:s.mockup,square:{...s.mockup,lineId:'square',productId:'canvas:8x8',scene:{sceneId:'gallery-canvas-square'},compositionId:'square-comp',sku:o.sku,compositionStatus:'approved',url:'https://liten.invalid/square.png'}};
 let repaired=false;const writes:string[]=[];s.route=(url:string,init:any)=>{if(init.method!=='GET')writes.push(url);if(url.includes('/lines/line/mockup?')&&!repaired)return Response.json({error:'composition_geometry_mismatch'},{status:409});return null};
 const {win,dom}=await boot('sessionId=project&mobile=1',s);win.navigate('compositions');
 assert.ok(win.document.querySelector('[data-composition-state="repair-required"]'));assert.equal(win.document.querySelector('[data-composition-state] h3').textContent,"We're preparing your artwork for this gift");assert.deepEqual([...win.document.querySelectorAll('[data-composition-state] p')].map((p:any)=>p.textContent),["Your artwork needs a small adjustment to fit this product correctly. We're taking care of it.","Your selected artwork and purchase are safe. No action is needed right now."]);assert.equal(win.document.getElementById('check-composition-line').textContent,'Check Again');assert.equal(win.document.body.textContent.includes('composition_geometry_mismatch'),false);assert.equal(win.document.getElementById('primary').disabled,true);assert.equal(win.document.querySelector('#right button').disabled,true);
 win.document.getElementById('next-product').click();assert.equal(win.document.querySelector('#screen img').src,s.mockups.square.url);assert.ok(win.document.querySelector('.mobile-approval-actions').textContent.includes('approved'));
 win.document.getElementById('previous-product').click();win.document.getElementById('check-composition-line').click();await new Promise(r=>setTimeout(r,25));assert.ok(win.document.querySelector('[data-composition-state="repair-required"]'));assert.deepEqual(writes,[]);assert.equal(s.compositions[0].correctionsRemaining,1);
 // If technical repair temporarily removes the invalid composition, refresh still must not call compose.
 s.compositions[0].compositionId=null;win.document.getElementById('check-composition-line').click();await new Promise(r=>setTimeout(r,25));assert.ok(win.document.querySelector('[data-composition-state="repair-required"]'));assert.deepEqual(writes,[]);
 repaired=true;s.compositions[0].compositionId='repaired-comp';s.mockups.line={...s.mockup,compositionId:'repaired-comp'};win.document.getElementById('check-composition-line').click();await new Promise(r=>setTimeout(r,25));assert.equal(win.document.querySelector('[data-composition-state="repair-required"]'),null);assert.equal(win.document.getElementById('primary').disabled,false);assert.deepEqual(writes,[]);assert.equal(s.compositions[1].status,'approved');dom.window.close();
 });



test('compact shopping favorite returns to gallery and configuration retains back navigation',async()=>{const {win,dom}=await boot('layoutReview=products');assert.equal(win.document.querySelectorAll('#right .context-image').length,0);assert.ok(win.document.querySelector('.gift-favorite-thumb'));win.document.querySelector('[data-feature="fine_art"]').click();assert.ok(win.document.querySelector('#left #studio-back'));win.document.getElementById('studio-back').click();assert.equal(win.document.getElementById('screen').dataset.view,'products');win.document.getElementById('shopping-favorite').click();assert.equal(win.document.getElementById('screen').dataset.view,'review');dom.window.close()});




test('returning through the bare Wizard URL restores only server-owned artwork and navigation hints',async()=>{
 const s:any=artworkProject();s.order.state='none';s.resume={sessionId:'project',view:'focus',effectIds:['jade','invented'],artFocus:s.batches[0].previews[0].previewId,recipient:contracts.recipientOptions[0]};
 const {win,dom,calls}=await boot('',s);
 assert.ok(calls.includes('/api/v1/gift/sessions/project'));
 assert.equal(win.document.getElementById('screen').dataset.view,'focus');
 assert.equal(new URL(win.location.href).searchParams.get('sessionId'),'project');
 const hint=JSON.parse(win.sessionStorage.getItem('liten-gift-resume'));
 assert.equal(hint.effectIds.includes('invented'),false);
 assert.equal('batches' in hint,false);assert.equal('entitlement' in hint,false);assert.equal('source' in hint,false);
 assert.equal(calls.some(x=>x.endsWith('/batches')),false);dom.window.close();
});
test('remembered paid-looking view cannot bypass authentication',async()=>{
 const {win,dom}=await boot('',{error:'sign_in_required',resume:{sessionId:'project',view:'compositions'}},401);
 assert.ok(win.document.getElementById('screen').textContent.includes('Sign in'));
 assert.equal(win.document.querySelector('#screen img'),null);dom.window.close();
});
test('explicit different session ignores another project navigation hints',async()=>{
 const s:any=project('none');s.resume={sessionId:'other-project',view:'checkout',effectIds:['jade']};
 const {win,dom}=await boot('sessionId=project',s);
 assert.equal(win.document.getElementById('screen').dataset.view,'effects');dom.window.close();
});

function workingProject(){const s:any=project('none');s.lines=[];s.geometries=[];s.batches=[{batchIndex:1,kind:'free',complete:false,previews:Array.from({length:6},(_,i)=>({previewId:'slot-'+i,slot:i+1,effectId:'jade',status:i===0?'ready':i===1?'generating':i===2?'failed':'pending',url:i===0?'https://liten.invalid/ready.jpg':null,width:i===0?768:null,height:i===0?768:null,retryable:i===2}))}];return s;}
test('restoration shows gears only for server generating slots, ready artwork and stopped failures',async()=>{
 const {win,dom,calls}=await boot('sessionId=project',workingProject());
 assert.equal(win.document.getElementById('screen').dataset.view,'review');
 assert.equal(win.document.querySelectorAll('#screen .mc-mark').length,1);
 assert.equal(win.document.querySelectorAll('#screen img').length,1);
 assert.ok(win.document.getElementById('screen').textContent.includes('Didn’t finish'));
 assert.ok((win.document.getElementById('screen').textContent.match(/Waiting to start/g)||[]).length<=1);
 assert.equal(calls.some(x=>x.endsWith('/batches')),false);dom.window.close();
});
test('Craft moves immediately to results without claiming that the unconfirmed request is generating',async()=>{
 const s:any=project('awaiting_artwork');s.lines=[];s.geometries=[];let finish:any;
 s.route=(url:string,init:any)=>url.endsWith('/batches')&&init.method==='POST'?new Promise(resolve=>{finish=resolve}):null;
 const {win,dom}=await boot('sessionId=project',s);win.navigate('effects');win.document.getElementById('primary').click();
 assert.equal(win.document.getElementById('screen').dataset.view,'review');
 assert.equal(win.document.querySelectorAll('.mc-mark').length,0);
 assert.ok((win.document.getElementById('screen').textContent.match(/Waiting to start/g)||[]).length<=1);
 const done:any=workingProject();done.batches[0].complete=true;done.batches[0].previews.forEach((p:any)=>Object.assign(p,{status:'ready',url:'https://liten.invalid/done.jpg',width:768,height:768}));
 finish({status:'ok',session:done,batch:done.batches[0]});await new Promise(r=>setTimeout(r,20));
 assert.equal(win.document.querySelectorAll('#screen [data-art]').length,6);assert.equal(win.document.querySelectorAll('.mc-mark').length,0);dom.window.close();
});
test('read-only status refresh replaces a completed batch without generating or consuming a retry',async()=>{
 const s=workingProject();const {win,dom,calls}=await boot('sessionId=project',s);
 s.batches[0].complete=true;s.batches[0].previews.forEach((p:any)=>Object.assign(p,{status:'ready',url:'https://liten.invalid/done.jpg',width:768,height:768}));
 assert.equal(win.document.getElementById('check-generation'),null);await new Promise(r=>setTimeout(r,1800));
 assert.equal(win.document.querySelectorAll('#screen [data-art]').length,6);
 assert.equal(calls.some(x=>x.endsWith('/retry')||x.endsWith('/batches')),false);dom.window.close();
});

test('generation SVG and animation/background remain exact Collection ports',()=>{
 const donor=fs.readFileSync('public/discovery-consolidated-draft.html','utf8'),source=fs.readFileSync('public/gift-wizard/wizard.next.ts','utf8'),css=fs.readFileSync('public/gift-wizard/generation.next.css','utf8');
 assert.ok(source.includes(donor.split(/\r?\n/).find(x=>x.startsWith('var MC_MARK_HTML ='))!));
 const block=donor.slice(donor.indexOf('.card.is-crafting .card__art{'),donor.indexOf('/* The old ring is kept'));
 assert.ok(css.replace(/\r/g,'').includes(block.replace(/\r/g,'')));
});

function latest(s:any,step='previews'){return {contractVersion:1,current:s,resume:s?{sessionId:s.sessionId,suggestedStep:step,resumeBatches:s.batches.filter((b:any)=>b.generation==='stalled').map((b:any)=>b.batchIndex),runningBatches:s.batches.filter((b:any)=>b.generation==='running').map((b:any)=>b.batchIndex)}:null,recent:[]}}
test('server latest session overrides stale local identity and restores signed source without IndexedDB',async()=>{
 const s:any=project('none');s.source.photoUrl='https://liten.invalid/signed-source.jpg';s.resume={sessionId:'old-project',view:'checkout'};s.latestResponse=latest({...s},'effects');s.route=(url:string)=>url.endsWith('/old-project')?new Response(JSON.stringify({error:'session_not_found'}),{status:404}):null;
 const {win,calls,dom}=await boot('',s);assert.ok(calls.includes('/api/v1/gift/sessions'));assert.ok(calls.includes('/api/v1/gift/sessions/project'));assert.equal(calls.some(x=>x.endsWith('/old-project')),true);assert.equal(win.document.getElementById('screen').dataset.view,'effects');win.navigate('photo');assert.ok([...win.document.images].some((i:any)=>i.src===s.source.photoUrl));dom.window.close();
});
test('no active server session ignores remembered project and returns to Photo',async()=>{
 const s:any=project('none');s.resume={sessionId:'project',view:'focus'};s.latestResponse=latest(null);s.route=(url:string)=>url.endsWith('/sessions/project')?new Response(JSON.stringify({error:'session_not_found'}),{status:404}):null;
 const {win,dom,calls}=await boot('',s);assert.equal(win.document.getElementById('screen').dataset.view,'photo');assert.equal(calls.includes('/api/v1/gift/sessions/project'),true);dom.window.close();
});
test('latest restoration validates response identity before using any artwork',async()=>{
 const s:any=project();s.latestResponse=latest({...s});s.latestResponse.resume.sessionId='wrong';
 const {win,dom}=await boot('',s);assert.equal(win.document.getElementById('error').textContent,'invalid_restore_response');assert.equal(win.document.querySelector('#screen img'),null);dom.window.close();
});
test('stalled restoration resumes unfinished batch once, never reserves a batch, and automatic polling only reads',async()=>{
 const s:any=workingProject();s.batches[0].generation='stalled';let retries=0;s.route=(url:string)=>{if(url.endsWith('/retry')){retries++;return {session:s,batch:s.batches[0],status:'partial'}}};
 const {win,calls,dom}=await boot('sessionId=project',s);await new Promise(r=>setTimeout(r,20));assert.equal(retries,1);assert.equal(win.document.querySelectorAll('.mc-mark').length,0);assert.equal(win.document.querySelectorAll('#screen img').length,1);
 assert.equal(win.document.getElementById('check-generation'),null);await new Promise(r=>setTimeout(r,1800));assert.equal(retries,1);assert.equal(calls.some(x=>x.endsWith('/batches')),false);dom.window.close();
});
test('running and exhausted batches never auto-retry; exhausted stale generating slots stop spinning',async()=>{
 for(const generation of ['running','failed']){const s:any=workingProject();s.batches[0].generation=generation;const {win,dom,calls}=await boot('sessionId=project',s);assert.equal(win.document.querySelectorAll('.mc-mark').length,generation==='running'?1:0);assert.equal(calls.some(x=>x.endsWith('/retry')),false);dom.window.close()}
});
test('Back cache reauthenticates and replaces expired source URL while preserving effect selection',async()=>{
 const s:any=project('none');s.source.photoUrl='https://liten.invalid/first-source.jpg';const {win,dom,calls}=await boot('sessionId=project',s);win.document.querySelector('[data-effect="jade"]').click();win.dispatchEvent(new win.PageTransitionEvent('pagehide'));s.source.photoUrl='https://liten.invalid/refreshed-source.jpg';win.dispatchEvent(new win.PageTransitionEvent('pageshow',{persisted:true}));await new Promise(r=>setTimeout(r,30));assert.equal(calls.filter(x=>x==='/api/v1/gift/sessions/project').length,2);assert.equal(win.document.querySelector('[data-effect="jade"]').getAttribute('aria-pressed'),'true');win.navigate('photo');assert.ok([...win.document.images].some((i:any)=>i.src===s.source.photoUrl));dom.window.close();
});
test('Back cache authentication failure conceals restored artwork',async()=>{
 const s:any=artworkProject();const {win,dom}=await boot('sessionId=project',s);win.navigate('review');s.route=()=>new Response(JSON.stringify({error:'sign_in_required'}),{status:401});win.dispatchEvent(new win.PageTransitionEvent('pageshow',{persisted:true}));await new Promise(r=>setTimeout(r,30));assert.equal(win.document.querySelector('#screen img'),null);assert.ok(win.document.getElementById('screen').textContent.includes('Sign in'));dom.window.close();
});

test('failed stalled recovery exposes explicit retry without looping or changing finished artwork',async()=>{
 const s:any=workingProject();s.batches[0].generation='stalled';let attempts=0;s.route=(url:string)=>url.endsWith('/retry')?(attempts++,new Response(JSON.stringify({error:'temporarily_unavailable'}),{status:503})):null;
 const {win,dom}=await boot('sessionId=project',s);await new Promise(r=>setTimeout(r,20));assert.equal(attempts,1);assert.equal(win.document.querySelectorAll('#screen img').length,1);assert.ok(win.document.getElementById('retry-generation'));win.document.getElementById('retry-generation').click();await new Promise(r=>setTimeout(r,20));assert.equal(attempts,2);dom.window.close();
});

function shoppingProject(){const s:any=artworkProject();s.order.state='none';s.order.orderId=null;s.lines=[];s.geometries=[];s.compositions=[];s.mockup=null;return s}
function acceptLines(s:any,init:any){const request=JSON.parse(init.body);s.lines=request.lines.map((l:any)=>({...l,size:l.productId.slice(l.productId.lastIndexOf(':')+1)}));s.geometries=s.lines.map((l:any)=>{const o=catalog.products.find((p:any)=>p.productId===l.productId);return {lineId:l.lineId,productId:l.productId,sku:o.sku,requiredPx:o.requirements.finalPx}});return s}
test('completed preview can be selected and persisted while other slots generate without advancing to shopping',async()=>{
 const s:any=workingProject();s.route=(url:string,init:any)=>{if(url.endsWith('/artwork')){s.artworkPreviewId=JSON.parse(init.body).previewId;return s}};
 const {win,dom,calls}=await boot('sessionId=project',s);assert.ok(win.document.getElementById('screen').textContent.includes('Choose One Artwork'));assert.equal(win.document.getElementById('primary').disabled,true);win.document.querySelector('[data-art]').click();await new Promise(r=>setTimeout(r,20));assert.equal(win.document.getElementById('screen').dataset.view,'focus');assert.equal(win.document.querySelectorAll('#screen img').length,1);assert.equal(win.document.querySelectorAll('#right img').length,0);assert.equal(win.document.getElementById('primary').textContent,'Choose Your Gift →');assert.equal(win.document.getElementById('primary').disabled,false);win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'products');assert.equal(calls.some(x=>x.endsWith('/compositions')),false);dom.window.close();
});
test('Add to Cart persists before displaying success and survives authenticated refresh, edit and removal',async()=>{
 const s:any=shoppingProject();let writes=0;s.route=(url:string,init:any)=>{if(url.endsWith('/lines')&&init.method==='PUT'){writes++;return acceptLines(s,init)}};
 const {win,dom}=await boot('sessionId=project',s);win.navigate('products');win.document.querySelector('[data-feature="fine_art"]').click();win.document.querySelector('[data-size]').click();await new Promise(r=>setTimeout(r,20));win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.equal(writes,1);assert.equal(s.lines.length,1);assert.equal(win.document.getElementById('screen').dataset.view,'cart');assert.equal(win.document.querySelectorAll('.cart-line').length,1);assert.equal(win.document.getElementById('primary').disabled,false);
 win.dispatchEvent(new win.PageTransitionEvent('pagehide'));win.dispatchEvent(new win.PageTransitionEvent('pageshow',{persisted:true}));await new Promise(r=>setTimeout(r,30));assert.equal(win.document.querySelectorAll('.cart-line').length,1);win.document.querySelector('[data-delta="1"]').click();await new Promise(r=>setTimeout(r,20));assert.equal(s.lines[0].copies,2);win.confirm=()=>true;win.document.querySelector('[data-remove]').click();await new Promise(r=>setTimeout(r,20));assert.equal(s.lines.length,0);assert.equal(win.document.getElementById('primary').disabled,true);assert.ok(win.document.getElementById('add-another'));assert.equal(writes,3);dom.window.close();
});
test('rejected cart write stays on configuration and never invents a line',async()=>{
 const s:any=shoppingProject();s.route=(url:string)=>url.endsWith('/lines')?new Response(JSON.stringify({error:'product_not_available'}),{status:409}):null;
 const {win,dom}=await boot('sessionId=project',s);win.navigate('products');win.document.querySelector('[data-feature="fine_art"]').click();win.document.querySelector('[data-size]').click();await new Promise(r=>setTimeout(r,20));win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.equal(win.document.getElementById('screen').dataset.view,'products');assert.equal(win.document.getElementById('error').textContent,'product_not_available');win.navigate('cart');assert.equal(win.document.querySelectorAll('.cart-line').length,0);dom.window.close();
});
test('a pre-write generation read cannot erase a subsequently confirmed cart',async()=>{
 const s:any=shoppingProject();s.batches[1].complete=false;s.batches[1].generation='running';s.batches[1].previews[5].status='generating';let release:any,hold=false;
 s.route=(url:string,init:any)=>{if(url.endsWith('/lines'))return acceptLines(s,init);if(hold&&url.endsWith('/project')&&init.method==='GET'){hold=false;const old=JSON.parse(JSON.stringify(s));return new Promise(r=>{release=()=>r(old)})}};
 const {win,dom}=await boot('sessionId=project',s);hold=true;const pending=win.refreshGift();win.navigate('products');win.document.querySelector('[data-feature="fine_art"]').click();win.document.querySelector('[data-size]').click();await new Promise(r=>setTimeout(r,20));win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));release();await pending;assert.equal(win.document.querySelectorAll('.cart-line').length,1);assert.equal(s.lines.length,1);dom.window.close();
});
test('second-six action preserves favorite and makes no reservation until Craft is pressed',async()=>{
 const s:any=shoppingProject();s.batches=s.batches.slice(0,1);s.nextBatch={kind:'free'};s.entitlement.freeAvailable=true;s.entitlement.freeBatchesUsed=1;
 const {win,dom,calls}=await boot('sessionId=project',s);assert.equal(win.document.getElementById('another-batch').textContent,'Create My Second Six Previews');win.document.getElementById('another-batch').click();assert.equal(win.document.getElementById('screen').dataset.view,'effects');assert.equal(s.artworkPreviewId,'favorite');assert.equal(calls.some(x=>x.endsWith('/batches')||x.endsWith('/artwork')),false);dom.window.close();
});


test('new gift opens intake without restoring or mutating the existing project',async()=>{
 const s:any=project();s.resume={sessionId:'project',view:'compositions',effectIds:[]};
 const {win,calls,dom}=await boot('newGift=1&resumeSessionId=project',s);
 assert.equal(win.document.getElementById('screen').dataset.view,'photo');
 assert.equal(win.document.getElementById('resume-gift').getAttribute('data-href'),'/gift-wizard.next.html?sessionId=project');
 assert.equal(calls.some(x=>x.includes('/api/v1/gift/')),false);
 assert.equal(JSON.parse(win.sessionStorage.getItem('liten-gift-resume')).sessionId,'project');dom.window.close();
});
test('existing project has a separate new-gift entry and explicit session still restores',async()=>{
 const {win,calls,dom}=await boot('newGift=1&sessionId=project');
 assert.ok(calls.includes('/api/v1/gift/sessions/project'));
 assert.equal(win.document.getElementById('new-gift').getAttribute('data-href'),'/gift-wizard.next.html?newGift=1&resumeSessionId=project');dom.window.close();
});


test('personalized preview waits for favorite, product and size selection',async()=>{
 const s:any=artworkProject();s.order={...s.order,state:'none',orderId:null};s.lines=[];
 const {win,dom,calls}=await boot('sessionId=project',s);
 try {
  for(const view of ['effects','review','focus','compare']){win.navigate(view);await new Promise(r=>setTimeout(r,20));assert.equal(calls.some(x=>x.includes('/product-preview')),false);assert.equal(win.document.querySelector('.studio-media'),null)}
  win.navigate('products');assert.equal(calls.some(x=>x.includes('/product-preview')),false);
  win.document.querySelector('[data-feature="fine_art"]').click();assert.equal(calls.some(x=>x.includes('/product-preview')),false);
  win.document.querySelector('[data-size]').click();await new Promise(r=>setTimeout(r,25));assert.equal(calls.filter(x=>x.includes('/product-preview')).length,1);
 } finally {dom.window.close()}
});
test('configuration consumes only the matching watermarked server product preview',async()=>{
 const s:any=artworkProject();s.order={...s.order,state:'none',orderId:null};
 let previewCalls=0;s.route=async(url:string)=>{if(!url.includes('/product-preview?'))return;previewCalls++;const productId=new URL(url,'https://test.invalid').searchParams.get('productId');const option=catalog.products.find((p:any)=>p.productId===productId)!;return {contractVersion:1,status:'ready',sessionId:s.sessionId,productId,sku:option.sku,favoriteId:s.artworkPreviewId,renderer:'scene',sceneId:({fine_art:'fine-art-square',framed:'classic-framed',canvas:'gallery-canvas-square'} as any)[productId.split(':')[0]],fit:'exact',url:'https://test.invalid/personalized.jpg',urlExpiresAt:'2099-01-01',width:1254,height:1254,cached:false,watermarked:true,productionPrintFile:false,purchaseAuthorization:false}};
 const {win,dom}=await boot('sessionId=project',s);win.navigate('configuration');await new Promise(r=>setTimeout(r,25));
 assert.equal(win.document.querySelector('.studio-media img')?.src,'https://test.invalid/personalized.jpg');assert.equal(previewCalls,1);dom.window.close();
});
test('adaptation and failed preview never substitute catalog photography',async()=>{
 for(const invalid of [false,true]){const s:any=artworkProject();s.order={...s.order,state:'none',orderId:null};s.route=async(url:string)=>{if(!url.includes('/product-preview?'))return;const productId=new URL(url,'https://test.invalid').searchParams.get('productId');const option=catalog.products.find((p:any)=>p.productId===productId)!;return {contractVersion:1,status:'adaptation_required',sessionId:s.sessionId,productId,sku:option.sku,favoriteId:invalid?'stale':s.artworkPreviewId,reason:'shape_needs_composition',favoriteAspect:1,pictureAspect:1.5,extension:0.5,method:'generated'}};
 const {win,dom}=await boot('sessionId=project',s);win.navigate('configuration');await new Promise(r=>setTimeout(r,25));assert.equal(win.document.querySelector('.studio-media img'),null);assert.ok(win.document.getElementById('screen').textContent.includes(invalid?'This product preview could not load.':'Product-specific artwork will be prepared after payment.'));if(!invalid){win.navigate('cart');await new Promise(r=>setTimeout(r,25));assert.ok(win.document.querySelector('.cart-thumbnail img[alt="Selected artwork"]'));win.navigate('checkout');await new Promise(r=>setTimeout(r,25));assert.ok(win.document.querySelector('[data-order-summary] img[alt="Selected artwork"]'));}dom.window.close();}
});


test('configuration restoration retains the selected product, size and quantity',async()=>{
 const s:any=artworkProject();s.order={...s.order,state:'none',orderId:null};s.resume={sessionId:'project',view:'configuration',activeProduct:'fine_art',size:'12x18',copies:2,history:['products']};
 const {win,dom}=await boot('sessionId=project',s);assert.equal(win.document.getElementById('screen').dataset.view,'products');assert.match(win.document.querySelector('.studio-panel').textContent,/12.*18/);assert.equal(win.document.getElementById('copies').value,'2');await new Promise(r=>setTimeout(r,25));dom.window.close();
});

test('Add to Cart is saved on the server and the gift survives every session refresh (the cart no longer vanishes)',async()=>{
 const s:any=artworkProject();s.order.state='none';s.order.orderId=null;s.compositions=[];s.mockup=null;s.lines=[];s.geometries=[];const geometry=project().geometries[0];const puts:any[]=[];
 s.route=(url:string,init:any)=>{if(url.endsWith('/lines')&&init.method==='PUT'){const b=JSON.parse(init.body);puts.push(b);s.lines=b.lines.map((l:any)=>({lineId:l.lineId,productId:l.productId,size:l.productId.split(':')[1],copies:l.copies}));s.geometries=s.lines.map((l:any)=>{const [fam,size]=l.productId.split(':'),o=local.products.find((p:any)=>p.id===fam).options.find((x:any)=>x.size===size);return {...geometry,lineId:l.lineId,productId:l.productId,sku:o.sku,requiredPx:o.requiredPx}});return s}};
 const {win,dom}=await boot('sessionId=project',s);const doc=win.document,tick=()=>new Promise(r=>setTimeout(r,30));
 win.navigate('configuration');await tick();
 const add=doc.getElementById('primary') as any;assert.match(add.textContent,/^Add to Cart/);
 add.click();await tick();
 assert.equal(puts.length,1);assert.equal(puts[0].lines.length,1);assert.match(puts[0].lines[0].productId,/^[a-z_]+:\d+x\d+$/);          // saved through the existing PUT /lines BEFORE it is shown
 assert.equal(doc.getElementById('screen').dataset.view,'cart');assert.equal(doc.querySelectorAll('.cart-line').length,1);
 // a refresh of the session from the server (what the generation poll, a restore or pageshow do) keeps the gift: the server now has it
 await win.retryRestoration?.();await tick();await tick();
 assert.equal(doc.querySelectorAll('.cart-line').length,1);assert.equal((doc.getElementById('primary') as any).disabled,false);
 dom.window.close();
});

test('a rejected Add to Cart leaves the cart as it was and shows the reason (no ghost item)',async()=>{
 const s:any=artworkProject();s.order.state='none';s.order.orderId=null;s.compositions=[];s.mockup=null;s.lines=[];s.geometries=[];
 s.route=(url:string,init:any)=>url.endsWith('/lines')&&init.method==='PUT'?new Response(JSON.stringify({error:'product_not_available'}),{status:409}):null;
 const {win,dom}=await boot('sessionId=project',s);const doc=win.document,tick=()=>new Promise(r=>setTimeout(r,30));
 win.navigate('configuration');await tick();
 (doc.getElementById('primary') as any).click();await tick();
 assert.notEqual(doc.getElementById('screen').dataset.view,'cart');assert.equal(doc.querySelectorAll('.cart-line').length,0);assert.match(doc.getElementById('error').textContent,/product_not_available/);
 dom.window.close();
});


test('generation reads progress while the batch POST remains in flight',async()=>{
 const s:any=project('awaiting_artwork');s.lines=[];s.geometries=[];s.batches=[];s.artworkPreviewId=null;let resolvePost:any,reads=0;
 s.route=async(url:string,init:any)=>{if(url.endsWith('/batches')&&init.method==='POST'){s.batches=workingProject().batches;s.batches[0].generation='running';return await new Promise(r=>resolvePost=r)}if(url.endsWith('/sessions/project')&&init.method==='GET')reads++;return null};
 const {win,dom}=await boot('sessionId=project',s);win.navigate('effects');win.document.getElementById('primary').click();const before=reads;await new Promise(r=>setTimeout(r,1750));assert.ok(reads>before);assert.equal(win.document.querySelectorAll('.is-crafting').length,1);assert.ok(win.document.querySelector('[data-art="slot-0"]'));assert.equal(win.document.getElementById('primary').textContent,'Choose Your Gift →');resolvePost({session:s,batch:s.batches[0],status:'partial'});await new Promise(r=>setTimeout(r,10));dom.window.close();
});
test('mobile Studio review keeps price and primary action together in its panel',async()=>{
 const s:any=artworkProject();s.order.state='none';s.lines=[];s.geometries=[];const {win,dom}=await boot('sessionId=project&mobile=1',s);win.navigate('configuration');assert.ok(win.document.querySelector('.studio-panel #primary'));assert.match(win.document.querySelector('.studio-panel').textContent,/\$/);await new Promise(r=>setTimeout(r,25));dom.window.close();
});


test('Studio Back preserves artwork, cart and per-product choices',async()=>{
 const s:any=shoppingProject();const {win,dom}=await boot('sessionId=project',s);win.navigate('products');
 win.document.querySelector('[data-feature="fine_art"]').click();win.document.querySelector('[data-aspect="Portrait"]').click();win.document.querySelector('[data-size="12x18"]').click();
 win.document.getElementById('copies').value='2';win.document.getElementById('copies').dispatchEvent(new win.Event('input'));const favorite=s.artworkPreviewId,lines=JSON.stringify(s.lines);
 win.document.getElementById('studio-back').click();assert.equal(win.document.querySelector('[data-aspect="Portrait"]').getAttribute('aria-pressed'),'true');
 win.document.getElementById('studio-back').click();assert.equal(win.document.querySelectorAll('[data-feature]').length,8);
 win.document.querySelector('[data-feature="fine_art"]').click();win.document.querySelector('[data-size="12x18"]').click();assert.equal(win.document.getElementById('copies').value,'2');assert.equal(s.artworkPreviewId,favorite);assert.equal(JSON.stringify(s.lines),lines);
 await new Promise(r=>setTimeout(r,25));dom.window.close();
});


test('bare return restores the authenticated working gift instead of another latest gift',async()=>{
 const s:any=artworkProject();s.order.state='none';s.resume={sessionId:'project',view:'configuration',activeProduct:'fine_art',size:'12x18',copies:2};const {win,calls,dom}=await boot('',s);assert.ok(calls.includes('/api/v1/gift/sessions/project'));assert.equal(calls.includes('/api/v1/gift/sessions'),false);assert.equal(win.document.getElementById('screen').dataset.view,'products');assert.equal(win.document.getElementById('copies').value,'2');await new Promise(r=>setTimeout(r,25));dom.window.close();
});


test('generation title follows confirmed slots and has no manual status button',async()=>{
 const s=workingProject();s.batches[0].previews[0].status='pending';s.batches[0].previews[0].url=null;
 const {win,dom}=await boot('sessionId=project',s);assert.equal(win.document.querySelector('#screen h2').textContent,'Creating Your Previews');assert.equal(win.document.getElementById('check-generation'),null);
 s.batches[0].previews[0].status='ready';s.batches[0].previews[0].url='https://liten.invalid/ready.jpg';await win.refreshGift();assert.equal(win.document.querySelector('#screen h2').textContent,'Choose One Artwork');dom.window.close();
});
test('paid composition preparation shows selected art only during the actual request',async()=>{
 const s:any=artworkProject();s.compositions=[];let finish:any;s.route=(url:string,init:any)=>url.endsWith('/compositions')&&init.method==='POST'?new Promise(resolve=>{finish=resolve}):null;
 const {win,dom}=await boot('sessionId=project',s);win.navigate('focus');win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,10));assert.ok(win.document.getElementById('screen').textContent.includes('Preparing Your Masterpiece'));assert.equal(win.document.querySelector('#screen img').alt,'Selected artwork');assert.equal(win.document.getElementById('primary').disabled,true);
 finish(artworkProject());await new Promise(r=>setTimeout(r,30));assert.equal(win.document.getElementById('screen').textContent.includes('Preparing Your Masterpiece'),false);assert.equal(win.document.querySelector('#screen img').src,'https://liten.invalid/signed-product.png');dom.window.close();
});

function compositionProject(stateName:string){const s:any=artworkProject();Object.assign(s.compositions[0],{state:stateName,attempts:stateName==='not_started'?0:1,preparingSince:stateName==='preparing'?'2026-10-20T00:00:00Z':null,failureCode:stateName==='failed'?'composition_failed':null,retryable:stateName==='failed'});if(!['ready','approved'].includes(stateName))Object.assign(s.compositions[0],{status:'none',compositionId:null});return s}
for(const stateName of ['not_started','stalled'])test('paid '+stateName+' starts once, polling/navigation/reload never repeat the POST',async()=>{
 const s=compositionProject(stateName);let posts=0;s.route=(url:string,init:any)=>{if(url.endsWith('/compositions')&&init.method==='POST'){posts++;return s}return null};
 const a=await boot('sessionId=project',s);await new Promise(r=>setTimeout(r,30));assert.equal(posts,1);a.win.navigate('compositions');await a.win.refreshComposition();assert.equal(posts,1);assert.equal(a.win.document.getElementById('primary').disabled,true);
 s.storage=Object.fromEntries(Object.keys(a.win.sessionStorage).map(k=>[k,a.win.sessionStorage.getItem(k)]));a.dom.window.close();const b=await boot('sessionId=project',s);await new Promise(r=>setTimeout(r,20));assert.equal(posts,1);b.dom.window.close();
});
test('preparing restore and refresh only read; ready replaces the loading state',async()=>{
 const s=compositionProject('preparing');let posts=0;s.route=(u:string,i:any)=>{if(i.method==='POST')posts++;return null};const {win,dom}=await boot('sessionId=project',s);assert.ok(win.document.getElementById('screen').textContent.includes('Preparing Your Masterpiece'));assert.equal(win.document.getElementById('primary').disabled,true);await win.refreshComposition();assert.equal(posts,0);Object.assign(s.compositions[0],{state:'ready',status:'ready',compositionId:'comp',preparingSince:null});await win.refreshComposition();assert.equal(win.document.querySelector('#screen img').src,s.mockup.url);assert.equal(win.document.getElementById('primary').disabled,false);assert.equal(posts,0);dom.window.close();
});
test('retryable failure waits for explicit retry; exhausted failure opens existing Help',async()=>{
 const s=compositionProject('failed');let posts=0;s.route=(u:string,i:any)=>{if(u.endsWith('/compositions')&&i.method==='POST'){posts++;return compositionProject('preparing')}return null};const {win,dom}=await boot('sessionId=project',s);assert.equal(posts,0);assert.equal(win.document.getElementById('primary').disabled,true);win.document.getElementById('retry-preparation-line').click();await new Promise(r=>setTimeout(r,20));assert.equal(posts,1);dom.window.close();
 s.compositions[0].retryable=false;const b=await boot('sessionId=project',s);assert.equal(b.win.document.getElementById('retry-preparation-line').textContent,'Concierge');assert.equal(posts,1);b.dom.window.close();
});
test('latest-session composition resume enters final review with no generation for ready',async()=>{
 const s=compositionProject('ready');s.latestResponse={contractVersion:1,current:structuredClone(s),resume:{sessionId:'project',suggestedStep:'compositions',resumeBatches:[],runningBatches:[],compositions:{state:'ready',resumeNeeded:false,preparing:[],stalled:[],failed:[]}},recent:[]};const {win,calls,dom}=await boot('',s);assert.equal(win.document.getElementById('screen').dataset.view,'compositions');assert.equal(calls.some(u=>u.endsWith('/compositions')),false);dom.window.close();
});
test('provisional transport opts in and rejects missing watermark or false surround claims',async()=>{
 const v:any={contractVersion:1,status:'provisional',sessionId:'project',productId:'fine_art:12x18',favoriteId:'favorite',renderer:'scene',sceneId:'fine-art-square',fit:'contain',url:'https://liten.invalid/provisional.png',urlExpiresAt:'2099-01-01',width:1254,height:1254,watermarked:true,productionPrintFile:false,purchaseAuthorization:false,provisional:{exactArtworkShown:true,cropped:false,distorted:false,surround:'neutral',bars:{sides:'top_bottom',fractionPerSide:0.1},favoriteAspect:1,pictureAspect:0.6667,extension:0.3,finalComposition:'generated'}};let requested='';const api=new backend.GiftBackend(async u=>{requested=u;return new Response(JSON.stringify(v))});assert.equal((await api.productPreview('project','fine_art:12x18','favorite')).status,'provisional');assert.ok(requested.endsWith('&provisional=1'));v.watermarked=false;await assert.rejects(()=>api.productPreview('project','fine_art:12x18','favorite'),/invalid_product_preview/);v.watermarked=true;v.provisional.cropped=true;await assert.rejects(()=>api.productPreview('project','fine_art:12x18','favorite'),/invalid_product_preview/);
});
test('provisional configuration shows the returned image and explains neutral surround and later generation',async()=>{
 const s:any=artworkProject();s.order.state='none';s.route=(u:string)=>u.includes('/product-preview?')?{contractVersion:1,status:'provisional',sessionId:'project',productId:new URL('https://test'+u).searchParams.get('productId'),favoriteId:'favorite',sku:catalog.products.find((p:any)=>p.productId===new URL('https://test'+u).searchParams.get('productId'))!.sku,renderer:'scene',sceneId:'fine-art-square',fit:'contain',url:'https://liten.invalid/provisional.png',urlExpiresAt:'2099-01-01',width:1254,height:1254,watermarked:true,productionPrintFile:false,purchaseAuthorization:false,provisional:{exactArtworkShown:true,cropped:false,distorted:false,surround:'neutral',bars:{sides:'top_bottom',fractionPerSide:.1},finalComposition:'generated'}}:null;s.resume={sessionId:'project',view:'configuration',activeProduct:'fine_art',size:'12x18',copies:1};const {win,dom}=await boot('',s);await new Promise(r=>setTimeout(r,30));assert.ok(win.document.body.textContent.includes('neutral surround is not artwork'));assert.ok(win.document.body.textContent.includes('new composition of the same effect'));assert.ok(win.document.querySelector('img[src="https://liten.invalid/provisional.png"]'));dom.window.close();
});

test('all eight default product photographs are approved source masters, with catalog values unchanged',()=>{
 const map:Record<string,string>={fine_art:'fine-art-square',premium:'premium-fine-art',framed:'classic-framed',matted:'matted-frame-square',canvas:'gallery-canvas-square',framed_canvas:'framed-canvas',mug:'ceramic-mug',card:'greeting-card'};
 for(const p of local.products){const id=map[p.id],m=JSON.parse(fs.readFileSync('public/gift-wizard/mockup-scenes/'+id+'/scene.next.json','utf8'));assert.equal(p.image,'./mockup-scenes/'+id+'/'+m.sourceImage);assert.ok(fs.existsSync('public/gift-wizard/'+p.image));}
});
test('retired calibrated mockups and missing or unrelated scene identities never display or enable approval',async()=>{
 for(const variant of ['calibrated','missing','wrong-family']){const s:any=artworkProject();if(variant==='calibrated'){s.mockup.renderer='calibrated';s.mockup.scene=null}else if(variant==='missing'){delete s.mockup.renderer;delete s.mockup.scene}else s.mockup.scene={sceneId:'ceramic-mug'};s.mockup.url='https://liten.invalid/retired.png';const {win,dom}=await boot('sessionId=project',s);win.navigate('compositions');assert.equal(win.document.querySelector('img[src="https://liten.invalid/retired.png"]'),null);assert.ok(win.document.getElementById('screen').textContent.includes('Not currently available'));assert.equal(win.document.getElementById('primary').disabled,true);dom.window.close();}
});
test('retired product previews are rejected before an image is inserted',async()=>{
 const s:any=artworkProject();s.order.state='none';s.route=(u:string)=>{if(!u.includes('/product-preview?'))return null;const productId=new URL(u,'https://test').searchParams.get('productId');return {contractVersion:1,status:'ready',sessionId:s.sessionId,productId,sku:catalog.products.find((p:any)=>p.productId===productId)!.sku,favoriteId:s.artworkPreviewId,renderer:'calibrated',sceneId:null,fit:'exact',url:'https://liten.invalid/retired.png',urlExpiresAt:'2099-01-01',width:1264,height:848,watermarked:true,productionPrintFile:false,purchaseAuthorization:false}};const {win,dom}=await boot('sessionId=project',s);win.navigate('configuration');await new Promise(r=>setTimeout(r,25));assert.equal(win.document.querySelector('.studio-media img'),null);assert.ok(win.document.getElementById('screen').textContent.includes('Not currently available'));dom.window.close();
});
test('offline approval examples use replacement scenes rather than retired payment-first mockups',async()=>{
 for(const mode of ['approval','approval-second','approval-final']){const {win,dom}=await boot('layoutReview='+mode);const images=[...win.document.querySelectorAll('#screen img')] as HTMLImageElement[];assert.ok(images.length>0);assert.ok(images.every(i=>i.src.includes('-scene-')||i.src.includes('/mockup-scenes/')));assert.ok(images.every(i=>!i.src.includes('/review/payment-first/')));dom.window.close();}
});

test('new-gift mobile progress is gated by prerequisites and does not mutate the session',async()=>{
 const s:any=project('none');s.order.orderId=null;s.lines=[];s.geometries=[];
 const {win,dom}=await boot('sessionId=project&mobile=1',s);win.navigate('effects');
 const menu=win.document.getElementById('mobile-progress');assert.equal(menu.querySelectorAll('.mobile-progress-pips span').length,7);
 assert.equal(menu.querySelector('[data-step="3"]').disabled,true);assert.equal(menu.querySelector('[data-step="4"]').disabled,true);assert.equal(menu.querySelector('[data-step="5"]').disabled,true);
 menu.querySelector('[data-step="0"]').click();assert.equal(win.document.getElementById('screen').dataset.view,'photo');dom.window.close();
});
test('mobile paid review keeps status by photograph and locks purchased editing',async()=>{
 const s:any=project();s.artworkPreviewId='preview';s.compositions=[{lineId:'line',productId:'framed:12x18',sourceArtworkId:'preview',compositionId:'comp',attempt:1,status:'approved',sku:s.geometries[0].sku,correctionsRemaining:1}];
 const {win,dom}=await boot('sessionId=project&mobile=1',s);win.navigate('compositions');
 assert.ok(win.document.querySelector('#screen .mobile-approval-actions [role="status"]'));assert.equal(win.document.querySelector('#mobile-progress [data-step="3"]').disabled,true);
 assert.equal(win.document.getElementById('previous-product'),null);assert.equal(win.document.querySelectorAll('#order-example').length,1);assert.equal(win.document.getElementById('primary').disabled,true);assert.equal(win.document.getElementById('primary').hidden,true);
 win.document.getElementById('order-example').click();assert.equal(win.document.getElementById('primary').disabled,true);assert.equal(win.document.getElementById('primary').hidden,true);dom.window.close();
});
test('desktop retains original progress and review placement',async()=>{
 const {win,dom}=await boot('layoutReview=approval');assert.equal(win.document.getElementById('mobile-progress'),null);assert.ok(win.document.querySelector('#right #primary'));assert.equal(win.document.getElementById('left').hidden,false);dom.window.close();
});

test('unavailable or failed scenes cannot enter cart',async()=>{
 for(const status of ['not_available','adaptation_required','failure']){
  const s:any=shoppingProject();s.route=(url:string)=>url.includes('/product-preview?')?(status==='failure'?new Response('{}',{status:503}):{...fixtureProductPreview(s,url),status}):undefined;
  const {win,dom,calls}=await boot('sessionId=project',s);win.navigate('configuration');await new Promise(r=>setTimeout(r,25));
  assert.equal(win.document.getElementById('primary').disabled,true);win.document.getElementById('primary').click();
  assert.equal(calls.some(x=>x.endsWith('/lines')),false);dom.window.close();
 }
});
test('pending personalized scene blocks Add to Cart until the server returns it',async()=>{
 const s:any=shoppingProject();let resolve:any;s.route=(url:string)=>url.includes('/product-preview?')?new Promise(r=>{resolve=()=>r(fixtureProductPreview(s,url))}):undefined;
 const {win,dom}=await boot('sessionId=project',s);win.navigate('configuration');assert.equal(win.document.getElementById('primary').disabled,true);
 resolve();await new Promise(r=>setTimeout(r,25));assert.equal(win.document.getElementById('primary').disabled,false);dom.window.close();
});

test('restored unavailable cart cannot checkout but permits removal',async()=>{
 const s:any=artworkProject();s.order={...s.order,state:'none',orderId:null};
 s.route=(url:string,init:any)=>url.includes('/product-preview?')?{...fixtureProductPreview(s,url),status:'not_available'}:url.endsWith('/lines')?acceptLines(s,init):undefined;
 const {win,dom}=await boot('sessionId=project',s);win.navigate('cart');await new Promise(r=>setTimeout(r,25));assert.equal(win.document.getElementById('primary').disabled,true);
 win.navigate('checkout');await fillCheckout(win);assert.equal(win.document.getElementById('primary').disabled,true);
 win.navigate('cart');win.confirm=()=>true;win.document.querySelector('[data-remove]').click();await new Promise(r=>setTimeout(r,25));assert.equal(s.lines.length,0);dom.window.close();
});

test('Studio uses one persistent host and eight families on desktop and mobile',async()=>{
 for(const mobile of ['', '&mobile=1']){const {win,dom,calls}=await boot('layoutReview=products'+mobile);const host=win.document.querySelector('.product-studio'),panel=host.querySelector('.studio-panel');
 assert.equal(win.document.querySelectorAll('[data-feature]').length,8);
 for(const p of local.products){win.document.querySelector('[data-feature="'+p.id+'"]').click();assert.equal(win.document.querySelector('.product-studio'),host);assert.equal(win.document.querySelector('.studio-panel'),panel);assert.equal(panel.querySelector('h2').textContent,p.label);assert.equal(panel.querySelector('#primary'),null);if(p.available)assert.ok(panel.querySelector('[data-size]'));else assert.match(panel.textContent,/Not currently available/);win.document.querySelector('#left #studio-back').click();}
 assert.equal(calls.some(x=>x.includes('/api/v1/gift/')),false);dom.window.close();}
});
test('Studio review and quantity survive authenticated refresh',async()=>{
 const s:any=shoppingProject();const {win,dom}=await boot('sessionId=project&mobile=1',s);win.navigate('products');win.document.querySelector('[data-feature="fine_art"]').click();win.document.querySelector('[data-aspect="Portrait"]').click();win.document.querySelector('[data-size="12x18"]').click();win.document.getElementById('copies').value='2';win.document.getElementById('copies').dispatchEvent(new win.Event('input'));await new Promise(r=>setTimeout(r,25));
 const hint=win.sessionStorage.getItem('liten-gift-resume');dom.window.close();s.storage={'liten-gift-resume':hint};const restored=await boot('sessionId=project&mobile=1',s);assert.equal(restored.win.document.getElementById('copies').value,'2');assert.match(restored.win.document.querySelector('.studio-panel').textContent,/12.*18/);await new Promise(r=>setTimeout(r,25));restored.dom.window.close();
});

 test('Collection restoration enters the shared Studio and cannot restart artwork generation',async()=>{
 const s:any=shoppingProject();s.entrance='collection';s.collection={previewId:'owned',portfolioId:'portfolio'};
 const {win,dom}=await boot('sessionId=project',s);
 assert.equal(win.document.getElementById('screen').dataset.view,'products');
 for(const step of ['photo','effects','review']){win.navigate(step);assert.equal(win.document.getElementById('screen').dataset.view,'products')}
 dom.window.close();
 });
 test('final approval calls approval-only finalize and completed state survives restoration',async()=>{
 const s:any=artworkProject();s.compositions[0].status='approved';s.mockup.compositionStatus='approved';let posted=0;
 s.route=(url:string,init:any)=>{if(url.endsWith('/finalize')){assert.equal(init.method,'POST');posted++;s.order.state='approved';return s}};
 const {win,dom,calls}=await boot('sessionId=project',s);win.navigate('compositions');win.document.getElementById('order-example').click();
 assert.equal(win.document.getElementById('primary').disabled,false);win.document.getElementById('primary').click();win.document.getElementById('primary').click();
 await new Promise(r=>setTimeout(r,40));assert.equal(posted,1);assert.match(win.document.getElementById('screen').textContent,/Your gifts are approved/);assert(!calls.some(x=>x.includes('manufactur')));dom.window.close();
 const restored=await boot('sessionId=project',s);assert.match(restored.win.document.getElementById('screen').textContent,/Your gifts are approved/);assert.equal(restored.win.document.getElementById('primary').textContent,'My Collection →');assert.equal(posted,1);restored.dom.window.close();
 });
 test('final approval failure retains the individual approvals and can retry',async()=>{
 const s:any=artworkProject();s.compositions[0].status='approved';s.mockup.compositionStatus='approved';s.route=(url:string)=>url.endsWith('/finalize')?new Response(JSON.stringify({error:'approval_unavailable'}),{status:503}):null;
 const {win,dom}=await boot('sessionId=project',s);win.navigate('compositions');win.document.getElementById('order-example').click();win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,40));assert.equal(s.order.state,'awaiting_artwork');assert.equal(win.document.getElementById('primary').disabled,false);assert.equal(win.document.getElementById('error').textContent,'approval_unavailable');dom.window.close();
 });

 test('Cancel returns through fresh entry while preserving the old project reference',async()=>{
 const {win,dom}=await boot('sessionId=project');
 const cancel=Array.from(win.document.querySelectorAll('button')).find((b:any)=>b.textContent==='Cancel') as HTMLButtonElement;
 assert.equal(cancel.dataset.href,'/gifts.next.html?newGift=1&resumeSessionId=project');
 const landing=new JSDOM(fs.readFileSync('public/gifts.next.html','utf8'),{url:'https://liten.invalid'+cancel.dataset.href,runScripts:'outside-only'});
 landing.window.eval(fs.readFileSync('public/gifts/entry.next.js','utf8'));
 const links=Array.from(landing.window.document.querySelectorAll('a.hp-cta'));
 assert.equal(links.length,2);for(const a of links)assert.equal(a.getAttribute('href'),'/gift-wizard.next.html?newGift=1&resumeSessionId=project');
 dom.window.close();landing.window.close();
 });

 test('fresh upload provides approved Back and Start Over with prior gift return',async()=>{const {win,dom}=await boot('newGift=1&resumeSessionId=project');assert(!Array.from(win.document.querySelectorAll('button')).some((b:any)=>b.textContent==='Cancel'));assert.equal(win.document.getElementById('back').hidden,false);assert.equal(win.document.getElementById('pivot-start').textContent,'Start Over');assert(win.document.getElementById('resume-gift'));dom.window.close()});
 test('new gift checks authentication before offering upload and retains fresh return URL',async()=>{
 const s:any=project();s.authStatus=401;const {win,dom,calls}=await boot('newGift=1&resumeSessionId=project',s);
 assert.match(win.document.getElementById('screen').textContent,/Sign in/);assert.equal(win.document.getElementById('primary').textContent,'Sign in \u2192');assert(!win.document.getElementById('choose-photo'));assert(!calls.includes('/api/v1/gift/sessions/project'));assert.match(win.location.search,/newGift=1/);dom.window.close();
 });
 test('expired authentication during upload opens sign-in instead of silently resetting photo input',async()=>{
 const s:any=project();s.route=(url:string,init:any)=>url==='/api/v1/gift/sessions'&&init.method==='POST'?new Response(JSON.stringify({error:'sign_in_required'}),{status:401}):null;
 const {win,dom}=await boot('newGift=1&resumeSessionId=project',s);win.MS_UPLOADER={readFileAsBase64:async()=>({b64:'fixture'})};win.URL.createObjectURL=()=> 'blob:fixture';win.URL.revokeObjectURL=()=>{};win.Image=class{src='';decode(){return Promise.resolve()}};
 await win.uploadPhoto(new win.File(['fixture'],'photo.jpg',{type:'image/jpeg'}));assert.match(win.document.getElementById('screen').textContent,/Sign in/);assert.equal(win.document.getElementById('primary').disabled,false);assert(!win.document.getElementById('choose-photo'));dom.window.close();
 });

 test('cancel confirmation keeps the active gift intact and uses approved copy',async()=>{
 const {win,dom,calls}=await boot('sessionId=project');win.HTMLDialogElement.prototype.showModal=function(){this.open=true};win.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new win.Event('close'))};
 const before=calls.length;Array.from(win.document.querySelectorAll('button')).find((b:any)=>b.textContent==='Cancel').click();const d=win.document.getElementById('cancel-gift-dialog');assert(d.open);assert.match(d.textContent,/does not delete your artwork or cancel a paid order/);win.document.getElementById('keep-creating').click();assert(!win.document.getElementById('cancel-gift-dialog'));assert.equal(calls.length,before);dom.window.close();
 });
 test('analysis has exactly one visible loading announcement',async()=>{
 const {win,dom}=await boot('newGift=1');let finish:any;win.MS_UPLOADER={readFileAsBase64:()=>new Promise(r=>finish=r)};const pending=win.uploadPhoto(new win.File(['x'],'photo.jpg',{type:'image/jpeg'}));assert.equal((win.document.body.textContent.match(/Analyzing your photo/g)||[]).length,1);finish({b64:''});await pending;dom.window.close();
 });

test('artwork selection has one stage title, left navigation and a distinct action card',async()=>{
 const {win,dom}=await boot('layoutReview=gallery');
 assert.equal(win.document.querySelector('#left h1').textContent,'Choose Your Artwork');
 assert.equal(win.document.querySelector('#screen h2'),null);
 assert(win.document.querySelector('#right.artwork-actions #primary'));
 assert(!Array.from(win.document.querySelectorAll('#screen button')).some((b:any)=>/^(Cancel|← Back)$/.test(b.textContent)));
 dom.window.close();
});

test('pivot review chooses one static effect before shared Product Studio with no generation requests',async()=>{
 const {win,dom,calls}=await boot('layoutReview=effects&pivot=1&subjects=5');
 try{const buttons=win.document.querySelectorAll('[data-effect]');buttons[0].click();win.document.querySelector('[data-effect]').click();assert.equal(win.document.querySelectorAll('[data-effect][aria-pressed="true"]').length,1);assert.equal(win.document.querySelector('.tray'),null);assert.equal(win.document.getElementById('primary').textContent,'Choose This Effect →');win.document.getElementById('primary').click();assert.equal(win.document.querySelectorAll('[data-feature]').length,8);win.document.querySelector('[data-feature="canvas"]').click();assert.equal(win.document.querySelector('[data-aspect="Portrait"]'),null);assert.ok(win.document.querySelector('[data-aspect="Square"]'));win.document.querySelector('[data-size]').click();assert.equal(win.document.getElementById('primary').disabled,true);assert.equal(calls.some(x=>/product-preview|batches|generations|compositions/.test(x)),false);}finally{dom.window.close()}
});

test('pivot simulated intake bypasses recipient and preserves one effect and details on refresh',async()=>{
 const {win,dom,calls}=await boot('layoutReview=photo&pivot=1');
 win.MS_UPLOADER={readFileAsBase64:async()=>({b64:'fixture-only'})};win.URL.createObjectURL=()=> 'blob:fixture';win.URL.revokeObjectURL=()=>{};win.Image=class{decode(){return Promise.resolve()}};
 await win.uploadPhoto(new win.File(['fixture'],'fixture.jpg',{type:'image/jpeg'}));assert.equal(win.document.getElementById('screen').dataset.view,'effects');assert.equal(win.document.querySelector('[name=recipient]'),null);win.document.getElementById('primary').click();win.document.querySelector('[data-feature="canvas"]').click();win.document.querySelector('[data-size="12x12"]').click();
 const storage=Object.fromEntries(Object.keys(win.sessionStorage).map(k=>[k,win.sessionStorage.getItem(k)]));assert.equal(calls.some(x=>x.includes('/api/')),false);dom.window.close();
 const restored=await boot('layoutReview=effects&pivot=1',{...project(),storage});assert.equal(restored.win.document.getElementById('screen').dataset.view,'products');assert.ok(restored.win.document.body.textContent.includes('12 × 12'));assert.equal(restored.win.document.getElementById('primary').disabled,true);restored.dom.window.close();
});
test('Gift Shop uses its isolated square Portrait variants and keeps Groups lookup unchanged',async()=>{
 for(const subject of ['man','woman']){
  const {win,dom,calls}=await boot('layoutReview=effects&pivot=1&fixtureSubject='+subject);
  const src=win.document.querySelector('#screen img').getAttribute('src');
  assert.equal(src,'/gift-wizard/effect-previews/portraits/jade/'+subject+'.jpg');
  assert.ok(calls.some(x=>x.endsWith('/effect-previews/index.next.json')));
  assert.ok(!src.startsWith('/previews/effects/'));
  win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'products');
  dom.window.close();
 }
 const pets=await boot('layoutReview=effects&pivot=1&fixtureSeries=pets');
 assert.match(pets.win.document.querySelector('#screen img').getAttribute('src'),/^\/gift-wizard\/effect-previews\/pets\/jade\//);pets.dom.window.close();
 const groups=await boot('layoutReview=effects&pivot=1&fixtureSeries=groups');
 assert.equal(groups.win.document.querySelector('#screen img').getAttribute('src'),'/previews/groups/groups_jade.jpg');groups.dom.window.close();
});
test('live Portrait samples never infer gender from fixture parameters or silently select a variant',async()=>{
 const {win,dom}=await boot('sessionId=project&fixtureSubject=woman',project());win.navigate('effects');
 assert.equal(win.document.querySelectorAll('#screen img,#right .context-image').length,0);
 assert.ok(win.document.getElementById('screen').textContent.includes('Not currently available'));
 dom.window.close();
});

for(const gender of ['female','male'])test('normal new-gift session uses approved single effect flow: '+gender,async()=>{
 const s:any=project('none');s.order.orderId=null;s.lines=[];s.geometries=[];s.source.subjectGender=gender;
 const {win,dom,calls}=await boot('sessionId=project',s);
 assert.equal(win.document.getElementById('primary').textContent,'Choose This Effect →');
 assert.equal(win.document.querySelector('#screen img').getAttribute('src'),'/gift-wizard/effect-previews/portraits/jade/'+(gender==='female'?'woman':'man')+'.jpg');
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'products');assert.equal(win.document.querySelectorAll('[data-feature]').length,8);
 win.document.querySelector('[data-feature="canvas"]').click();win.document.querySelector('[data-size]').click();
 assert.equal(win.document.getElementById('primary').disabled,true);assert(!calls.some(x=>/batches|compositions|product-preview/.test(x)));
 const storage=Object.fromEntries(Object.keys(win.sessionStorage).map(k=>[k,win.sessionStorage.getItem(k)]));dom.window.close();
 const restored=await boot('sessionId=project',{...s,storage});assert.equal(restored.win.document.getElementById('screen').dataset.view,'products');assert(restored.win.document.querySelector('.studio-media img'));restored.dom.window.close();
});

for(const gender of ['unknown',null])test('unclassified Portrait uses only explicit original neutral mapping: '+gender,async()=>{
 const s:any=project('none');s.lines=[];s.geometries=[];s.source.subjectGender=gender;
 s.originalPortraitManifest={base:'/previews/effects/',effects:{jade:{neutral:'neutral.jpg',man:'man.jpg',woman:'woman.jpg'}}};
 const {win,dom}=await boot('sessionId=project',s);
 assert.equal(win.document.querySelector('#screen img').getAttribute('src'),'/previews/effects/jade/neutral.jpg');
 dom.window.close();
 const restored=await boot('',{...s,resume:{sessionId:'project',view:'effects'}});
 assert.equal(restored.win.document.querySelector('#screen img').getAttribute('src'),'/previews/effects/jade/neutral.jpg');restored.dom.window.close();
});

for(const series of ['pets','groups'])test('live '+series+' ignores null subjectGender',async()=>{
 const s:any=project('none');s.lines=[];s.geometries=[];s.source.series=series;s.source.subjectGender=null;s.source.peopleCount=series==='groups'?3:null;
 const {win,dom}=await boot('sessionId=project',s);
 const src=win.document.querySelector('#screen img').getAttribute('src');
 if(series==='pets')assert.match(src,/^\/gift-wizard\/effect-previews\/pets\/jade\//);else assert.equal(src,'/previews/groups/groups_jade.jpg');
 dom.window.close();
});

test('artwork-only paid review uses server image and disclosure without a product photograph',async()=>{
 const s:any=artworkProject();s.mockup={...s.mockup,renderer:'artwork',scene:null,representation:'artwork_only',physicalProductShown:false,previewBasis:'product_shaped_artwork',disclosureCode:'artwork_only_preview',disclosure:"This shows your artwork exactly as it will be printed, in this product's shape. It is not a photograph of the product."};
 const {win,dom}=await boot('sessionId=project',s);win.navigate('compositions');
 assert.ok(win.document.querySelector('#screen img[src="https://liten.invalid/signed-product.png"]'));
 assert.ok(win.document.getElementById('screen').textContent.includes('It is not a photograph of the product.'));
 win.document.getElementById('order-example').click();
 assert.ok(win.document.querySelector('.cart-details').textContent.includes('It is not a photograph of the product.'));
 assert.equal(win.document.querySelector('.cart-thumbnail .small'),null);
 assert.equal(win.document.querySelector('.cart-details .small').textContent,s.compositions[0].state||s.compositions[0].status);

 dom.window.close();
 const api=new backend.GiftBackend(async()=>new Response(JSON.stringify({...s.mockup,disclosure:null})));
 await assert.rejects(()=>api.mockup('project','line','composition'),/approved_scene_required|invalid_mockup_response/);
});
test('Gift availability is authoritative over Print Shop artwork-fit selection',async()=>{
 const s:any=project('none');s.lines=[];s.geometries=[];s.source.subjectGender='female';
 s.route=(u:string)=>u.endsWith('/availability')?{contractVersion:1,sessionId:'project',products:catalog.products.map(p=>({productId:p.productId,purchasable:p.family==='matted'}))}:null;
 const {win,dom}=await boot('sessionId=project',s);win.document.getElementById('primary').click();
 assert.equal(win.document.querySelector('[data-feature="matted"]').disabled,false);
 assert.ok(win.document.querySelector('[data-feature="canvas"]').textContent.includes('Not currently available'));
 dom.window.close();
});
