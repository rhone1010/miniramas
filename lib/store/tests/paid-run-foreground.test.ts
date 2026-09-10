// lib/store/tests/paid-run-foreground.test.ts
//
// The run just bought in the modal is drawn FIRST in My Collection.
//
// PRODUCTION REGRESSION, 2026-09-10, portfolio a49230fb (a $4.99 4-pack,
// paid in the embedded modal). Every server handoff succeeded -- webhook,
// activation, dispatch, all four renders done within 35s -- and the
// customer saw nothing. The page had hydrated the account's 34 existing
// pieces at sign-in, embedded checkout meant no reload afterwards, and
// pieceLanded appends a piece it has not seen. The four new tiles were
// drawn at positions 35-38 of 38, below the fold.
//
// Before embedded checkout a reload sat between paying and seeing the
// collection, rebuilding PIECES from empty newest-first, so this never
// showed. The fix foregrounds the purchased portfolio at render time, seeds
// its crafting tiles before the panel paints, and leaves ordinary hydration
// order alone.
//
// These run the SHIPPED renderCollection, pieceLanded, mcVisible,
// paidRunsFirst, foregroundPaidRun, openCollectionForPaidRun, beginPaidRun,
// verifyPurchasePaid, onEmbeddedCheckoutComplete, closeCheckout and the
// portfolio_paid return handler, cut out of the page by name. Only the
// network, the DOM and the clock are stubs.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public', 'discovery-consolidated-draft.html'), 'utf8',
)

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
  return HTML.slice(at + 1, matchBrace(HTML, HTML.indexOf('{', at)) + 1)
}
function returnHandler(): string {
  const marker = HTML.indexOf('// ── Payment confirmation by return')
  const start = HTML.indexOf('(function(){', marker)
  const close = matchBrace(HTML, start + '(function()'.length)
  return HTML.slice(start, close + 5)
}
const retryConstants = () =>
  HTML.match(/^var PAID_RETRY_EVERY = \d+;\s*\nvar PAID_RETRY_TRIES = \d+;/m)![0]

// -- the server, as the client sees it ----------------------------------

type Item = { slot: number; preset: string; status: 'pending' | 'done'; previewId: string | null; previewUrl: string | null }
type Portfolio = { id: string; series: string; items: Item[] }

/** The 10 portfolios the production account already had, newest first --
 *  the order GET /api/v1/portfolios returns. 34 pieces. */
const EXISTING: Array<[string, number]> = [
  ['2f424993', 1], ['441c132e', 4], ['69ead6e0', 4], ['bc0fe84d', 1], ['ce39a3df', 4],
  ['ad1c80b5', 4], ['4269bd44', 4], ['935148c0', 4], ['15baa850', 4], ['9929cd25', 4],
]
const NEW_ID = 'a49230fb'
const NEW_EFFECTS = ['folded_book', 'origami', 'plushy', 'art_deco']   // the real purchase

function done(id: string, size: number): Portfolio {
  return { id, series: 'portraits', items: Array.from({ length: size }, (_, s) => ({
    slot: s, preset: 'e' + s, status: 'done' as const, previewId: id + '-p' + s, previewUrl: 'https://img/' + id + '/' + s,
  })) }
}
function pending(id: string, effects: string[]): Portfolio {
  return { id, series: 'portraits', items: effects.map((e, s) => ({
    slot: s, preset: e, status: 'pending' as const, previewId: null, previewUrl: null,
  })) }
}

let server: Portfolio[]
let verifyScript: string[]
let verifyCount: number
let opened: number
let grids: number
let sb: any

/** loadPortfolio, reduced to the item mapping it performs on /status. */
function loadPortfolio(id: string) {
  const p = server.find((x) => x.id === id)!
  return Promise.resolve(p.items.map((i) => ({
    key: 'pf' + id + ':' + i.slot, portfolioId: id, name: i.preset, siloName: '',
    series: 'Portraits', locked: true, crafting: i.status !== 'done',
    previewId: i.previewId, art: i.previewUrl || null, aspect: null,
  })))
}

