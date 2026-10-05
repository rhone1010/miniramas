import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
const shared=readFileSync('public/creation-consistency.js','utf8');
const baseline=JSON.parse(readFileSync('lib/store/tests/fixtures/creation-consistency-baseline.json','utf8'));
const hash=(s:string)=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
for(const series of ['pets','discovery-consolidated-draft']){
 const expected=baseline[series];
 const staged=readFileSync(`public/${series}.html`,'utf8');
 const scripts=[...staged.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>ts.createSourceFile('page.js',m[1],ts.ScriptTarget.Latest,true,ts.ScriptKind.JS));
 const fn=(name:string)=>{for(const sf of scripts){const n=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);if(n)return n.getText(sf);}throw Error(name);};
 function setup(discovery=false){
  const dom=new JSDOM('<body><aside id="discoveryRail"></aside><div id="discoveryView"></div><div id="reviewView"><div id="reviewGrid"></div></div><div id="aspectView"></div></body>',{runScripts:'outside-only',url:'http://localhost/'});
  const w:any=dom.window;w.scrollTo=()=>{};w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.ResizeObserver=class{observe(){}};w.document.fonts={ready:Promise.resolve()};
  Object.assign(w,{SELECTED:[],SLOTS:[],FILL_MODE:false,TARGET_PICK:0,VALID_SIZES:[1,4,8,16],SIZE_PRICE:{1:2.99,4:4.99,8:7.99,16:12.99},SERVER_OFFER:null,INCLUDED_UNLOCKS_BY_SIZE:{1:0,4:1,8:1,16:2},ASPECT:'portrait',ASPECT_FORCED:false,ASPECTS:[{id:'portrait',label:'Portrait'},{id:'square',label:'Square'},{id:'landscape',label:'Landscape'},{id:'mobile',label:'Mobile'}],ANALYZE_RESULT:null,small:false,ACTIVE_SILO:'cast_carved',checkoutCalls:0,clearCalls:0});
  w.eval(['targetFor','targetBundle','openSlots','lockTier','releaseTier','sizeInfo','buildSummaryHtml','reviewItems','desktopBundleProgress','renderReviewRail','renderAspectRail','aspectReadyHtml','chooseAspect'].map(fn).join('\n'));
  Object.assign(w,{railIsSheet:()=>w.small,resolveFanTier:()=>1,photoStampHtml:()=>'<img alt="Your photo"><button class="photo-change">Change</button>',paintTier:()=>{},fitStampThumb:()=>{},focusStampThumb:()=>{},logPayloadIfReady:()=>{},paintDesktopCurator:()=>{},paintBundle:()=>{},noteSection:(id:string)=>{w.ACTIVE_SILO=id;},showDiscovery:()=>{w.document.body.classList.remove('is-review','is-format');},startCheckout:()=>{w.checkoutCalls++;},askStartOver:()=>{w.clearCalls++;}});
  w.showReview=()=>{w.document.body.classList.remove('is-format');w.document.body.classList.add('is-review');w.renderReviewRail();};
  w.showAspect=()=>{w.document.body.classList.remove('is-review');w.document.body.classList.add('is-format');w.renderAspectRail();};
  w.hideAspect=()=>w.showReview();
  if(discovery){
   w.DISCOVERY_RAIL_HTML=staged.match(/<aside class="rail" id="discoveryRail">([\s\S]*?)<\/aside>/)![1];
   w.SILOS=[{id:'cast_carved',name:'Cast & Carved',effects:[{id:'effect0'}]},{id:'painted',name:'Painted',effects:[{id:'effect1'}]}];w.DESKTOP_ALL_OPEN=false;w.isChosen=(id:string)=>w.SELECTED.some((x:any)=>x.key===id);w.iconMarkup=()=>'';
   w.eval(['desktopCuratorHtml','desktopMapRooms','paintDesktopCurator','paintBundle','priceOf'].map(fn).join('\n'));
   w.discoveryRail.innerHTML=w.desktopCuratorHtml();
  }
  w.eval(shared);
  const pick=(n:number)=>{w.SELECTED=Array.from({length:n},(_,i)=>({key:'effect'+i,name:'Effect '+(i+1)}));w.lockTier();};
  return {w,dom,pick};
 }
 describe(series+' canonical presentation',()=>{
  it('shows categories and keeps progress, package and current category synchronized',()=>{
   const {w,dom,pick}=setup(true);const d=w.document;
   expect(d.getElementById('dcurMapBody').hidden).toBe(false);
   expect(d.getElementById('consistencyDiscoveryHeading').textContent.trim()).toBe('Choose An Effect');
   for(const n of [1,3,4,7,8,15,16]){pick(n);w.paintDesktopCurator();w.paintBundle();const target=w.targetBundle();expect(d.querySelector('#dcurProgress .is-current,#dcurProgress .is-next').textContent).toBe(String(target));expect(d.getElementById('groupsPackageInfo').textContent).toContain('$'+w.SIZE_PRICE[target].toFixed(2));expect(d.querySelector('.groups-unlock-count').textContent).toBe(String(w.INCLUDED_UNLOCKS_BY_SIZE[target]));}
   w.noteSection('painted');expect(d.querySelector('[data-curator-room="painted"]').getAttribute('aria-pressed')).toBe('true');expect(d.querySelector('[data-curator-room="cast_carved"]').getAttribute('aria-pressed')).toBe('false');dom.window.close();
  });
  it('preserves the approved Review fan, selection, format and payment mechanics byte for byte',()=>{
   const functions=(html:string)=>{const map:Record<string,string>={};for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){const sf=ts.createSourceFile('x.js',m[1],ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);const walk=(node:ts.Node)=>{if(ts.isFunctionDeclaration(node)&&node.name)map[node.name.text]=node.getText(sf);ts.forEachChild(node,walk);};walk(sf);}return map;};
   const b=functions(staged);
   for(const name of ['toggleSelect','syncDiscoveryChecks','requestReview','resolveFanTier','buildFans','fanLayoutCard','fanBaseTransform','fanHoverTransform','applyFanTransform','reviewItems','renderReviewGrid','rvRemove','openReviewDetail','closeReviewDetail','paintReviewDetail','clearFanGeometry','layoutFans','removeFanItem','showReview','defaultAspect','renderAspects','chooseAspect','showAspect','hideAspect','buildCheckoutPayload','startCheckout'])expect(hash(b[name]),name).toBe(expected.functions[name]);
   expect(hash(b.pickFor.replaceAll('PICK_POOL','CURATED').replaceAll('recommendationEffect','curatedEffect'))).toBe(expected.functions.pickFor);
   expect(hash(b.recommendationEffect.replaceAll('recommendationEffect','curatedEffect'))).toBe(expected.functions.curatedEffect);
   expect(hash(b.recommendationPreviewUrl.replaceAll('recommendationPreviewUrl','curatedPreviewUrl'))).toBe(expected.functions.curatedPreviewUrl);
  });
  it('removes Curated navigation without removing catalog effects or the recommendation pool',()=>{
   for(const token of ['id="dcurRemix"','id="curatedBox"','id="mcurCurated"','function rerollBench','function goCurated','function renderCuratedStage','CURATED.page'])expect(staged).not.toContain(token);
   const pool=(html:string,name:string)=>html.match(new RegExp('var '+name+' = ([\\s\\S]*?);'))?.[1];
   expect(pool(staged,'PICK_UNIVERSE')?.replace(/\r\n/g,'\n')).toBe(expected.pool);
   expect(staged).toContain('bench:   PICK_POOL.bench.slice()');
  });
  it.each([0,1,2,4,5,8,9,16])('binds manifest, valid forward state and actual package at %i selections',n=>{
   const {w,dom,pick}=setup();pick(n);w.showReview();const d=w.document,t=w.targetBundle();
   expect(d.querySelectorAll('#groupsCartEffects li').length).toBe(n);
   expect(d.getElementById('groupsShapeSummary').textContent).toBe('Collection'+t+(t===1?' Craft':' Crafts')+'Included Unlocks'+w.INCLUDED_UNLOCKS_BY_SIZE[t]+'Total$'+w.SIZE_PRICE[t].toFixed(2));
   expect(d.getElementById('groupsReviewCraft').disabled).toBe(![1,4,8,16].includes(n));
   expect(d.querySelector('.photo-row').inert).toBe(true);
   expect(d.querySelectorAll('#groupsCartBack').length).toBe(1);dom.window.close();
  });
  it('keeps server offer precedence and the selected-format summary in sync',()=>{
   const {w,dom,pick}=setup();pick(4);w.SERVER_OFFER={count:4,priceUsd:5.11};w.showReview();expect(w.document.getElementById('groupsShapeSummary').textContent).toContain('$5.11');
   w.document.getElementById('groupsReviewCraft').click();expect(w.ASPECT).toBe('portrait');expect(w.document.getElementById('groupsCartFormat').textContent).toBe('Format · Portrait');
   w.chooseAspect('mobile');expect(w.document.getElementById('groupsCartFormat').textContent).toBe('Format · Mobile');expect(w.ASPECT_FORCED).toBe(true);
   w.document.getElementById('groupsShapeCraft').click();expect(w.checkoutCalls).toBe(1);
   w.document.getElementById('groupsCartBack').click();expect(w.document.body.classList.contains('is-review')).toBe(true);expect(w.ASPECT).toBe('mobile');dom.window.close();
  });
  it('routes Clear Selection through the existing confirmation and clears stage additions on Back',()=>{
   const {w,dom,pick}=setup();pick(4);w.showReview();w.document.getElementById('groupsReviewClear').click();expect(w.clearCalls).toBe(1);expect(w.SELECTED.length).toBe(4);
   w.document.getElementById('groupsCartBack').click();expect(w.document.querySelector('.consistency-port')).toBeNull();expect(w.document.body.classList.contains('groups-cart')).toBe(false);dom.window.close();
  });
  it('retains original mobile rail and restores it when crossing the breakpoint',()=>{
   const {w,dom,pick}=setup();pick(4);w.showReview();w.small=true;w.dispatchEvent(new w.Event('resize'));
   expect(w.document.getElementById('groupsShapeRail')).toBeNull();expect(w.document.querySelector('.consistency-heading')).toBeNull();expect(w.document.getElementById('btnBackRail')).not.toBeNull();expect(w.document.querySelector('.btn-create')).not.toBeNull();
   w.showAspect();expect(w.document.getElementById('btnCraft')).not.toBeNull();w.small=false;w.dispatchEvent(new w.Event('resize'));expect(w.document.getElementById('groupsCartFormat').textContent).toBe('Format · Portrait');dom.window.close();
  });
 });
}
