import type Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { getStripe } from './stripe'
import { createBrandedSession } from './stripe-branding'

// Approved Production exports: products.csv / prices.csv, supplied by Rich.
// These are reusable unlocks, never generation credits or included allowances.
export const COLLECTION_UNLOCK_KIND = 'collection_unlock_bundle'
export const COLLECTION_UNLOCK_LOCK = 'discovery_unlock_credit'
export const COLLECTION_UNLOCK_OFFERS = [
  { count: 1, cents: 299, sku: 'discovery_unlock_1', product: 'prod_VIC0Ff7OO7nFPj', price: 'price_1UHbcOCWHIffAtyWFDQnDjXS' },
  { count: 3, cents: 799, sku: 'discovery_unlock_3', product: 'prod_VIC1i7JpOxdPKt', price: 'price_1UHbd2CWHIffAtyW1MJLbZze' },
  { count: 5, cents: 1299, sku: 'discovery_unlock_5', product: 'prod_VIC1NXbC8G1t5X', price: 'price_1UHbdeCWHIffAtyWzjKDpaI6' },
  { count: 10, cents: 1999, sku: 'discovery_unlock_10', product: 'prod_VIC2C77alxQgTo', price: 'price_1UHbeNCWHIffAtyWhFIbwhdU' },
] as const

export async function collectionUnlockBalance(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin.from('entitlements')
    .select('id,purchases!inner(status)', { count: 'exact', head: true })
    .eq('user_id', userId).eq('status', 'available')
    .eq('locked_style', COLLECTION_UNLOCK_LOCK).is('locked_variant', null)
    .eq('purchases.status', 'paid')
  if (error || count === null) throw new Error('unlock_balance_unavailable')
  return count
}

export async function createCollectionUnlockCheckout(userId: string, count: number, returnUrl: string) {
  const offer = COLLECTION_UNLOCK_OFFERS.find(o => o.count === count)
  if (!offer) throw new Error('invalid_unlock_quantity')
  const stripe = getStripe()
  const price = await stripe.prices.retrieve(offer.price)
  const product = typeof price.product === 'string' ? price.product : price.product.id
  if (!price.active || price.currency !== 'usd' || price.unit_amount !== offer.cents ||
      product !== offer.product || price.type !== 'one_time') throw new Error('unlock_price_mismatch')
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment', ui_mode: 'embedded', redirect_on_completion: 'if_required', return_url: returnUrl,
    line_items: [{ price: offer.price, quantity: 1 }],
    metadata: { kind: COLLECTION_UNLOCK_KIND, userId, sku: offer.sku },
  }
  const reserve = async (expired: string | null = null) => {
    const { data, error } = await supabaseAdmin.rpc('reserve_collection_unlock_checkout', {
      p_user: userId, p_sku: offer.sku, p_params: params, p_expired: expired,
    })
    if (error || !data) throw new Error('unlock_bundle_reservation_unavailable')
    return data
  }
  let attempt = await reserve()
  let session: Stripe.Checkout.Session | null = attempt.session_id ? await stripe.checkout.sessions.retrieve(attempt.session_id) : null
  if (session?.status === 'expired') {
    attempt = await reserve(attempt.attempt_id)
    session = attempt.session_id ? await stripe.checkout.sessions.retrieve(attempt.session_id) : null
  }
  if (!session) {
    if (Date.now() - Date.parse(attempt.created_at) >= 23 * 60 * 60 * 1000) {
      throw new Error('unlock_checkout_requires_reconciliation')
    }
    session = await createBrandedSession(stripe, attempt.params, {
      idempotencyKey: `collection-unlocks:${attempt.attempt_id}`,
    })
  }
  if (session.status !== 'open' || session.payment_status === 'paid' || !session.client_secret) {
    throw new Error('unlock_payment_not_open')
  }
  const { error } = await supabaseAdmin.rpc('complete_collection_unlock_checkout', {
    p_attempt: attempt.attempt_id, p_user: userId, p_session: session.id,
  })
  if (error) throw new Error('unlock_bundle_persist_failed')
  return { clientSecret: session.client_secret, sessionId: session.id, priceCents: offer.cents }
}

// Both webhook and browser confirmation use this same verified fulfillment.
export async function fulfillCollectionUnlocks(sessionId: string, userId?: string) {
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  const { data: purchase, error } = await supabaseAdmin.from('purchases')
    .select('id,user_id,sku_id,amount_cents').eq('stripe_session_id', sessionId).maybeSingle()
  if (error || !purchase || !purchase.user_id || (userId && purchase.user_id !== userId)) {
    throw new Error('unlock_purchase_not_found')
  }
  const offer = COLLECTION_UNLOCK_OFFERS.find(o => o.sku === purchase.sku_id)
  if (!offer || session.metadata?.kind !== COLLECTION_UNLOCK_KIND ||
      session.metadata?.userId !== purchase.user_id || session.metadata?.sku !== offer.sku ||
      session.amount_total !== offer.cents || purchase.amount_cents !== offer.cents ||
      session.currency !== 'usd') throw new Error('unlock_payment_mismatch')
  if (session.payment_status !== 'paid') return { confirmed: false }
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 })
  if (lines.has_more || lines.data.length !== 1 || lines.data[0].price?.id !== offer.price ||
      lines.data[0].quantity !== 1) throw new Error('unlock_line_item_mismatch')
  const charge = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!charge) throw new Error('unlock_payment_intent_missing')
  const { error: fulfillError } = await supabaseAdmin.rpc('fulfill_collection_unlocks', {
    p_session: session.id, p_charge: charge, p_user: purchase.user_id,
  })
  if (fulfillError) throw new Error('unlock_bundle_fulfillment_failed')
  return { confirmed: true, balance: await collectionUnlockBalance(purchase.user_id) }
}
