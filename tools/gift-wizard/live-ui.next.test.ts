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
 return {contractVersion:1,sessionId:'project',source:{sourceRef:'source',series:'portraits',width:768,height:768,peopleCount:null},lines:[{lineId:'line',productId:'framed:12x18',size:'12x18',copies:1}],geometries:[{lineId:'line',productId:'framed:12x18',sku:opt.sku,requiredPx:opt.requiredPx}],batches:[],usedEffectIds:[],entitlement:{freeBatchesTotal:2,freeBatchesUsed:0,paidPacksAvailable:0,freeAvailable:true,freeBlockedReason:null},nextBatch:{kind:'free'},expiresAt:'2099-01-01',catalogVersion:'test',order:{orderId:'order',state:orderState,freeBatchesGranted:2,approvedAt:null,unlockPortfolioId:null,totalCents:12300,disclosureVersion:'v1'},artworkPreviewId:null,compositions:[]};
}
const catalog={contractVersion:1,products:local.products.flatMap((p:any)=>p.options.map((o:any)=>({productId:p.id+':'+o.size,family:p.id,status:p.available?'launch':'disabled',selectable:p.available,sku:o.sku,size:o.size,label:o.label,retailCents:o.retailCents,attributes:o.attributes,requirements:{picturePx:{w:o.imageWidthIn*300,h:o.imageHeightIn*300},ppi:300,finalPx:o.requiredPx}})))};
async function boot(query:string,response:any=project(),status=200){
 const dom=new JSDOM(fs.readFileSync('public/gift-wizard.next.html','utf8'),{url:'https://liten.invalid/gift-wizard.next.html?'+query,runScripts:'outside-only'});
 const win=dom.window as any,calls:string[]=[];
 win.matchMedia=()=>({matches:query.includes('mobile=1'),addEventListener(){}});win.ResizeObserver=class{observe(){}disconnect(){}};win.scrollTo=()=>{};win.structuredClone=structuredClone;win.AbortController=AbortController;win.Response=Response;
 win.require=(name:string)=>name.includes('contracts.next')?contracts:name.includes('backend-state')?state:name.includes('backend.next')?backend:live;
 win.fetch=async(url:string,init:any={})=>{calls.push(String(url));if(response.route&&String(url).includes('/api/v1/gift/')){const routed=await response.route(String(url),init);if(routed)return routed instanceof Response?routed:new Response(JSON.stringify(routed),{status:200})}const data=String(url).endsWith('/auth/me')?{user:{id:'test-account'}}:String(url).endsWith('/orders/confirm')?response.confirmation:String(url).includes('/mockup?')?(response.mockups?.[String(url).split('/lines/')[1]?.split('/')[0]]||response.mockup):String(url).includes('/api/v1/print/catalog')?catalog:String(url).includes('/api/v1/gift/')?response:String(url).includes('catalog-samples/index.next')?JSON.parse(fs.readFileSync('public/gift-wizard/catalog-samples/index.next.json','utf8')):String(url).includes('catalog.next')?local:String(url).includes('fixtures.next')?JSON.parse(fs.readFileSync('public/gift-wizard/fixtures.next.json','utf8')):{effects:{},base:'/previews/'};return new Response(JSON.stringify(data),{status:String(url).includes('/api/v1/gift/')?status:200})};
 let code=fs.readFileSync('public/gift-wizard/wizard.next.ts','utf8').replace('import.meta.url',"'https://liten.invalid/gift-wizard/wizard.next.js'").replace('await import(path);',"window.EFFECT_REGISTRY={silos:[{id:'first',label:'First'}],effects:[{id:'jade',label:'Jade',category:'first',body:'live'}]};").replace(/start\(\);\s*$/,"globalThis.started=start();globalThis.navigate=go;");
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
 s.mockup={contractVersion:1,sessionId:'project',lineId:'line',productId:'framed:12x18',sourceArtworkId:'preview',compositionId:'comp',attempt:1,compositionStatus:'ready',sku:s.geometries[0].sku,watermarked:true,productionPrintFile:false,purchaseAuthorization:false,geometrySource:'frozen',url:'https://liten.invalid/signed-product.png',urlExpiresAt:'2099-01-01',width:1264,height:848};
 const {win,calls,dom}=await boot('sessionId=project',s);win.navigate('compositions');
 assert.ok(calls.some(x=>x.endsWith('/lines/line/mockup?compositionId=comp')));
 assert.equal(win.document.querySelector('#screen img').src,s.mockup.url);
 assert.equal(win.document.getElementById('primary').disabled,false);
 win.document.getElementById('order-example').click();assert.equal(win.document.getElementById('primary').textContent,'Approve My Gifts →');assert.equal(win.document.getElementById('primary').disabled,true);
 assert.equal(calls.some(x=>x.endsWith('/approve')),false);dom.window.close();
});
test('checkout requires valid delivery and explicit acceptance with a saved favorite',async()=>{const s=artworkProject();s.order.state='checkout_open';const {win,dom}=await boot('sessionId=project',s);win.navigate('checkout');assert.equal(win.document.getElementById('primary').disabled,true);for(const [id,value] of Object.entries({email:'test@example.com',name:'Test Person',line1:'1 Test Street',city:'Test',state:'CA',postcode:'90001',countryCode:'US'})){const input=win.document.getElementById(id);input.value=value;input.dispatchEvent(new win.Event('input'))}assert.equal(win.document.getElementById('primary').disabled,true);const box=win.document.getElementById('disclosure');box.checked=true;box.dispatchEvent(new win.Event('change'));assert.equal(win.document.getElementById('primary').disabled,false);const authoritative=fs.readFileSync('lib/v1/gift/orders.ts','utf8').match(/text: "(.*)",/)[1].replace(/\\n/g,'\n');assert.equal([...win.document.querySelectorAll('#gift-disclosure p')].map((p:any)=>p.textContent).join('\n\n'),authoritative);dom.window.close()});

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