function build(opts: { realPieces?: boolean; pieces?: any[] } = {}) {
  const env: Record<string, unknown> = {
    fetch: async (url: string) => {
      if (url === '/api/v1/portfolios') {
        return { ok: true, json: async () => ({ portfolios: server.map((p) => ({ id: p.id, status: 'ready' })) }) }
      }
      if (url.startsWith('/api/v1/checkout/')) {
        const s = verifyScript[Math.min(verifyCount, verifyScript.length - 1)]
        verifyCount++
        return { ok: true, json: async () => ({ purchase: { status: s } }) }
      }
      throw new Error('unexpected fetch ' + url)
    },
    setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
    console: { log() {}, warn() {}, error() {} },
    URLSearchParams,
    location: { search: '', pathname: '/discovery' },
    history: { replaceState() {} },
    document: { getElementById: () => ({ classList: { add() {}, remove() {}, contains: () => false }, innerHTML: '' }) },
    loadPortfolio, loadShelf: () => Promise.resolve([]),
    activateIfStalled() {}, dispatchIfGenerating() {},
    openMyCollection: () => { opened++ },
    renderMyCollectionGrid: () => { grids++ },
    renderMycollRail() {},
    craftWhenPiecesLand() {},             // the poll's cadence is not under test; waves are driven by hand
    readUnlockIntent: () => null, clearUnlockIntent() {}, requestUnlock: () => Promise.resolve('unlocked'),
    canonicalSeries: (s: string) => (({ portraits: 'Portraits' } as any)[String(s).toLowerCase()] || s),
    MC_SERIES: 'all', MC_STATE: 'all',
    PIECES: opts.pieces ?? [],
    REAL_PIECES: opts.realPieces ?? true,
    RUN_LANDED: true,
    AWAITING_PAID_HYDRATION: false,
    PAID_RUN_FOREGROUND: [],
    FEATURED: null,
    STRIPE_EMBED: null,
  }
  const body = [
    retryConstants(),
    fn('pieceLanded'), fn('mcVisible'), fn('paidRunsFirst'),
    fn('renderCollection'),
    fn('openCollectionForPaidRun'), fn('foregroundPaidRun'), fn('beginPaidRun'),
    fn('verifyPurchasePaid'), fn('closeCheckout'), fn('onEmbeddedCheckoutComplete'),
    'function runReturnHandler(){ ' + returnHandler() + ' }',
    'return { renderCollection: renderCollection, mcVisible: mcVisible,',
    '  onEmbeddedCheckoutComplete: onEmbeddedCheckoutComplete, runReturnHandler: runReturnHandler,',
    '  state: function(){ return { PIECES: PIECES, REAL_PIECES: REAL_PIECES,',
    '    PAID_RUN_FOREGROUND: PAID_RUN_FOREGROUND, AWAITING_PAID_HYDRATION: AWAITING_PAID_HYDRATION }; } };',
  ].join('\n')
  sb = new Function(...Object.keys(env), body)(...Object.values(env))
  return sb
}

const keys = () => sb.mcVisible().map((p: any) => p.key)
const flush = () => vi.advanceTimersByTimeAsync(0)
const EXISTING_KEYS = EXISTING.flatMap(([id, n]) => Array.from({ length: n }, (_, s) => 'pf' + id + ':' + s))
const newKeys = (id: string, n: number) => Array.from({ length: n }, (_, s) => 'pf' + id + ':' + s)

/** The signed-in page: sign-in hydration has already put 34 pieces in PIECES. */
async function signedInWith34() {
  server = EXISTING.map(([id, n]) => done(id, n))
  build()
  await sb.renderCollection()
  expect(sb.state().PIECES).toHaveLength(34)
  expect(keys()).toEqual(EXISTING_KEYS)
}

/** Buy in the modal: the purchase row exists, the webhook confirms it. */
async function buyInModal(id: string, effects: string[]) {
  server = [pending(id, effects), ...server]
  sb.onEmbeddedCheckoutComplete('cs_test_' + id, { portfolioId: id, series: 'portraits', effectIds: effects })
  await flush()
}

