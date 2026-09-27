import { expect, it, vi } from 'vitest'
import { executeReservedRefund, type RefundReservation } from '../remedy-refund-execution'
const now=Date.parse('2026-09-26T12:00:00Z')
function fixture(overrides:Partial<RefundReservation>={}) {
 const row:RefundReservation={id:'allocation',support_case_id:'case',user_id:'owner',purchase_id:'purchase',stripe_charge_id:'ch_paid',stripe_refund_id:null,amount_cents:391,refund_status:'submitted',created_at:new Date(now-1000).toISOString(),...overrides}
 const refund={id:'re_1',charge:'ch_paid',amount:391,currency:'usd',status:'succeeded',metadata:{liten_refund_allocation:'allocation',liten_case:'case'}}
 const deps={now:()=>now,claim:vi.fn(async()=>row),record:vi.fn(async(_row:RefundReservation,_result:any,_status:string)=>{}),stripe:{refunds:{list:vi.fn(()=>({async *[Symbol.asyncIterator](){}})),retrieve:vi.fn(async()=>refund),create:vi.fn(async()=>refund)}}}
 return {row,refund,deps}
}
it('uses only the reserved amount and a stable allocation idempotency key',async()=>{
 const {deps}=fixture();expect(await executeReservedRefund('allocation',deps)).toBe('succeeded')
 expect(deps.stripe.refunds.create).toHaveBeenCalledWith({charge:'ch_paid',amount:391,metadata:{liten_refund_allocation:'allocation',liten_case:'case'}},{idempotencyKey:'liten-remedy-refund:allocation'})
})
it('reconciles a lost Stripe response instead of creating another refund',async()=>{
 const {deps,refund}=fixture();deps.stripe.refunds.list.mockImplementation(()=>({async *[Symbol.asyncIterator](){yield refund}}) as any)
 expect(await executeReservedRefund('allocation',deps)).toBe('succeeded');expect(deps.stripe.refunds.create).not.toHaveBeenCalled()
})
it('holds old uncertain reservations beyond the bounded idempotency window',async()=>{
 const {deps}=fixture({created_at:new Date(now-24*60*60*1000).toISOString()})
 expect(await executeReservedRefund('allocation',deps)).toBe('review');expect(deps.stripe.refunds.create).not.toHaveBeenCalled()
})
it('records only matching charge, amount, currency and durable case metadata',async()=>{
 const {deps,refund}=fixture({stripe_refund_id:'re_1'});refund.amount=392
 expect(await executeReservedRefund('allocation',deps)).toBe('review');expect(deps.record.mock.calls[0][2]).toBe('review')
})
it('does not release value after an uncertain transport error or repeat a failed refund',async()=>{
 const {deps}=fixture();deps.stripe.refunds.create.mockRejectedValue(new Error('network'))
 expect(await executeReservedRefund('allocation',deps)).toBe('pending_reconciliation');expect(deps.record).not.toHaveBeenCalled()
 const failed=fixture({refund_status:'failed'});expect(await executeReservedRefund('allocation',failed.deps)).toBe('review');expect(failed.deps.stripe.refunds.create).not.toHaveBeenCalled()
})
it('does not repeat an already successful refund',async()=>{
 const {deps}=fixture({refund_status:'succeeded'});expect(await executeReservedRefund('allocation',deps)).toBe('succeeded');expect(deps.stripe.refunds.list).not.toHaveBeenCalled()
})