test('preview-first fixture journey keeps favorite separate from product photography',async()=>{
 const {win,dom,calls}=await boot('layoutReview=effects&mobile=1');
 assert.equal(win.document.querySelectorAll('.progress li').length,6);
 assert.equal(win.document.querySelector('.progress [aria-current]').textContent,'Choose Effects');
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'review');
 win.document.querySelector('[data-art]').click();win.document.getElementById('primary').click();
 assert.equal(win.document.getElementById('screen').dataset.view,'products');
 assert.equal(win.document.querySelectorAll('[data-feature]').length,8);assert.equal(win.document.querySelectorAll('[data-product]').length,1);
 const reference=win.document.querySelector('#right img').src;assert.ok(reference.includes('preview-1.jpg'));
 win.document.querySelector('[data-product="fine_art"]').click();assert.ok(win.document.querySelector('#right img').src.includes('product-fine_art'));
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'cart');
 assert.ok(win.document.querySelector('.cart-thumbnail img').src.includes('product-'));
 win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'checkout');
 assert.ok(win.document.getElementById('gift-disclosure').textContent.includes('first twelve personalized artwork previews are free'));
 assert.equal(calls.some(x=>x.includes('/api/v1/gift/')),false);dom.window.close();
});
test('legacy allocation responses fail closed',async()=>{
 const s:any=project('none');delete s.entitlement.freeAvailable;
 const {win,dom,calls}=await boot('sessionId=project',s);assert.equal(win.document.getElementById('error').textContent,'invalid_entitlement_response');assert.equal(calls.some(x=>x.endsWith('/batches')),false);dom.window.close();
});

