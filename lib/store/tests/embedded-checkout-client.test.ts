// lib/store/tests/embedded-checkout-client.test.ts
//
// The Discovery client side of embedded portfolio checkout.
//
// These do NOT model the client. They cut the shipped functions out of
// public/discovery-consolidated-draft.html by name -- startCheckout,
// closeCheckout, onEmbeddedCheckoutComplete, verifyPurchasePaid,
// beginPaidRun, openCollectionForPaidRun and the portfolio_paid return
// handler -- and run them in a sandbox where the DOM, fetch, Stripe.js and
// the clock are stubs. What passes here is the code that ships.
//
// The flow under test:
//   Aspect Ratio -> startCheckout -> embedded form mounted in #ckModal
//     card / Link : onComplete -> close -> verify -> My Collection
//     redirect    : provider -> return_url -> portfolio_paid -> verify -> My Collection
//     closed      : nothing opens, nothing is verified, nothing is reset

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public', 'discovery-consolidated-draft.html'), 'utf8',
)

// -- cutting shipped code out of the page -----------------------------

/** Index of the brace that closes the one at `open`. Skips strings,
 *  template literals and comments, so braces inside them do not count. */
function matchBrace(src: string, open: number): number {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1]
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 1; continue }
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++
      continue
    }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  throw new Error('unbalanced braces from ' + open)
}

function fn(name: string): string {
  const at = HTML.indexOf('\nfunction ' + name + '(')
  if (at < 0) throw new Error('function not found in page: ' + name)
  const open = HTML.indexOf('{', at)
  return HTML.slice(at + 1, matchBrace(HTML, open) + 1)
}

/** The portfolio_paid handler: an anonymous IIFE after its marker comment. */
function returnHandler(): string {
  const marker = HTML.indexOf('// ── Payment confirmation by return')
  if (marker < 0) throw new Error('return handler marker not found')
  const start = HTML.indexOf('(function(){', marker)
  const open = start + '(function()'.length
  const close = matchBrace(HTML, open)
  if (HTML.slice(close + 1, close + 5) !== ')();') throw new Error('handler is not an IIFE')
  return HTML.slice(start, close + 5)
}

function retryConstants(): string {
  const m = HTML.match(/^var PAID_RETRY_EVERY = \d+;\s*\nvar PAID_RETRY_TRIES = \d+;/m)
  if (!m) throw new Error('retry constants not found')
  return m[0]
}

// -- the sandbox ----------------------------------------------------------

type El = { id: string; disabled: boolean; textContent: string; innerHTML: string;
            classes: Set<string>; classList: any; remove: () => void }
function el(id: string): El {
  const classes = new Set<string>()
  return {
    id, disabled: false, textContent: 'Craft My Collection', innerHTML: '', classes,
    classList: {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      contains: (c: string) => classes.has(c),
    },
    remove: () => {},
  }
}

let els: Record<string, El>
let fetchCalls: string[]
let verifyScript: Array<string | null>
let verifyCount: number
let navigatedTo: string | null
let initOpts: any
let embed: { mount: any; destroy: any }
let opened: number
let craftCalls: number[]
let unlockIntent: any
let requestUnlockCalls: any[]
let replaceStateCalls: any[]
let locationObj: { origin: string; pathname: string; search: string }
let aspectState: any
let sb: any

const PORTFOLIO_RESPONSE = {
  clientSecret: 'cs_test_embedded_1_secret_x',
  publishableKey: 'pk_test_probe',
  sessionId: 'cs_test_embedded_1',
  portfolioId: 'portfolio-1',
}

