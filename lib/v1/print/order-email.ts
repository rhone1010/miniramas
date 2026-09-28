import {supabaseAdmin as db} from '@/lib/supabase'
import type {PrintOrderRow} from './db'
import {getSku} from './sku-map'

type Kind='paid'|'delayed'|'accepted'|'shipped'|'cancelled'|'refunded'|'studio'
type Refund={id:string;amount:number;paymentMethod?:string}
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const money=(n:number)=>'$'+(n/100).toFixed(2)
export function printEmailKind(o:PrintOrderRow):Kind|null{
 if(!o.paid_at)return null
 if(o.status==='paid')return 'paid'
 if(o.status==='error'||o.status==='withheld')return 'delayed'
 if(o.status==='placed'||o.status==='in_production')return 'accepted'
 if(o.status==='shipped'||o.status==='delivered')return 'shipped'
 if(o.status==='cancelled')return 'cancelled'
 return null
}
export function printEmailContent(o:PrintOrderRow,kind:Kind,origin:string,art:Array<{title:string;url?:string}>,refund?:Refund,studioNotified=false){
 const number=o.prodigi_merchant_ref||o.id
 const view=origin+'/print?print=1&session='+encodeURIComponent(o.stripe_session_id)
 const help=origin+'/help#support'
 const titles={paid:'Payment received',delayed:'Your print order needs attention',accepted:'Accepted by the print lab',shipped:'Your print order has shipped',cancelled:'Your print order has been cancelled',refunded:'Your print refund',studio:'Paid print order needs attention'}
 const message=kind==='paid'?'Payment received. Another email will arrive when your order ships.':
 kind==='delayed'?'Payment was received. Your order has not yet reached the print lab. Please do not reorder. '+(studioNotified?'The studio has been notified and will handle your order.':'Your order needs support. Please contact the studio below.'):
 kind==='accepted'?'Your order has been accepted by the print lab.':
 kind==='shipped'?'Your order has shipped.':kind==='cancelled'?'Your order has been cancelled. Cancellation does not itself confirm a refund.':
 kind==='refunded'?`Refunded: ${money(refund!.amount)}. Returned to ${refund?.paymentMethod||'the original payment method'}. Your payment provider determines when the refund appears.`:
 'Payment received; fulfillment has not reached the print lab. Please review this order. The customer must not reorder.'
 const items=o.items.map((i,n)=>{const e=getSku(i.size,i.finish),label=(i as any).sizeLabel||e.label;return {title:art[n]?.title||'Artwork',url:art[n]?.url,line:`${art[n]?.title||'Artwork'} · ${e.familyLabel} · ${label} · Quantity ${i.copies} · ${money(i.retailCents*i.copies)}`}})
 const a=o.shipping_address,destination=[a.name,a.line1,a.line2,[a.city,a.state,a.postcode].filter(Boolean).join(', '),a.countryCode].filter(Boolean).join('\n')
 const totals=`Subtotal: ${money(o.retail_subtotal_cents)}\nShipping: ${money(o.retail_shipping_cents)}\nTax: ${money(Math.max(0,o.retail_total_cents-o.retail_subtotal_cents-o.retail_shipping_cents))}\nTotal paid: ${money(o.retail_total_cents)}`
 const tracking=kind==='shipped'?[o.shipping_carrier,o.tracking_number,o.tracking_url].filter(Boolean).join('\n'):''
 return {subject:`${titles[kind]} · Order ${number}`,text:`${titles[kind]}\nOrder ${number}\n\n${message}\n\n${items.map(i=>i.line).join('\n')}\n\n${totals}\n\nShipping to\n${destination}\n\n${tracking}\nView Order: ${view}\nConcierge / Support: ${help}`,html:`<h1>${esc(titles[kind])}</h1><p>Order ${esc(number)}</p><p>${esc(message)}</p>${items.map(i=>`<div>${i.url?`<img src="${esc(i.url)}" alt="${esc(i.title)}" width="120">`:''}<p>${esc(i.line)}</p></div>`).join('')}<p>${esc(totals).replace(/\n/g,'<br>')}</p><p>Shipping to<br>${esc(destination).replace(/\n/g,'<br>')}</p><p>${esc(tracking).replace(/\n/g,'<br>')}</p><p><a href="${esc(view)}">View Order</a> · <a href="${esc(help)}">Concierge / Support</a></p>`}
}