test('unpaid free batches use the server allocation and retain batch idempotency',async()=>{
 const s:any=project('none');s.order.orderId=null;s.lines=[];s.geometries=[];const bodies:any[]=[];
 s.route=(url:string,init:any)=>{if(url.endsWith('/batches')){bodies.push(JSON.parse(init.body));s.entitlement.freeBatchesUsed++;s.entitlement.freeAvailable=s.entitlement.freeBatchesUsed<2;s.entitlement.freeBlockedReason=s.entitlement.freeAvailable?null:'session_limit';s.nextBatch=s.entitlement.freeAvailable?{kind:'free'}:{kind:'payment_required',amountCents:299,currency:'USD'};s.batches=artworkProject().batches.slice(0,s.entitlement.freeBatchesUsed);return {status:'ok',batch:s.batches.at(-1),session:s}}};
 const {win,dom}=await boot('sessionId=project',s);assert.equal(win.document.getElementById('primary').disabled,false);win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.equal(win.document.querySelectorAll('[data-art]').length,6);win.document.getElementById('another-batch').click();await new Promise(r=>setTimeout(r,20));assert.equal(bodies.length,2);assert.notEqual(bodies[0].idempotencyKey,bodies[1].idempotencyKey);assert.equal(win.document.getElementById('another-batch').textContent,'Six More · $2.99');assert.equal(s.order.orderId,null);dom.window.close();
});

test('favorite persists before shopping without requesting a composition',async()=>{
 const s=artworkProject();s.order.state='none';s.order.orderId=null;s.artworkPreviewId=null;s.compositions=[];s.mockup=null;let saved='';
 s.route=(url:string,init:any)=>{if(url.endsWith('/artwork')){saved=JSON.parse(init.body).previewId;s.artworkPreviewId=saved;return s}};
 const {win,dom,calls}=await boot('sessionId=project',s);win.document.getElementById('primary').click();await new Promise(r=>setTimeout(r,20));assert.ok(saved);assert.equal(win.document.getElementById('screen').dataset.view,'products');assert.equal(calls.some(x=>x.endsWith('/compositions')),false);dom.window.close();
});

test('checkout adapter sends current disclosure and delivery to test checkout only',async()=>{
 const requests:any[]=[];const api=new backend.GiftBackend(async(url,init)=>{requests.push({url,body:JSON.parse(String(init.body))});return Response.json({clientSecret:'secret',stripeSessionId:'cs_test_1',publishableKey:'pk_test_1',totals:{itemsCents:100,shippingCents:20,totalCents:120},disclosure:{version:'2026-10-18-3',text:'authoritative'}})});
 const body:any={email:'test@example.com',shippingAddress:{name:'Test',line1:'1 Street',city:'City',postcode:'12345',countryCode:'US'},disclosureAccepted:true,disclosureVersion:'2026-10-18-3',returnPath:'/gift-wizard.next.html'};
 await api.checkout('project',body);assert.deepEqual(requests[0].body,body);await assert.rejects(api.checkout('project',{...body,disclosureAccepted:false}),/disclosure_required/);assert.equal(requests.length,1);await assert.rejects(api.approveOrder('project'),/integration_blocked/);
});

test('server allocation caps, refunds and manufacturing states prevent free generation',()=>{
 for(const state of ['none','checkout_open','awaiting_artwork']){const s:any=project(state);assert.equal(live.canCraft(s),true);s.entitlement.freeAvailable=false;assert.equal(live.canCraft(s),false)}
 for(const state of ['needs_attention','approved','with_lab','refund_requested','refunded','cancelled'])assert.equal(live.canCraft(project(state) as any),false);
});

