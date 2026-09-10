// lib/store/tests/post-purchase-discovery.test.ts
//
// After a confirmed purchase, Discovery starts again from nothing selected,
// and the one way back from every post-selection rail is the same control.
//
// PRODUCTION, 2026-09-10, a size-1 purchase paid in the embedded modal. Back
// in Discovery the purchased effect was still chosen, and the Curator said
// "You have 1. I'll pick 3 more to make 4." Card and Link finish in the modal
// and the page never reloads, so SELECTED, the tier held at that size and the
// server discovery session all still carried the run just bought. Nothing
// cleared them: the only clear was Start over.
//
// Also: My Collection's rail said "← Back to Workshop" -- a different label,
// a different control pinned to the foot of the rail, and a close that only
// swapped the rail back, leaving the Aspect Ratio stage up underneath it.
//
// These run the SHIPPED beginPaidRun, clearPurchasedSelection, releaseTier,
// verifyPurchasePaid, onEmbeddedCheckoutComplete, confirmSize, the four rail
// builders, closeMyCollection, showDiscovery, mycollBackToDiscovery and the
// rail's own click listener, cut out of the page by name. Only the network,
// the DOM and the clock are stubs.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public', 'discovery-consolidated-draft.html'), 'utf8',
).replace(/\r\n/g, '\n')

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
const retryConstants = () =>
  HTML.match(/^var PAID_RETRY_EVERY = \d+;\s*\nvar PAID_RETRY_TRIES = \d+;/m)![0]

/* The listener on the rail that My Collection's buttons go through. */
function mycollRailClick(): string {
  const head = "discoveryRail.addEventListener('click', function(e)"
  const at = HTML.indexOf(head, HTML.indexOf('\nfunction renderMycollRail('))
  if (at < 0) throw new Error('My Collection rail listener not found')
  const open = HTML.indexOf('{', at + head.length)
  return 'function(e)' + HTML.slice(open, matchBrace(HTML, open) + 1)
}

class FakeClassList {
  s = new Set<string>()
  constructor(...c: string[]) { c.forEach((x) => this.s.add(x)) }
  add(c: string) { this.s.add(c) }
  remove(c: string) { this.s.delete(c) }
  contains(c: string) { return this.s.has(c) }
  toggle(c: string, on?: boolean) { (on ?? !this.s.has(c)) ? this.s.add(c) : this.s.delete(c) }
}

// ── 1 · the purchased selection ─────────────────────────────────────

let verifyScript: string[]
let verifyCount: number
let log: string[]
let removes: string[]
let sb: any

