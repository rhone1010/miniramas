// store/stripe.ts
// lib/store/stripe.ts
//
// Singleton Stripe client. The pinned api version is what Stripe assigns
// when the secret key is created; we let the SDK default rather than
// pinning here, so an account-level upgrade doesn't break us.

import Stripe from 'stripe'

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  cached = new Stripe(key, { typescript: true })
  return cached
}

export function getAppUrl(): string {
  const url = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
  if (!url) throw new Error('APP_URL is not set')
  return url.replace(/\/$/, '')
}
