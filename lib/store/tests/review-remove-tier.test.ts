// lib/store/tests/review-remove-tier.test.ts
//
// Removing from a held bundle in Review, down to a smaller valid bundle.
//
// PRODUCTION BUG, 2026-09-10. Pick for 4, add up to 8, go to Review, then
// remove with the Review x until 4 remain. The rail stayed on the 8:
// "4 of 8", "Choose 4 more to complete your 8" -- and the 4-pack could not
// be bought, because every Next button and startCheckout refuse while a
// slot is open, and the rail's tier marks ignore taps while a tier is held.
//
// Cause: removeFanItem, while a tier is held, turns the removed card into an
// open slot and leaves TIER alone, and nothing re-checked the new count. The
// Discovery grid's deselect path releases the tier and was never affected.
//
// Ruled 2026-09-10: keep the held 8 at 5, 6 and 7. When a Review removal
// lands exactly on a smaller valid bundle, release the hold and relock there.
//
// These run the SHIPPED removeFanItem, releaseTier, lockTier, openSlots,
// afterSelectionChange, updateCollectionSummary, paintTier, tierRungs,
// markHtml, priceOf and sizeInfo, cut out of the page by name. The rail's
// text and the Next button are read from what those functions write.

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'

const FILE = path.join(process.cwd(), 'public', 'discovery-consolidated-draft.html')
// LF throughout: git checks this file out with CRLF on Windows (core.autocrlf),
// while `git show` below returns LF. Compare content, not line endings.
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

type Stub = { classes: Set<string>; classList: any; innerHTML: string; textContent: string; disabled: boolean }
function stub(): Stub {
  const classes = new Set<string>()
  return {
    classes, innerHTML: '', textContent: '', disabled: false,
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
  els = { tierD: stub(), collNext: stub(), btnGoReview: stub() }
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
    applyFanTransform() {}, layoutFans() {}, showDiscovery() {}, renderReviewRail() {},
    syncSelect: (k: string, what: string) => { if (what === 'remove') serverRemoves.push(k) },
    SELECTED,
    VALID_SIZES: [1, 4, 8, 16],
    SIZE_PRICE: { 1: 2.99, 4: 4.99, 8: 7.99, 16: 12.99 },
    SERVER_OFFER: null,
    TIER: 0, SLOTS: [], FILL_MODE: false,
  }
  // renderReviewGrid rebuilds the fan from SLOTS (reviewItems hands the fan
  // SLOTS, not SELECTED). Reproduced here so a relock is visible.
  const body = [
    fn('openSlots'), fn('releaseTier'), fn('lockTier'), fn('priceOf'), fn('tierRungs'),
    fn('markHtml'), fn('paintTier'), fn('sizeInfo'), fn('updateCollectionSummary'),
    fn('afterSelectionChange'), fn('removeFanItem'),
    'function renderReviewGrid(){ __rebuilt(); fanState.fans = [SLOTS.map(function(k){ return k ? { key:k, el:__card() } : { key:"slot", slot:true, el:__card() }; })]; }',
    'return {',
    '  lockTier: lockTier, removeFanItem: removeFanItem, updateCollectionSummary: updateCollectionSummary,',
    '  enterReview: function(){ if (!TIER || SLOTS.length !== TIER) lockTier(); },',
    '  setHeld: function(t, s, fill){ TIER = t; SLOTS = s; FILL_MODE = !!fill; },',
    '  state: function(){ return { TIER: TIER, SLOTS: SLOTS.slice(), open: openSlots(), n: SELECTED.length, FILL_MODE: FILL_MODE }; }',
    '};',
  ].join('\n')
  const names = [...Object.keys(env), '__rebuilt', '__card']
  const vals = [...Object.values(env), () => { reviewGridRebuilds++ }, cardEl]
  sb = new Function(...names, body)(...vals)
  return sb
}

