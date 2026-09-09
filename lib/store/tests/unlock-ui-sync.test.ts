// lib/store/tests/unlock-ui-sync.test.ts
//
// UI state synchronisation for unlock. Three defects, modelled here as the
// client now behaves. No database, no network, no DOM.
//
// 1. Nothing on screen changed until renderCollection() finished — a full
//    re-read of every portfolio, eight requests for a collection of three,
//    on top of an unlock call that downloads the clean original. Three
//    seconds of an untouched card, which reads as a click that did not land.
//    The confirmed piece now updates from the 200 itself.
//
// 2. No in-flight guard. Every click during that window fired another
//    POST /portraits/unlock and another renderCollection, so impatience made
//    it slower.
//
// 3. includedRemaining was one global, assigned by loadPortfolio for every
//    portfolio in parallel — last resolver won, non-deterministically. With
//    three portfolios the rail showed some other portfolio's count and never
//    moved when you spent this one's.

import { describe, it, expect, beforeEach } from 'vitest'

type Piece = { key: string; portfolioId?: string; locked: boolean }

const PF_A = 'portfolio-a'
const PF_B = 'portfolio-b'

let PIECES: Piece[]
let INCLUDED_BY_PORTFOLIO: Record<string, number>
let UNLOCK_INFLIGHT: Record<string, boolean>
let serverCalls: number
let repaints: number

/** includedRemainingFor, as shipped. */
function includedRemainingFor(p: Piece | null): number {
  if (!p || !p.portfolioId) return 0
  const n = INCLUDED_BY_PORTFOLIO[p.portfolioId]
  return typeof n === 'number' ? n : 0
}

const tick = () => new Promise((r) => setTimeout(r, 5))

/** The server round trip: slow on purpose, and counted. */
async function serverUnlock(key: string): Promise<'ok' | 'no_entitlement'> {
  serverCalls++
  const piece = PIECES.find((p) => p.key === key)!
  const remaining = includedRemainingFor(piece)
  await tick()
  return remaining > 0 ? 'ok' : 'no_entitlement'
}

/** unlockPiece + requestUnlock, as shipped. */
async function unlockPiece(p: Piece): Promise<string> {
  if (!p || !p.locked) return 'skipped'
  if (UNLOCK_INFLIGHT[p.key]) return 'in_flight'      // guard
  UNLOCK_INFLIGHT[p.key] = true
  try {
    const res = await serverUnlock(p.key)
    if (res !== 'ok') return 'failed'
    // post-confirmation: only the confirmed piece, only its own portfolio
    const confirmed = PIECES.find((x) => x.key === p.key)
    if (confirmed) {
      confirmed.locked = false
      if (confirmed.portfolioId && INCLUDED_BY_PORTFOLIO[confirmed.portfolioId] > 0) {
        INCLUDED_BY_PORTFOLIO[confirmed.portfolioId] -= 1
      }
    }
    repaints++
    return 'unlocked'
  } finally {
    delete UNLOCK_INFLIGHT[p.key]
  }
}

beforeEach(() => {
  PIECES = [
    { key: 'pfA:0', portfolioId: PF_A, locked: true },
    { key: 'pfA:1', portfolioId: PF_A, locked: true },
    { key: 'pfB:0', portfolioId: PF_B, locked: true },
    { key: 'pc-shelf', locked: false },          // owned outright, no portfolio
  ]
  INCLUDED_BY_PORTFOLIO = { [PF_A]: 1, [PF_B]: 1 }
  UNLOCK_INFLIGHT = {}
  serverCalls = 0
  repaints = 0
})

describe('one click unlocks immediately', () => {
  it('the confirmed piece is unlocked and repainted on the response', async () => {
    expect(await unlockPiece(PIECES[0])).toBe('unlocked')
    expect(PIECES[0].locked).toBe(false)
    expect(repaints).toBe(1)
    expect(serverCalls).toBe(1)
  })

  it('touches no sibling piece', async () => {
    await unlockPiece(PIECES[0])
    expect(PIECES[1].locked).toBe(true)   // same portfolio
    expect(PIECES[2].locked).toBe(true)   // other portfolio
  })

  it('never unlocks before the server confirms', async () => {
    INCLUDED_BY_PORTFOLIO[PF_A] = 0       // server will refuse
    expect(await unlockPiece(PIECES[0])).toBe('failed')
    expect(PIECES[0].locked).toBe(true)
    expect(repaints).toBe(0)
  })
})

describe('in-flight guard', () => {
  it('five rapid clicks send exactly one request', async () => {
    const p = PIECES[0]
    const results = await Promise.all([
      unlockPiece(p), unlockPiece(p), unlockPiece(p), unlockPiece(p), unlockPiece(p),
    ])
    expect(serverCalls).toBe(1)
    expect(results.filter((r) => r === 'unlocked')).toHaveLength(1)
    expect(results.filter((r) => r === 'in_flight')).toHaveLength(4)
  })

  it('does not block a different piece', async () => {
    const [a, b] = await Promise.all([unlockPiece(PIECES[0]), unlockPiece(PIECES[2])])
    expect([a, b]).toEqual(['unlocked', 'unlocked'])
    expect(serverCalls).toBe(2)
  })

  it('clears after completion, so a later click is allowed', async () => {
    await unlockPiece(PIECES[0])
    expect(UNLOCK_INFLIGHT['pfA:0']).toBeUndefined()
    // A different portfolio still has its own allowance.
    expect(await unlockPiece(PIECES[2])).toBe('unlocked')
  })

  it('a second piece in a spent portfolio is refused, not blocked by the guard', async () => {
    // This is production's observed behaviour: image one unlocks, image two
    // stays locked because that portfolio's included unlock is gone. The
    // request is still SENT — the guard is per piece, not a lockout.
    await unlockPiece(PIECES[0])
    const before = serverCalls
    expect(await unlockPiece(PIECES[1])).toBe('failed')
    expect(serverCalls).toBe(before + 1)
    expect(PIECES[1].locked).toBe(true)
  })
})

describe('included unlocks are per portfolio', () => {
  it('drops to 0 for that portfolio immediately after a successful unlock', async () => {
    await unlockPiece(PIECES[0])
    expect(includedRemainingFor(PIECES[0])).toBe(0)
  })

  it('leaves the other portfolio untouched', async () => {
    await unlockPiece(PIECES[0])
    expect(includedRemainingFor(PIECES[2])).toBe(1)
  })

  it('shows the featured piece own portfolio count, not a global', async () => {
    await unlockPiece(PIECES[0])                       // spend A's
    expect(includedRemainingFor(PIECES[0])).toBe(0)    // featuring A
    expect(includedRemainingFor(PIECES[2])).toBe(1)    // featuring B
    // The old global would have read 1 for both — whichever portfolio's
    // fetch resolved last set it.
  })

  it('is not a sum across portfolios', async () => {
    const total = Object.values(INCLUDED_BY_PORTFOLIO).reduce((a, b) => a + b, 0)
    expect(total).toBe(2)
    expect(includedRemainingFor(PIECES[0])).toBe(1)   // per portfolio, not 2
  })

  it('reports 0 for a shelf piece, which has no portfolio', () => {
    expect(includedRemainingFor(PIECES[3])).toBe(0)
    expect(includedRemainingFor(null)).toBe(0)
  })
})
