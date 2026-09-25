import type Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { getStripe } from './stripe'
import { createBrandedSession } from './stripe-branding'
import { COLLECTION_UNLOCK_OFFERS } from './collection-unlocks'

export const COLLECTION_SET_KIND = 'collection_unlock_set'
const productId = COLLECTION_UNLOCK_OFFERS[0].product

export async function createCollectionSetCheckout(userId: string, count: number, returnUrl: string) {
  if (!Number.isInteger(count) || count < 10) throw new Error('collection_set_too_small')
  const stripe = getStripe()
  // Reuse the approved single-unlock product, with this offer's per-piece rate.
  // No new catalog product or reusable-credit price is created.
  const product = await stripe.products.retrieve(productId)
  if (product.deleted || !product.active) throw new Error('collection_set_product_unavailable')
  const reserve = async (expired: string | null = null) => {
    const { data, error } = await supabaseAdmin.rpc('reserve_collection_unlock_set', {
      p_user: userId, p_return_url: returnUrl, p_expected_count: count, p_expired: expired,
    })
    if (error || !data) throw new Error('collection_set_reservation_unavailable')
    return data
  }
  let attempt = await reserve()
  let session: Stripe.Checkout.Session | null = attempt.session_id ? await stripe.checkout.sessions.retrieve(attempt.session_id) : null
  if (session?.status === 'expired') {
    attempt = await reserve(attempt.attempt_id)
    session = attempt.session_id ? await stripe.checkout.sessions.retrieve(attempt.session_id) : null
  }
  if (!session) {
    if (Date.now() - Date.parse(attempt.created_at) >= 23 * 60 * 60 * 1000) throw new Error('collection_set_requires_reconciliation')
    session = await createBrandedSession(stripe, attempt.params, { idempotencyKey: `collection-set:${attempt.attempt_id}` })
  }
  if (session.payment_status === 'paid') {
    await fulfillCollectionSet(session.id, userId)
    return { confirmed: true, sessionId: session.id, count: attempt.quantity, priceCents: attempt.amount_cents }
  }
  if (session.status !== 'open' || !session.client_secret) throw new Error('collection_set_payment_not_open')
  const { error } = await supabaseAdmin.rpc('complete_collection_unlock_set', {
    p_attempt: attempt.attempt_id, p_user: userId, p_session: session.id,
  })
  if (error) throw new Error('collection_set_persist_failed')
  return { clientSecret: session.client_secret, sessionId: session.id, count: attempt.quantity, priceCents: attempt.amount_cents }
}

export async function fulfillCollectionSet(sessionId: string, userId?: string) {
  const { data: attempt, error } = await supabaseAdmin.from('collection_unlock_sets')
    .select('attempt_id,user_id,quantity,rate_cents,amount_cents,purchase_id').eq('session_id', sessionId).maybeSingle()
  if (error || !attempt || (userId && attempt.user_id !== userId)) throw new Error('collection_set_not_found')
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.metadata?.kind !== COLLECTION_SET_KIND || session.metadata?.userId !== attempt.user_id ||
    session.metadata?.attemptId !== attempt.attempt_id || session.currency !== 'usd' ||
    session.amount_total !== attempt.amount_cents || attempt.quantity < 10 ||
    attempt.rate_cents !== (attempt.quantity >= 20 ? 159 : 179) ||
    attempt.amount_cents !== attempt.quantity * attempt.rate_cents) throw new Error('collection_set_payment_mismatch')
  if (session.payment_status !== 'paid') return { confirmed: false }
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 })
  const line = lines.data[0]
  const price = line?.price
  const product = typeof price?.product === 'string' ? price.product : price?.product?.id
  if (lines.has_more || lines.data.length !== 1 || line.quantity !== attempt.quantity ||
    product !== productId || price?.currency !== 'usd' || price?.unit_amount !== attempt.rate_cents ||
    price?.type !== 'one_time') throw new Error('collection_set_line_mismatch')
  const charge = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!charge) throw new Error('collection_set_charge_missing')
  const { data, error: fulfillError } = await supabaseAdmin.rpc('fulfill_collection_unlock_set', {
    p_session: session.id, p_charge: charge, p_user: attempt.user_id,
  })
  if (fulfillError || data !== attempt.quantity) throw new Error('collection_set_fulfillment_failed')
  return { confirmed: true, count: data }
}