function build(opts: { selected?: number; realPieces?: boolean } = {}) {
  const selected = Array.from({ length: opts.selected ?? 4 }, (_, i) => ({ key: 'effect_' + i, name: 'E' + i }))
  aspectState = {
    SELECTED: selected,
    POSE: 'as_photographed',
    ASPECT: 'landscape',
    SRC_B64: 'BASE64SOURCE',
    SUBJECT: 'woman',
  }
  const windowObj: any = {
    Stripe: (pk: string) => ({
      initEmbeddedCheckout: async (o: any) => { initOpts = { ...o, pk }; return embed },
    }),
  }
  Object.defineProperty(windowObj, 'location', {
    get: () => locationObj,
    set: (v: string) => { navigatedTo = String(v) },
  })

  const env: Record<string, unknown> = {
    document: { getElementById: (id: string) => els[id] || null },
    window: windowObj,
    location: locationObj,
    history: { replaceState: (...a: unknown[]) => replaceStateCalls.push(a) },
    fetch: async (url: string) => {
      fetchCalls.push(url)
      if (url === '/api/v1/portfolios') {
        return { status: 200, ok: true, json: async () => PORTFOLIO_RESPONSE }
      }
      if (url.startsWith('/api/v1/checkout/')) {
        const s = verifyScript[Math.min(verifyCount, verifyScript.length - 1)]
        verifyCount++
        if (s === 'network_error') throw new Error('network')
        return { ok: true, json: async () => ({ purchase: { status: s } }) }
      }
      throw new Error('unexpected fetch ' + url)
    },
    setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
    console: { log() {}, warn() {}, error() {} },
    URLSearchParams,
    // globals startCheckout reads
    ME: { email: 'rich@example.com' },
    PENDING_CRAFT: false,
    openSignin: () => {},
    SELECTED: aspectState.SELECTED,
    VALID_SIZES: [1, 4, 8, 16],
    openSlots: () => 0,
    POSE: aspectState.POSE,
    ASPECT: aspectState.ASPECT,
    SUBJECT: aspectState.SUBJECT,
    SRC_B64: aspectState.SRC_B64,
    aspectRatioOf: (a: string) => ({ square: '1:1', portrait: '3:4', landscape: '4:3' } as any)[a],
    SERVER_OFFER: null,
    SIZE_PRICE: { 1: 2.99, 4: 4.99, 8: 7.99, 16: 12.99 },
    act: () => {},
    loadStripeJs: () => Promise.resolve(),
    showCheckoutError: () => {},
    // state the paid run touches
    STRIPE_EMBED: null,
    PAID_RUN_FOREGROUND: [],
    canonicalSeries: (s: string) => (({ portraits: 'Portraits' } as any)[String(s).toLowerCase()] || s),
    REAL_PIECES: opts.realPieces ?? false,
    RUN_LANDED: true,
    AWAITING_PAID_HYDRATION: false,
    PIECES: ['demo0', 'demo1'],
    openMyCollection: () => { opened++ },
    craftWhenPiecesLand: (n: number) => { craftCalls.push(n) },
    readUnlockIntent: () => unlockIntent,
    clearUnlockIntent: () => { unlockIntent = null },
    requestUnlock: (...a: unknown[]) => { requestUnlockCalls.push(a); return Promise.resolve('unlocked') },
  }

  const body = [
    retryConstants(),
    fn('openCollectionForPaidRun'),
    fn('foregroundPaidRun'),
    fn('beginPaidRun'),
    fn('verifyPurchasePaid'),
    fn('closeCheckout'),
    fn('startCheckout'),
    fn('onEmbeddedCheckoutComplete'),
    fn('resetCraftBtn'),
    'function runReturnHandler(){ ' + returnHandler() + ' }',
    'return { startCheckout: startCheckout, closeCheckout: closeCheckout,',
    '  onEmbeddedCheckoutComplete: onEmbeddedCheckoutComplete, runReturnHandler: runReturnHandler,',
    '  state: function(){ return { STRIPE_EMBED: STRIPE_EMBED, REAL_PIECES: REAL_PIECES,',
    '    RUN_LANDED: RUN_LANDED, AWAITING_PAID_HYDRATION: AWAITING_PAID_HYDRATION, PIECES: PIECES,',
    '    PAID_RUN_FOREGROUND: PAID_RUN_FOREGROUND,',
    '    SELECTED: SELECTED, POSE: POSE, ASPECT: ASPECT, SRC_B64: SRC_B64 }; } };',
  ].join('\n')

  sb = new Function(...Object.keys(env), body)(...Object.values(env))
  return sb
}

