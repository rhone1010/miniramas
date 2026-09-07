// lib/store/internal-fetch.ts
//
// Headers for a call this deployment makes to ITSELF.
//
// The render pipeline is a chain of self-calls: activatePortfolio POSTs to
// /portfolios/items/render, which POSTs to /portraits/generate, which may POST
// back to /portfolios/items/render on a retry. Each one goes out to the
// deployment's own public URL (getAppUrl) and comes back in through Vercel's
// edge — including, on a protected deployment, its authentication layer.
//
// So on any preview with Deployment Protection on, every hop is answered with
//
//   401 {"error":{"message":"Protected deployment","code":"401"}}
//
// and no render ever runs. Confirmed against this branch's preview 2026-09-07;
// portfolio 7bc95255 had been sitting at 'generating' since 29 August for
// exactly this reason.
//
// Vercel's supported way through is Protection Bypass for Automation: enable it
// in Project Settings → Deployment Protection, and Vercel injects
// VERCEL_AUTOMATION_BYPASS_SECRET into the deployment's environment. A request
// carrying that value in x-vercel-protection-bypass skips the check.
//
// REQUIRES THE SETTING. This reads an env var Vercel only provides once
// Protection Bypass for Automation is switched on. Absent — production, local,
// or a preview without it — this adds nothing and behaves exactly as before,
// so it is safe everywhere and does nothing on its own.
//
// The secret is never logged and never leaves a request to our own origin.

export function internalHeaders(
  base: Record<string, string> = {},
): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (!secret) return base
  return { ...base, 'x-vercel-protection-bypass': secret }
}
