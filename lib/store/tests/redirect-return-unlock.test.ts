// lib/store/tests/redirect-return-unlock.test.ts
//
// THE DOOR THE MITIGATION DID NOT COVER.
//
// On 2026-09-17 a customer paid $2.99 and the image stayed locked, because
// activateDiscoveryUnlock lived only on the branch while Stripe delivered its
// webhook to Production. The fix was unlock-confirm: the browser asks Stripe
// itself, from the deployment that served it. It was proved twice at runtime
// and A4 was closed.
//
// It was proved twice on ONE door. `redirect_on_completion: 'if_required'`
// means card and Link finish inside the modal and fire onComplete -- which is
// what calls finishUnlockPayment. Klarna, Cash App Pay and Amazon Pay leave
// the page instead, and come back to return_url. The unlock's return_url was
// built by safeReturnBase, which returns `origin + pathname` and appends
// nothing; the portfolio path has always appended `?portfolio_paid=1&session_id=`.
//
// So the return handler read `paid` and `session_id`, found neither, and
// returned. unlock-confirm was never called. The webhook could not call it
// either. The customer paid and got nothing -- the same failure, through the
// door nobody had walked.
//
// These tests hold both halves shut: the URL must carry the parameters, and
// the handler must converge on the proven sequence rather than invent a
// second one.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const ROOT = process.cwd()
const ROUTE = 'app/api/v1/portfolios/[portfolioId]/unlock-checkout/route.ts'
const HTML = 'public/discovery-consolidated-draft.html'

const routeSrc = readFileSync(path.join(ROOT, ROUTE), 'utf8')
const html = readFileSync(path.join(ROOT, HTML), 'utf8')

