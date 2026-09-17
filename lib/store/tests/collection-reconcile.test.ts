// lib/store/tests/collection-reconcile.test.ts
//
// THE INVARIANT, ASSERTED AGAINST THE SHIPPING FILE.
//
//   MY COLLECTION MAY RENDER A CARD ONLY WHILE THE CURRENT SERVER RESPONSE
//   STILL ESTABLISHES THAT THE UNDERLYING PORTFOLIO/ITEM EXISTS.
//
// 2026-09-17: thirty portfolios, 116 items and 113 ledger rows were deleted
// from the database and My Collection went on drawing their cards. Nothing
// was wrong with the delete and nothing was cached by the server: every path
// into PIECES added or updated, and no code had ever existed that could take
// a card away. renderCollection returned early on an empty answer, so a
// server saying "you own nothing" was indistinguishable from a server saying
// nothing at all, and the parse-time seed, the SELECTED placeholders restored
// from liten_resume_v1 and the crafting placeholders from the last checkout
// all survived indefinitely.
//
// reconcileCollection is the subtraction that was missing. It is defined
// inside the single-file Discovery page, so this test lifts it out of the
// shipping HTML rather than out of a copy -- a copy is exactly what would let
// the two drift apart again.

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public/discovery-consolidated-draft.html'),
  'utf8',
)

/** Lift the reconciler, and the two key patterns it classifies with, out of
 *  the page itself. If either disappears or is renamed, this throws rather
 *  than quietly testing nothing. */
function loadReconciler() {
  const fn = HTML.match(/function reconcileCollection\(all, portfoliosKnown, shelfKnown\)\{[\s\S]*?\n\}/)
  const pk = HTML.match(/^var PORTFOLIO_KEY = .*$/m)
  const sk = HTML.match(/^var SHELF_KEY {5}= .*$/m)
  if (!fn || !pk || !sk) throw new Error('reconcileCollection or its key patterns are no longer in the page')

  const scope: any = {
    PIECES: [] as any[],
    unlockSelection: {} as Record<string, true>,
    JUST_LANDED: {} as Record<string, true>,
    INCLUDED_BY_PORTFOLIO: {} as Record<string, number>,
    PAID_RUN_FOREGROUND: [] as string[],
    FEATURED: null as any,
    REAL_PIECES: false,
    intentCleared: false,
  }

  /* pieceLanded's real contract: add by key, or replace in place. */
  const body = `
    ${pk[0]}
    ${sk[0]}
    function pieceLanded(piece){
      var at = -1;
      PIECES.forEach(function(p, i){ if (p.key === piece.key) at = i; });
      if (at < 0){ PIECES.push(piece); return true; }
      PIECES[at] = piece; return true;
    }
    function readUnlockIntent(){ return scope.intent || null; }
    function clearUnlockIntent(){ scope.intentCleared = true; }
    ${fn[0]}
    return reconcileCollection;
  `
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const make = new Function(
    'scope', 'PIECES', 'unlockSelection', 'JUST_LANDED',
    'INCLUDED_BY_PORTFOLIO', 'PAID_RUN_FOREGROUND',
    `var FEATURED = scope.FEATURED, REAL_PIECES = scope.REAL_PIECES;
     ${body}`,
  )
  const reconcile = make(
    scope, scope.PIECES, scope.unlockSelection, scope.JUST_LANDED,
    scope.INCLUDED_BY_PORTFOLIO, scope.PAID_RUN_FOREGROUND,
  )
  return { reconcile, scope }
}

const DEAD = '9f26ce5f-b87b-4c23-ab0e-9e5e795df73e'   // one of the 30 purged
const LIVE = '6d57664c-8c71-4101-bf2e-c90edea0b9d3'

/** Exactly what was on Rich's glass at the refresh: SELECTED placeholders
 *  (locked previews, no art), a demo-seed crafting card, four placeholders
 *  from a portfolio that no longer exists, and a shelf piece. */
function stalePieces() {
  return [
    { key: 'renaissance_noble', name: 'Renaissance Noble', crafting: false, locked: true, art: null },
    { key: 'stained_glass',     name: 'Stained Glass',     crafting: false, locked: true, art: null },
    { key: 'cubism',            name: 'Cubism',            crafting: false, locked: true, art: null },
    { key: 'demo27',            name: 'Renaissance Noble', crafting: true,  locked: true, art: null },
    { key: 'pf' + DEAD + ':0', portfolioId: DEAD, crafting: false, locked: true,  art: 'x' },
    { key: 'pf' + DEAD + ':1', portfolioId: DEAD, crafting: false, locked: true,  art: 'x' },
    { key: 'pf' + DEAD + ':2', portfolioId: DEAD, crafting: false, locked: true,  art: 'x' },
    { key: 'pf' + DEAD + ':3', portfolioId: DEAD, crafting: true,  locked: true,  art: null },
    { key: 'pc4821', name: 'Oil Impasto', crafting: false, locked: false, art: 'y' },
  ]
}

