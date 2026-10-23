import type {AvailabilityView} from './backend-contracts/gift/availability';
/** Prepared frontend transport only. Authenticated calls only. Final manufacturing release remains blocked. */
import type {ProductPreviewView,RestoreResponse,SessionView,BatchView,BatchRequest,BatchResponse,SetLinesRequest,GiftCheckoutRequest,GiftCheckoutResponse,OrderConfirmRequest,OrderConfirmResponse,PackCheckoutRequest,PackCheckoutResponse,PackConfirmRequest,PackConfirmResponse,SelectArtworkRequest,RefundRequestBody,RefundRequestResponse,MockupView} from './backend-contracts/gift/types';
import type {CatalogResponse} from './backend-contracts/print/catalog-types';
export type Transport=(url:string,init:RequestInit)=>Promise<Response>;
export class GiftApiError extends Error {constructor(public code:string,public status:number,public details:unknown=null){super(code)}}
const segment=(s:string)=>{if(!/^[\w-]{1,80}$/.test(s))throw new GiftApiError('invalid_reference',0);return encodeURIComponent(s)};
const sessionPath=(id:string)=>'/api/v1/gift/sessions/'+segment(id);
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const previewURL=(url:string)=>/^https:\/\//.test(url)||(typeof location!=='undefined'&&['localhost','127.0.0.1'].includes(location.hostname)&&url.startsWith(location.origin+'/'));

