// lib/v1/gift/orders.ts
//
// PURCHASE BEFORE GENERATION: the Gift Wizard checkout and the verified payment confirmation.
//
// The customer pays for their chosen physical products first. The order is a normal Print Shop order (print_orders, the same
// Stripe client, the same Prodigi shipping quote) in the new 'awaiting_artwork' state, so the existing fulfilment pipeline
// cannot see it until the customer has approved their artwork. Nothing personalised is generated until payment is verified
// with Stripe; nothing is sent to the lab until the customer approves.
//
// Prices, SKUs, attributes and quantities come from the canonical catalog and the saved session lines, never from the browser,
// and are frozen on the order (print_orders.items + gift_order_lines).

import type Stripe from 'stripe'
import { createBrandedSession } from '@/lib/store/stripe-branding'
import { allProducts } from '../print/catalog'
import { planFor } from './composition-plan'
import type { PrintOrderItem, ShippingAddress } from '../print/db'
import type { QuoteRequest, QuoteResponse } from '../print/prodigi-client'
import type { PrintFinish, PrintSize } from '../print/sku-map'
import { GiftError, owned, type GiftDeps } from './service'
import { StoreError, type GiftStore, type OrderInfo } from './store'
import { giftRenderId, parseGiftRenderId } from './order-kind'
import { GIFT_RETURN_PATHS, type Disclosure, type GiftCheckoutRequest, type GiftCheckoutResponse } from './types'

export const GIFT_ORDER_KIND = 'gift_order'

/** Shown before payment, passed to Stripe Checkout as its submit message, and recorded by version when the customer accepts. */
export const DISCLOSURE: Disclosure = {
  version: '2026-10-16-1',
  text: 'Your artwork is personalized and is created after you pay. You will review six previews, and a second six at no additional cost, ' +
    'then choose one artwork and approve how it looks on each product. Nothing is printed or manufactured until you approve. ' +
    'If you are not satisfied after reviewing your included previews, you may request a full refund of your purchase through Concierge.',
}

export interface PrintOrdersPort {
  create(i: {
    stripeSessionId: string; ownerKey: string; customerEmail: string; shippingAddress: ShippingAddress; items: PrintOrderItem[]
    retailSubtotalCents: number; retailShippingCents: number; retailTotalCents: number; shippingMethod: string; prodigiMerchantRef: string
  }): Promise<{ id: string }>
  replaceStripeSession(orderId: string, stripeSessionId: string): Promise<void>
}

