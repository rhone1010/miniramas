// lib/store/tests/review-remove-tier.test.ts
//
// ONE TARGET BUNDLE, and the #172 Review removal behaviour on top of it.
//
// PRODUCTION BUG, 2026-09-10 (#172). Pick for 4, add up to 8, go to Review,
// then remove with the Review x until 4 remain. The rail stayed on the 8 --
// "4 of 8", "Choose 4 more to complete your 8" -- and the 4-pack could not be
// bought. Ruled then: keep the held 8 at 5, 6 and 7; when a Review removal
// lands exactly on a smaller valid bundle, let go and relock there.
//
// PASS 2, 2026-09-13 (Rich): there is ONE targetBundle, derived from the
// count -- 0-1 -> 1, 2-4 -> 4, 5-8 -> 8, 9-16 -> 16 -- shared by the upper
// bundle indicator, the Collection's target circle, the progress rail, Pick
// for me and Review. An exact tier holds until the customer goes past it;
// removals follow it down; nothing is sticky. #172's rule is now simply that
// rule: targetFor(5..7) is 8, targetFor(4) is 4. There is no second
// held-tier state (the old TIER variable is gone), so none can disagree.
//
// These run the SHIPPED targetFor, targetBundle, openSlots, releaseTier,
// lockTier, priceOf, markHtml, paintTier, paintBundle, sizeInfo,
// updateCollectionSummary, afterSelectionChange and removeFanItem, cut out
// of the page by name. The rail and bundle markup are read from what those
// functions write.

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), 'public', 'discovery-consolidated-draft.html')
// LF throughout: git checks this file out with CRLF on Windows (core.autocrlf).
const HTML = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n')

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
function fnFrom(src: string, name: string): string | null {
  const at = src.indexOf('\nfunction ' + name + '(')
  if (at < 0) return null
  return src.slice(at + 1, matchBrace(src, src.indexOf('{', at)) + 1)
}
const fn = (name: string) => {
  const s = fnFrom(HTML, name)
  if (!s) throw new Error('function not found in page: ' + name)
  return s
}

// -- a Review session in a sandbox ------------------------------------

type Stub = { classes: Set<string>; classList: any; innerHTML: string; textContent: string; disabled: boolean; attrs: Record<string, string>; setAttribute: any }
function stub(): Stub {
  const classes = new Set<string>(), attrs: Record<string, string> = {}
  return {
    classes, attrs, innerHTML: '', textContent: '', disabled: false,
    setAttribute: (k: string, v: string) => { attrs[k] = v },
    classList: {
      add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c),
      contains: (c: string) => classes.has(c),
      toggle: (c: string, on?: boolean) => { (on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c) },
    },
  }
}
function cardEl(): any {
  const e: any = stub()
  e.style = {}
  e.cloneNode = () => { const c = cardEl(); return c }
  e.addEventListener = () => {}
  e.parentNode = { replaceChild: () => {}, removeChild: () => {} }
  return e
}

let els: Record<string, Stub>
let fanState: { fans: Array<Array<{ key: string; el: any; slot?: boolean }>> }
let reviewGridRebuilds: number
let serverRemoves: string[]
let sb: any

const keysOf = (n: number) => Array.from({ length: n }, (_, i) => 'fx' + i)