function build(opts: { selected: string[]; tier?: number }) {
  const env: Record<string, unknown> = {
    fetch: async (url: string) => {
      if (url.startsWith('/api/v1/checkout/')) {
        const s = verifyScript[Math.min(verifyCount, verifyScript.length - 1)]
        verifyCount++
        return { ok: true, json: async () => ({ purchase: { status: s } }) }
      }
      throw new Error('unexpected fetch ' + url)
    },
    setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
    console: { log() {}, warn() {}, error() {} },
    document: {
      getElementById: (id: string) => id === 'sizeConfirm'
        ? sizeConfirm : null,
      querySelectorAll: () => [],
    },
    // the selection, as the page holds it
    SELECTED: opts.selected.map((k) => ({ key: k, baseId: k, name: 'E ' + k, siloName: 'Room' })),
    TIER: opts.tier ?? opts.selected.length,
    SLOTS: opts.selected.slice(),
    FILL_MODE: false,
    // state that must survive a purchase
    POSE: 'as_photographed', ASPECT: 'landscape', SRC_B64: 'BASE64SOURCE',
    SESSION_ID: 'sess-1', SUBJECT: 'woman',
    // the paid run
    STRIPE_EMBED: null, PIECES: [], REAL_PIECES: true, RUN_LANDED: true,
    AWAITING_PAID_HYDRATION: false, PAID_RUN_FOREGROUND: [],
    canonicalSeries: (s: string) => s,
    openMyCollection: () => { log.push('open collection') },
    craftWhenPiecesLand: () => { log.push('poll') },
    // what clearing talks to
    syncSelect: (id: string, action: string) => { log.push('sync ' + action + ' ' + id); if (action === 'remove') removes.push(id); return Promise.resolve(null) },
    syncDiscoveryChecks: () => { log.push('repaint checks') },
    afterSelectionChange: () => { log.push('after selection change') },
    // the size step
    SIZE_ASK: { kind: 'pick', size: null },
    act: () => {},
  }
  const sizeConfirm = { innerHTML: '', scrollIntoView() {} }
  const body = [
    retryConstants(),
    fn('releaseTier'),
    fn('openCollectionForPaidRun'), fn('foregroundPaidRun'),
    fn('beginPaidRun'), fn('clearPurchasedSelection'),
    fn('verifyPurchasePaid'), fn('closeCheckout'), fn('onEmbeddedCheckoutComplete'),
    fn('confirmSize'),
    'return { onEmbeddedCheckoutComplete: onEmbeddedCheckoutComplete, beginPaidRun: beginPaidRun,',
    '  clearPurchasedSelection: clearPurchasedSelection,',
    '  askPick: function(v){ SIZE_ASK = { kind:"pick", size:null }; confirmSize(v); return sizeConfirmEl.innerHTML; },',
    '  state: function(){ return { SELECTED: SELECTED, TIER: TIER, SLOTS: SLOTS, FILL_MODE: FILL_MODE,',
    '    POSE: POSE, ASPECT: ASPECT, SRC_B64: SRC_B64, SESSION_ID: SESSION_ID, SUBJECT: SUBJECT }; } };',
  ].join('\n')
  const all = { ...env, sizeConfirmEl: sizeConfirm }
  sb = new Function(...Object.keys(all), body)(...Object.values(all))
  return sb
}

const flush = () => vi.advanceTimersByTimeAsync(0)
const keys = () => sb.state().SELECTED.map((s: any) => s.key)
const runOf = (ids: string[]) => ({ portfolioId: 'pf-new', series: 'portraits', effectIds: ids.slice() })

beforeEach(() => {
  vi.useFakeTimers()
  verifyScript = ['paid']
  verifyCount = 0
  log = []
  removes = []
})
afterEach(() => { vi.useRealTimers() })