export interface GiftOrderDeps {
  store: GiftStore
  stripe: Stripe
  printOrders: PrintOrdersPort
  quote(req: QuoteRequest): Promise<QuoteResponse>
  /** The account must be cleared for fulfilment (the same gate the Print Shop applies); a sale that cannot be fulfilled is refused up front. */
  canFulfil(ownerKey: string): Promise<boolean>
  /** Preview only: Stripe test mode and the Prodigi sandbox must be in force. Throws when they are not. */
  requireSandbox?: () => void
  publishableKey: string | undefined
  now?: () => number
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const orderReturnUrl = (origin: string, returnPath: unknown): string => {
  if (typeof returnPath !== 'string' || !(GIFT_RETURN_PATHS as readonly string[]).includes(returnPath)) throw new GiftError('checkout_unavailable')
  return `${origin}${returnPath}?gift_order_session={CHECKOUT_SESSION_ID}`
}

export async function createGiftCheckout(
  deps: GiftOrderDeps & { gift: GiftDeps },
  input: { user: { id: string }; sessionId: string; origin: string; body: Partial<GiftCheckoutRequest> },
): Promise<GiftCheckoutResponse> {
  const rec = await owned(deps.gift, input.user.id, input.sessionId)
  const b = input.body
  if (b.disclosureAccepted !== true) throw new GiftError('disclosure_required')
  if (typeof b.email !== 'string' || !EMAIL.test(b.email)) throw new GiftError('invalid_email')
  const a = b.shippingAddress
  if (!a || !['name', 'line1', 'city', 'postcode'].every(k => typeof (a as any)[k] === 'string' && (a as any)[k].trim()) || !/^[A-Za-z]{2}$/.test(a.countryCode ?? '')) throw new GiftError('invalid_address')
  const shippingMethod = (['Budget', 'Standard', 'Express', 'Overnight'] as const).includes(b.shippingMethod as any) ? b.shippingMethod! : 'Budget'
  const returnUrl = orderReturnUrl(input.origin, b.returnPath)
  const address: ShippingAddress = { name: a.name.trim(), line1: a.line1.trim(), line2: a.line2?.trim() || undefined, city: a.city.trim(), state: a.state?.trim() || undefined, postcode: a.postcode.trim(), countryCode: a.countryCode.toUpperCase() }

  // An order that is already paid is never sold twice; an open, unpaid one is reused.
  const existing = rec.order_id ? await deps.store.getOrder(rec.order_id) : null
  if (existing?.paid_at && existing.status !== 'created') throw new GiftError('order_already_paid')

  if (!rec.lines.length) throw new GiftError('no_lines')
  if (deps.requireSandbox) { try { deps.requireSandbox() } catch { throw new GiftError('checkout_unavailable') } }
  if (!(await deps.canFulfil(input.user.id))) throw new GiftError('fulfilment_unavailable')

  // Server-owned lines: catalog price, SKU and attributes. A product the artwork this session makes cannot fit is refused now.
  const catalog = new Map(allProducts().map(p => [p.productId, p]))
  const planCtx = { series: rec.series!, peopleCount: rec.analysis.peopleCount ?? null, masterAspect: rec.master_aspect ?? '1:1' }
  const lines = rec.lines.map(l => {
    const p = catalog.get(l.productId)
    if (!p || p.status !== 'launch' || p.retailCents === null) throw new GiftError('product_not_available')
    // Mixed shapes are normal (a 12 x 18 print with an 8 x 8 canvas). A product is refused only when NO bounded way exists to make
    // its shape: neither the artwork's own shape nor any aspect ratio the series can generate gets within the 20% extension limit.
    if (!planFor(p, planCtx)) throw new GiftError('product_not_available_for_artwork')
    return { line: l, product: p }
  })
  const itemsCents = lines.reduce((n, x) => n + x.product.retailCents! * x.line.copies, 0)

  let shippingCents: number
  try {
    const q = await deps.quote({
      shippingMethod, destinationCountryCode: address.countryCode, currencyCode: 'USD',
      items: lines.map(x => ({ sku: x.product.sku, copies: x.line.copies, attributes: x.product.attributes, assets: [{ printArea: 'default' }] })),
    })
    const first = q.quotes[0]
    if (!first) throw new Error('empty quote')
    shippingCents = Math.round(parseFloat(first.costSummary.shipping.amount) * 100)
    if (!Number.isFinite(shippingCents) || shippingCents < 0) throw new Error('bad shipping amount')
  } catch { throw new GiftError('shipping_quote_failed') }
  const totalCents = itemsCents + shippingCents
  const totals = { itemsCents, shippingCents, totalCents }

  // Reuse the open Stripe session of an unpaid order.
  if (existing && existing.status === 'created') {
    const prior = await deps.stripe.checkout.sessions.retrieve(existing.stripe_session_id).catch(() => null)
    if (prior && prior.status === 'open' && prior.client_secret && existing.retail_total_cents === totalCents && deps.publishableKey) {
      return { clientSecret: prior.client_secret, stripeSessionId: prior.id, publishableKey: deps.publishableKey, totals, disclosure: DISCLOSURE }
    }
  }
  if (!deps.publishableKey) throw new GiftError('checkout_unavailable')

  const merchantRef = `gift-${(deps.now ?? Date.now)()}-${rec.id.slice(0, 8)}`
  const session = await createBrandedSession(deps.stripe, {
    mode: 'payment', ui_mode: 'embedded', redirect_on_completion: 'if_required', return_url: returnUrl, customer_email: b.email,
    line_items: [
      ...lines.map(x => ({ quantity: x.line.copies, price_data: { currency: 'usd', unit_amount: x.product.retailCents!, product_data: { name: `${x.product.familyLabel} ${x.product.label}`, description: x.product.note } } })),
      ...(shippingCents > 0 ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: shippingCents, product_data: { name: `Shipping (${shippingMethod})` } } }] : []),
    ],
    custom_text: { submit: { message: DISCLOSURE.text } },
    metadata: { kind: GIFT_ORDER_KIND, giftSessionId: rec.id, userId: input.user.id, merchant_ref: merchantRef, disclosure: DISCLOSURE.version },
  })
  if (!session.client_secret || session.status !== 'open') throw new GiftError('checkout_unavailable')

  try {
    if (existing) {
      await deps.printOrders.replaceStripeSession(existing.id, session.id)
    } else {
      const items: PrintOrderItem[] = lines.map(x => ({
        renderId: giftRenderId(rec.id, x.line.lineId), renderUrl: '', size: x.product.size as PrintSize, finish: x.product.family as PrintFinish,
        copies: x.line.copies, sku: x.product.sku, retailCents: x.product.retailCents!,
      }))
      const order = await deps.printOrders.create({
        stripeSessionId: session.id, ownerKey: input.user.id, customerEmail: b.email, shippingAddress: address, items,
        retailSubtotalCents: itemsCents, retailShippingCents: shippingCents, retailTotalCents: totalCents, shippingMethod, prodigiMerchantRef: merchantRef,
      })
      await deps.store.linkOrder(rec.id, input.user.id, order.id, DISCLOSURE.version)
    }
  } catch (e) {
    if (e instanceof StoreError) throw new GiftError(e.code as any)
    console.error('[gift/checkout] order persistence failed:', e instanceof Error ? e.message : e, 'stripe=', session.id)
    throw new GiftError('order_persist_failed')
  }
  return { clientSecret: session.client_secret, stripeSessionId: session.id, publishableKey: deps.publishableKey, totals, disclosure: DISCLOSURE }
}