const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  els = { btnCraft: el('btnCraft'), ckForm: el('ckForm'), ckErr: el('ckErr'), ckModal: el('ckModal') }
  fetchCalls = []
  verifyScript = ['paid']
  verifyCount = 0
  navigatedTo = null
  initOpts = null
  embed = { mount: vi.fn(), destroy: vi.fn() }
  opened = 0
  craftCalls = []
  unlockIntent = null
  requestUnlockCalls = []
  replaceStateCalls = []
  locationObj = { origin: 'https://litenco.com', pathname: '/discovery', search: '' }
})
afterEach(() => vi.useRealTimers())

async function openModal(opts?: { selected?: number }) {
  const s = build(opts)
  s.startCheckout()
  await flush()
  return s
}

// -- 3, 4, 5 . the client mounts the secret in the existing modal ------

describe('startCheckout mounts an embedded session in the existing modal', () => {
  it('posts to the portfolios route and mounts the returned client secret', async () => {
    await openModal()
    expect(fetchCalls).toContain('/api/v1/portfolios')
    expect(initOpts.clientSecret).toBe(PORTFOLIO_RESPONSE.clientSecret)
    expect(initOpts.pk).toBe(PORTFOLIO_RESPONSE.publishableKey)
  })

  it('passes an onComplete handler', async () => {
    await openModal()
    expect(typeof initOpts.onComplete).toBe('function')
  })

  it('mounts into #ckForm and opens #ckModal -- no new modal', async () => {
    const s = await openModal()
    expect(embed.mount).toHaveBeenCalledWith('#ckForm')
    expect(els.ckModal.classes.has('is-open')).toBe(true)
    expect(s.state().STRIPE_EMBED).toBe(embed)
  })

  it('never navigates the window', async () => {
    await openModal()
    expect(navigatedTo).toBeNull()
  })

  it('has no hosted-redirect line left in startCheckout at all', () => {
    // Code only: the comment that records the removed line quotes it.
    const code = fn('startCheckout').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/window\.location\s*=/)
    expect(code).not.toMatch(/r\.data\.url/)
  })

  it('gives the craft button back once the form is up', async () => {
    await openModal()
    expect(els.btnCraft.disabled).toBe(false)
  })
})

// -- 4 . the Aspect Ratio screen is untouched underneath --------------

describe('opening and closing checkout leaves Aspect Ratio exactly as it was', () => {
  it('selection, source, pose and aspect survive open then close', async () => {
    const s = await openModal()
    const before = s.state()
    s.closeCheckout()
    await flush()
    const after = s.state()
    expect(after.SELECTED).toBe(before.SELECTED)
    expect(after.SELECTED.map((x: any) => x.key)).toEqual(['effect_0', 'effect_1', 'effect_2', 'effect_3'])
    expect(after.POSE).toBe('as_photographed')
    expect(after.ASPECT).toBe('landscape')
    expect(after.SRC_B64).toBe('BASE64SOURCE')
  })

  it('nothing navigates, so nothing is rebuilt', async () => {
    const s = await openModal()
    s.closeCheckout()
    expect(navigatedTo).toBeNull()
    expect(replaceStateCalls).toEqual([])
  })
})

// -- 10 . closing without paying ---------------------------------------