describe('a confirmed purchase takes its effects out of the selection', () => {
  it('size 1, paid in the modal: Discovery starts from nothing selected', async () => {
    const s = build({ selected: ['fx_amber'] })
    const before = s.state().SELECTED
    s.onEmbeddedCheckoutComplete('cs_test_1', runOf(['fx_amber']))
    await flush()
    const st = s.state()
    expect(st.SELECTED).toEqual([])
    expect(st.SELECTED).toBe(before)             // cleared in place; nothing holds a stale copy
    expect(st.TIER).toBe(0)                      // the size-1 hold is gone with it
    expect(st.SLOTS).toEqual([])
    expect(st.FILL_MODE).toBe(false)
  })

  it('the Curator no longer says "You have 1. I’ll pick 3 more to make 4."', async () => {
    const s = build({ selected: ['fx_amber'] })
    // what production showed, with the purchased effect still selected
    expect(s.askPick(4)).toContain('You have 1. I’ll pick 3 more to make 4.')
    s.onEmbeddedCheckoutComplete('cs_test_1', runOf(['fx_amber']))
    await flush()
    const said = s.askPick(4)
    expect(said).toContain('I’ll pick 4 for you.')
    expect(said).not.toContain('You have')
  })

  it('a 4-pack clears all four, and the server session is told about each', async () => {
    const ids = ['a', 'b', 'c', 'd']
    const s = build({ selected: ids })
    s.onEmbeddedCheckoutComplete('cs_test_4', runOf(ids))
    await flush()
    expect(keys()).toEqual([])
    expect(removes.sort()).toEqual(ids)
  })

  it('only the effects that checkout posted leave -- nothing else is touched', async () => {
    // Chosen after the modal closed, while the payment was still being
    // confirmed: not part of the run that was paid for.
    const s = build({ selected: ['a', 'b', 'c', 'd', 'later'], tier: 0 })
    s.onEmbeddedCheckoutComplete('cs_test_4', runOf(['a', 'b', 'c', 'd']))
    await flush()
    expect(keys()).toEqual(['later'])
    expect(removes).not.toContain('later')
  })

  it('this is not Start over: photograph, pose, shape, subject and session stay', async () => {
    const s = build({ selected: ['fx_amber'] })
    s.onEmbeddedCheckoutComplete('cs_test_1', runOf(['fx_amber']))
    await flush()
    const st = s.state()
    expect(st.SRC_B64).toBe('BASE64SOURCE')
    expect(st.POSE).toBe('as_photographed')
    expect(st.ASPECT).toBe('landscape')
    expect(st.SUBJECT).toBe('woman')
    expect(st.SESSION_ID).toBe('sess-1')
    expect(log.some((l) => l.startsWith('sync clear'))).toBe(false)   // not the all-clearing call
  })

  it('the Discovery checkmarks and the gauge repaint from the cleared selection', async () => {
    const s = build({ selected: ['fx_amber'] })
    s.onEmbeddedCheckoutComplete('cs_test_1', runOf(['fx_amber']))
    await flush()
    expect(log).toContain('repaint checks')
    expect(log).toContain('after selection change')
  })

  it('the collection opens first; the clear follows it, and the poll still starts', async () => {
    const s = build({ selected: ['fx_amber'] })
    s.onEmbeddedCheckoutComplete('cs_test_1', runOf(['fx_amber']))
    await flush()
    const open = log.indexOf('open collection')
    expect(open).toBe(0)
    expect(log.indexOf('sync remove fx_amber')).toBeGreaterThan(open)
    expect(log).toContain('poll')
  })
})

describe('nothing is cleared until the purchase row says paid', () => {
  it('pending, then paid: the selection is intact until the yes', async () => {
    verifyScript = ['pending', 'paid']
    const s = build({ selected: ['fx_amber'] })
    s.onEmbeddedCheckoutComplete('cs_test_1', runOf(['fx_amber']))
    await flush()
    expect(keys()).toEqual(['fx_amber'])
    expect(removes).toEqual([])
    await vi.advanceTimersByTimeAsync(2500)
    expect(keys()).toEqual([])
    expect(removes).toEqual(['fx_amber'])
  })

  for (const terminal of ['failed', 'refunded']) {
    it(`a definite ${terminal} leaves the selection exactly as it was`, async () => {
      verifyScript = [terminal]
      const s = build({ selected: ['fx_amber'] })
      s.onEmbeddedCheckoutComplete('cs_test_1', runOf(['fx_amber']))
      await vi.advanceTimersByTimeAsync(20_000)
      expect(keys()).toEqual(['fx_amber'])
      expect(s.state().TIER).toBe(1)
      expect(removes).toEqual([])
    })
  }

  it('never confirmed within the budget: selection intact (the existing rule)', async () => {
    verifyScript = ['pending']
    const s = build({ selected: ['fx_amber'] })
    s.onEmbeddedCheckoutComplete('cs_test_1', runOf(['fx_amber']))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(keys()).toEqual(['fx_amber'])
    expect(removes).toEqual([])
  })

  it('the return path has no run and clears nothing -- it arrives on a fresh page', async () => {
    const s = build({ selected: ['fx_amber'] })
    s.beginPaidRun()
    await flush()
    expect(keys()).toEqual(['fx_amber'])
    expect(removes).toEqual([])
    expect(log).toContain('open collection')
  })

  it('clearPurchasedSelection with no run, or an empty one, is a no-op', () => {
    const s = build({ selected: ['fx_amber'] })
    s.clearPurchasedSelection(undefined)
    s.clearPurchasedSelection({ portfolioId: 'x', effectIds: [] })
    expect(keys()).toEqual(['fx_amber'])
    expect(s.state().TIER).toBe(1)
    expect(log).toEqual([])
  })
})

