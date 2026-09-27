// Server-only economic allocation. Inputs must come from verified purchase,
// entitlement, portfolio/set snapshots and Stripe, never from a request body.
// This is a quote: the existing refund audit must reserve it atomically before
// any Stripe call. A successful quote is not authorization to issue a refund.
export type RemedyPayment = {
  purchaseId: string
  paidCents: number
  remainingCents: number
  reservedCents: number
  // A prior refund without an artwork allocation cannot safely be guessed.
  unallocatedRefundCents: number
}
export type RemedyShare = {
  purchaseId: string
  key: string
  component: 'craft' | 'unlock'
  cents: number
}
export type RemedyAllocation = RemedyShare & { eligibleCents: number }
export class AllocationReview extends Error {}

function cents(n: number) {
  if (!Number.isSafeInteger(n) || n < 0) throw new AllocationReview('invalid_money')
  return n
}

// Fixed order, integer cents: the first remainder slots receive one cent each.
// Every share of a purchase sums to exactly what was paid, including $7.99/3.
export function proportionalCents(total: number, count: number, index: number) {
  cents(total)
  if (!Number.isSafeInteger(count) || count < 1 ||
      !Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new AllocationReview('invalid_purchase_membership')
  }
  return Math.floor(total / count) + (index < total % count ? 1 : 0)
}

export function craftShare(purchaseId: string, paidCents: number, portfolioId: string, size: number, slot: number): RemedyShare {
  return { purchaseId, key: `craft:${portfolioId}:${slot}`, component: 'craft', cents: proportionalCents(paidCents, size, slot) }
}

export function paidUnlockShare(purchaseId: string, paidCents: number, entitlementId: string, purchasedEntitlementIds: string[]): RemedyShare {
  const ids = [...purchasedEntitlementIds].sort()
  if (new Set(ids).size !== ids.length) throw new AllocationReview('duplicate_entitlement')
  return { purchaseId, key: `unlock:${entitlementId}`, component: 'unlock',
    cents: proportionalCents(paidCents, ids.length, ids.indexOf(entitlementId)) }
}

export function collectionSetShare(purchaseId: string, paidCents: number, attemptId: string, artworkId: string, purchasedSet: string[]): RemedyShare {
  const ids = [...purchasedSet].sort()
  if (new Set(ids).size !== ids.length) throw new AllocationReview('duplicate_set_member')
  return { purchaseId, key: `set:${attemptId}:${artworkId}`, component: 'unlock',
    cents: proportionalCents(paidCents, ids.length, ids.indexOf(artworkId)) }
}

export function includedUnlockShare(): null { return null }

export function allocateSingleArtworkRefund(
  shares: RemedyShare[], payments: RemedyPayment[],
  committedByShare: ReadonlyMap<string, number>,
): { allocations: RemedyAllocation[]; totalCents: number } {
  const byPurchase = new Map(payments.map(p => [p.purchaseId, p]))
  if (byPurchase.size !== payments.length) throw new AllocationReview('duplicate_payment')
  const budget = new Map<string, number>()
  for (const p of payments) {
    cents(p.paidCents); cents(p.remainingCents); cents(p.reservedCents); cents(p.unallocatedRefundCents)
    if (p.remainingCents > p.paidCents || p.unallocatedRefundCents > 0) throw new AllocationReview('payment_needs_reconciliation')
    budget.set(p.purchaseId, Math.max(0, p.remainingCents - p.reservedCents))
  }
  const seen = new Set<string>()
  const allocations: RemedyAllocation[] = []
  // Stable ordering also makes multiple components from one transaction safe.
  for (const share of [...shares].sort((a, b) => a.key.localeCompare(b.key))) {
    if (seen.has(share.key)) throw new AllocationReview('duplicate_allocation')
    seen.add(share.key)
    const payment = byPurchase.get(share.purchaseId)
    if (!payment) throw new AllocationReview('payment_missing')
    const amount = cents(share.cents)
    const committed = cents(committedByShare.get(share.key) ?? 0)
    if (amount > payment.paidCents || committed > amount) throw new AllocationReview('allocation_needs_reconciliation')
    const eligibleCents = Math.min(amount - committed, budget.get(share.purchaseId)!)
    budget.set(share.purchaseId, budget.get(share.purchaseId)! - eligibleCents)
    if (eligibleCents > 0) allocations.push({ ...share, eligibleCents })
  }
  const totalCents = allocations.reduce((sum, a) => sum + a.eligibleCents, 0)
  if (!Number.isSafeInteger(totalCents)) throw new AllocationReview('invalid_money')
  return { allocations, totalCents }
}