async function fillCheckout(win:any){for(const [id,value] of Object.entries({email:'test@example.com',name:'Test Person',line1:'1 Test Street',city:'Test',state:'CA',postcode:'90001',countryCode:'US'})){const el=win.document.getElementById(id);el.value=value;el.dispatchEvent(new win.Event('input'))}const box=win.document.getElementById('disclosure');box.checked=true;box.dispatchEvent(new win.Event('change'))}

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
 s.compositions.push({...s.compositions[0],lineId:'square',productId:'canvas:8x8',compositionId:'square-comp',sku:o.sku,status:'approved'});
 s.mockups={line:s.mockup,square:{...s.mockup,lineId:'square',productId:'canvas:8x8',compositionId:'square-comp',sku:o.sku,compositionStatus:'approved',url:'https://liten.invalid/square.png'}};
 let repaired=false;const writes:string[]=[];s.route=(url:string,init:any)=>{if(init.method!=='GET')writes.push(url);if(url.includes('/lines/line/mockup?')&&!repaired)return Response.json({error:'composition_geometry_mismatch'},{status:409});return null};
 const {win,dom}=await boot('sessionId=project&mobile=1',s);win.navigate('compositions');
 assert.ok(win.document.querySelector('[data-composition-state="repair-required"]'));assert.equal(win.document.querySelector('[data-composition-state] h3').textContent,"We're preparing your artwork for this gift");assert.deepEqual([...win.document.querySelectorAll('[data-composition-state] p')].map((p:any)=>p.textContent),["Your artwork needs a small adjustment to fit this product correctly. We're taking care of it.","Your selected artwork and purchase are safe. No action is needed right now."]);assert.equal(win.document.getElementById('check-composition-line').textContent,'Check Again');assert.equal(win.document.body.textContent.includes('composition_geometry_mismatch'),false);assert.equal(win.document.getElementById('primary').disabled,true);assert.equal(win.document.querySelector('#right button').disabled,true);
 win.document.getElementById('next-product').click();assert.equal(win.document.querySelector('#screen img').src,s.mockups.square.url);assert.ok(win.document.getElementById('right').textContent.includes('approved'));
 win.document.getElementById('previous-product').click();win.document.getElementById('check-composition-line').click();await new Promise(r=>setTimeout(r,25));assert.ok(win.document.querySelector('[data-composition-state="repair-required"]'));assert.deepEqual(writes,[]);assert.equal(s.compositions[0].correctionsRemaining,1);
 // If technical repair temporarily removes the invalid composition, refresh still must not call compose.
 s.compositions[0].compositionId=null;win.document.getElementById('check-composition-line').click();await new Promise(r=>setTimeout(r,25));assert.ok(win.document.querySelector('[data-composition-state="repair-required"]'));assert.deepEqual(writes,[]);
 repaired=true;s.compositions[0].compositionId='repaired-comp';s.mockups.line={...s.mockup,compositionId:'repaired-comp'};win.document.getElementById('check-composition-line').click();await new Promise(r=>setTimeout(r,25));assert.equal(win.document.querySelector('[data-composition-state="repair-required"]'),null);assert.equal(win.document.getElementById('primary').disabled,false);assert.deepEqual(writes,[]);assert.equal(s.compositions[1].status,'approved');dom.window.close();
 });