describe('the unlock return_url tells the client what happened', () => {
  it('carries paid=1 and the session id placeholder', () => {
    expect(routeSrc).toMatch(/paid=1&session_id=\{CHECKOUT_SESSION_ID\}/)
  })

  /* safeReturnBase is still the open-redirect guard -- the parameters are
     appended to what it returns, never in place of it. */
  it('still passes the customer URL through safeReturnBase first', () => {
    expect(routeSrc).toMatch(/safeReturnBase\(/)
    const base = routeSrc.indexOf('safeReturnBase(')
    const params = routeSrc.indexOf('paid=1&session_id=')
    expect(base, 'the guard must run before the parameters are appended').toBeLessThan(params)
  })

  it('appends with & when the base already has a query string', () => {
    expect(routeSrc).toMatch(/includes\('\?'\) \? '&' : '\?'/)
  })

  /* The whole point: Stripe substitutes the placeholder, so it must survive
     into the session rather than being URL-encoded or interpolated away. */
  it('hands the composed URL to the session, not the bare base', () => {
    expect(routeSrc).toMatch(/returnUrl,/)
    expect(routeSrc).toMatch(/const returnUrl = returnBase \+/)
  })
})

describe('a redirect return completes through the path A4 proved', () => {
  /** The return handler, lifted from the page rather than a copy of it. */
  const handler = (() => {
    const at = html.indexOf('// ── Payment confirmation by return')
    expect(at, 'the return handler is no longer in the page').toBeGreaterThan(-1)
    return html.slice(at, at + 6000)
  })()

  it('recognises the unlock return on paid=1', () => {
    expect(handler).toMatch(/params\.get\('paid'\) === '1'/)
  })

  /* THE ONE THAT WOULD HAVE CAUGHT IT. Calling requestUnlock alone answers
     409 no_entitlement, because on a branch deployment nothing has activated
     the entitlement -- the webhook cannot, and only unlock-confirm can. */
  it('confirms with Stripe before asking for the image', () => {
    expect(handler).toMatch(/finishUnlockPayment\(piece, sessionId\)/)
  })

  it('does not reach for the image without confirming first', () => {
    const confirmAt = handler.indexOf('finishUnlockPayment(piece, sessionId)')
    const bare = handler.indexOf('requestUnlock(ui.previewId, ui.key)')
    expect(confirmAt).toBeGreaterThan(-1)
    // the bare call survives only as the no-portfolio fallback, after it
    expect(bare).toBeGreaterThan(confirmAt)
  })

  /* PIECES is not hydrated on a fresh load, so the piece is rebuilt from the
     intent. portfolioId is carried in the key: 'pf' + portfolioId + ':' + slot. */
  it('rebuilds the piece from the intent when PIECES is empty', () => {
    expect(handler).toMatch(/ui\.key\.slice\(2, colon\)/)
    expect(handler).toMatch(/locked: true/)
  })

  it('prefers the real piece when the collection is already hydrated', () => {
    expect(handler).toMatch(/PIECES\[qi\]\.key === ui\.key/)
    expect(handler).toMatch(/known \|\|/)
  })

  /** The key-splitting logic itself, run rather than merely matched. */
  it('recovers portfolioId from a real key shape', () => {
    const portfolioIdFrom = (key: string) => {
      const colon = key ? key.lastIndexOf(':') : -1
      return (key && key.indexOf('pf') === 0 && colon > 2) ? key.slice(2, colon) : null
    }
    expect(portfolioIdFrom('pfe2813285-c534-46dd-b881-d809f6c9a31d:3'))
      .toBe('e2813285-c534-46dd-b881-d809f6c9a31d')
    expect(portfolioIdFrom('pc4821')).toBeNull()        // a shelf piece has no portfolio
    expect(portfolioIdFrom('demo27')).toBeNull()        // nor does the seed
    expect(portfolioIdFrom('')).toBeNull()
  })

  it('the stale comment claiming a hosted unlock return is gone', () => {
    expect(html).not.toMatch(/An unlock \(hosted, via startUnlockCheckout\) still/)
  })
})

describe('iOS safe-area rules are actually operative', () => {
  /* The stylesheet uses env(safe-area-inset-*) throughout. Without
     viewport-fit=cover every one of those resolves to 0 on iOS, so the
     allowances were inert on the exact device they were written for. */
  it('the viewport meta opts into the safe area', () => {
    expect(html).toMatch(/<meta name="viewport" content="[^"]*viewport-fit=cover/)
  })

  it('and there are safe-area rules for it to enable', () => {
    const uses = html.match(/env\(safe-area-inset/g) || []
    expect(uses.length).toBeGreaterThan(5)
  })
})

describe('a signed-out visitor owns nothing, and is shown nothing', () => {
  /* renderCollection -- and so reconcileCollection -- runs only under
     `if (ME)`. The nav handler calls openMyCollection() with no auth guard,
     so a signed-out visitor painted PIECES: the 28-item demo seed, with a
     permanent Crafting tile and 28 dead "Unlock $2.99" buttons. */
  const paintMe = (() => {
    const at = html.indexOf('function paintMe()')
    expect(at, 'paintMe is no longer in the page').toBeGreaterThan(-1)
    return html.slice(at, at + 1600)
  })()

  it('retires the seed when there is no user', () => {
    expect(paintMe).toMatch(/__B2_SIGNED_OUT_SEED__/)
    expect(paintMe).toMatch(/if \(!REAL_PIECES\)\{ PIECES\.length = 0; REAL_PIECES = true; \}/)
  })

  it('still hydrates from the server when there is one', () => {
    expect(paintMe).toMatch(/if \(ME\) \{ renderCollection\(\)\.then\(refreshWhileCrafting\); return; \}/)
  })

  it('repaints only a collection that is already open', () => {
    expect(paintMe).toMatch(/mycoll\.classList\.contains\('is-open'\)/)
  })

  /* Signing out retires the seed through the SAME REAL_PIECES swap
     reconcileCollection uses, rather than a second mechanism that could
     drift away from it. */
  it('uses the same seed-retirement the server path uses', () => {
    expect(html).toMatch(/if \(!REAL_PIECES\)\{ REAL_PIECES = true; changed = true; \}/)
  })
})