describe('closing the modal without paying', () => {
  it('destroys the embed and hides the modal', async () => {
    const s = await openModal()
    s.closeCheckout()
    expect(embed.destroy).toHaveBeenCalledTimes(1)
    expect(els.ckModal.classes.has('is-open')).toBe(false)
    expect(s.state().STRIPE_EMBED).toBeNull()
  })

  it('does not verify anything, open anything, or start a run', async () => {
    const s = await openModal()
    s.closeCheckout()
    await vi.runAllTimersAsync()
    expect(fetchCalls.some((u) => u.startsWith('/api/v1/checkout/'))).toBe(false)
    expect(opened).toBe(0)
    expect(craftCalls).toEqual([])
    expect(s.state().AWAITING_PAID_HYDRATION).toBe(false)
  })

  it('the ×, the scrim and Escape all route to closeCheckout', () => {
    expect(HTML).toMatch(/ckX[\s\S]{0,200}closeCheckout/)
    expect(HTML).toContain('if (e.target === ckModal) closeCheckout();')
    expect(HTML).toMatch(/e\.key === 'Escape' && ckModal && ckModal\.classList\.contains\('is-open'\)\) closeCheckout\(\);/)
  })
})

// -- 6, 7 . completing in the modal ---------------------------------

describe('card / Link: onComplete closes the modal and opens My Collection', () => {
  it('closes and destroys the form first', async () => {
    await openModal()
    initOpts.onComplete()
    expect(embed.destroy).toHaveBeenCalledTimes(1)
    expect(els.ckModal.classes.has('is-open')).toBe(false)
  })

  it('verifies the purchase by the session id the route returned', async () => {
    await openModal()
    initOpts.onComplete()
    await flush()
    expect(fetchCalls).toContain('/api/v1/checkout/cs_test_embedded_1')
  })

  it('opens My Collection on a confirmed paid, and starts the existing poll', async () => {
    const s = await openModal()
    initOpts.onComplete()
    await flush()
    expect(opened).toBe(1)
    expect(craftCalls).toEqual([0])
    const st = s.state()
    expect(st.AWAITING_PAID_HYDRATION).toBe(true)
    expect(st.RUN_LANDED).toBe(true)
    expect(st.REAL_PIECES).toBe(true)
    // The demo seed is gone and the run's four crafting placeholders stand in
    // its place, in slot order, keyed exactly as loadPortfolio will key them.
    expect(st.PIECES.map((p: any) => p.key)).toEqual([0, 1, 2, 3].map((s) => 'pfportfolio-1:' + s))
    expect(st.PIECES.every((p: any) => p.crafting && p.locked && p.art === null)).toBe(true)
    expect(st.PAID_RUN_FOREGROUND).toEqual(['portfolio-1'])
  })

  it('does not open before the server says paid', async () => {
    verifyScript = ['pending', 'paid']
    await openModal()
    initOpts.onComplete()
    await flush()
    expect(opened).toBe(0)
  })

  it('ignores a stored unlock intent -- this was a portfolio checkout', async () => {
    unlockIntent = { previewId: 'p1', key: 'k1', at: Date.now() }
    await openModal()
    initOpts.onComplete()
    await flush()
    expect(opened).toBe(1)
    expect(requestUnlockCalls).toEqual([])
  })
})

// -- 8, 9 . the #169 budget, reached through onComplete ---------------

describe('the in-modal path keeps #169’s verification exactly', () => {
  it('pending then paid: opens on the second check, 2500ms later', async () => {
    verifyScript = ['pending', 'paid']
    await openModal()
    initOpts.onComplete()
    await flush()
    expect(verifyCount).toBe(1)
    await vi.advanceTimersByTimeAsync(2499)
    expect(verifyCount).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(verifyCount).toBe(2)
    expect(opened).toBe(1)
  })

  it('five checks at most, then gives up with the collection closed', async () => {
    verifyScript = ['pending']
    await openModal()
    initOpts.onComplete()
    await vi.runAllTimersAsync()
    expect(verifyCount).toBe(5)
    expect(opened).toBe(0)
  })

  it('a dropped request is retried, not treated as a no', async () => {
    verifyScript = ['network_error', 'paid']
    await openModal()
    initOpts.onComplete()
    await vi.runAllTimersAsync()
    expect(opened).toBe(1)
  })

  for (const terminal of ['failed', 'refunded']) {
    it(`${terminal}: asked once, nothing opens`, async () => {
      verifyScript = [terminal]
      const s = await openModal()
      initOpts.onComplete()
      await vi.runAllTimersAsync()
      expect(verifyCount).toBe(1)
      expect(opened).toBe(0)
      expect(s.state().AWAITING_PAID_HYDRATION).toBe(false)
    })
  }
})

