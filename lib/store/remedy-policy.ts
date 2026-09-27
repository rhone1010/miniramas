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
}
export type RemedyDecision = {
  remedy: 'redo' | 'refund' | 'source_photo' | 'review' | 'contact'
  source: 'goodwill' | 'evidence_policy' | 'batch_review' | 'integrity_review' | 'customer_contact'
  amountCents: number
  consumeGoodwill: boolean
}

// The vision model cannot set these monetary or repeat-remedy rules.
export function decideRemedy(i: RemedyPolicyInput): RemedyDecision {
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
  if(i.evidence==='source_limitation')return decision('source_photo','evidence_policy')
  if(i.requested==='refund'&&i.evidence==='likely_failure'){
    if(i.paymentVerified&&Number.isSafeInteger(i.eligibleCents)&&i.eligibleCents>0&&i.eligibleCents<=5000)
      return decision('refund','evidence_policy',i.eligibleCents)
    return decision('review','integrity_review')
  }
  return decision('redo','evidence_policy')
}
