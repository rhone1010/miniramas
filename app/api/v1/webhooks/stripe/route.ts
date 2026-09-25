// stripe-webhook-route.ts
// app/api/v1/webhooks/stripe/route.ts
//
// Handles checkout.session.completed, checkout.session.expired, and
// charge.failed events. All entitlement state changes for paid/failed
// purchases happen through confirmPurchase / handlePaymentFailure so
// the logic is shared with any other surface that needs to fire them.
//
// Idempotency: confirmPurchase is a no-op if the purchase row already
// has the same charge id. Stripe retries failed deliveries up to 3
// days; activation failures return 500 so delivery can be retried safely.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { COLLECTION_SET_KIND, fulfillCollectionSet } from '@/lib/store/collection-unlock-set'
import { COLLECTION_UNLOCK_KIND, fulfillCollectionUnlocks } from '@/lib/store/collection-unlocks'
import { getStripe }                         from '@/lib/store/stripe'
import { confirmPurchase, handlePaymentFailure } from '@/lib/store/entitlements'
import { supabaseAdmin }                     from '@/lib/supabase'
import { activatePortfolio }                 from '@/lib/store/portfolio-checkout'
import { activateDiscoveryUnlock }           from '@/lib/store/discovery-unlock'

// Stripe needs the raw body to validate the signature. Disable parsing.
// In Next.js App Router, request.text() returns the raw body as a string —
// no body-parser config required.

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 })
  }

  const rawBody = await req.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-webhook] signature verification failed:', msg)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  // Acknowledge only after fulfillment succeeds.
  try {
    await dispatch(event)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-webhook] dispatch failed:', event.type, event.id, msg)
    return NextResponse.json({ error: 'fulfillment_failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.payment_status !== 'paid') return
      if (session.metadata?.kind === COLLECTION_SET_KIND) {
        await fulfillCollectionSet(session.id)
        return
      }
      if (session.metadata?.kind === COLLECTION_UNLOCK_KIND) {
        await fulfillCollectionUnlocks(session.id)
        return
      }
      const chargeId =
        (typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id) ||
        session.id
      const { purchaseId } = await confirmPurchase({
        stripeSessionId: session.id,
        stripeChargeId:  chargeId,
      })
      await activatePortfolio(purchaseId)
      /* __A4_DISCOVERY_UNLOCK__ An additional $2.99 unlock confirms here.
         The metadata only decides WHICH handler runs; it grants nothing.
         activateDiscoveryUnlock re-reads our own rows and re-verifies
         purchase -> entitlement -> ledger -> portfolio -> owner before it
         makes anything spendable, and its flip is conditional so a
         duplicate delivery changes nothing. */
      if (session.metadata?.kind === 'discovery_unlock') {
        const result = await activateDiscoveryUnlock({ stripeSessionId: session.id })
        if (!result.activated && !['already_available', 'already_consumed'].includes(result.reason ?? '')) {
          throw new Error(`unlock_activation_failed: ${result.reason}`)
        }
      }
      return
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session
      await handlePaymentFailure({
        stripeSessionId: session.id,
        reason:          'session_expired',
      })
      return
    }

    case 'charge.failed': {
      // Less common with Checkout but possible. We need the session id
      // — the charge object exposes the payment_intent which we set
      // above as our stripe_charge_id. Look up the purchase by that.
      const charge = event.data.object as Stripe.Charge
      const intentId = typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id
      if (!intentId) return
      // We don't have the session id directly. Find the purchase by
      // stripe_charge_id (which we set to the payment_intent id), or
      // skip if not found.
      const sessionId = await sessionIdForCharge(intentId)
      if (!sessionId) {
        console.warn('[stripe-webhook] charge.failed: no purchase found for intent', intentId)
        return
      }
      await handlePaymentFailure({
        stripeSessionId: sessionId,
        reason:          charge.failure_message || 'charge_failed',
      })
      return
    }

    default:
      // Ignore everything else.
      return
  }
}

async function sessionIdForCharge(intentId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('purchases')
    .select('stripe_session_id')
    .eq('stripe_charge_id', intentId)
    .maybeSingle()
  if (error) return null
  return data?.stripe_session_id ?? null
}
