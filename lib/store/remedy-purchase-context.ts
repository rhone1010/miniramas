import { supabaseAdmin as db } from '@/lib/supabase'
import { getStripe } from './stripe'
import { AllocationReview, craftShare, paidUnlockShare, collectionSetShare, type RemedyShare } from './remedy-allocation'

async function read(query: any) {
  const { data, error } = await query
  if (error) throw new AllocationReview('purchase_context_unavailable')
  return data
}

// Read-only. Proves the original payment against its recorded Checkout session.
// The amount comes from captured cash, not today's catalog or displayed price.
export async function readRemedyPayment(userId: string, purchaseId: string) {
  const purchase = await read(db.from('purchases')
    .select('id,user_id,sku_id,status,stripe_session_id,stripe_charge_id,amount_cents')
    .eq('id', purchaseId).eq('user_id', userId).maybeSingle())
  if (!purchase || !['paid','refunded'].includes(purchase.status)) throw new AllocationReview('verified_payment_missing')
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(purchase.stripe_session_id)
  const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!piId || session.payment_status !== 'paid' || session.currency !== 'usd') throw new AllocationReview('verified_payment_missing')
  const intent = await stripe.paymentIntents.retrieve(piId)
  const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id
  if (!chargeId) throw new AllocationReview('verified_charge_missing')
  const charge = await stripe.charges.retrieve(chargeId)
  const storedCharge = purchase.stripe_charge_id
  if ((storedCharge && storedCharge !== piId && storedCharge !== chargeId) ||
      !charge.paid || !charge.captured || charge.disputed || charge.currency !== 'usd' ||
      charge.amount_captured !== session.amount_total || charge.amount_refunded > charge.amount_captured ||
      charge.amount_captured > purchase.amount_cents) throw new AllocationReview('payment_needs_reconciliation')
  return { purchase, purchaseId, chargeId, paymentIntentId: piId, paidCents: charge.amount_captured,
    remainingCents: charge.amount_captured - charge.amount_refunded, refundedCents: charge.amount_refunded,
    identityTokens: [typeof charge.customer==='string'?`stripe_customer:${charge.customer}`:null,
      charge.payment_method_details?.card?.fingerprint?`stripe_card:${charge.payment_method_details.card.fingerprint}`:null].filter(Boolean) as string[] }
}

// Every join is owner-scoped. A legacy piece without an exact purchase linkage
// remains review-only; neither dates nor similar prices are purchase evidence.
export async function readArtworkRefundShares(userId: string, artworkId: string, portfolioId: string) {
  const portfolio = await read(db.from('portfolios').select('id,user_id,purchase_id,size,composition')
    .eq('id', portfolioId).eq('user_id', userId).maybeSingle())
  const item = portfolio && await read(db.from('portfolio_items').select('slot,status,preview_id')
    .eq('portfolio_id', portfolioId).eq('preview_id', artworkId).maybeSingle())
  if (!portfolio || !item || item.status !== 'done') throw new AllocationReview('artwork_not_found')
  if (portfolio.composition?.remedy?.case_id) throw new AllocationReview('replacement_requires_case_review')
  const payments = new Map<string, Awaited<ReturnType<typeof readRemedyPayment>>>()
  async function payment(id: string) {
    if (!payments.has(id)) payments.set(id, await readRemedyPayment(userId, id))
    return payments.get(id)!
  }
  const craft = await payment(portfolio.purchase_id)
  const shares: RemedyShare[] = [craftShare(craft.purchaseId, craft.paidCents, portfolio.id, portfolio.size, item.slot)]
  const sets = await read(db.from('collection_unlock_sets').select('attempt_id,purchase_id,preview_ids,quantity,fulfilled_at')
    .eq('user_id', userId).contains('preview_ids', [artworkId]))
  const setPurchases = new Set<string>()
  for (const set of sets || []) {
    if (!set.fulfilled_at) continue
    if (set.quantity !== set.preview_ids.length) throw new AllocationReview('set_needs_reconciliation')
    const paid = await payment(set.purchase_id)
    shares.push(collectionSetShare(paid.purchaseId, paid.paidCents, set.attempt_id, artworkId, set.preview_ids))
    setPurchases.add(set.purchase_id)
  }
  const consumed = await read(db.from('entitlements').select('id,purchase_id,locked_style')
    .eq('user_id', userId).eq('locked_variant', artworkId).eq('status', 'consumed'))
  for (const entitlement of consumed || []) {
    // Unlock All also has a consumed entitlement. Its snapshot is the only
    // allocation basis; counting that entitlement again would double its value.
    if (setPurchases.has(entitlement.purchase_id)) continue
    const origin = await read(db.from('portfolios').select('id')
      .eq('user_id', userId).eq('purchase_id', entitlement.purchase_id).limit(1).maybeSingle())
    if (origin) continue // Included in a craft payment, even across collections.
    if (!['discovery_unlock_credit','discovery_unlock'].includes(entitlement.locked_style)) {
      throw new AllocationReview('unlock_origin_needs_reconciliation')
    }
    const paid = await payment(entitlement.purchase_id)
    const all = await read(db.from('entitlements').select('id,locked_style')
      .eq('user_id', userId).eq('purchase_id', entitlement.purchase_id))
    const expected = entitlement.locked_style === 'discovery_unlock' ? 1 :
      ({discovery_unlock_1:1,discovery_unlock_3:3,discovery_unlock_5:5,discovery_unlock_10:10} as Record<string,number>)[paid.purchase.sku_id]
    if (!expected || all.length !== expected || all.some((e: any) => e.locked_style !== entitlement.locked_style)) {
      throw new AllocationReview('unlock_quantity_needs_reconciliation')
    }
    shares.push(paidUnlockShare(paid.purchaseId, paid.paidCents, entitlement.id, all.map((e: any) => e.id)))
  }
  return { artworkId, portfolioId, shares, payments: [...payments.values()] }
}
