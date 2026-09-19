// lib/store/tests/deployment-contract.test.ts
//
// THE LESSON, WRITTEN AS A TEST.
//
//   A PREVIEW-CREATED PAYMENT FLOW MUST NOT DEPEND FOR COMPLETION ON CODE
//   THAT EXISTS ONLY IN PREVIEW WHILE STRIPE DELIVERS TO PRODUCTION/main.
//
// 2026-09-17: a customer paid $2.99 twice on Preview and neither piece
// unlocked. Price, session, metadata and entitlement were all correct. The
// confirmation handler was simply in another building -- Stripe delivers
// checkout.session.completed to the PRODUCTION endpoint, Production serves
// `main`, and activateDiscoveryUnlock existed only on the feature branch. The
// webhook answered 200, logged nothing, and the bound entitlement stayed
// 'pending' forever.
//
// Nineteen unit tests passed through all of it, because every one of them
// mocked the webhook. They proved each joint in isolation and never proved
// the joints were in the same building.
//
// This test asks the question they could not: for every handler the Stripe
// webhook dispatches to, does that code exist in the deployment that
// actually RECEIVES the webhook? `main` is the proxy for that deployment,
// read from git rather than from the working tree -- reading the working
// tree is exactly the mistake that let this through.

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'

const ROOT = process.cwd()
const WEBHOOK = 'app/api/v1/webhooks/stripe/route.ts'

