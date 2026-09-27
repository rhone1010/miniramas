import {expect,it} from 'vitest'
import {decideRemedy,type RemedyPolicyInput} from '../remedy-policy'
const base:RemedyPolicyInput={requested:'refund',scope:'artwork',firstGoodwill:true,alreadyRemediedArtwork:false,identityNeedsReview:false,paymentVerified:true,eligibleCents:391,evidence:'uncertain'}
it('honors the first eligible customer choice without a model judgment',()=>{
 expect(decideRemedy(base)).toEqual({remedy:'refund',source:'goodwill',amountCents:391,consumeGoodwill:true})
 expect(decideRemedy({...base,requested:'redo'})).toMatchObject({remedy:'redo',amountCents:0,consumeGoodwill:true})
})
it('enforces the cash ceiling, integer cents and verified paid allocation',()=>{
 for(const eligibleCents of [0,-1,5001,NaN,299.5])expect(decideRemedy({...base,eligibleCents}).remedy).toBe('review')
 expect(decideRemedy({...base,eligibleCents:5000}).amountCents).toBe(5000)
 expect(decideRemedy({...base,paymentVerified:false}).remedy).toBe('review')
})
it('does not manufacture a batch refund from first-remedy eligibility',()=>{
 expect(decideRemedy({...base,scope:'batch'})).toEqual({remedy:'review',source:'batch_review',amountCents:0,consumeGoodwill:false})
})
it('holds repeat artwork and uncertain related identities for review',()=>{
 expect(decideRemedy({...base,alreadyRemediedArtwork:true}).remedy).toBe('review')
 expect(decideRemedy({...base,identityNeedsReview:true}).remedy).toBe('review')
})
it('uses subsequent evidence for the approved remedy outcomes',()=>{
 expect(decideRemedy({...base,firstGoodwill:false,evidence:'likely_failure'})).toMatchObject({remedy:'refund',amountCents:391,consumeGoodwill:false})
 expect(decideRemedy({...base,firstGoodwill:false,evidence:'source_limitation'}).remedy).toBe('source_photo')
 expect(decideRemedy({...base,firstGoodwill:false,evidence:'meets_effect'}).remedy).toBe('redo')
 expect(decideRemedy({...base,firstGoodwill:false,evidence:'uncertain'}).remedy).toBe('redo')
})
it('does not consume goodwill when the customer asks to talk',()=>{
 expect(decideRemedy({...base,requested:'contact'})).toMatchObject({remedy:'contact',consumeGoodwill:false,amountCents:0})
})
