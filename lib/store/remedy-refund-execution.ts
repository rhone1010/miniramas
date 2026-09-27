// A reservation is the durable authority. No request/model amount reaches Stripe.
// Retries reconcile the original audit row; they never mint a second allocation.
export type RefundReservation = {
  id: string; support_case_id: string; user_id: string; purchase_id: string
  stripe_charge_id: string; stripe_refund_id: string | null
  amount_cents: number; refund_status: string; created_at: string
}
export type RefundResult = { id: string; charge: string | { id: string }; amount: number; currency: string; status: string | null; metadata?: Record<string,string> }
type ExecutionDependencies = {
  stripe: any
  // SQL verifies case/owner/allocation and returns its current immutable row.
  claim: (id:string) => Promise<RefundReservation>
  record: (row:RefundReservation,result:RefundResult|null,status:'submitted'|'succeeded'|'failed'|'review') => Promise<void>
  now?: () => number
}
function matches(row:RefundReservation,r:RefundResult) {
  return (typeof r.charge==='string'?r.charge:r.charge?.id)===row.stripe_charge_id &&
    r.amount===row.amount_cents && r.currency==='usd' &&
    r.metadata?.liten_refund_allocation===row.id && r.metadata?.liten_case===row.support_case_id
}
export async function executeReservedRefund(id:string,deps:ExecutionDependencies) {
  const row=await deps.claim(id)
  if(!row||!Number.isSafeInteger(row.amount_cents)||row.amount_cents<=0||row.amount_cents>5000)
    throw new Error('invalid_refund_reservation')
  if(row.refund_status==='succeeded')return 'succeeded'
  if(['failed','review'].includes(row.refund_status))return 'review'
  let refund:RefundResult|null=null
  try {
    if(row.stripe_refund_id)refund=await deps.stripe.refunds.retrieve(row.stripe_refund_id)
    else {
      // A response may have been lost after Stripe accepted it. Pagination is
      // intentional: absence from the first page is not proof of no refund.
      for await(const result of deps.stripe.refunds.list({charge:row.stripe_charge_id,limit:100})) {
        if(result.metadata?.liten_refund_allocation===row.id){
          if(refund){await deps.record(row,null,'review');return 'review'}
          refund=result
        }
      }
      if(!refund){
        const age=(deps.now?.()??Date.now())-Date.parse(row.created_at)
        // Stripe may discard idempotency keys after 24h. Uncertain older work
        // remains held, even when a list read finds no result.
        if(!Number.isFinite(age)||age<0||age>=23*60*60*1000){
          await deps.record(row,null,'review');return 'review'
        }
        refund=await deps.stripe.refunds.create({charge:row.stripe_charge_id,amount:row.amount_cents,
          metadata:{liten_refund_allocation:row.id,liten_case:row.support_case_id}},
          {idempotencyKey:`liten-remedy-refund:${row.id}`})
      }
    }
    if(!refund||!matches(row,refund)){await deps.record(row,null,'review');return 'review'}
    const status=refund.status==='succeeded'?'succeeded':
      ['failed','canceled'].includes(refund.status||'')?'failed':'submitted'
    await deps.record(row,refund,status)
    return status
  } catch {
    // Keep the reservation and its original idempotency key. A transport error
    // is not evidence that Stripe did not move money.
    return 'pending_reconciliation'
  }
}