/**
 * Payment verification. Retrieves the session FROM STRIPE and checks the kind, owner, the order and session it belongs to, the
 * mode, currency, paid status, the total against the stored order, and every line item against the frozen order lines. Only then
 * does the database function move the order to 'awaiting_artwork' and grant the two free batches. Idempotent: the webhook,
 * Stripe retries and the browser's confirm call can arrive in any order and the result is the same.
 * `expectedUserId` is set for a browser confirm; the webhook passes none.
 */
export async function confirmGiftOrder(deps: { stripe: Stripe; store: GiftStore }, stripeSessionId: string, expectedUserId?: string): Promise<{ confirmed: boolean; sessionId?: string; userId?: string }> {
  if (typeof stripeSessionId !== 'string' || !/^cs_[\w]{8,200}$/.test(stripeSessionId)) throw new GiftError('order_not_found')
  const session = await deps.stripe.checkout.sessions.retrieve(stripeSessionId)
  const m = session.metadata ?? {}
  if (m.kind !== GIFT_ORDER_KIND || !m.giftSessionId || !m.userId) throw new GiftError('order_not_found')
  if (expectedUserId && m.userId !== expectedUserId) throw new GiftError('order_not_found')            // never reveal another customer's order
  const rec = await deps.store.getSession(m.giftSessionId, m.userId)
  const order = await deps.store.orderByStripeSession(session.id)
  if (!rec || !order || rec.order_id !== order.id) throw new GiftError('order_not_found')

  if (session.mode !== 'payment' || session.currency !== 'usd' || session.amount_total !== order.retail_total_cents) throw new GiftError('payment_not_confirmed')
  if (session.payment_status !== 'paid') return { confirmed: false, sessionId: rec.id, userId: rec.user_id }
  const items = await deps.stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })
  const expected = [...order.items.map(i => i.retailCents * i.copies), ...(order.retail_shipping_cents > 0 ? [order.retail_shipping_cents] : [])].sort((x, y) => x - y)
  const actual = items.data.map(l => l.amount_total).sort((x, y) => x - y)
  if (items.has_more || expected.length !== actual.length || expected.some((v, i) => v !== actual[i])) throw new GiftError('payment_not_confirmed')
  const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!intent) throw new GiftError('payment_not_confirmed')

  const lines = order.items.map(i => {
    const p = parseGiftRenderId(i.renderId)
    const line = p && rec.lines.find(l => l.lineId === p.lineId)
    if (!line) throw new GiftError('payment_not_confirmed')
    return { lineId: line.lineId, productId: line.productId, sku: i.sku, copies: i.copies }
  })
  try { await deps.store.confirmOrder({ sessionId: rec.id, orderId: order.id, userId: rec.user_id, stripeSessionId: session.id, paymentIntent: intent, lines }) }
  catch (e) { if (e instanceof StoreError) throw new GiftError(e.code as any); throw e }
  return { confirmed: true, sessionId: rec.id, userId: rec.user_id }
}

/**
 * Re-verification at fulfilment time (hours or days after payment), mirroring retry.ts's checks for sandbox orders but for the
 * gift kind and, in production, live mode: paid, the right amount, the intent succeeded, nothing refunded, disputed or pending refund.
 */
export async function verifyGiftPayment(stripe: Stripe, order: Pick<OrderInfo, 'stripe_session_id' | 'stripe_payment_intent' | 'retail_total_cents' | 'paid_at'>, opts: { testModeOnly: boolean }): Promise<void> {
  if (!order.paid_at || !order.stripe_payment_intent) throw new Error('gift_unpaid')
  const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id)
  const intent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent, { expand: ['latest_charge'] })
  const charge = intent.latest_charge
  if (opts.testModeOnly && (session.livemode || intent.livemode)) throw new Error('gift_payment_not_test_mode')
  if (session.metadata?.kind !== GIFT_ORDER_KIND || session.status !== 'complete' || session.payment_status !== 'paid' || session.payment_intent !== order.stripe_payment_intent ||
      intent.status !== 'succeeded' || intent.currency !== 'usd' || intent.amount_received !== order.retail_total_cents || session.amount_total !== order.retail_total_cents) throw new Error('gift_payment_not_confirmed')
  if (!charge || typeof charge === 'string' || !charge.paid || charge.refunded || charge.amount_refunded > 0 || charge.disputed) throw new Error('gift_charge_ineligible')
  const refunds = await stripe.refunds.list({ payment_intent: intent.id, limit: 100 })
  if (refunds.has_more || refunds.data.some(r => r.status !== 'failed' && r.status !== 'canceled')) throw new Error('gift_refunded')
}

/** The database-side gate for a gift order about to be queued or placed: a refund request or refund stops it. */
export async function giftOrderRecheck(store: GiftStore, orderId: string): Promise<void> {
  const s = await store.sessionForOrder(orderId)
  if (!s) return
  if (s.refunded_at) throw new Error('order_refunded')
  if (s.refund_requested_at) throw new Error('refund_pending')
  if (!s.approved_at) throw new Error('artwork_not_approved')
}
