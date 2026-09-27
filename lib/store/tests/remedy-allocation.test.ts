import { expect, it } from 'vitest'
import { allocateSingleArtworkRefund, proportionalCents, craftShare, paidUnlockShare, collectionSetShare, includedUnlockShare } from '../remedy-allocation'

const payment = (purchaseId: string, paidCents: number, remainingCents = paidCents, reservedCents = 0) =>
  ({ purchaseId, paidCents, remainingCents, reservedCents, unallocatedRefundCents: 0 })
it('conserves every paid cent across each approved craft and wallet size', () => {
  for (const [total, count] of [[299,1],[499,4],[799,8],[1299,16],[799,3],[1299,5],[1999,10]]) {
    const shares = Array.from({length:count},(_,i)=>proportionalCents(total,count,i))
    expect(shares.reduce((a,b)=>a+b,0)).toBe(total)
    expect(Math.max(...shares)-Math.min(...shares)).toBeLessThanOrEqual(1)
  }
})
it('combines actual craft share and consumed wallet unit, not catalog display price', () => {
  const shares=[craftShare('craft',499,'portfolio',4,0),paidUnlockShare('wallet',799,'b',['c','a','b'])]
  const quote=allocateSingleArtworkRefund(shares,[payment('craft',499),payment('wallet',799)],new Map())
  expect(quote.totalCents).toBe(125+266)
  expect(quote.allocations.map(a=>a.purchaseId)).toEqual(['craft','wallet'])
})
it('adds no cash value for included/free unlocks, even when they cross collections', () => {
  expect(includedUnlockShare()).toBeNull()
  expect(allocateSingleArtworkRefund([craftShare('craft',1299,'p',16,15)],[payment('craft',1299)],new Map()).totalCents).toBe(81)
})
it('allocates Unlock All only over its persisted purchased set', () => {
  const set=Array.from({length:16},(_,i)=>String(i).padStart(2,'0'))
  const shares=set.map(id=>collectionSetShare('set',2864,'attempt',id,set))
  expect(shares.reduce((sum,a)=>sum+a.cents,0)).toBe(2864)
  expect(shares.every(a=>a.cents===179)).toBe(true)
  expect(()=>collectionSetShare('set',2864,'attempt','later-artwork',set)).toThrow('invalid_purchase_membership')
})
it('caps each original transaction independently without borrowing another balance', () => {
  const shares=[craftShare('craft',499,'p',4,0),paidUnlockShare('wallet',799,'b',['a','b','c'])]
  const quote=allocateSingleArtworkRefund(shares,[payment('craft',499,20),payment('wallet',799,250,100)],new Map())
  expect(quote.allocations.map(a=>a.eligibleCents)).toEqual([20,150])
  expect(quote.totalCents).toBe(170)
})
it('excludes already committed economic value, including pending reservations', () => {
  const share=paidUnlockShare('wallet',799,'b',['a','b','c'])
  expect(allocateSingleArtworkRefund([share],[payment('wallet',799)],new Map([[share.key,266]])).totalCents).toBe(0)
  expect(allocateSingleArtworkRefund([share],[payment('wallet',799)],new Map([[share.key,200]])).totalCents).toBe(66)
})
it('shares one remaining transaction budget across its component allocations', () => {
  const shares=[craftShare('p',499,'portfolio',4,0),{purchaseId:'p',key:'unlock:e',component:'unlock' as const,cents:299}]
  expect(allocateSingleArtworkRefund(shares,[payment('p',499,150)],new Map()).totalCents).toBe(150)
})
it('requires reconciliation for a prior refund with no attributable artwork allocation', () => {
  expect(()=>allocateSingleArtworkRefund([craftShare('p',499,'x',4,0)],[{...payment('p',499,399),unallocatedRefundCents:100}],new Map())).toThrow('payment_needs_reconciliation')
})
it('rejects duplicate/forged membership and invalid monetary inputs', () => {
  expect(()=>paidUnlockShare('p',799,'a',['a','a','b'])).toThrow()
  expect(()=>paidUnlockShare('p',799,'x',['a','b','c'])).toThrow()
  expect(()=>proportionalCents(2.99,3,0)).toThrow()
  expect(()=>proportionalCents(-1,3,0)).toThrow()
  const share=craftShare('p',499,'x',4,0)
  expect(()=>allocateSingleArtworkRefund([share,share],[payment('p',499)],new Map())).toThrow('duplicate_allocation')
  expect(()=>allocateSingleArtworkRefund([share],[],new Map())).toThrow('payment_missing')
})
