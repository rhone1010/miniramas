// lib/v1/gift/refund.ts
//
// REFUNDS. The approved policy (previews come BEFORE purchase: the first twelve are free): after purchasing physical products a customer
// may request a full refund of that purchase through Concierge until the order is submitted to the print partner (Prodigi). Once
// submitted, that pre-production eligibility ends. Eligibility does not depend on the previews. The request goes to Concierge
// (the existing support_messages record); nothing is manufactured while it is open; the refund itself is issued by a person in Stripe, and
// this system only RECORDS it after verifying it with Stripe. Both halves are idempotent. No refund is ever automatic. Pack purchases
// ($2.99 per six previews) are separate payments and are not part of this refund.
//
//   request   POST .../refund-request   -> gift_request_refund (migration 048) + one Concierge message keyed by the request id.
//                                          While open, selection, composition, approval, generation and release to fulfilment all refuse.
//   decline   Concierge decides no      -> declineRefund(): the customer continues.
//   refund    Stripe `charge.refunded`  -> applyVerifiedRefunds(): re-reads the charge and its refunds FROM STRIPE, then
//                                          gift_apply_refund once per Stripe refund id. A full refund of an order not yet placed with the
//                                          lab cancels it and releases the session for cleanup. A refund after placement is flagged for a person.

import type Stripe from 'stripe'
import { GiftError, fromStoreError, owned, type GiftDeps } from './service'
import type { GiftStore } from './store'
import type { RefundRequestResponse } from './types'

export interface ConciergePort {
  /** One Concierge record. Idempotent on `id`: a repeat is a no-op. */
  create(row: { id: string; user_id: string | null; reply_to: string; subject: string; body: string; context: Record<string, unknown> }): Promise<void>
}

/** The customer-facing statement of the policy. Intended as the last paragraph of the purchase disclosure (disclosure 2026-10-18-2) and for wherever refunds are explained. */
export const REFUND_POLICY_TEXT =
  'After purchasing physical gifts, you may request a full refund through Concierge until your order is submitted to our print partner. Once submitted, the order is no longer eligible for this refund.\n\nAdditional artwork preview packs are separate purchases and are not included in physical-product refunds.'

export const REFUND_CUSTOMER_MESSAGE =
  'Your refund request has been sent to Concierge. Nothing will be printed or manufactured while it is reviewed, and you will hear from us by email.'

export async function requestRefund(deps: GiftDeps & { concierge: ConciergePort }, userId: string, sessionId: string, reason: unknown): Promise<RefundRequestResponse> {
  const rec = await owned(deps, userId, sessionId)
  if (!rec.order_id) throw new GiftError('order_not_paid')
  const why = typeof reason === 'string' ? reason.trim().slice(0, 1000) : ''
  let requestId: string
  try { requestId = await deps.store.requestRefund({ sessionId: rec.id, userId, reason: why }) } catch (e) { fromStoreError(e) }
  const order = await deps.store.getOrder(rec.order_id)
  const batches = await deps.store.listBatches(rec.id)
  const ref = order?.prodigi_merchant_ref || rec.order_id
  await deps.concierge.create({
    id: requestId, user_id: userId, reply_to: order?.customer_email ?? '',
    subject: `Gift Wizard refund request: order ${ref}`,
    body: `The customer asks for a full refund of the physical-product purchase, order ${ref} ($${((order?.retail_total_cents ?? 0) / 100).toFixed(2)}).` +
      ' Policy: a full refund may be requested until the order is submitted to the print partner; this order has not been submitted.' +
      ` The first twelve previews are free and came before the purchase (preview batches generated: ${batches.length}).${why ? ` Their words: ${why}` : ''}` +
      ' Nothing has been sent to the print lab and nothing will be while this is open. A full refund is issued in Stripe by a person and then recorded automatically after Stripe verifies it.',
    context: { kind: 'gift_refund_request', request_id: requestId, order_id: rec.order_id, session_id: rec.id, total_cents: order?.retail_total_cents ?? null, batches: batches.length },
  })
  return { requestId, state: 'requested', message: REFUND_CUSTOMER_MESSAGE }
}

/** Concierge declines the request: the customer continues. (Called by a person's tooling; there is no customer route.) */
export const declineRefund = (store: GiftStore, orderId: string) => store.declineRefund(orderId)

/**
 * A Stripe `charge.refunded` event. The event is only a pointer: the charge and every refund are re-read from Stripe, and only
 * SUCCEEDED refunds count. Safe to receive repeatedly and out of order: each Stripe refund id is applied once.
 */
export async function applyVerifiedRefunds(deps: { stripe: Stripe; store: GiftStore }, charge: { id: string; payment_intent?: string | { id: string } | null }): Promise<Array<{ refundId: string; result: string }>> {
  const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!intentId) return []
  const order = await deps.store.orderByPaymentIntent(intentId)
  if (!order || !(await deps.store.sessionForOrder(order.id))) return []                 // not a gift order: the Print Shop's own handling applies
  const verified = await deps.stripe.charges.retrieve(charge.id)
  const verifiedIntent = typeof verified.payment_intent === 'string' ? verified.payment_intent : verified.payment_intent?.id
  if (verifiedIntent !== intentId) return []
  const list = await deps.stripe.refunds.list({ payment_intent: intentId, limit: 100 })
  const succeeded = list.data.filter(r => r.status === 'succeeded').sort((a, b) => a.created - b.created)
  const out: Array<{ refundId: string; result: string }> = []
  let cumulative = 0
  for (const r of succeeded) {
    cumulative += r.amount
    out.push({ refundId: r.id, result: await deps.store.applyRefund({ orderId: order.id, refundId: r.id, amountCents: r.amount, full: cumulative >= order.retail_total_cents }) })
  }
  return out
}