/** What the customer reads on the rail, from what the shipped code wrote. */
function rail() {
  sb.updateCollectionSummary()
  const html = els.tierD.innerHTML
  return {
    held: /class="cnt held"/.test(html),
    counter: (html.match(/<div class="cnt[^"]*"[^>]*>([^<]*)<\/div>/) || [])[1],
    fourMark: /<span class="t">4<\/span><span class="p">\$4\.99<\/span>/.test(html),
    choose: els.collNext.textContent,
    nextOn: els.btnGoReview.classes.has('on'),
  }
}

/** The Review x on one of the real (non-slot) cards. */
function removeOne() {
  const card = fanState.fans[0].find((x) => !x.slot && !String(x.key).startsWith('slot'))!
  sb.removeFanItem(0, card.key)
  return card.key
}

let sel: string[]
beforeEach(() => { sel = [] })

// -- the production reproduction --------------------------------------

describe('Review x from a held 8 down to 4', () => {
  it('5, 6 and 7 keep the held 8', () => {
    build(keysOf(8)); sb.enterReview()
    expect(sb.state().TIER).toBe(8)
    for (const n of [7, 6, 5]) {
      removeOne()
      const r = rail()
      expect(sb.state()).toMatchObject({ TIER: 8, n, open: 8 - n })
      expect(r.held).toBe(true)
      expect(r.counter).toBe(`${n} of 8`)
      expect(r.choose).toBe(`Choose ${8 - n} more to complete your 8`)
      expect(r.nextOn).toBe(false)
    }
  })

  it('at exactly 4 the hold is released and the 4-pack is restored', () => {
    build(keysOf(8)); sb.enterReview()
    for (let i = 0; i < 4; i++) removeOne()
    const s = sb.state()
    expect(s.n).toBe(4)
    expect(s.TIER).toBe(4)                               // relocked at the new size
    expect(s.open).toBe(0)                               // nothing left to fill
    expect(s.SLOTS).toEqual(['fx4', 'fx5', 'fx6', 'fx7'])
    const r = rail()
    expect(r.held).toBe(false)
    expect(r.counter).toBe('4')
    expect(r.fourMark).toBe(true)                        // 4 · $4.99 on the rail
    expect(r.choose).toBe('')                            // no "Choose 4 more"
    expect(r.nextOn).toBe(true)                          // and the customer can continue
  })

  it('the Review fan is rebuilt at 4, with no leftover slot cards', () => {
    build(keysOf(8)); sb.enterReview()
    for (let i = 0; i < 3; i++) removeOne()
    expect(fanState.fans[0].filter((x: any) => x.slot)).toHaveLength(3)   // 5: three open slots
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

  it('checkout is no longer blocked at 4', () => {
    // startCheckout: if (!n || VALID_SIZES.indexOf(n) === -1 || openSlots()) return;
    build(keysOf(8)); sb.enterReview()
    for (let i = 0; i < 4; i++) removeOne()
    const { n, open } = sb.state()
    expect([1, 4, 8, 16]).toContain(n)
    expect(open).toBe(0)
  })
})

// -- the full ladder 1 -> 4 -> 5 -> 8 -> 7 -> 4 ---------------------------

describe('bundle transitions 1 -> 4 -> 5 -> 8 -> 7 -> 4', () => {
  it('matches the agreed states at every step', () => {
    // Discovery: adding, nothing held.
    const up: Array<[number, { valid: boolean; counter: string }]> = [
      [1, { valid: true, counter: '1' }], [4, { valid: true, counter: '4' }],
      [5, { valid: false, counter: '5' }], [8, { valid: true, counter: '8' }],
    ]
    for (const [n, want] of up) {
      build(keysOf(n))
      const r = rail()
      expect(r.held).toBe(false)
      expect(r.counter).toBe(want.counter)
      expect(r.nextOn).toBe(want.valid)
      expect(r.choose).toBe('')
    }
    // Review at 8, then the Review x.
    build(keysOf(8)); sb.enterReview()
    removeOne()
    let r = rail()
    expect([r.held, r.counter, r.choose, r.nextOn]).toEqual([true, '7 of 8', 'Choose 1 more to complete your 8', false])
    removeOne(); removeOne(); removeOne()
    r = rail()
    expect([r.held, r.counter, r.choose, r.nextOn]).toEqual([false, '4', '', true])
  })
})

// -- the same rule on the other tiers --------------------------------------

describe('the rule is "a smaller valid bundle", not "exactly 4"', () => {
  it('16 held down to 8 releases at 8; 9-15 stay held', () => {
    build(keysOf(16)); sb.enterReview()
    for (let n = 15; n >= 9; n--) { removeOne(); expect(sb.state()).toMatchObject({ TIER: 16, n }) }
    removeOne()
    expect(sb.state()).toMatchObject({ TIER: 8, n: 8, open: 0 })
    expect(rail().nextOn).toBe(true)
  })

  it('4 held down to 1 releases at 1; 3 and 2 stay held', () => {
    build(keysOf(4)); sb.enterReview()
    removeOne(); expect(sb.state()).toMatchObject({ TIER: 4, n: 3, open: 1 })
    removeOne(); expect(sb.state()).toMatchObject({ TIER: 4, n: 2, open: 2 })
    removeOne(); expect(sb.state()).toMatchObject({ TIER: 1, n: 1, open: 0 })
  })

  it('8 released at 4 then taken further holds the new 4', () => {
    build(keysOf(8)); sb.enterReview()
    for (let i = 0; i < 4; i++) removeOne()
    removeOne()
    expect(sb.state()).toMatchObject({ TIER: 4, n: 3, open: 1 })
    expect(rail().choose).toBe('Choose 1 more to complete your 4')
  })
})

// -- what must not change ---------------------------------------------------

describe('untouched', () => {
  it('Help me choose 8 from 4 picked is still a deliberate held 8', () => {
    // runSize: TIER = v; SLOTS = SELECTED keys + nulls. The repaint must not
    // release it -- the rule lives on the removal event, not in the rail.
    build(keysOf(4))
    sb.setHeld(8, [...keysOf(4), null, null, null, null], true)
    const r = rail()
    expect(sb.state()).toMatchObject({ TIER: 8, n: 4, open: 4, FILL_MODE: true })
    expect([r.held, r.counter, r.choose, r.nextOn]).toEqual([true, '4 of 8', 'Choose 4 more to complete your 8', false])
  })

  it('a removal that does not land on a bundle still leaves an open slot card', () => {
    build(keysOf(8)); sb.enterReview()
    removeOne()
    expect(fanState.fans[0].filter((x: any) => x.slot)).toHaveLength(1)
    expect(reviewGridRebuilds).toBe(0)
  })

  it('removing with nothing held is unchanged', () => {
    build(keysOf(5))                                     // Review never locks 5
    sb.enterReview()
    expect(sb.state().TIER).toBe(0)
    removeOne()
    expect(sb.state()).toMatchObject({ TIER: 0, n: 4 })
    expect(reviewGridRebuilds).toBe(0)
  })

  it('every shared tier function is byte-identical to main', () => {
    let main: string
    try { main = execSync('git show origin/main:public/discovery-consolidated-draft.html', { maxBuffer: 64 << 20 }).toString().replace(/\r\n/g, '\n') }
    catch { return }                                     // no git history available: skip, the behaviour tests above still hold
    for (const n of ['lockTier', 'releaseTier', 'openSlots', 'paintTier', 'updateCollectionSummary',
                     'afterSelectionChange', 'toggleSelect', 'runSize', 'showReview', 'startCheckout', 'sizeInfo']) {
      expect(fnFrom(HTML, n), n).toBe(fnFrom(main, n))
    }
  })

  it('removeFanItem is the only function that changed', () => {
    expect(fn('removeFanItem')).toContain('if (SELECTED.length < TIER && VALID_SIZES.indexOf(SELECTED.length) > -1){')
  })
})
