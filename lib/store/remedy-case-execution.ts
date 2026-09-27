import { supabaseAdmin as db } from '@/lib/supabase'
import { allocateSingleArtworkRefund, AllocationReview } from './remedy-allocation'
import { readArtworkRefundShares } from './remedy-purchase-context'
import { decideRemedy } from './remedy-policy'
import { readRemedySource, reviewRemedyEvidence, hashRemedyIdentity } from './remedy-evidence'
import { executeReservedRefund } from './remedy-refund-execution'
import { getStripe } from './stripe'

async function read(query:any) {
 const {data,error}=await query
 if(error)throw new Error('case_execution_unavailable')
 return data
}
const rpc=(name:string,args:any)=>read(db.rpc(name,args))
export async function readRemedyCase(userId:string,caseId:string) {
 const row=await read(db.from('support_messages').select('id,user_id,reply_to,body,case_number,context,created_at')
  .eq('id',caseId).eq('user_id',userId).maybeSingle())
 if(!row||row.context?.case?.kind!=='make_it_right')throw new Error('case_missing')
 return row
}
export async function authorizeRemedyCase(user:{id:string,email?:string|null},caseId:string) {
 const row=await readRemedyCase(user.id,caseId), c=row.context.case
 if(c.authorized_remedy)return row
 if(c.requested_remedy==='contact')return rpc('authorize_make_it_right_case',{p_case:caseId,p_user:user.id,
  p_decision:{remedy:'contact',amountCents:0,identity_keys:[`user:${user.id}`],source_hash:null,
   evidence:null,refund_allocations:[]}})
 const priorRows=await read(db.from('support_messages').select('id,context').eq('user_id',user.id))
 const prior=(priorRows||[]).filter((r:any)=>r.id!==caseId&&r.context?.case?.kind==='make_it_right').map((r:any)=>r.context.case)
 const firstGoodwill=!prior.some((p:any)=>p.goodwill_consumed)
 const source=await readRemedySource(user.id,c.artwork)
 let evidence:any={classification:'uncertain',reason:'First goodwill remedy',sourceHash:source?.sourceHash||null}
 if(!firstGoodwill||c.scope==='batch')evidence=await reviewRemedyEvidence(user.id,c,row.body,prior)
 const identityKeys=[`user:${user.id}`]
 if(user.email)identityKeys.push(`email:${hashRemedyIdentity(user.email.trim().toLowerCase())}`)
 if(c.scope==='batch')return rpc('authorize_make_it_right_case',{p_case:caseId,p_user:user.id,
  p_decision:{remedy:'review',amountCents:0,identity_keys:identityKeys,source_hash:source?.sourceHash||null,
   evidence,refund_allocations:[]}})
 let eligibleCents=0, paymentVerified=false, allocations:any[]=[]
 // Both choices inspect the payment relationship to prevent another identity
 // resetting first-goodwill eligibility. Failure is review, never guessed cash.
 try {
  if(c.artwork.kind!=='portfolio')throw new AllocationReview('legacy_requires_review')
  const context=await readArtworkRefundShares(user.id,c.artwork.id,c.artwork.portfolioId)
  context.payments.forEach(p=>p.identityTokens.forEach(t=>identityKeys.push(`payment:${hashRemedyIdentity(t)}`)))
  const audit=await read(db.from('refund_log').select('purchase_id,allocation_key,amount_cents,refund_status')
   .in('purchase_id',context.payments.map(p=>p.purchaseId)).not('support_case_id','is',null))
  const committed=new Map<string,number>()
  for(const r of audit||[])committed.set(r.allocation_key,(committed.get(r.allocation_key)||0)+r.amount_cents)
  const payments=context.payments.map(p=>{
   const rows=(audit||[]).filter((r:any)=>r.purchase_id===p.purchaseId)
   const confirmed=rows.filter((r:any)=>r.refund_status==='succeeded').reduce((n:number,r:any)=>n+r.amount_cents,0)
   if(confirmed>p.refundedCents)throw new AllocationReview('stripe_audit_mismatch')
   return {...p,reservedCents:rows.filter((r:any)=>r.refund_status!=='succeeded').reduce((n:number,r:any)=>n+r.amount_cents,0),
    unallocatedRefundCents:p.refundedCents-confirmed}
  })
  const quote=allocateSingleArtworkRefund(context.shares,payments,committed)
  eligibleCents=quote.totalCents;paymentVerified=true
  allocations=quote.allocations.map(a=>{const p=context.payments.find(p=>p.purchaseId===a.purchaseId)!
   return {...a,paidCents:p.paidCents,remainingCents:p.remainingCents,chargeId:p.chargeId}})
 }catch(e){if(!(e instanceof AllocationReview))throw e}
 const decision=decideRemedy({requested:c.requested_remedy,scope:c.scope,firstGoodwill,
  alreadyRemediedArtwork:prior.some((p:any)=>p.artwork?.id===c.artwork.id&&['redo','refund','source_photo'].includes(p.authorized_remedy)),
  identityNeedsReview:!paymentVerified||!source?.sourceHash||!!source?.portfolio?.composition?.remedy?.case_id||
   (c.requested_remedy==='redo'&&!['portraits','pets'].includes(source?.portfolio?.series)),
  paymentVerified,eligibleCents,evidence:evidence.classification})
 return rpc('authorize_make_it_right_case',{p_case:caseId,p_user:user.id,p_decision:{...decision,
  identity_keys:[...new Set(identityKeys)],source_hash:source?.sourceHash||null,evidence,
  refund_allocations:decision.remedy==='refund'?allocations:[]}})
}