describe('My Collection reconciles against the server, including downward', () => {
  let reconcile: any, scope: any

  beforeEach(() => {
    const L = loadReconciler()
    reconcile = L.reconcile
    scope = L.scope
    scope.PIECES.length = 0
    stalePieces().forEach(p => scope.PIECES.push(p))
    scope.INCLUDED_BY_PORTFOLIO[DEAD] = 1
    scope.unlockSelection['pf' + DEAD + ':2'] = true
    scope.JUST_LANDED['pf' + DEAD + ':3'] = true
  })

  /* THE REPORTED DEFECT, AS THE CUSTOMER MET IT. */
  it('renders zero cards when the server owns nothing — Rich after the purge', () => {
    const changed = reconcile([], true, true)

    expect(scope.PIECES).toHaveLength(0)
    expect(changed).toBe(true)
  })

  it('takes the stale Crafting placeholder with it', () => {
    reconcile([], true, true)
    expect(scope.PIECES.filter((p: any) => p.crafting)).toHaveLength(0)
  })

  it('drops the client state hanging off every removed card', () => {
    scope.intent = { previewId: 'p1', key: 'pf' + DEAD + ':2' }
    scope.FEATURED = { key: 'pf' + DEAD + ':0' }

    reconcile([], true, true)

    expect(scope.unlockSelection).toEqual({})
    expect(scope.JUST_LANDED).toEqual({})
    expect(scope.INCLUDED_BY_PORTFOLIO).toEqual({})
    expect(scope.intentCleared).toBe(true)
  })

  /* THE OTHER HALF OF THE INVARIANT: an unreachable server is not an empty
     one. Pruning on a failed request would blank a working collection on the
     first flaky tick. */
  it('prunes nothing when neither source could be read', () => {
    reconcile([], false, false)
    expect(scope.PIECES).toHaveLength(9)
  })

  it('prunes only the namespace that actually answered', () => {
    reconcile([], true, false)            // portfolios known empty, shelf unread
    const keys = scope.PIECES.map((p: any) => p.key)
    expect(keys).toEqual(['pc4821'])      // shelf held; pf cards and seed gone
  })

  /* Partial deletion, which is the general case the purge was a special case
     of: what the server still returns stays, what it stopped returning goes. */
  it('keeps what the server still returns and removes only the rest', () => {
    const stillThere = [
      { key: 'pf' + LIVE + ':0', portfolioId: LIVE, crafting: false, locked: true, art: 'z' },
    ]
    scope.PIECES.push({ key: 'pf' + LIVE + ':0', portfolioId: LIVE, crafting: false, locked: true, art: 'z' })

    reconcile(stillThere, true, true)

    expect(scope.PIECES.map((p: any) => p.key)).toEqual(['pf' + LIVE + ':0'])
    expect(scope.INCLUDED_BY_PORTFOLIO).toEqual({})
  })

  /* A run bought seconds ago is not yet readable while the webhook is in
     flight. Held for the session that bought it -- and only that session. */
  it('holds the placeholders of a run bought in this session', () => {
    scope.PAID_RUN_FOREGROUND.push(DEAD)
    reconcile([], true, true)
    expect(scope.PIECES.map((p: any) => p.key)).toEqual([
      'pf' + DEAD + ':0', 'pf' + DEAD + ':1', 'pf' + DEAD + ':2', 'pf' + DEAD + ':3',
    ])
  })

  it('protects nothing on a plain page load, so a refresh cannot resurrect', () => {
    expect(scope.PAID_RUN_FOREGROUND).toHaveLength(0)
    reconcile([], true, true)
    expect(scope.PIECES).toHaveLength(0)
  })
})

/* The early returns that caused the defect must not come back: each one
   returned before PIECES could be reconciled. */
describe('renderCollection no longer bails out before reconciling', () => {
  it('does not treat an empty answer as no answer', () => {
    expect(HTML).not.toMatch(/if \(!results && !shelf\.length\) return null;/)
    expect(HTML).not.toMatch(/if \(!d \|\| !d\.portfolios \|\| !d\.portfolios\.length\) return null;/)
  })

  it('reconciles before it reports to the poller', () => {
    const tail = HTML.match(/var changed = reconcileCollection\([\s\S]*?return all\.some/)
    expect(tail, 'reconcileCollection must run before renderCollection returns').toBeTruthy()
  })

  it('the shelf reports an unreadable shelf as null, not as empty', () => {
    expect(HTML).toMatch(/shelf not loaded:', e\); return null;/)
    expect(HTML).toMatch(/if \(!d \|\| !Array\.isArray\(d\.pieces\)\) return null;/)
  })
})
