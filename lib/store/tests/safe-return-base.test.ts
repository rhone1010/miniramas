// lib/store/tests/safe-return-base.test.ts
//
// safeReturnBase decides where Stripe sends a customer after they pay.
// It is an open-redirect guard, so the interesting cases are the ones it
// must REFUSE, not the ones it allows.
//
// Why this file exists: exact-origin matching sent every Discovery
// customer to APP_URL/collections after a successful payment, because
// Discovery is served from discovery.litenco.com while APP_URL is
// litenco.com. Their portfolios rendered and were never displayed. The
// subdomain case below is that fix; the two rejection cases are what
// stops the fix from becoming a hole.
//
// Pure function, no database, no network.

import { describe, it, expect } from 'vitest'
import { safeReturnBase } from '@/lib/store/portfolio-checkout'

const APP = 'https://litenco.com'
const FALLBACK = `${APP}/collections`

describe('safeReturnBase', () => {
  it('allows the exact APP_URL origin', () => {
    expect(safeReturnBase('https://litenco.com/portraits', APP))
      .toBe('https://litenco.com/portraits')
  })

  it('allows a subdomain of the APP_URL host', () => {
    // The Discovery case: pay on discovery.litenco.com, come back to it.
    expect(safeReturnBase('https://discovery.litenco.com/discovery', APP))
      .toBe('https://discovery.litenco.com/discovery')
  })

  it('rejects an unrelated external host', () => {
    expect(safeReturnBase('https://evil.com/steal', APP)).toBe(FALLBACK)
  })

  it('rejects a deceptive suffix host', () => {
    // Ends with our host as a LABEL PREFIX, not a suffix. The leading dot
    // in the subdomain test is what catches this.
    expect(safeReturnBase('https://litenco.com.evil.com/steal', APP)).toBe(FALLBACK)
  })

  // ── the rest of the guard, unchanged by this edit ──────────────

  it('rejects a host that merely ends with the same string', () => {
    expect(safeReturnBase('https://evillitenco.com/steal', APP)).toBe(FALLBACK)
  })

  it('rejects a protocol downgrade on our own host', () => {
    expect(safeReturnBase('http://discovery.litenco.com/discovery', APP)).toBe(FALLBACK)
  })

  it('falls back when returnUrl is absent', () => {
    expect(safeReturnBase(undefined, APP)).toBe(FALLBACK)
  })

  it('falls back when returnUrl is unparseable', () => {
    expect(safeReturnBase('not a url', APP)).toBe(FALLBACK)
  })

  it('drops any query or fragment the caller supplied', () => {
    // success_url appends its own query; a caller-supplied one must not survive.
    expect(safeReturnBase('https://discovery.litenco.com/discovery?x=1#f', APP))
      .toBe('https://discovery.litenco.com/discovery')
  })

  it('still works for a localhost APP_URL in development', () => {
    expect(safeReturnBase('http://localhost:3000/discovery', 'http://localhost:3000'))
      .toBe('http://localhost:3000/discovery')
  })

  it('rejects a different port on the APP_URL host itself', () => {
    expect(safeReturnBase('http://localhost:4000/x', 'http://localhost:3000'))
      .toBe('http://localhost:3000/collections')
  })
})
