import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, sessions: {} as Record<string, any>, charges: {} as Record<string, any>, stripe: {} as any }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (table: string) => {
  const filters: ((r:any)=>boolean)[]=[]
  const run=()=>({data:(h.tables[table]||[]).filter(r=>filters.every(f=>f(r))),error:null})
  const q:any={select:()=>q,limit:()=>q,eq:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q},
    contains:(k:string,v:any[])=>{filters.push(r=>v.every(x=>r[k].includes(x)));return q},
    maybeSingle:async()=>{const r=run();return {...r,data:r.data.length===1?r.data[0]:null,error:r.data.length>1?{message:'multiple'}:null}},
    then:(a:any,b:any)=>Promise.resolve(run()).then(a,b)}
  return q
} } }))
vi.mock('../stripe',()=>({getStripe:()=>h.stripe}))
import { readArtworkRefundShares, readRemedyPayment } from '../remedy-purchase-context'

function pay(id:string,sku:string,total:number,actual=total) {
  h.tables.purchases.push({id,user_id:'owner',sku_id:sku,status:'paid',stripe_session_id:`cs_${id}`,stripe_charge_id:`pi_${id}`,amount_cents:total})
  h.sessions[`cs_${id}`]={payment_intent:`pi_${id}`,payment_status:'paid',currency:'usd',amount_total:actual}
  h.charges[`ch_${id}`]={paid:true,captured:true,disputed:false,currency:'usd',amount_captured:actual,amount_refunded:0}
}
beforeEach(()=>{
  h.tables={purchases:[],portfolios:[{id:'portfolio',user_id:'owner',purchase_id:'craft',size:4}],
    portfolio_items:[{portfolio_id:'portfolio',preview_id:'art',slot:0,status:'done'}],collection_unlock_sets:[],entitlements:[]}
  h.sessions={};h.charges={}
  h.stripe={checkout:{sessions:{retrieve:vi.fn(async(id:string)=>h.sessions[id])}},
    paymentIntents:{retrieve:vi.fn(async(id:string)=>({latest_charge:id.replace('pi_','ch_')}))},
    charges:{retrieve:vi.fn(async(id:string)=>h.charges[id])},refunds:{create:vi.fn()}}
  pay('craft','basket_discover_5',499)
})
it('reads the actual payment and stable craft quantity without issuing a refund',async()=>{
  h.sessions.cs_craft.amount_total=399;h.charges.ch_craft.amount_captured=399
  const c=await readArtworkRefundShares('owner','art','portfolio')
  expect(c.shares).toEqual([{purchaseId:'craft',key:'craft:portfolio:0',component:'craft',cents:100}])
  expect(h.stripe.refunds.create).not.toHaveBeenCalled()
})
it('verifies owner and completed artwork before Stripe lookup',async()=>{
  await expect(readArtworkRefundShares('other','art','portfolio')).rejects.toThrow('artwork_not_found')
  h.tables.portfolio_items[0].status='pending'
  await expect(readArtworkRefundShares('owner','art','portfolio')).rejects.toThrow('artwork_not_found')
  expect(h.stripe.checkout.sessions.retrieve).not.toHaveBeenCalled()
})
it('attributes a wallet unit from the original purchase and entire entitlement set',async()=>{
  pay('wallet','discovery_unlock_3',799)
  h.tables.entitlements=['a','b','c'].map(id=>({id,user_id:'owner',purchase_id:'wallet',locked_style:'discovery_unlock_credit',locked_variant:id==='b'?'art':null,status:id==='b'?'consumed':'available'}))
  const c=await readArtworkRefundShares('owner','art','portfolio')
  expect(c.shares[1].cents).toBe(266)
  h.tables.entitlements.pop()
  await expect(readArtworkRefundShares('owner','art','portfolio')).rejects.toThrow('unlock_quantity_needs_reconciliation')
})
it('does not double count Unlock All and its consumed entitlement',async()=>{
  pay('all','unlock_addon_1',1790)
  const ids=['art',...Array.from({length:9},(_,i)=>`other-${i}`)]
  h.tables.collection_unlock_sets=[{attempt_id:'attempt',user_id:'owner',purchase_id:'all',quantity:10,preview_ids:ids,fulfilled_at:'now'}]
  h.tables.entitlements=[{id:'ent',user_id:'owner',purchase_id:'all',locked_style:'discovery_unlock_set',locked_variant:'art',status:'consumed'}]
  const c=await readArtworkRefundShares('owner','art','portfolio')
  expect(c.shares).toHaveLength(2);expect(c.shares[1].cents).toBe(179)
})
it('treats included unlocks from another portfolio as zero additional cash',async()=>{
  h.tables.portfolios.push({id:'origin',user_id:'owner',purchase_id:'included',size:16})
  h.tables.entitlements=[{id:'ent',user_id:'owner',purchase_id:'included',locked_style:'portrait_unlock',locked_variant:'art',status:'consumed'}]
  expect((await readArtworkRefundShares('owner','art','portfolio')).shares).toHaveLength(1)
  expect(h.stripe.checkout.sessions.retrieve).toHaveBeenCalledTimes(1)
})
it('verifies the recorded charge and rejects disputed or mismatched payment',async()=>{
  h.tables.purchases[0].stripe_charge_id='pi_other'
  await expect(readRemedyPayment('owner','craft')).rejects.toThrow('payment_needs_reconciliation')
  h.tables.purchases[0].stripe_charge_id='pi_craft';h.charges.ch_craft.disputed=true
  await expect(readRemedyPayment('owner','craft')).rejects.toThrow('payment_needs_reconciliation')
})
it('carries Stripe remaining cash without substituting the catalog total',async()=>{
  h.charges.ch_craft.amount_refunded=400
  const p=await readRemedyPayment('owner','craft')
  expect(p.paidCents).toBe(499);expect(p.remainingCents).toBe(99)
})