// -- 11 . redirect methods: the portfolio_paid fallback ------------------

describe('the portfolio_paid return handler still works', () => {
  it('verifies the returned session and opens My Collection', async () => {
    locationObj.search = '?portfolio_paid=1&session_id=cs_test_returned'
    build().runReturnHandler()
    await flush()
    expect(replaceStateCalls).toEqual([[null, '', '/discovery']])
    expect(fetchCalls).toEqual(['/api/v1/checkout/cs_test_returned'])
    expect(opened).toBe(1)
    expect(craftCalls).toEqual([0])
  })

  it('pending then paid on return, same budget', async () => {
    locationObj.search = '?portfolio_paid=1&session_id=cs_test_returned'
    verifyScript = ['pending', 'pending', 'paid']
    build().runReturnHandler()
    await vi.runAllTimersAsync()
    expect(verifyCount).toBe(3)
    expect(opened).toBe(1)
  })

  it('an unlock return still finishes the unlock and opens nothing', async () => {
    locationObj.search = '?paid=1&session_id=cs_test_unlock'
    unlockIntent = { previewId: 'p1', key: 'k1', at: Date.now() }
    build().runReturnHandler()
    await flush()
    expect(requestUnlockCalls).toEqual([['p1', 'k1']])
    expect(opened).toBe(0)
  })

  it('an ordinary page load does nothing', async () => {
    locationObj.search = ''
    build().runReturnHandler()
    await vi.runAllTimersAsync()
    expect(fetchCalls).toEqual([])
    expect(replaceStateCalls).toEqual([])
  })
})

// -- 6 . one verification implementation, two callers ------------------

describe('both completion paths share one verification', () => {
  it('there is exactly one purchase-verification request in the page', () => {
    expect(HTML.split("fetch('/api/v1/checkout/' + encodeURIComponent(sessionId)").length - 1).toBe(1)
  })

  it('it lives in verifyPurchasePaid, and both callers call it', () => {
    expect(fn('verifyPurchasePaid')).toContain("fetch('/api/v1/checkout/' + encodeURIComponent(sessionId)")
    expect(fn('onEmbeddedCheckoutComplete')).toContain('verifyPurchasePaid(sessionId, function(){ beginPaidRun(run); })')
    expect(returnHandler()).toContain('verifyPurchasePaid(sessionId, function(){')
    expect(returnHandler()).toContain('beginPaidRun();')
  })

  it('the retry constants are declared once, with #169’s values', () => {
    expect(HTML.split('var PAID_RETRY_EVERY = 2500;').length - 1).toBe(1)
    expect(HTML.split('var PAID_RETRY_TRIES = 4;').length - 1).toBe(1)
  })

  it('the constants are declared above the handler that reads them', () => {
    // A var assigned below its first caller hoists the name, not the value.
    expect(HTML.indexOf('var PAID_RETRY_TRIES = 4;'))
      .toBeLessThan(HTML.indexOf('// ── Payment confirmation by return'))
  })
})

// -- 12 . every size, same presentation -------------------------------

describe('size 1 and 4/8/16 open the same embedded checkout', () => {
  for (const n of [1, 4, 8, 16]) {
    it(`size ${n}: portfolios route, embedded mount, no navigation`, async () => {
      await openModal({ selected: n })
      expect(fetchCalls).toEqual(['/api/v1/portfolios'])
      expect(embed.mount).toHaveBeenCalledWith('#ckForm')
      expect(navigatedTo).toBeNull()
    })
  }
})