test('carousel exposes all eight products and unavailable products are viewable only',async()=>{const {win,calls,dom}=await boot('layoutReview=products');for(const p of local.products){win.document.querySelector('[data-feature="'+p.id+'"]').click();assert.equal(win.document.querySelector('.gift-feature-details h2').textContent,p.label);assert.equal(win.document.getElementById('choose-featured').disabled,!p.available);assert.equal(win.document.querySelectorAll('.gift-feature-image').length,1);}assert.equal(calls.some(x=>x.includes('/api/v1/gift/')),false);dom.window.close()});
test('carousel previous next and keyboard preserve favorite and configuration behavior',async()=>{const {win,dom}=await boot('layoutReview=products');const favorite=win.document.querySelector('#right img').src;win.document.getElementById('gift-previous').click();assert.equal(win.document.querySelector('[data-feature][aria-pressed="true"]').dataset.feature,'card');win.document.getElementById('gift-next').click();assert.equal(win.document.querySelector('[data-feature][aria-pressed="true"]').dataset.feature,'fine_art');win.document.querySelector('[data-feature="fine_art"]').dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(win.document.activeElement.dataset.feature,'premium');assert.equal(win.document.querySelector('#right img').src,favorite);win.document.getElementById('choose-featured').click();assert.equal(win.document.getElementById('screen').dataset.view,'configuration');assert.ok(win.document.querySelector('[data-size]'));win.document.getElementById('copies').value='2';win.document.getElementById('copies').dispatchEvent(new win.Event('input'));win.document.getElementById('primary').click();assert.equal(win.document.getElementById('screen').dataset.view,'cart');assert.ok(win.document.getElementById('screen').textContent.includes('Quantity 2'));dom.window.close()});
test('mobile carousel swipe changes product but vertical scrolling does not',async()=>{const {win,dom}=await boot('layoutReview=products&mobile=1');const gesture=(dx:number,dy:number)=>{const el=win.document.getElementById('gift-swipe'),start=new win.Event('touchstart'),end=new win.Event('touchend');Object.defineProperty(start,'touches',{value:[{clientX:200,clientY:200}]});Object.defineProperty(end,'changedTouches',{value:[{clientX:200+dx,clientY:200+dy}]});el.dispatchEvent(start);el.dispatchEvent(end);};gesture(-100,5);assert.equal(win.document.querySelector('[data-feature][aria-pressed="true"]').dataset.feature,'premium');gesture(5,120);assert.equal(win.document.querySelector('[data-feature][aria-pressed="true"]').dataset.feature,'premium');gesture(100,5);assert.equal(win.document.querySelector('[data-feature][aria-pressed="true"]').dataset.feature,'fine_art');dom.window.close()});

test('compact shopping favorite returns to gallery and configuration retains back navigation',async()=>{const {win,dom}=await boot('layoutReview=products');assert.equal(win.document.querySelectorAll('#right .context-image').length,0);assert.ok(win.document.querySelector('.gift-favorite-thumb'));win.document.getElementById('choose-featured').click();assert.ok(win.document.querySelector('#screen #back'));win.document.getElementById('back').click();assert.equal(win.document.getElementById('screen').dataset.view,'products');win.document.getElementById('shopping-favorite').click();assert.equal(win.document.getElementById('screen').dataset.view,'review');dom.window.close()});

test('visual picker traps focus, closes with Escape and selection, and keeps unavailable gifts blocked',async()=>{const {win,dom}=await boot('layoutReview=products');const open=()=>win.document.getElementById('open-product-picker').click();open();assert.equal(win.document.getElementById('product-picker').getAttribute('aria-modal'),'true');const close=win.document.getElementById('close-product-picker');close.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(win.document.activeElement.dataset.feature,'card');win.document.activeElement.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(win.document.activeElement.id,'open-product-picker');open();win.document.querySelector('[data-feature="card"]').click();assert.equal(win.document.querySelector('.is-open'),null);assert.equal(win.document.getElementById('choose-featured').disabled,true);assert.equal(win.document.activeElement.id,'open-product-picker');assert.equal(win.document.getElementById('right').inert,false);dom.window.close()});

test('catalog samples follow classification without changing favorite, prices, availability or making generation calls',async()=>{for(const series of ['pets','groups','portraits']){const {win,calls,dom}=await boot('layoutReview=products&fixtureSeries='+series);const favorite=win.document.querySelector('.gift-favorite-thumb').src;for(const p of local.products){win.document.querySelector('[data-feature="'+p.id+'"]').click();assert.ok(win.document.querySelector('.gift-feature-image').src.endsWith('/'+series+'-'+p.id+'-desktop.webp'));assert.ok(win.document.querySelector('.gift-feature-media source').srcset.endsWith('/'+series+'-'+p.id+'-mobile.webp'));assert.equal(win.document.getElementById('choose-featured').disabled,!p.available);assert.equal(win.document.querySelector('.gift-favorite-thumb').src,favorite);}assert.equal(calls.some(x=>x.includes('/api/v1/gift/')),false);dom.window.close();}});