// ── 2 · 3 · one label, one place, one destination ───────────────────

type Rail = 'review' | 'pose' | 'aspect' | 'mycoll'

function buildRails() {
  const handlers: Record<string, Record<string, unknown>> = {}
  const el = (id: string) => ({
    id, addEventListener: (ev: string, f: unknown) => { (handlers[id] ||= {})[ev] = f },
  })
  const rail = { innerHTML: '' }
  const showDiscovery = function showDiscovery() {}
  const env: Record<string, unknown> = {
    discoveryRail: rail,
    document: { getElementById: el },
    buildSummaryHtml: () => ({ bodyHtml: '<div class="sum"></div>', priceHtml: '<div id="tierR"></div>', info: { valid: true }, n: 1 }),
    openSlots: () => 0, photoStampHtml: () => '', paintTier() {}, fitStampThumb() {},
    ANALYZE_RESULT: null, focusStampThumb() {},
    showDiscovery, showAspect() {}, startCheckout() {},
    includedRemainingFor: () => 0, FEATURED: null, PIECES: [], unlockSelection: {},
    unlockPrice: (n: number) => n * 1.99, CURATOR_HEAD_HTML: '', featuredHtml: () => '',
  }
  const body = [
    fn('renderReviewRail'), fn('renderPoseRail'), fn('renderAspectRail'), fn('mcStat'), fn('renderMycollRail'),
    'return { review: renderReviewRail, pose: renderPoseRail, aspect: renderAspectRail, mycoll: renderMycollRail };',
  ].join('\n')
  const r = new Function(...Object.keys(env), body)(...Object.values(env))
  return {
    paint(which: Rail) { r[which](); return rail.innerHTML },
    handlers, showDiscovery,
  }
}

const BACK = /<a class="link-back" id="([A-Za-z]+)">← Back to Discovery<\/a>$/

describe('Back to Discovery: the same label and the same place on every rail', () => {
  it('there is no "Workshop" left anywhere in Discovery', () => {
    expect(HTML).not.toMatch(/Workshop/)
  })

  for (const which of ['review', 'pose', 'aspect', 'mycoll'] as Rail[]) {
    it(`${which}: the last thing in the rail is "← Back to Discovery", as a link-back`, () => {
      const html = buildRails().paint(which)
      expect(html).toMatch(BACK)
      expect(html.match(/Back to Discovery/g)).toHaveLength(1)
    })
  }

  it('all four rails end in the identical control -- only the id differs', () => {
    const rails = buildRails()
    const tails = (['review', 'pose', 'aspect', 'mycoll'] as Rail[])
      .map((w) => rails.paint(w).match(BACK)![0].replace(/id="[A-Za-z]+"/, 'id=""'))
    expect(new Set(tails).size).toBe(1)
  })

  it('My Collection no longer uses the pinned-to-the-foot .mc-back', () => {
    expect(buildRails().paint('mycoll')).not.toContain('mc-back')
  })

  it('the My Collection tour step names it the same way', () => {
    expect(HTML).toMatch(/sel:'#mycollBackRail', title:'Back to Discovery'/)
  })

  for (const which of ['review', 'pose', 'aspect'] as Rail[]) {
    it(`${which}: its Back to Discovery goes to showDiscovery (unchanged)`, () => {
      const rails = buildRails()
      rails.paint(which)
      expect(rails.handlers.btnBackRail.click).toBe(rails.showDiscovery)
    })
  }
})