async function deliver(o:PrintOrderRow,kind:Kind,eventKey:string,to:string,content:ReturnType<typeof printEmailContent>){
 const key=process.env.RESEND_API_KEY
 if(!key||!to)throw new Error('print_email_unconfigured')
 const payload={from:process.env.SUPPORT_FROM_EMAIL||'Liten & Co <hello@litenco.com>',to:[to],...content}
 const inserted=await db.from('print_order_notifications').insert({order_id:o.id,event_key:eventKey,kind,payload})
 if(inserted.error&&inserted.error.code!=='23505')throw new Error('print_email_record_failed')
 // Only one server can move the persisted notification into sending.
 const {data:claim,error}=await db.from('print_order_notifications').update({status:'sending',attempted_at:new Date().toISOString()}).eq('order_id',o.id).eq('event_key',eventKey).eq('status','pending').select('payload').maybeSingle()
 if(error)throw new Error('print_email_claim_failed')
 if(!claim){const prior=await db.from('print_order_notifications').select('status').eq('order_id',o.id).eq('event_key',eventKey).maybeSingle();return prior.data?.status==='accepted'}
 let status='uncertain',id:string|undefined
 try{
  const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json',authorization:`Bearer ${key}`,'Idempotency-Key':`print/${o.id}/${eventKey}`},body:JSON.stringify(claim.payload)})
  const body=await r.json().catch(()=>null);status=r.ok?'accepted':'failed';if(r.ok)id=body?.id
 }catch{}
 const result=await db.from('print_order_notifications').update({status,completed_at:new Date().toISOString(),provider_message_id:id||null}).eq('order_id',o.id).eq('event_key',eventKey).eq('status','sending')
 if(result.error)throw new Error('print_email_result_failed')
 return status==='accepted'
}

/** Always reads durable order state; never called from browser receipt polling. */
export async function notifyPrintOrder(sessionId:string,refund?:Refund){
 try{
  const {data:o,error}=await db.from('print_orders').select('*').eq('stripe_session_id',sessionId).maybeSingle<PrintOrderRow>()
  if(error||!o)throw new Error('print_email_order_missing')
  const kind=refund?'refunded':printEmailKind(o);if(!kind)return
  if(refund&&(!o.paid_at||!Number.isInteger(refund.amount)||refund.amount<=0||refund.amount>o.retail_total_cents))throw new Error('invalid_print_refund_notification')
  const origin=process.env.VERCEL_ENV==='preview'?'https://miniramas-git-codex-canonical-2026-09-24-litenco.vercel.app':'https://litenco.com'
  const art=await Promise.all(o.items.map(async i=>{
   const item=await db.from('portfolio_items').select('preset').eq('preview_id',i.renderId).maybeSingle()
   const preview=await db.from('preview_ledger').select('storage_path').eq('id',i.renderId).maybeSingle()
   const signed=preview.data?.storage_path?await db.storage.from('previews').createSignedUrl(preview.data.storage_path,604800):null
   return {title:String(item.data?.preset||'Artwork').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()),url:signed?.data?.signedUrl}
  }))
  let studioNotified=false
  if(kind==='delayed')studioNotified=await deliver(o,'studio','studio',process.env.SUPPORT_TO_EMAIL||'',printEmailContent(o,'studio',origin,art)).catch(()=>false)
  await deliver(o,kind,refund?'refund/'+refund.id:kind,o.customer_email,printEmailContent(o,kind,origin,art,refund,studioNotified))
 }catch(e){console.error('[print-email]',e instanceof Error?e.message:'notification_failed')}
}
