/** Authenticated state boundary. A URL selects a project; it never proves payment. */
import {GiftBackend,GiftApiError,assertSession} from './backend.next.js';
import type {SessionView,MockupView} from './backend-contracts/gift/types';
export function purchased(s:SessionView){return !!s.order.orderId&&['awaiting_artwork','approved','with_lab'].includes(s.order.state)}
export function canCraft(s:SessionView){return ['none','checkout_open','awaiting_artwork'].includes(s.order.state)&&Date.parse(s.expiresAt)>Date.now()&&((s.nextBatch.kind==='free'&&s.entitlement.freeAvailable)||(s.nextBatch.kind==='paid'&&s.entitlement.paidPacksAvailable>0))}
export class LiveGift {
 private value:SessionView|null=null;private epoch=0;
 readonly mockups=new Map<string,MockupView>();
 constructor(readonly api:GiftBackend,readonly id:string){}
 clear(){this.epoch++;this.value=null;this.mockups.clear()}
 get session(){return this.value?structuredClone(this.value):null}
 accept(s:SessionView){assertSession(s);if(s.sessionId!==this.id)throw new GiftApiError('session_identity_mismatch',0);this.epoch++;this.value=structuredClone(s);this.mockups.clear()}
 async restore(signal?:AbortSignal){const n=++this.epoch;this.value=null;this.mockups.clear();const s=await this.api.restore(this.id,signal);if(n===this.epoch)this.accept(s)}
 async mockup(lineId:string,signal?:AbortSignal){
  const s=this.session,n=this.epoch;
  if(!s||!purchased(s))throw new GiftApiError('order_payment_required',0);
  const line=s.lines.find(l=>l.lineId===lineId),c=s.compositions.find(c=>c.lineId===lineId&&c.productId===line?.productId&&c.sourceArtworkId===s.artworkPreviewId&&c.compositionId&&['ready','approved'].includes(c.status));
  if(!line||!c?.compositionId)throw new GiftApiError('composition_not_found',0);
  const m=await this.api.mockup(this.id,lineId,c.compositionId,signal);
  const current=this.value?.compositions.find(x=>x.lineId===lineId);
  if(n!==this.epoch||current?.compositionId!==m.compositionId||this.value?.artworkPreviewId!==m.sourceArtworkId||m.productId!==line.productId||m.attempt!==c.attempt||m.sku!==c.sku)throw new GiftApiError('stale_composition',409);
  this.mockups.set(lineId,m);return m;
 }
}
