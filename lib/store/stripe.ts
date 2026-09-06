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
  // Vercel auto-sets two domain vars per deployment:
  //   VERCEL_BRANCH_URL  — branch-stable: myapp-git-branch-team.vercel.app
  //   VERCEL_URL         — deployment-specific hash: myapp-abc123-team.vercel.app
  // Prefer VERCEL_BRANCH_URL because Supabase's Redirect URL allowlist
  // uses the branch pattern (miniramas-git-*-litenco.vercel.app/**),
  // and the hash-based VERCEL_URL doesn't match that wildcard.
  // Fall back to VERCEL_URL (still correct for Stripe redirects),
  // then to static APP_URL for local dev.
  const vercel = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
  const url = vercel
    ? `https://${vercel}`
    : process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  if (!url) throw new Error('APP_URL is not set')
  return url.replace(/\/$/, '')
}