function land(id: string, slot: number) {
  const it = server.find((p) => p.id === id)!.items[slot]
  it.status = 'done'; it.previewId = id + '-p' + slot; it.previewUrl = 'https://img/' + id + '/' + slot
}

beforeEach(() => {
  vi.useFakeTimers()
  verifyScript = ['paid']
  verifyCount = 0
  opened = 0
  grids = 0
})
afterEach(() => vi.useRealTimers())

// -- the exact production regression -------------------------------

describe('production regression: 34 existing pieces, then a 4-pack in the modal', () => {
  it('BEFORE the fix, this sequence drew the new tiles at 35-38 -- the defect, stated', async () => {
    // Same shipped pieceLanded, with no foreground: what mcVisible returned
    // before paidRunsFirst existed.
    await signedInWith34()
    server = [pending(NEW_ID, NEW_EFFECTS), ...server]
    await sb.renderCollection()
    const pos = keys().map((k: string, i: number) => [k, i + 1]).filter(([k]: any) => k.startsWith('pf' + NEW_ID))
    expect(pos.map(([, i]: any) => i)).toEqual([35, 36, 37, 38])
  })

  it('the moment My Collection opens, positions 1-4 are the new crafting tiles', async () => {
    await signedInWith34()
    await buyInModal(NEW_ID, NEW_EFFECTS)
    expect(opened).toBe(1)
    // Before any poll wave has come back: these are the seeded placeholders.
    const vis = sb.mcVisible()
    expect(vis.slice(0, 4).map((p: any) => p.key)).toEqual(newKeys(NEW_ID, 4))
    expect(vis.slice(0, 4).every((p: any) => p.crafting)).toBe(true)
    expect(vis.slice(0, 4).map((p: any) => p.name)).toEqual(NEW_EFFECTS)
  })

  it('the 34 existing pieces follow, in their original relative order', async () => {
    await signedInWith34()
    await buyInModal(NEW_ID, NEW_EFFECTS)
    expect(keys().slice(4)).toEqual(EXISTING_KEYS)
    expect(keys()).toHaveLength(38)
  })

  it('results landing OUT OF ORDER keep positions 1-4 stable and in slot order', async () => {
    await signedInWith34()
    await buyInModal(NEW_ID, NEW_EFFECTS)
    for (const slot of [3, 0, 2, 1]) {                  // production: slot 3 finished first
      land(NEW_ID, slot)
      await sb.renderCollection()
      expect(keys().slice(0, 4)).toEqual(newKeys(NEW_ID, 4))
      expect(keys().slice(4)).toEqual(EXISTING_KEYS)
      expect(keys()).toHaveLength(38)                   // replaced in place -- never duplicated
    }
  })

  it('each tile turns from crafting to finished in its own position', async () => {
    await signedInWith34()
    await buyInModal(NEW_ID, NEW_EFFECTS)
    land(NEW_ID, 2)
    await sb.renderCollection()
    const top = sb.mcVisible().slice(0, 4)
    expect(top.map((p: any) => p.crafting)).toEqual([true, true, false, true])
    expect(top[2].art).toBe('https://img/' + NEW_ID + '/2')
  })

  it('after all four are done, the new portfolio is still positions 1-4', async () => {
    await signedInWith34()
    await buyInModal(NEW_ID, NEW_EFFECTS)
    for (const slot of [3, 0, 2, 1]) land(NEW_ID, slot)
    await sb.renderCollection()
    await sb.renderCollection()                          // a later reconciliation pass
    expect(keys().slice(0, 4)).toEqual(newKeys(NEW_ID, 4))
    expect(sb.mcVisible().slice(0, 4).every((p: any) => !p.crafting)).toBe(true)
    expect(keys().slice(4)).toEqual(EXISTING_KEYS)
  })

  it('PIECES itself is never reordered -- only the paint is', async () => {
    await signedInWith34()
    await buyInModal(NEW_ID, NEW_EFFECTS)
    await sb.renderCollection()
    const raw = sb.state().PIECES.map((p: any) => p.key)
    expect(raw.slice(0, 34)).toEqual(EXISTING_KEYS)
    expect(raw.slice(34)).toEqual(newKeys(NEW_ID, 4))
  })

  it('nothing is foregrounded until the purchase is confirmed paid', async () => {
    await signedInWith34()
    verifyScript = ['pending', 'paid']
    await buyInModal(NEW_ID, NEW_EFFECTS)
    expect(opened).toBe(0)
    expect(sb.state().PAID_RUN_FOREGROUND).toEqual([])
    expect(keys()).toEqual(EXISTING_KEYS)                // no placeholders yet
    await vi.advanceTimersByTimeAsync(2500)
    expect(opened).toBe(1)
    expect(keys().slice(0, 4)).toEqual(newKeys(NEW_ID, 4))
  })

  it('a failed purchase foregrounds nothing and seeds nothing', async () => {
    await signedInWith34()
    verifyScript = ['failed']
    await buyInModal(NEW_ID, NEW_EFFECTS)
    await vi.runAllTimersAsync()
    expect(opened).toBe(0)
    expect(sb.state().PAID_RUN_FOREGROUND).toEqual([])
    expect(sb.state().PIECES).toHaveLength(34)
  })
})