function build(selected: string[]) {
  els = { tierD: stub(), bundleInd: stub(), btnGoReview: stub() }
  reviewGridRebuilds = 0
  serverRemoves = []
  const SELECTED = selected.map((k) => ({ key: k, name: k }))
  fanState = { fans: [SELECTED.map((s) => ({ key: s.key, el: cardEl() }))] }
  const env: Record<string, unknown> = {
    document: { getElementById: (id: string) => els[id] || null },
    reviewView: { classList: { contains: (c: string) => c === 'active' } },   // we are in Review
    fanState,
    setTimeout: (f: () => void) => f(),
    act() {}, syncDiscoveryChecks() {}, logPayloadIfReady() {}, paintMinimapSelection() {},
    paintCuratedRail() {}, paintAllEffects() {}, coachUpdate() {},
    applyFanTransform() {}, layoutFans() {}, showDiscovery() {}, renderReviewRail() {},
    syncSelect: (k: string, what: string) => { if (what === 'remove') serverRemoves.push(k) },
    SELECTED,
    VALID_SIZES: [1, 4, 8, 16],
    SIZE_PRICE: { 1: 2.99, 4: 4.99, 8: 7.99, 16: 12.99 },
    SERVER_OFFER: null,
    SLOTS: [], FILL_MODE: false, TARGET_PICK: 0,
  }
  // renderReviewGrid rebuilds the fan from SLOTS. Reproduced here so a
  // relock is visible.
  const body = [
    fn('targetFor'), fn('targetBundle'), fn('openSlots'), fn('releaseTier'), fn('lockTier'), fn('priceOf'),
    fn('markHtml'), fn('paintTier'), fn('paintBundle'), fn('sizeInfo'), fn('updateCollectionSummary'),
    fn('afterSelectionChange'), fn('removeFanItem'),
    'function renderReviewGrid(){ __rebuilt(); fanState.fans = [SLOTS.map(function(k){ return k ? { key:k, el:__card() } : { key:"slot", slot:true, el:__card() }; })]; }',
    'return {',
    '  targetFor: targetFor, removeFanItem: removeFanItem, updateCollectionSummary: updateCollectionSummary,',
    '  enterReview: function(){ if (SLOTS.length !== targetBundle()) lockTier(); },',
    '  pickTarget: function(v){ TARGET_PICK = v; var t = targetBundle(); TARGET_PICK = 0; return t; },',
    '  state: function(){ return { target: targetBundle(), SLOTS: SLOTS.slice(), open: openSlots(), n: SELECTED.length, FILL_MODE: FILL_MODE }; }',
    '};',
  ].join('\n')
  const names = [...Object.keys(env), '__rebuilt', '__card']
  const vals = [...Object.values(env), () => { reviewGridRebuilds++ }, cardEl]
  sb = new Function(...names, body)(...vals)
  return sb
}

