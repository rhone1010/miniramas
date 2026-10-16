// lib/v1/gift/pack.ts
//
// The $2.99 six-preview pack. Reuses the existing Stripe client and branded embedded checkout (lib/store/stripe.ts,
// stripe-branding.ts), the same shape as the digital-unlock checkout. It is a SEPARATE product from the Discovery unlock
// (discovery_unlock_1 is also $2.99 but is a different thing and is untouched): the price is inline price_data, so no
// Stripe dashboard setup is needed and no existing price is reused.
//
// PAYMENT IS NEVER TRUSTED FROM THE BROWSER. A pack row is written only by fulfillPack(), which retrieves the session
// FROM STRIPE and verifies the kind, owner, amount, currency, mode, paid status and the single line item before calling
// the migration's gift_fulfill_preview_pack. It is idempotent on the Stripe session id: the webhook, a retry and the
// browser's confirm call can all arrive, in any order, and only one pack results.

import type Stripe from 'stripe'
import { createBrandedSession } from '@/lib/store/stripe-branding'
import type { GiftStore } from './store'
import { BATCH_SIZE, PACK_CURRENCY, PACK_KIND, PACK_PRICE_CENTS } from './policy'
import { GIFT_RETURN_PATHS } from './types'

export class PackError extends Error { constructor(public code: 'invalid_return_path' | 'pack_payment_unavailable' | 'pack_payment_mismatch' | 'pack_purchase_not_found') { super(code) } }

export function packReturnUrl(origin: string, returnPath: unknown): string {
  if (typeof returnPath !== 'string' || !(GIFT_RETURN_PATHS as readonly string[]).includes(returnPath)) throw new PackError('invalid_return_path')
  return `${origin}${returnPath}?gift_pack_session={CHECKOUT_SESSION_ID}`
}

export async function createPackCheckout(stripe: Stripe, userId: string, returnUrl: string) {
  const session = await createBrandedSession(stripe, {
    mode: 'payment', ui_mode: 'embedded', redirect_on_completion: 'if_required', return_url: returnUrl, client_reference_id: userId,
    line_items: [{
      quantity: 1,
      price_data: { currency: PACK_CURRENCY, unit_amount: PACK_PRICE_CENTS, product_data: { name: `${BATCH_SIZE} more previews`, description: 'Six additional watermarked previews for your Gift Wizard session' } },
    }],
    metadata: { kind: PACK_KIND, userId },
  })
  if (!session.client_secret || session.status !== 'open') throw new PackError('pack_payment_unavailable')
  return { clientSecret: session.client_secret, stripeSessionId: session.id, amountCents: PACK_PRICE_CENTS as 299 }
}

/** Verified fulfilment. `expectedUserId` is set when a signed-in browser asks to confirm; the webhook passes none. */
export async function fulfillPack(deps: { stripe: Stripe; store: GiftStore }, sessionId: string, expectedUserId?: string): Promise<{ confirmed: boolean; paidPacksAvailable: number }> {
  if (typeof sessionId !== 'string' || !/^cs_[\w]{8,200}$/.test(sessionId)) throw new PackError('pack_purchase_not_found')
  const session = await deps.stripe.checkout.sessions.retrieve(sessionId)
  const userId = session.metadata?.userId
  if (session.metadata?.kind !== PACK_KIND || !userId) throw new PackError('pack_purchase_not_found')
  if (expectedUserId && userId !== expectedUserId) throw new PackError('pack_purchase_not_found')       // never reveal another user's purchase
  if (session.mode !== 'payment' || session.currency !== PACK_CURRENCY || session.amount_total !== PACK_PRICE_CENTS) throw new PackError('pack_payment_mismatch')
  if (session.payment_status !== 'paid') return { confirmed: false, paidPacksAvailable: await deps.store.paidPackCount(userId) }
  const lines = await deps.stripe.checkout.sessions.listLineItems(session.id, { limit: 2 })
  if (lines.has_more || lines.data.length !== 1 || lines.data[0].quantity !== 1 || lines.data[0].amount_total !== PACK_PRICE_CENTS) throw new PackError('pack_payment_mismatch')
  await deps.store.fulfillPack(userId, session.id, PACK_PRICE_CENTS)
  return { confirmed: true, paidPacksAvailable: await deps.store.paidPackCount(userId) }
}