export async function executeRemedyCase(userId:string,caseId:string) {
 const row=await readRemedyCase(userId,caseId), c=row.context.case
 if(['resolved','reviewing'].includes(c.status))return row
 if(c.authorized_remedy==='refund'){
  // Re-entry uses precisely the authorized snapshot, including original Stripe
  // remaining amount. The reservation RPC recognizes its own existing rows.
  const reservations=await rpc('reserve_make_it_right_refund',{p_case:caseId,p_user:userId,p_allocations:c.refund_allocations})
  for(const reservation of reservations){
   const result=await executeReservedRefund(reservation.id,{stripe:getStripe(),
    claim:id=>rpc('claim_make_it_right_refund',{p_id:id,p_case:caseId,p_user:userId}),
    record:(r,result,status)=>rpc('record_make_it_right_refund',{p_id:r.id,p_case:caseId,p_user:userId,
     p_result:result?{...result,charge:typeof result.charge==='string'?result.charge:result.charge.id}:null,p_status:status}).then(()=>{})})
   // Do not send a second component while the preceding result is uncertain.
   if(result!=='succeeded')break
  }
 }else if(c.authorized_remedy==='redo'){
  await rpc('start_make_it_right_redo',{p_case:caseId,p_user:userId})
 }
 return rpc('refresh_make_it_right_case',{p_case:caseId,p_user:userId})
}

// Customer projection: payment fingerprints, source hashes, evidence reasons,
// allocation keys and Stripe IDs never leave the server.
function refundBreakdown(c:any) {
 if(c.status!=='resolved'||c.authorized_remedy!=='refund'||!Array.isArray(c.refund_allocations))return []
 const totals=new Map<string,number>()
 for(const a of c.refund_allocations){
  if(!['craft','unlock'].includes(a.component)||!Number.isSafeInteger(a.eligibleCents)||a.eligibleCents<=0)return []
  const label=a.component==='craft'?'Craft value':String(a.key).startsWith('set:')?'Unlock All':'Unlock'
  totals.set(label,(totals.get(label)||0)+a.eligibleCents)
 }
 if([...totals.values()].reduce((sum,n)=>sum+n,0)!==c.authorized_amount_cents)return []
 return [...totals].map(([label,amountCents])=>({label,amountCents}))
}
export function customerRemedyCase(row:any) {
 const c=row.context.case
 return {id:row.id,caseNumber:row.case_number,artwork:c.artwork,issue:c.issue,requested_remedy:c.requested_remedy,
  authorized_remedy:c.authorized_remedy||null,status:c.status||'requested',scope:c.scope||'artwork',
  amountCents:c.authorized_amount_cents||0,refundBreakdown:refundBreakdown(c),created_at:c.created_at||row.created_at,updated_at:c.updated_at,
  replacement:c.replacement?{portfolioId:c.replacement.portfolio_id}:null}
}