// -- size 1 ------------------------------------------------------------

describe('size 1', () => {
  it('its single crafting tile opens at position 1 and stays there once done', async () => {
    await signedInWith34()
    await buyInModal('s1ngle00', ['samurai'])
    expect(keys()[0]).toBe('pfs1ngle00:0')
    expect(sb.mcVisible()[0].crafting).toBe(true)
    expect(keys().slice(1)).toEqual(EXISTING_KEYS)
    land('s1ngle00', 0)
    await sb.renderCollection()
    expect(keys()[0]).toBe('pfs1ngle00:0')
    expect(sb.mcVisible()[0].crafting).toBe(false)
    expect(keys()).toHaveLength(35)
  })
})

// -- 8 and 16 ------------------------------------------------------------

describe('8 and 16 keep their full 1..N order on top', () => {
  for (const n of [8, 16]) {
    it(`size ${n}`, async () => {
      await signedInWith34()
      const effects = Array.from({ length: n }, (_, i) => 'fx' + i)
      await buyInModal('big' + n, effects)
      expect(keys().slice(0, n)).toEqual(newKeys('big' + n, n))
      for (const s of [...Array(n).keys()].reverse()) land('big' + n, s)
      await sb.renderCollection()
      expect(keys().slice(0, n)).toEqual(newKeys('big' + n, n))
      expect(keys().slice(n)).toEqual(EXISTING_KEYS)
    })
  }
})

// -- first-time buyer -------------------------------------------------------

describe('an empty, first-time collection', () => {
  it('opens with only the new crafting tiles -- the demo seed is gone', async () => {
    server = []
    build({ realPieces: false, pieces: ['demo0', 'demo1', 'demo2'].map((k) => ({ key: k, series: 'Portraits', crafting: false, locked: true })) })
    await buyInModal(NEW_ID, NEW_EFFECTS)
    expect(keys()).toEqual(newKeys(NEW_ID, 4))
    expect(sb.mcVisible().every((p: any) => p.crafting)).toBe(true)
  })

  it('fills in place and keeps 1-4', async () => {
    server = []
    build({ realPieces: false, pieces: [{ key: 'demo0', series: 'Portraits', crafting: false, locked: true }] })
    await buyInModal(NEW_ID, NEW_EFFECTS)
    land(NEW_ID, 1); land(NEW_ID, 3)
    await sb.renderCollection()
    expect(keys()).toEqual(newKeys(NEW_ID, 4))
    expect(sb.mcVisible().map((p: any) => p.crafting)).toEqual([true, false, true, false])
  })
})

// -- a second purchase in the same session --------------------------------

describe('two purchases on one page', () => {
  it('the most recent run is first, the earlier run second, then everything else', async () => {
    await signedInWith34()
    await buyInModal(NEW_ID, NEW_EFFECTS)
    await buyInModal('second00', ['a', 'b'])
    expect(keys().slice(0, 2)).toEqual(newKeys('second00', 2))
    expect(keys().slice(2, 6)).toEqual(newKeys(NEW_ID, 4))
    expect(keys().slice(6)).toEqual(EXISTING_KEYS)
  })
})

