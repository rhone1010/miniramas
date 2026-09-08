// lib/store/internal-auth.ts
//
// Shared-secret check for endpoints only ever called by Vercel Cron or by
// this deployment itself — never by a browser.
//
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on every scheduled
// invocation when a CRON_SECRET environment variable is set on the project.
// That is the documented way to keep a cron path from being triggered by
// anyone who knows the URL, and it is what both /portfolios/items/render-poll
// and /portfolios/items/render check.
//
// This is a verifier, not a header builder. internal-fetch.ts's
// internalHeaders() is the outbound half of a self-call (it adds Vercel's
// deployment-protection bypass); this is the inbound half, and the two are
// unrelated mechanisms that happen to serve the same journey.
//
// UNSET IS A REFUSAL, NOT A PASS. Both callers return 503 when CRON_SECRET is
// absent rather than running open, matching how the Stripe webhook treats a
// missing STRIPE_WEBHOOK_SECRET (webhooks/stripe/route.ts:26-30). These routes
// start paid image generation; an unconfigured deployment must not be a
// deployment that anyone on the internet can bill.

export type InternalAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string }

export function checkInternalAuth(req: Request): InternalAuthResult {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[internal-auth] CRON_SECRET not set — refusing the request')
    return { ok: false, status: 503, error: 'internal_auth_not_configured' }
  }

  const header = req.headers.get('authorization') || ''
  const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  if (!presented || !timingSafeEqual(presented, secret)) {
    return { ok: false, status: 401, error: 'unauthorized' }
  }

  return { ok: true }
}

/* Constant-time compare, so a caller cannot learn the secret one byte at a
   time from how long the comparison took. Length is compared first and leaks
   only the length, which is not the secret. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
