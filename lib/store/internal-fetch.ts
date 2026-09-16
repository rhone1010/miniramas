// lib/store/internal-fetch.ts
//
// THE OUTBOUND HALF OF A SELF-CALL. internal-auth.ts's checkInternalAuth() is
// the inbound half; this decides where a self-call goes and what it must carry
// to be let in. The two are unrelated mechanisms that serve the same journey.
//
// WHY THIS EXISTS (Rich, 2026-09-16, from the 4-image purchase).
// Three places ask this deployment to do work by making an HTTP request to
// itself: the dispatch fan-out, the render's call to portraits/generate, and
// the retry. All three used getAppUrl(), which is `APP_URL ||
// NEXT_PUBLIC_APP_URL` and nothing else (stripe.ts:20-24).
//
// On Production that is right: APP_URL is the custom domain, and the project's
// SSO setting is `all_except_custom_domains`, so a self-call walks in.
//
// On Preview it was wrong twice over. The Preview-scoped APP_URL is a fixed
// secret naming an OLD branch deployment, so the call left for a deployment
// that is not the one running -- and every *.vercel.app URL is behind Vercel
// Authentication, so it was refused at the edge before any of our code ran.
// Observed 2026-09-16 22:33:21Z: all four items of one portfolio came back
// `HTTP 401 {"protection":{"vercel_auth_enabled":true,...}}` in 60ms,
// `{"dispatched":4,"rendered":0,"failed":4}`. Nothing was claimed, so the
// recovery cron did the whole portfolio -- three in one tick, the fourth two
// minutes later. That 3+1 is what Rich saw.
//
// So a Preview self-call needs BOTH halves fixed: the right deployment, and a
// way past the wall in front of it.
//
// THE TARGET IS ENVIRONMENT, NEVER INPUT. Both functions read process.env and
// nothing else. No request, query string, header, cookie or body can move a
// self-call somewhere else -- that is the point of keeping this away from the
// route handlers, which all have a Request in scope.

import { getAppUrl } from '@/lib/store/stripe'

/* True when this is a Preview deployment that can name itself. VERCEL_URL is
   the deployment's own unique hostname, so it is the deployment RUNNING THIS
   CODE -- not a branch alias that may have moved on to a newer build. */
function previewSelfUrl(): string | null {
  if (process.env.VERCEL_ENV !== 'preview') return null
  const host = process.env.VERCEL_URL
  return host ? `https://${host}` : null
}

/** Base URL for a request this deployment makes to itself.
 *
 *  Preview   → the current deployment (https://$VERCEL_URL)
 *  Production→ getAppUrl(), i.e. APP_URL — the custom domain, unchanged
 *  Local/dev → getAppUrl(), unchanged
 *
 *  A Preview deployment with no VERCEL_URL falls through to getAppUrl() and
 *  behaves exactly as it did before this file existed. */
export function internalBaseUrl(): string {
  return previewSelfUrl() ?? getAppUrl()
}

/** Headers for a request this deployment makes to itself.
 *
 *  Adds Vercel's deployment-protection bypass, and only when the call is
 *  actually going to a protected *.vercel.app URL. Production talks to the
 *  custom domain, which SSO does not cover, so it sends no bypass and its
 *  requests are byte-for-byte what they were.
 *
 *  VERCEL_AUTOMATION_BYPASS_SECRET is injected by Vercel when Protection
 *  Bypass for Automation is enabled on the project (it is, scope
 *  `automation-bypass`, verified 2026-09-16). If it is ever turned off the
 *  secret is absent, the header is omitted, and Preview self-calls go back to
 *  being refused at the edge and recovered by the cron -- the behaviour this
 *  file replaced, not something worse.
 *
 *  Caller-supplied headers are spread first so this cannot quietly drop an
 *  Authorization the caller meant to send. */
export function internalHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (previewSelfUrl() && bypass) headers['x-vercel-protection-bypass'] = bypass
  return headers
}
