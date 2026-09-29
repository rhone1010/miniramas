import {supabaseAdmin as db} from '@/lib/supabase'
import {getStripe} from './stripe-client'
import {canFulfil,getPrintOrderById,type PrintOrderRow} from './db'
import {requireSandboxPrint} from './owned-source'
import {prepareAndPlacePrint,PlacementUncertainError} from './fulfillment'
import {notifyPrintOrder} from './order-email'

/** Read-only payment verification. No Stripe mutation API is used here. */
export async function verifyRetryPayment(order:PrintOrderRow){
 const stripe=getStripe()
 if(!order.paid_at||!order.stripe_payment_intent)throw new Error('retry_unpaid')
 const session=await stripe.checkout.sessions.retrieve(order.stripe_session_id)
 const intent=await stripe.paymentIntents.retrieve(order.stripe_payment_intent,{expand:['latest_charge']})
 const charge=intent.latest_charge
 if(session.livemode||intent.livemode||session.status!=='complete'||session.payment_status!=='paid'||session.payment_intent!==order.stripe_payment_intent||!['catalog_v2','square_8x8'].includes(session.metadata?.print_test||'')||intent.status!=='succeeded'||intent.currency!=='usd'||intent.amount_received!==order.retail_total_cents||session.amount_total!==order.retail_total_cents)throw new Error('retry_payment_not_confirmed')
 if(!charge||typeof charge==='string'||!charge.paid||charge.refunded||charge.amount_refunded>0||charge.disputed)throw new Error('retry_charge_ineligible')
 const refunds=await stripe.refunds.list({payment_intent:intent.id,limit:100})
 if(refunds.has_more||refunds.data.some(r=>r.status!=='failed'&&r.status!=='canceled'))throw new Error('retry_refunded')
}

export async function retryPrintFulfillment(userId:string,orderId:string,retryId:string){
 requireSandboxPrint()
 const order=await getPrintOrderById(orderId)
 if(!order||order.owner_key!==userId||!await canFulfil(userId))throw new Error('retry_not_authorized')
 const prior=await db.from('print_fulfillment_retries').select('order_id,requested_by,status').eq('id',retryId).maybeSingle()
 if(prior.error)throw new Error('retry_ledger_unavailable')
 if(prior.data){if(prior.data.order_id!==orderId||prior.data.requested_by!==userId)throw new Error('retry_not_authorized');return {ok:true,deduped:true,status:prior.data.status}}
 if(order.status!=='error'||order.prodigi_order_id||order.placed_at)throw new Error('retry_ineligible')
 await verifyRetryPayment(order)
 const {data:claim,error}=await db.rpc('claim_print_fulfillment_retry',{p_order:orderId,p_user:userId,p_retry:retryId})
 if(error)throw new Error('retry_claim_refused')
 if(!claim?.claimed)return {ok:true,deduped:true,status:claim?.status}
 const claimed=claim.order as PrintOrderRow
 let result:{status:string;payload:Record<string,string>}
 try{
  const id=await prepareAndPlacePrint(claimed,true,async()=>{
   requireSandboxPrint()
   const current=await getPrintOrderById(orderId)
   if(!current||current.status!=='paid'||current.prodigi_order_id||!await canFulfil(userId))throw new Error('retry_no_longer_eligible')
   await verifyRetryPayment(current)
  })
  result={status:'placed',payload:{prodigi_order_id:id}}
 }catch(e){result={status:e instanceof PlacementUncertainError?'uncertain':'error',payload:{error:e instanceof Error?e.message:'retry_failed'}}}
 const completed=await db.rpc('finish_print_fulfillment_retry',{p_retry:retryId,p_user:userId,p_status:result.status,p_result:result.payload})
 if(completed.error)throw new Error('retry_result_requires_review')
 if(result.status!=='uncertain')await notifyPrintOrder(claimed.stripe_session_id)
 return {ok:result.status==='placed',status:result.status}
}
