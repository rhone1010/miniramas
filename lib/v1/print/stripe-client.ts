// lib/v1/print/stripe-client.ts
//
// Thin Stripe SDK wrapper. Lazy-init so import doesn't crash without env.
//
// Required env vars:
//   STRIPE_SECRET_KEY        (sk_test_* in dev, sk_live_* in prod)
//   STRIPE_WEBHOOK_SECRET    (whsec_* — from Stripe CLI or dashboard endpoint)

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY in env')
  _stripe = new Stripe(key, {
    // Pin to a recent stable API version. SDK enforces forward compat.
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  })
  return _stripe
}