// -- what is unchanged ------------------------------------------------------

describe('ordinary hydration and the redirect path are untouched', () => {
  it('with no in-modal run, mcVisible returns PIECES order exactly', async () => {
    await signedInWith34()
    server = [pending(NEW_ID, NEW_EFFECTS), ...server]
    await sb.renderCollection()
    expect(sb.state().PAID_RUN_FOREGROUND).toEqual([])
    expect(keys()).toEqual(sb.state().PIECES.map((p: any) => p.key))
  })

  it('paidRunsFirst hands back the very same array when nothing is foregrounded', async () => {
    build()
    const list = [{ key: 'x', portfolioId: 'p' }]
    const src = fn('paidRunsFirst')
    const pr = new Function('PAID_RUN_FOREGROUND', src + '\nreturn paidRunsFirst;')([])
    expect(pr(list)).toBe(list)
  })

  it('the portfolio_paid handler (redirect methods, #169) passes no run', () => {
    // It has a session id, not a run: its paid callback is beginPaidRun() with
    // no argument, and it never reaches foregroundPaidRun.
    expect(returnHandler()).toContain('beginPaidRun();')
    expect(returnHandler()).not.toContain('foregroundPaidRun')
    expect(returnHandler()).not.toContain('beginPaidRun(run)')
  })

  it('the return handler, run for real, opens the collection with nothing foregrounded', async () => {
    // After a redirect the page has reloaded: PIECES is the demo seed, and the
    // handler reads its session id from the URL.
    server = [pending(NEW_ID, NEW_EFFECTS), ...EXISTING.map(([id, n]) => done(id, n))]
    const body = [
      retryConstants(), fn('pieceLanded'), fn('mcVisible'), fn('paidRunsFirst'), fn('renderCollection'),
      fn('openCollectionForPaidRun'), fn('foregroundPaidRun'), fn('beginPaidRun'), fn('verifyPurchasePaid'),
      'function runReturnHandler(){ ' + returnHandler() + ' }',
      'return { run: runReturnHandler, renderCollection: renderCollection, mcVisible: mcVisible,',
      '  fg: function(){ return PAID_RUN_FOREGROUND; } };',
    ].join('\n')
    const env: Record<string, unknown> = {
      fetch: async (url: string) => url === '/api/v1/portfolios'
        ? { ok: true, json: async () => ({ portfolios: server.map((p) => ({ id: p.id })) }) }
        : { ok: true, json: async () => ({ purchase: { status: 'paid' } }) },
      setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
      console: { log() {}, warn() {}, error() {} }, URLSearchParams,
      location: { search: '?portfolio_paid=1&session_id=cs_test_ret', pathname: '/discovery' },
      history: { replaceState() {} },
      loadPortfolio, loadShelf: () => Promise.resolve([]), activateIfStalled() {}, dispatchIfGenerating() {},
      openMyCollection: () => { opened++ }, renderMyCollectionGrid() {}, renderMycollRail() {},
      craftWhenPiecesLand() {}, readUnlockIntent: () => null, clearUnlockIntent() {}, requestUnlock() {},
      canonicalSeries: (x: string) => x, MC_SERIES: 'all', MC_STATE: 'all',
      PIECES: [{ key: 'demo0', series: 'Portraits', crafting: false, locked: true }],
      REAL_PIECES: false, RUN_LANDED: true, AWAITING_PAID_HYDRATION: false, PAID_RUN_FOREGROUND: [], FEATURED: null,
    }
    const h = new Function(...Object.keys(env), body)(...Object.values(env))
    h.run()
    await flush()
    expect(opened).toBe(1)
    expect(h.fg()).toEqual([])                          // nothing foregrounded
    await h.renderCollection()
    // A reload rebuilds PIECES newest-first, so the new run is first anyway.
    expect(h.mcVisible().slice(0, 4).map((p: any) => p.key)).toEqual(newKeys(NEW_ID, 4))
  })
})
