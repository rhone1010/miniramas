export type RemedyEvidence = 'likely_failure' | 'source_limitation' | 'meets_effect' | 'uncertain'
export type RemedyRequest = 'redo' | 'refund' | 'contact'
export type RemedyPolicyInput = {
  requested: RemedyRequest
  scope: 'artwork' | 'batch'
  firstGoodwill: boolean
  alreadyRemediedArtwork: boolean
  identityNeedsReview: boolean
  paymentVerified: boolean
  eligibleCents: number
  evidence: RemedyEvidence
  /** False once the source photograph has been deleted under the 60-day retention policy: a redo cannot be run from it, so the customer is asked for a new photograph instead. Default true. */
  sourceRetained?: boolean
}
export type RemedyDecision = {
  remedy: 'redo' | 'refund' | 'source_photo' | 'review' | 'contact'
  source: 'goodwill' | 'evidence_policy' | 'subsequent_review' | 'batch_review' | 'integrity_review' | 'customer_contact'
  amountCents: number
  consumeGoodwill: boolean
}

// The vision model cannot set these monetary or repeat-remedy rules.
export function decideRemedy(i: RemedyPolicyInput): RemedyDecision {
  const d=decideRemedyCore(i)
  return d.remedy==='redo'&&i.sourceRetained===false?{remedy:'source_photo',source:i.firstGoodwill?'goodwill':'evidence_policy',amountCents:0,consumeGoodwill:false}:d
}
function decideRemedyCore(i: RemedyPolicyInput): RemedyDecision {
  const decision=(remedy:RemedyDecision['remedy'],source:RemedyDecision['source'],amountCents=0,consumeGoodwill=false)=>
    ({remedy,source,amountCents,consumeGoodwill})
  if(i.scope==='batch')return decision('review','batch_review')
  if(i.requested==='contact')return decision('contact','customer_contact')
  if(i.alreadyRemediedArtwork||i.identityNeedsReview)return decision('review','integrity_review')
  if(i.firstGoodwill){
    if(i.requested==='redo')return decision('redo','goodwill',0,true)
    if(i.paymentVerified&&Number.isSafeInteger(i.eligibleCents)&&i.eligibleCents>0&&i.eligibleCents<=5000)
      return decision('refund','goodwill',i.eligibleCents,true)
    return decision('review','integrity_review')
  }
  // ONE automatic goodwill refund per customer: every later refund claim is reviewed by a person. Evidence may inform the review; it never pays.
  if(i.requested==='refund')return decision('review','subsequent_review')
  if(i.evidence==='source_limitation')return decision('source_photo','evidence_policy')
  return decision('redo','evidence_policy')
}