/** What the customer reads on the rail and the bundle, from what the shipped code wrote. */
function rail() {
  sb.updateCollectionSummary()
  const html = els.tierD.innerHTML
  const mark = (html.match(/class="mark target[^"]*"[^>]*><span class="t">(\d+)<\/span><span class="p">([^<]*)<\/span>/) || [])
  const bundle = els.bundleInd.innerHTML.match(/<span class="b-n">(\d+)<\/span><span class="b-p">([^<]*)<\/span>/) || []
  return {
    counter: (html.match(/<div class="cnt[^"]*"[^>]*>([^<]*)<\/div>/) || [])[1],
    target: mark[1], price: mark[2],
    bundleTarget: bundle[1], bundlePrice: bundle[2],
    reviewUsable: !els.btnGoReview.disabled,
  }
}

/** The Review x on one of the real (non-slot) cards. */
function removeOne() {
  const card = fanState.fans[0].find((x) => !x.slot && !String(x.key).startsWith('slot'))!
  sb.removeFanItem(0, card.key)
  return card.key
}

beforeEach(() => {})

// -- the rule itself ----------------------------------------------------------

describe('one target bundle, from the count', () => {
  it('0-1 -> 1, 2-4 -> 4, 5-8 -> 8, 9-16 -> 16 (Rich, 2026-09-13)', () => {
    build([])
    const want = [1, 1, 4, 4, 4, 8, 8, 8, 8, 16, 16, 16, 16, 16, 16, 16, 16]
    want.forEach((t, n) => expect(sb.targetFor(n), `count ${n}`).toBe(t))
  })

  it('the upper bundle indicator and the Collection target always show the same target and price', () => {
    for (let n = 0; n <= 16; n++) {
      build(keysOf(n))
      const r = rail()
      expect(r.bundleTarget, `count ${n}`).toBe(r.target)
      expect(r.bundlePrice, `count ${n}`).toBe(r.price)
    }
  })

  it('at zero the target is 1 / $2.99, and Review is visible but not usable', () => {
    build([])
    const r = rail()
    expect([r.target, r.price, r.counter, r.reviewUsable]).toEqual(['1', '$2.99', '0', false])
  })

  it('an exact tier holds; adding past it moves on; removing follows it down', () => {
    const steps: Array<[number, string]> = [[1, '1'], [2, '4'], [4, '4'], [5, '8'], [8, '8'], [9, '16'], [16, '16'], [8, '8'], [4, '4'], [1, '1']]
    for (const [n, t] of steps) { build(keysOf(n)); expect(rail().target, `count ${n}`).toBe(t) }
  })

  it('Review is usable from 1 at every count, incomplete ones included', () => {
    for (const n of [1, 2, 3, 5, 6, 12, 15, 16]) { build(keysOf(n)); expect(rail().reviewUsable, `count ${n}`).toBe(true) }
  })

  it("Pick for me's chosen size sets the target while it fills", () => {
    build(keysOf(1))
    expect(sb.pickTarget(8)).toBe(8)
    expect(sb.state().target).toBe(1)                     // and only while it fills
  })
})

// -- #172 on the shared target ------------------------------------------------

describe('Review x from a full 8 down to 4 (#172)', () => {
  it('5, 6 and 7 keep the target at 8, with open places', () => {
    build(keysOf(8)); sb.enterReview()
    expect(sb.state().target).toBe(8)
    for (const n of [7, 6, 5]) {
      removeOne()
      const r = rail()
      expect(sb.state()).toMatchObject({ target: 8, n, open: 8 - n })
      expect([r.counter, r.target, r.price]).toEqual([String(n), '8', '$7.99'])
    }
  })

  it('at exactly 4 the target is 4 and the 4-pack is restored', () => {
    build(keysOf(8)); sb.enterReview()
    for (let i = 0; i < 4; i++) removeOne()
    const s = sb.state()
    expect(s).toMatchObject({ n: 4, target: 4, open: 0 })
    expect(s.SLOTS).toEqual(['fx4', 'fx5', 'fx6', 'fx7'])
    const r = rail()
    expect([r.counter, r.target, r.price]).toEqual(['4', '4', '$4.99'])
  })

  it('the Review fan is rebuilt at 4, with no leftover slot cards', () => {
    build(keysOf(8)); sb.enterReview()
    for (let i = 0; i < 3; i++) removeOne()
    expect(fanState.fans[0].filter((x: any) => x.slot)).toHaveLength(3)   // 5: three open places
    removeOne()
    expect(reviewGridRebuilds).toBe(1)
    expect(fanState.fans[0]).toHaveLength(4)
    expect(fanState.fans[0].some((x: any) => x.slot)).toBe(false)
  })

  it('every removal still reaches the server session', () => {
    build(keysOf(8)); sb.enterReview()
    const removed = [removeOne(), removeOne(), removeOne(), removeOne()]
    expect(serverRemoves).toEqual(removed)
  })

  it('checkout is not blocked at 4 (startCheckout: valid size and no open place)', () => {
    build(keysOf(8)); sb.enterReview()
    for (let i = 0; i < 4; i++) removeOne()
    const { n, open } = sb.state()
    expect([1, 4, 8, 16]).toContain(n)
    expect(open).toBe(0)
  })
})

describe('the same rule on the other tiers', () => {
  it('16 down to 8 lands on 8; 9-15 keep 16', () => {
    build(keysOf(16)); sb.enterReview()
    for (let n = 15; n >= 9; n--) { removeOne(); expect(sb.state()).toMatchObject({ target: 16, n }) }
    removeOne()
    expect(sb.state()).toMatchObject({ target: 8, n: 8, open: 0 })
  })

  it('4 down to 1 lands on 1; 3 and 2 keep 4', () => {
    build(keysOf(4)); sb.enterReview()
    removeOne(); expect(sb.state()).toMatchObject({ target: 4, n: 3, open: 1 })
    removeOne(); expect(sb.state()).toMatchObject({ target: 4, n: 2, open: 2 })
    removeOne(); expect(sb.state()).toMatchObject({ target: 1, n: 1, open: 0 })
  })

  it('8 down to 4 then further keeps the new 4', () => {
    build(keysOf(8)); sb.enterReview()
    for (let i = 0; i < 4; i++) removeOne()
    removeOne()
    expect(sb.state()).toMatchObject({ target: 4, n: 3, open: 1 })
  })

  it('an incomplete count enters Review with open places for the rest', () => {
    build(keysOf(5)); sb.enterReview()
    expect(sb.state()).toMatchObject({ target: 8, n: 5, open: 3 })
    expect(sb.state().SLOTS.filter((k: any) => !k)).toHaveLength(3)
  })

  it('a removal that does not land on a bundle leaves an open slot card', () => {
    build(keysOf(8)); sb.enterReview()
    removeOne()
    expect(fanState.fans[0].filter((x: any) => x.slot)).toHaveLength(1)
    expect(reviewGridRebuilds).toBe(0)
  })
})

describe('one source of truth', () => {
  it('there is no second held-tier state: no TIER variable, one targetBundle', () => {
    expect(HTML).not.toMatch(/\bvar TIER\b/)
    expect(HTML.match(/\nfunction targetBundle\(/g)).toHaveLength(1)
    for (const n of ['paintTier', 'paintBundle', 'openSlots', 'lockTier', 'reviewItems', 'removeFanItem']) {
      expect(fn(n), n).toMatch(/targetBundle\(\)/)
    }
  })
})
