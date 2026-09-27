import {beforeEach,expect,it,vi} from 'vitest'
const h=vi.hoisted(()=>({rows:[] as any[],rpc:vi.fn(),source:vi.fn(),evidence:vi.fn(),context:vi.fn()}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{rpc:h.rpc,from:(table:string)=>{
 const filters:any[]=[];const run=()=>({data:(table==='support_messages'?h.rows:[]).filter(r=>filters.every(f=>f(r))),error:null})
 const q:any={select:()=>q,eq:(k:string,v:any)=>{filters.push((r:any)=>r[k]===v);return q},in:()=>q,not:()=>q,
 maybeSingle:async()=>({...run(),data:run().data[0]||null}),then:(a:any,b:any)=>Promise.resolve(run()).then(a,b)};return q
}}}))
vi.mock('../remedy-evidence',()=>({readRemedySource:h.source,reviewRemedyEvidence:h.evidence,hashRemedyIdentity:(v:string)=>`hashed:${v}`}))
vi.mock('../remedy-purchase-context',()=>({readArtworkRefundShares:h.context}))
vi.mock('../stripe',()=>({getStripe:()=>{throw new Error('No money calls in authorization')}}))
import {authorizeRemedyCase,readRemedyCase,customerRemedyCase} from '../remedy-case-execution'
beforeEach(()=>{
 vi.clearAllMocks()
 h.rows=[{id:'case',user_id:'owner',case_number:42,context:{case:{kind:'make_it_right',scope:'artwork',requested_remedy:'refund',artwork:{id:'art',kind:'portfolio',portfolioId:'portfolio'}}}}]
 h.source.mockResolvedValue({sourceHash:'source',portfolio:{series:'portraits'}})
 h.evidence.mockResolvedValue({classification:'likely_failure'})
 h.context.mockResolvedValue({shares:[{purchaseId:'purchase',key:'craft:portfolio:0',component:'craft',cents:125}],
 payments:[{purchaseId:'purchase',paidCents:499,remainingCents:499,refundedCents:0,chargeId:'ch_paid',identityTokens:[]}]})
 h.rpc.mockResolvedValue({data:h.rows[0],error:null})
})
it('rejects access to another customer case before any policy or payment lookup',async()=>{
 await expect(readRemedyCase('other','case')).rejects.toThrow('case_missing')
 expect(h.context).not.toHaveBeenCalled();expect(h.rpc).not.toHaveBeenCalled()
})
it('authorizes only the actual allocation and stores the exact reservation snapshot',async()=>{
 await authorizeRemedyCase({id:'owner',email:'owner@example.test'},'case')
 const [name,args]=h.rpc.mock.calls[0];expect(name).toBe('authorize_make_it_right_case')
 expect(args.p_decision).toMatchObject({remedy:'refund',amountCents:125,source_hash:'source',refund_allocations:[{purchaseId:'purchase',key:'craft:portfolio:0',cents:125,eligibleCents:125,paidCents:499,remainingCents:499,chargeId:'ch_paid'}]})
 expect(h.evidence).not.toHaveBeenCalled()
})
it('batch evidence cannot authorize cash and contact does not require Stripe',async()=>{
 h.rows[0].context.case.scope='batch';await authorizeRemedyCase({id:'owner'},'case')
 expect(h.rpc.mock.calls[0][1].p_decision).toMatchObject({remedy:'review',amountCents:0,refund_allocations:[]})
 expect(h.evidence).toHaveBeenCalled();expect(h.context).not.toHaveBeenCalled()
 h.rows[0].context.case.scope='artwork';h.rows[0].context.case.requested_remedy='contact';h.rpc.mockClear()
 await authorizeRemedyCase({id:'owner'},'case');expect(h.rpc.mock.calls[0][1].p_decision.remedy).toBe('contact')
 expect(h.context).not.toHaveBeenCalled()
})
it('customer projection excludes payment identities, model evidence and allocation internals',()=>{
 Object.assign(h.rows[0].context.case,{identity_keys:['secret'],source_hash:'secret',evidence:{reason:'internal'},refund_allocations:[{chargeId:'ch_secret'}]})
 const result=customerRemedyCase(h.rows[0]);expect(result.caseNumber).toBe(42)
 expect(JSON.stringify(result)).not.toMatch(/secret|identity_keys|source_hash|refund_allocations|evidence/)
})
it('explains the completed Case 3 amount without disclosing transaction identifiers',()=>{
 Object.assign(h.rows[0].context.case,{status:'resolved',authorized_remedy:'refund',authorized_amount_cents:424,
  refund_allocations:[{component:'craft',key:'craft:private:2',eligibleCents:125,purchaseId:'private'},{component:'unlock',key:'unlock:private',eligibleCents:299,chargeId:'private'}]})
 const result=customerRemedyCase(h.rows[0])
 expect(result.refundBreakdown).toEqual([{label:'Craft value',amountCents:125},{label:'Unlock',amountCents:299}])
 expect(JSON.stringify(result)).not.toContain('private')
})
it('labels Unlock All separately and omits a free included unlock',()=>{
 Object.assign(h.rows[0].context.case,{status:'resolved',authorized_remedy:'refund',authorized_amount_cents:125,
  refund_allocations:[{component:'craft',key:'craft:private:0',eligibleCents:125}]})
 expect(customerRemedyCase(h.rows[0]).refundBreakdown).toEqual([{label:'Craft value',amountCents:125}])
 h.rows[0].context.case.authorized_amount_cents=304
 h.rows[0].context.case.refund_allocations.push({component:'unlock',key:'set:private',eligibleCents:179})
 expect(customerRemedyCase(h.rows[0]).refundBreakdown[1]).toEqual({label:'Unlock All',amountCents:179})
})
it('does not present pending or inconsistent allocations as refunded',()=>{
 Object.assign(h.rows[0].context.case,{status:'executing',authorized_remedy:'refund',authorized_amount_cents:125,
  refund_allocations:[{component:'craft',eligibleCents:125}]})
 expect(customerRemedyCase(h.rows[0]).refundBreakdown).toEqual([])
 h.rows[0].context.case.status='resolved';h.rows[0].context.case.authorized_amount_cents=126
 expect(customerRemedyCase(h.rows[0]).refundBreakdown).toEqual([])
})