describe('My Collection’s Back to Discovery lands on Discovery', () => {
  let views: Record<string, { classList: FakeClassList }>
  let railsPainted: string[]
  let acts: string[]

  function buildNav(opts: { under: 'aspect' | 'review' | 'pose' }) {
    views = {
      discoveryView: { classList: new FakeClassList('hidden') },
      reviewView: { classList: new FakeClassList(...(opts.under === 'review' ? ['active'] : [])) },
      poseView: { classList: new FakeClassList(...(opts.under === 'pose' ? ['active'] : [])) },
      aspectView: { classList: new FakeClassList(...(opts.under === 'aspect' ? ['active'] : [])) },
      mycoll: { classList: new FakeClassList('is-open') },
      navMyCollection: { classList: new FakeClassList('is-here') },
      body: { classList: new FakeClassList(...(opts.under === 'review' ? ['is-review'] : [])) },
    }
    railsPainted = []
    acts = []
    const env: Record<string, unknown> = {
      document: {
        getElementById: (id: string) => views[id] ?? null,
        body: views.body,
      },
      mycoll: Object.assign(views.mycoll, { setAttribute() {} }),
      discoveryView: views.discoveryView,
      reviewView: views.reviewView,
      unlockSelection: { k: true },
      // how openMyCollection records it: Review, or else 'discovery'
      railBeforeMycoll: opts.under === 'review' ? 'review' : 'discovery',
      renderReviewRail: () => { railsPainted.push('review') },
      restoreDiscoveryRail: () => { railsPainted.push('discovery') },
      act: (s: string) => { acts.push(s) },
      FEATURED: null,
    }
    const body = [
      fn('closeMyCollection'), fn('showDiscovery'), fn('mycollBackToDiscovery'),
      'var railClick = ' + mycollRailClick() + ';',
      'return { close: closeMyCollection, back: mycollBackToDiscovery,',
      '  click: function(sel){ return railClick({ target: { closest: function(s){ return s === sel ? {} : null; } } }); } };',
    ].join('\n')
    return new Function(...Object.keys(env), body)(...Object.values(env))
  }

  const onDiscovery = () => {
    expect(views.mycoll.classList.contains('is-open')).toBe(false)
    expect(views.discoveryView.classList.contains('hidden')).toBe(false)
    expect(views.aspectView.classList.contains('active')).toBe(false)
    expect(views.poseView.classList.contains('active')).toBe(false)
    expect(views.reviewView.classList.contains('active')).toBe(false)
    expect(views.body.classList.contains('is-review')).toBe(false)
    expect(railsPainted[railsPainted.length - 1]).toBe('discovery')
  }

  it('after a purchase (Aspect Ratio underneath): the Discovery stage and rail, together', () => {
    const n = buildNav({ under: 'aspect' })
    n.click('#mycollBackRail')
    onDiscovery()
    expect(acts).toContain('back to Discovery')
  })

  it('what it did before: closeMyCollection alone left the Aspect stage up under a Discovery rail', () => {
    const n = buildNav({ under: 'aspect' })
    n.close()
    expect(views.aspectView.classList.contains('active')).toBe(true)
    expect(views.discoveryView.classList.contains('hidden')).toBe(true)
    expect(railsPainted).toEqual(['discovery'])
  })

  it('opened over Review: the label says Discovery, so it goes to Discovery, not Review', () => {
    const n = buildNav({ under: 'review' })
    n.click('#mycollBackRail')
    onDiscovery()
  })

  it('opened over Pose: Discovery', () => {
    const n = buildNav({ under: 'pose' })
    n.click('#mycollBackRail')
    onDiscovery()
  })

  it('the main-nav toggle still closes through closeMyCollection alone (unchanged)', () => {
    expect(HTML).toContain("if (mycoll.classList.contains('is-open')) closeMyCollection(); else openMyCollection();")
  })
})