export function assertSession(v:unknown):asserts v is SessionView {
 if(!record(v)||v.contractVersion!==1||typeof v.sessionId!=='string'||!record(v.order)||!record(v.entitlement)||!record(v.nextBatch)||!Array.isArray(v.lines)||!Array.isArray(v.batches)||!Array.isArray(v.compositions))throw new GiftApiError('invalid_session_response',0);
 if(v.entrance!==undefined&&!['photo','collection'].includes(v.entrance))throw new GiftApiError('invalid_session_response',0);
 if(v.entrance==='collection'&&(!record(v.collection)||typeof v.collection.previewId!=='string'||typeof v.collection.portfolioId!=='string'||!v.artworkPreviewId))throw new GiftApiError('invalid_session_response',0);
 for(const n of [v.entitlement.freeBatchesTotal,v.entitlement.freeBatchesUsed,v.entitlement.paidPacksAvailable,v.order.freeBatchesGranted])if(!Number.isInteger(n)||n<0)throw new GiftApiError('invalid_entitlement_response',0);
 if(typeof v.entitlement.freeAvailable!=='boolean'||![null,'session_limit','photo_limit','daily_limit','lifetime_limit'].includes(v.entitlement.freeBlockedReason))throw new GiftApiError('invalid_entitlement_response',0);
 if(!['free','paid','payment_required','blocked'].includes(v.nextBatch.kind)||!Array.isArray(v.geometries)||typeof v.expiresAt!=='string')throw new GiftApiError('invalid_session_response',0);
 for(const c of v.compositions)if(c.state!==undefined&&(!['not_started','preparing','stalled','failed','ready','approved'].includes(c.state)||!Number.isInteger(c.attempts)||c.attempts<0||typeof c.retryable!=='boolean'||(c.preparingSince!==null&&!Number.isFinite(Date.parse(c.preparingSince)))||(c.failureCode!==null&&typeof c.failureCode!=='string')))throw new GiftApiError('invalid_composition_state',0);
 if(!['none','checkout_open','awaiting_artwork','approved','with_lab','refund_requested','refunded','cancelled','needs_attention'].includes(v.order.state))throw new GiftApiError('invalid_order_state',0);
}
// Only the replacement masters/masks from litenco product image alphas 2-assets.zip.
const approvedSceneFamilies:Record<string,string>={'fine-art-portrait':'fine_art','fine-art-landscape':'fine_art','premium-square':'premium','premium-landscape':'premium','classic-framed-square':'framed','classic-framed-portrait':'framed','gallery-canvas-portrait':'canvas','framed-canvas-portrait':'framed_canvas','matted-frame-portrait':'matted','fine-art-square':'fine_art','premium-fine-art':'premium','classic-framed':'framed','matted-frame-square':'matted','gallery-canvas-square':'canvas','gallery-canvas-landscape':'canvas','matted-frame-landscape':'canvas','framed-canvas':'framed_canvas','ceramic-mug':'mug','greeting-card':'card'};
export function isApprovedScene(productId:string,sceneId:unknown){return typeof sceneId==='string'&&approvedSceneFamilies[sceneId]===productId.split(':')[0]}
export const integrationBlocks=Object.freeze(['sandbox_final_release','mug_card_profiles'] as const);
export class GiftBackend {
 constructor(private readonly transport:Transport){}
 private async request<T>(method:string,url:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  let response:Response;try{response=await this.transport(url,{method,credentials:'same-origin',cache:'no-store',signal,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})}catch(e){if(signal?.aborted)throw e;throw new GiftApiError('network_failure',0)}
  let value:unknown;try{value=await response.json()}catch{throw new GiftApiError('invalid_json_response',response.status)}
  if(!response.ok)throw new GiftApiError(record(value)&&typeof value.error==='string'?value.error:'gift_unavailable',response.status,value);
  return value as T;
 }
 private async session(method:string,url:string,body?:unknown,signal?:AbortSignal){const result=await this.request<unknown>(method,url,body,signal);assertSession(result);return result}
 // Existing payload types are retained; no new endpoint or entitlement response is guessed.
 prePurchaseBatch(id:string,b:BatchRequest):Promise<BatchResponse>{return this.startBatch(id,b)}
 prePurchaseFavorite(id:string,b:SelectArtworkRequest):Promise<SessionView>{return this.selectArtwork(id,b)}
 create(image_b64:string,signal?:AbortSignal){return this.session('POST','/api/v1/gift/sessions',{image_b64},signal)}
 fromCollection(previewId:string){return this.session('POST','/api/v1/gift/sessions/from-collection',{previewId})}
 restore(id:string,signal?:AbortSignal){return this.session('GET',sessionPath(id),undefined,signal)}
 async restoreLatest(signal?:AbortSignal):Promise<RestoreResponse>{
  const v=await this.request<RestoreResponse>('GET','/api/v1/gift/sessions',undefined,signal);
  if(!v||v.contractVersion!==1||!Array.isArray(v.recent)||(v.current===null?v.resume!==null:!v.resume))throw new GiftApiError('invalid_restore_response',0);
  if(v.current){assertSession(v.current);const r=v.resume!;if(r.sessionId!==v.current.sessionId||!['effects','previews','products','cart','checkout','compositions','order'].includes(r.suggestedStep)||![r.resumeBatches,r.runningBatches].every(a=>Array.isArray(a)&&a.every(n=>Number.isInteger(n)&&n>0)))throw new GiftApiError('invalid_restore_response',0)}
  const c=v.resume?.compositions;if(c!=null&&(!['not_started','preparing','stalled','failed','ready','approved'].includes(c.state)||typeof c.resumeNeeded!=='boolean'||![c.preparing,c.stalled,c.failed].every(a=>Array.isArray(a)&&a.every(x=>typeof x==='string'))))throw new GiftApiError('invalid_restore_response',0);
  return v;
 }
 async catalog(signal?:AbortSignal){const v=await this.request<CatalogResponse>('GET','/api/v1/print/catalog',undefined,signal);if(v.contractVersion!==1||!Array.isArray(v.products))throw new GiftApiError('invalid_catalog_response',0);return v}
 async availability(id:string,signal?:AbortSignal){const v=await this.request<AvailabilityView>('GET',sessionPath(id)+'/availability',undefined,signal);if(v.contractVersion!==1||v.sessionId!==id||!Array.isArray(v.products)||v.products.some(p=>typeof p.purchasable!=='boolean'||typeof p.productId!=='string'))throw new GiftApiError('invalid_availability_response',0);return v}
 setLines(id:string,b:SetLinesRequest,signal?:AbortSignal){return this.session('PUT',sessionPath(id)+'/lines',{lines:b.lines.map(l=>({lineId:l.lineId,productId:l.productId,copies:l.copies}))},signal)}
 async confirmOrder(b:OrderConfirmRequest,signal?:AbortSignal){const v=await this.request<OrderConfirmResponse>('POST','/api/v1/gift/orders/confirm',{stripeSessionId:b.stripeSessionId},signal);if(typeof v.confirmed!=='boolean'||(v.confirmed&&!v.session))throw new GiftApiError('invalid_confirmation_response',0);if(v.session)assertSession(v.session);return v}
 async batch(id:string,n:number,signal?:AbortSignal){if(!Number.isInteger(n)||n<1)throw new GiftApiError('invalid_batch_index',0);return this.request<BatchView>('GET',sessionPath(id)+'/batches/'+n,undefined,signal)}
 selectArtwork(id:string,b:SelectArtworkRequest,signal?:AbortSignal){return this.session('POST',sessionPath(id)+'/artwork',{previewId:b.previewId},signal)}
 async confirmPack(b:PackConfirmRequest,signal?:AbortSignal){const v=await this.request<PackConfirmResponse>('POST','/api/v1/gift/preview-pack/confirm',{stripeSessionId:b.stripeSessionId},signal);if(typeof v.confirmed!=='boolean'||!Number.isInteger(v.paidPacksAvailable)||v.paidPacksAvailable<0)throw new GiftApiError('invalid_pack_response',0);return v}
 refund(id:string,b:RefundRequestBody,signal?:AbortSignal){return this.request<RefundRequestResponse>('POST',sessionPath(id)+'/refund-request',{reason:b.reason},signal)}
 // Exact authoritative requests retained as types; held capabilities emit no request until CC/design reconciliation.
 async checkout(id:string,b:GiftCheckoutRequest):Promise<GiftCheckoutResponse>{
  if(b.disclosureAccepted!==true||!b.disclosureVersion)throw new GiftApiError('disclosure_required',0);
  const v=await this.request<GiftCheckoutResponse>('POST',sessionPath(id)+'/checkout',b);
  if(!v.publishableKey?.startsWith('pk_test_')||!v.stripeSessionId?.startsWith('cs_test_')||!v.clientSecret||!v.disclosure?.version||typeof v.disclosure.text!=='string'||!v.totals||![v.totals.itemsCents,v.totals.shippingCents,v.totals.totalCents].every(n=>Number.isInteger(n)&&n>=0))throw new GiftApiError('test_checkout_required',0);
  return v;
 }
 startBatch(id:string,b:BatchRequest):Promise<BatchResponse>{return this.request('POST',sessionPath(id)+'/batches',{idempotencyKey:b.idempotencyKey,effectIds:b.effectIds})}
 retryBatch(id:string,n:number):Promise<BatchResponse>{if(!Number.isInteger(n)||n<1)throw new GiftApiError('invalid_batch_index',0);return this.request('POST',sessionPath(id)+'/batches/'+n+'/retry')}
 async packCheckout(b:PackCheckoutRequest):Promise<PackCheckoutResponse>{
  const v=await this.request<PackCheckoutResponse>('POST','/api/v1/gift/preview-pack/checkout',{returnPath:b.returnPath});
  if(!v.publishableKey?.startsWith('pk_test_')||!v.stripeSessionId?.startsWith('cs_test_')||v.amountCents!==299||!v.clientSecret)throw new GiftApiError('test_checkout_required',0);
  return v;
 }
 async authenticated(){const v=await this.request<{user:unknown}>('GET','/api/v1/auth/me');if(!v.user)throw new GiftApiError('authentication_required',401)}
 async signIn(next:string){
  if(!next.startsWith('/')||next.startsWith('//'))throw new GiftApiError('invalid_return_path',0);
  const v=await this.request<{ok:boolean;url?:string}>('POST','/api/v1/auth/signin',{provider:'google',next});
  if(!v.ok||!v.url||!/^https:\/\/[^/]+\.supabase\.co\/auth\/v1\/authorize\?/.test(v.url))throw new GiftApiError('invalid_signin_response',0);
  return v.url;
 }
 compose(id:string):Promise<SessionView>{return this.session('POST',sessionPath(id)+'/compositions')}
 correct(id:string,lineId:string):Promise<SessionView>{return this.session('POST',sessionPath(id)+'/compositions/'+segment(lineId)+'/correct')}
 approveComposition(id:string,compositionId:string):Promise<SessionView>{return this.session('POST',sessionPath(id)+'/compositions/'+segment(compositionId)+'/approve')}
 finalize(id:string):Promise<SessionView>{return this.session('POST',sessionPath(id)+'/finalize')}
 approveOrder(id:string):Promise<SessionView>{return this.finalize(id)}
 async mockup(id:string,lineId:string,compositionId:string,signal?:AbortSignal):Promise<MockupView>{
  const v=await this.request<MockupView>('GET',sessionPath(id)+'/lines/'+segment(lineId)+'/mockup?compositionId='+segment(compositionId),undefined,signal);
  if(!v||v.contractVersion!==1||v.sessionId!==id||v.lineId!==lineId||v.compositionId!==compositionId||typeof v.watermarked!=='boolean'||v.productionPrintFile!==false||v.purchaseAuthorization!==false||!previewURL(v.url)||!(Date.parse(v.urlExpiresAt)>Date.now())||!(v.width>0&&v.height>0)||!['frozen','legacy_catalog'].includes(v.geometrySource))throw new GiftApiError('invalid_mockup_response',0);
  if(!isProductRepresentation(v,v.productId,v.scene?.sceneId))throw new GiftApiError('approved_scene_required',0);
  return v;
 }
 async productPreview(id:string,productId:string,favoriteId:string,signal?:AbortSignal):Promise<ProductPreviewView>{
  const v=await this.request<ProductPreviewView>('GET',sessionPath(id)+'/product-preview?productId='+encodeURIComponent(productId)+'&provisional=1',undefined,signal);
  if(!v||v.contractVersion!==1||v.sessionId!==id||v.productId!==productId||v.favoriteId!==favoriteId||!['ready','provisional','adaptation_required','not_available'].includes(v.status))throw new GiftApiError('invalid_product_preview_response',0);
  if((v.status==='ready'||v.status==='provisional')&&(v.watermarked!==true||v.productionPrintFile!==false||v.purchaseAuthorization!==false||!previewURL(v.url)||!(Date.parse(v.urlExpiresAt)>Date.now())||!(v.width>0&&v.height>0)||!['scene','artwork','calibrated'].includes(v.renderer)))throw new GiftApiError('invalid_product_preview_response',0);
  if((v.status==='ready'||v.status==='provisional')&&!isProductRepresentation(v.status==='provisional'?{...v,...v.provisional}:v,productId,v.sceneId))throw new GiftApiError('approved_scene_required',0);
  if(v.status==='provisional'){const p=v.provisional;if(v.fit!=='contain'||!p||p.exactArtworkShown!==true||p.cropped!==false||p.distorted!==false||p.surround!=='neutral'||!p.bars||!['top_bottom','left_right'].includes(p.bars.sides)||!Number.isFinite(p.bars.fractionPerSide)||p.bars.fractionPerSide<0||p.bars.fractionPerSide>=0.5||!['generated','deterministic',null].includes(p.finalComposition))throw new GiftApiError('invalid_product_preview_response',0)}
  return v;
 }
 private block<T>(reason:string):Promise<T>{return Promise.reject(new GiftApiError('integration_blocked',0,{reason}))}
}
/** Carries the actual per-line server composition only; never falls back to the selected master. */
export function compositionReferences(session:SessionView){
 assertSession(session);
 if(!session.order.orderId||!session.artworkPreviewId||!['awaiting_artwork','approved','with_lab'].includes(session.order.state))return [];
 const lines=new Map(session.lines.map(l=>[l.lineId,l]));
 const seen=new Set<string>();return session.compositions.filter(c=>{
  const line=lines.get(c.lineId);if(!line||line.productId!==c.productId||seen.has(c.lineId)||!c.compositionId||!c.previewUrl||!['ready','approved'].includes(c.status))return false;
  if(c.sourceArtworkId!==session.artworkPreviewId||!/^https:\/\//.test(c.previewUrl)||!c.width||!c.height)return false;seen.add(c.lineId);return true;
 }).map(c=>({lineId:c.lineId,productId:c.productId,compositionId:c.compositionId!,previewUrl:c.previewUrl!,width:c.width!,height:c.height!,status:c.status,fit:c.fit}));
}

function isProductRepresentation(v:{renderer?:string;representation?:string;physicalProductShown?:boolean;previewBasis?:string;disclosureCode?:string|null;disclosure?:string|null},productId:string,sceneId?:string|null){return v.renderer==='scene'?isApprovedScene(productId,sceneId):v.renderer==='artwork'&&v.representation==='artwork_only'&&v.physicalProductShown===false&&v.previewBasis==='product_shaped_artwork'&&v.disclosureCode==='artwork_only_preview'&&typeof v.disclosure==='string'&&v.disclosure.trim().length>0}
