import {it,expect,vi,beforeEach} from 'vitest'
vi.mock('@/lib/store/auth',()=>({getUser:async()=>null}))
const s=vi.hoisted(()=>({order:null as any,session:null as any,intent:null as any,refunds:[] as any[],allowed:true,prior:null as any,claimed:false,placed:vi.fn(),notify:vi.fn(),rpc:vi.fn()}))
vi.mock('./db',()=>({getPrintOrderById:async()=>s.order,canFulfil:async()=>s.allowed}))
vi.mock('./owned-source',()=>({requireSandboxPrint:()=>{}}))
vi.mock('./stripe-client',()=>({getStripe:()=>({checkout:{sessions:{retrieve:async()=>s.session}},paymentIntents:{retrieve:async()=>s.intent},refunds:{list:async()=>({data:s.refunds,has_more:false})}})}))
vi.mock('./fulfillment',()=>({prepareAndPlacePrint:s.placed,PlacementUncertainError:class extends Error{}}))
vi.mock('./order-email',()=>({notifyPrintOrder:s.notify}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{rpc:s.rpc,from:()=>{const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:s.prior,error:null})};return q}}}))
import {retryPrintFulfillment} from './retry'
import {PlacementUncertainError} from './fulfillment'
import {POST} from '../../../app/api/v1/print/retry/route'
beforeEach(()=>{
 s.order={id:'order',owner_key:'owner',status:'error',paid_at:'date',stripe_payment_intent:'pi_test',stripe_session_id:'cs_test',retail_total_cents:3585,prodigi_order_id:null,placed_at:null}
 s.session={livemode:false,status:'complete',payment_status:'paid',payment_intent:'pi_test',amount_total:3585,metadata:{print_test:'catalog_v2'}}
 s.intent={id:'pi_test',livemode:false,status:'succeeded',currency:'usd',amount_received:3585,latest_charge:{paid:true,refunded:false,amount_refunded:0,disputed:false}}
 s.refunds=[];s.allowed=true;s.prior=null;s.claimed=false;s.placed.mockReset();s.notify.mockReset();s.rpc.mockReset()
 s.rpc.mockImplementation(async(name,args)=>{if(name==='claim_print_fulfillment_retry'){if(s.claimed)return {data:{claimed:false,status:'running'}};s.claimed=true;s.order={...s.order,status:'paid'};return {data:{claimed:true,order:{...s.order}}}}return {data:null,error:null}})
 s.placed.mockImplementation(async(_o,_sandbox,check)=>{await check();return 'prodigi-test'})
})
it('reuses fulfillment after payment verification and records completion before notification',async()=>{
 expect(await retryPrintFulfillment('owner','order','attempt')).toEqual({ok:true,status:'placed'})
 expect(s.placed).toHaveBeenCalledTimes(1);expect(s.rpc).toHaveBeenCalledWith('finish_print_fulfillment_retry',{p_retry:'attempt',p_user:'owner',p_status:'placed',p_result:{prodigi_order_id:'prodigi-test'}});expect(s.notify).toHaveBeenCalledWith('cs_test')
})
it('refuses another owner and accounts without fulfillment permission',async()=>{
 await expect(retryPrintFulfillment('other','order','attempt')).rejects.toThrow('retry_not_authorized');s.allowed=false
 await expect(retryPrintFulfillment('owner','order','attempt')).rejects.toThrow('retry_not_authorized');expect(s.placed).not.toHaveBeenCalled()
})
for(const status of ['created','cancelled','placed','shipped','paid'])it(`refuses ${status} orders`,async()=>{s.order.status=status;await expect(retryPrintFulfillment('owner','order','attempt')).rejects.toThrow('retry_ineligible');expect(s.rpc).not.toHaveBeenCalled()})
it('refuses absent payment, refund, pending refund, and mismatched totals',async()=>{
 s.order.paid_at=null;await expect(retryPrintFulfillment('owner','order','attempt')).rejects.toThrow('retry_unpaid');s.order.paid_at='date'
 s.intent.latest_charge.amount_refunded=1;await expect(retryPrintFulfillment('owner','order','attempt')).rejects.toThrow('retry_charge_ineligible');s.intent.latest_charge.amount_refunded=0
 s.refunds=[{status:'pending'}];await expect(retryPrintFulfillment('owner','order','attempt')).rejects.toThrow('retry_refunded');s.refunds=[]
 s.intent.amount_received=1;await expect(retryPrintFulfillment('owner','order','attempt')).rejects.toThrow('retry_payment_not_confirmed');expect(s.placed).not.toHaveBeenCalled()
})
it('deduplicates the same durable request without provider work',async()=>{
 s.prior={order_id:'order',requested_by:'owner',status:'placed'};s.order.status='placed'
 expect(await retryPrintFulfillment('owner','order','attempt')).toEqual({ok:true,deduped:true,status:'placed'});expect(s.placed).not.toHaveBeenCalled()
})
it('prevents a second claimant from reaching fulfillment',async()=>{
 s.claimed=true;expect(await retryPrintFulfillment('owner','order','attempt')).toMatchObject({deduped:true,status:'running'});expect(s.placed).not.toHaveBeenCalled()
})
it('records preparation failure as retryable error',async()=>{
 s.placed.mockRejectedValue(new Error('asset_pipeline: failed'))
 expect(await retryPrintFulfillment('owner','order','attempt')).toEqual({ok:false,status:'error'})
 expect(s.rpc).toHaveBeenLastCalledWith('finish_print_fulfillment_retry',expect.objectContaining({p_status:'error'}))
})
it('quarantines uncertain placement and does not send a false result email',async()=>{
 s.placed.mockRejectedValue(new PlacementUncertainError('timeout'))
 expect(await retryPrintFulfillment('owner','order','attempt')).toEqual({ok:false,status:'uncertain'});expect(s.notify).not.toHaveBeenCalled()
})
it('requires same-origin and an authenticated session at the HTTP boundary',async()=>{
 const url='https://miniramas-git-codex-canonical-2026-09-24-litenco.vercel.app/api/v1/print/retry'
 expect((await POST(new Request(url,{method:'POST',headers:{origin:'https://other.test'}}))).status).toBe(403)
 expect((await POST(new Request(url,{method:'POST',headers:{origin:new URL(url).origin}}))).status).toBe(401)
 expect(s.placed).not.toHaveBeenCalled()
})