function onMain(file: string): string | null {
  try {
    return execFileSync('git', ['show', `main:${file}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { return null }
}

/** Every module the webhook imports from our own tree. */
function webhookImports(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/^import\s+[\s\S]*?from\s+'(@\/[^']+)'/gm)) out.push(m[1])
  return out
}

describe('the Stripe webhook and the deployment that receives it', () => {
  const working = readFileSync(path.join(ROOT, WEBHOOK), 'utf8')

  it('main still has the webhook route at the path Stripe posts to', () => {
    expect(onMain(WEBHOOK)).toBeTruthy()
  })

  /* THE ONE THAT WOULD HAVE CAUGHT IT.

     Stripe posts to Production, and Production serves main. So a webhook
     handler that exists only on a branch cannot complete a branch-created
     payment -- which is exactly what happened on 2026-09-17.

     A branch is ALLOWED to add webhook code; that is how anything ships. What
     is not allowed is for a payment flow to depend on it being there. So the
     assertion is conditional: if the webhook reaches for a module main does
     not have, the flow that module serves must also be completable by the
     deployment serving the customer.

     This test fails the moment someone adds a webhook-only handler with no
     deployment-local confirmation path -- the precise shape of the bug. */
  it('no payment flow depends solely on webhook code that main does not have', () => {
    const missing: string[] = []
    for (const spec of webhookImports(working)) {
      const rel = spec.replace(/^@\//, '')
      const candidates = [`${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`]
      if (!candidates.some(c => onMain(c) !== null)) missing.push(spec)
    }

    /* Today exactly one module is in this position, and it is mitigated.
       Anything else appearing here is an unmitigated repeat of the incident. */
    const MITIGATED: Record<string, string> = {
      '@/lib/store/discovery-unlock':
        'app/api/v1/portfolios/[portfolioId]/unlock-confirm/route.ts',
    }

    const unmitigated = missing.filter(m => !MITIGATED[m])
    expect(
      unmitigated,
      `these webhook handlers exist only on this branch and have no deployment-local ` +
      `confirmation path, so a payment made here could never be completed: ${unmitigated.join(', ')}`,
    ).toEqual([])

    // and each mitigation must actually be present and run the same activation
    for (const [mod, confirmRoute] of Object.entries(MITIGATED)) {
      if (!missing.includes(mod)) continue      // merged to main; nothing to mitigate
      const src = readFileSync(path.join(ROOT, confirmRoute), 'utf8')
      expect(src, `${mod} is branch-only and ${confirmRoute} must confirm it`).toMatch(/checkout\.sessions\.retrieve/)
    }
  })

  /* The standing rule, asserted structurally rather than by hope: the unlock
     has a confirmation path on the deployment that serves the customer, so a
     branch deployment can complete its own payments. */
  it('the Discovery unlock can be confirmed without the webhook', () => {
    const confirm = 'app/api/v1/portfolios/[portfolioId]/unlock-confirm/route.ts'
    const src = readFileSync(path.join(ROOT, confirm), 'utf8')
    // it asks Stripe itself, rather than trusting the browser
    expect(src).toMatch(/checkout\.sessions\.retrieve/)
    expect(src).toMatch(/payment_status !== 'paid'/)
    // and it runs the same activation the webhook runs
    expect(src).toMatch(/activateDiscoveryUnlock/)
    // fail-closed on identity
    expect(src).toMatch(/wrong_owner/)
    expect(src).toMatch(/identity_mismatch/)
  })

  it('the client asks that endpoint when the unlock payment completes', () => {
    const html = readFileSync(path.join(ROOT, 'public/discovery-consolidated-draft.html'), 'utf8')
    expect(html).toMatch(/onComplete: function\(\)\{ finishUnlockPayment\(p, r\.data\.sessionId\); \}/)
    expect(html).toMatch(/unlock-confirm/)
  })
})

/* ══ THE RENDER PATH HAS THE SAME EXPOSURE AS THE WEBHOOK ══════════
   Added 2026-09-19, after the locked-preview watermark was restored on this
   branch and new pieces still came out clean.

   The webhook was the first place this bit (2026-09-17, $2.99 paid and
   nothing unlocked). The render path is the second, and it is worse-behaved
   because it fails SILENTLY: there is no error, no 409, no log. A piece
   simply renders with whichever version of renderOnePortfolioItem the
   deployment that claimed it happens to be running.

   Two deployments claim portfolio items:
     - the client's fast-path dispatch, on the deployment serving the page
       (a Preview, carrying this branch)
     - the render-poll CRON, every two minutes, three at a time, on
       PRODUCTION -- which serves main
   Both call renderOnePortfolioItem. So for any run longer than the fast path
   completes, main renders a share of it, and a branch-only change to what a
   locked derivative looks like applies to some pieces and not others.

   This does not assert that the two agree -- a branch is allowed to change
   the renderer, that is how anything ships. It asserts the thing that is
   easy to forget: that a change to the LOCKED DERIVATIVE cannot be judged
   from Preview alone, because Production renders too. */
describe('the render path and the deployment that also runs it', () => {
  const renderer = 'lib/store/portfolio-render.ts'

  it('main still has the renderer the cron calls', () => {
    expect(onMain(renderer)).toBeTruthy()
    expect(onMain('app/api/v1/portfolios/items/render-poll/route.ts')).toBeTruthy()
  })

  it('the cron and the fast path share one renderer, so neither can drift alone', () => {
    const poll = readFileSync(path.join(ROOT, 'app/api/v1/portfolios/items/render-poll/route.ts'), 'utf8')
    const fast = readFileSync(path.join(ROOT, 'app/api/v1/portfolios/items/render/route.ts'), 'utf8')
    expect(poll).toMatch(/renderOnePortfolioItem/)
    expect(fast).toMatch(/renderOnePortfolioItem/)
  })

  /* THE ONE THAT NAMES THE CURRENT SITUATION. When the locked derivative is
     built differently here than on main, pieces rendered by Production's
     cron carry main's version. Not a failure to fix in code -- a fact to
     know before judging a locked piece on Preview. */
  it('says plainly when the locked derivative differs from main', () => {
    const here = readFileSync(path.join(ROOT, renderer), 'utf8')
    const there = onMain(renderer) ?? ''
    const bakesHere = /bakeWatermark\(imageB64\)/.test(here)
    const bakesThere = /bakeWatermark\(imageB64\)/.test(there)

    if (bakesHere !== bakesThere) {
      console.warn(
        '[deployment-contract] the locked derivative is built differently here than on main ' +
        `(branch bakes: ${bakesHere}, main bakes: ${bakesThere}). The render-poll cron runs on ` +
        'PRODUCTION every two minutes, three items at a time, and claims from the same database — ' +
        'so a share of every run is rendered by main and will NOT match what this branch produces. ' +
        'Locked-preview appearance cannot be accepted from Preview until this is merged.',
      )
    }
    // Not a failure: shipping a renderer change is exactly how this gets to
    // main. The warning is the deliverable.
    expect(typeof bakesHere).toBe('boolean')
  })
})
