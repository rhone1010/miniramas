// lib/store/tests/paid-return.test.ts
//
// What happens between Stripe sending the customer back and My Collection
// being on screen.
//
// Two defects, both in the same handler.
//
// 1. The panel opened three levels down inside renderCollection, after
//    GET /portfolios, then a /status and an /unlocks for every portfolio the
//    account owns, then loadShelf -- seventeen requests for eight
//    portfolios -- and only if all of that returned at least one piece
//    (`if (!all.length) return null` sits above the open). None of it is
//    anything the panel needs in order to be visible.
//
// 2. Verification was one-shot. purchases.status flips to 'paid' when the
//    Stripe webhook lands, and the browser is sometimes back first. A
//    'pending' answer skipped the branch, nothing retried, and
//    history.replaceState had already erased portfolio_paid and session_id
//    -- so the collection never opened on that load.
//
// Modelled here as the handler now behaves: no DOM, no network, fake clock.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public', 'discovery-consolidated-draft.html'), 'utf8',
)

const PAID_RETRY_EVERY = 2500
const PAID_RETRY_TRIES = 4

type Status = 'pending' | 'paid' | 'failed' | 'refunded' | null

let verifyCalls: number
let scripted: Array<Status | 'network_error'>
let opened: number
let openedAtCall: number | null
let collectionHydrations: number
let pollStarted: boolean
let unlockFinished: string | null
let piecesSeed: string[]
let realPieces: boolean
let runLanded: boolean

/** The demo seed PIECES is built with at parse time when no selection is
 *  restored -- fabricated Groups/Pets/Halloween entries. */
const DEMO_SEED = ['demo0', 'demo1', 'demo2']

function openMyCollection() {
  opened++
  openedAtCall = verifyCalls
}

/** openCollectionForPaidRun, as shipped. */
function openCollectionForPaidRun() {
  if (!realPieces) {
    piecesSeed = []
    realPieces = true
  }
  openMyCollection()
}

/** The renderCollection wave. Deliberately slow and counted: the point of
 *  the fix is that opening no longer waits for it. */
async function renderCollection() {
  collectionHydrations++
  await new Promise((r) => setTimeout(r, 1400))
  return true
}

function craftWhenPiecesLand() {
  pollStarted = true
  return renderCollection()
}

async function fetchStatus(): Promise<Status> {
  const next = scripted[Math.min(verifyCalls, scripted.length - 1)]
  verifyCalls++
  if (next === 'network_error') throw new Error('network')
  return next
}

/** The handler, as shipped. hasUnlockIntent stands for readUnlockIntent(). */
function runPaidReturn(opts: { isPaid: boolean; sessionId: string | null; hasUnlockIntent?: boolean }) {
  if (!opts.isPaid || !opts.sessionId) return Promise.resolve('not_a_paid_return')

  function verify(triesLeft: number): Promise<string> {
    return fetchStatus()
      .then((status) => {
        if (status === 'paid') {
          if (opts.hasUnlockIntent) {
            unlockFinished = 'unlock'
            return 'unlock'
          }
          openCollectionForPaidRun()
          runLanded = true
          craftWhenPiecesLand()
          return 'opened'
        }
        if (status === 'failed' || status === 'refunded') return 'terminal_' + status
        if (triesLeft > 0) {
          return new Promise<string>((res) =>
            setTimeout(() => res(verify(triesLeft - 1)), PAID_RETRY_EVERY),
          )
        }
        return 'gave_up'
      })
      .catch(() => {
        if (triesLeft > 0) {
          return new Promise<string>((res) =>
            setTimeout(() => res(verify(triesLeft - 1)), PAID_RETRY_EVERY),
          )
        }
        return 'gave_up'
      })
  }
  return verify(PAID_RETRY_TRIES)
}

beforeEach(() => {
  vi.useFakeTimers()
  verifyCalls = 0
  scripted = ['paid']
  opened = 0
  openedAtCall = null
  collectionHydrations = 0
  pollStarted = false
  unlockFinished = null
  piecesSeed = [...DEMO_SEED]
  realPieces = false
  runLanded = true
})
afterEach(() => vi.useRealTimers())

// -- 1 . confirmed paid opens before hydration --------------------

describe('a confirmed paid return opens My Collection immediately', () => {
  it('opens on the answer to the first verification', async () => {
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    expect(await p).toBe('opened')
    expect(opened).toBe(1)
    expect(openedAtCall).toBe(1)
  })

  it('does not wait for renderCollection to resolve', async () => {
    const order: string[] = []
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.advanceTimersByTimeAsync(0)
    order.push(opened ? 'opened' : 'not-open-yet')
    order.push(collectionHydrations === 1 ? 'wave-still-running' : 'wave-done')
    await vi.runAllTimersAsync()
    await p
    // Open first, with the 1400ms wave still in flight behind it.
    expect(order).toEqual(['opened', 'wave-still-running'])
  })

  it('still starts the existing poll behind it', async () => {
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    await p
    expect(pollStarted).toBe(true)
    expect(collectionHydrations).toBe(1)
  })

  it('clears the demo seed so no fabricated piece is shown to a payer', async () => {
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    await p
    expect(piecesSeed).toEqual([])
    expect(realPieces).toBe(true)
  })

  it('leaves RUN_LANDED true so renderCollection does not open it again', async () => {
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    await p
    expect(runLanded).toBe(true)
    expect(opened).toBe(1)
  })
})

// -- 2 . the pending race -----------------------------------------

describe('pending first, paid on retry', () => {
  it('opens once the webhook lands on the second check', async () => {
    scripted = ['pending', 'paid']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    expect(await p).toBe('opened')
    expect(verifyCalls).toBe(2)
    expect(opened).toBe(1)
  })

  it('waits the chosen interval between checks, not less', async () => {
    scripted = ['pending', 'paid']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.advanceTimersByTimeAsync(0)
    expect(verifyCalls).toBe(1)
    expect(opened).toBe(0)
    await vi.advanceTimersByTimeAsync(PAID_RETRY_EVERY - 1)
    expect(verifyCalls).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(verifyCalls).toBe(2)
    await vi.runAllTimersAsync()
    await p
    expect(opened).toBe(1)
  })

  it('still opens on the very last allowed check', async () => {
    scripted = ['pending', 'pending', 'pending', 'pending', 'paid']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    expect(await p).toBe('opened')
    expect(verifyCalls).toBe(PAID_RETRY_TRIES + 1)
  })

  it('is bounded -- it gives up rather than polling forever', async () => {
    scripted = ['pending']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    expect(await p).toBe('gave_up')
    expect(verifyCalls).toBe(PAID_RETRY_TRIES + 1)
    expect(opened).toBe(0)
  })

  it('spans ten seconds and no more', async () => {
    scripted = ['pending']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.advanceTimersByTimeAsync(PAID_RETRY_EVERY * PAID_RETRY_TRIES)
    expect(verifyCalls).toBe(PAID_RETRY_TRIES + 1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(verifyCalls).toBe(PAID_RETRY_TRIES + 1)
    await p
  })

  it('retries a dropped request too -- a network error is not a no', async () => {
    scripted = ['network_error', 'paid']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    expect(await p).toBe('opened')
    expect(verifyCalls).toBe(2)
  })
})

// -- 3 . pending never opens speculatively ------------------------

describe('nothing opens without a confirmed payment', () => {
  it('does not open while the answer is still pending', async () => {
    scripted = ['pending', 'pending', 'paid']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.advanceTimersByTimeAsync(0)
    expect(opened).toBe(0)
    await vi.advanceTimersByTimeAsync(PAID_RETRY_EVERY)
    expect(opened).toBe(0)
    await vi.runAllTimersAsync()
    await p
    expect(opened).toBe(1)
  })

  it('never opens on a terminal failure, and does not retry one', async () => {
    for (const s of ['failed', 'refunded'] as const) {
      opened = 0
      verifyCalls = 0
      scripted = [s]
      const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
      await vi.runAllTimersAsync()
      expect(await p).toBe('terminal_' + s)
      expect(opened).toBe(0)
      expect(verifyCalls).toBe(1)
    }
  })

  it('never opens when verification never succeeds', async () => {
    scripted = ['network_error']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    expect(await p).toBe('gave_up')
    expect(opened).toBe(0)
  })

  it('does not clear the demo seed unless it actually opens', async () => {
    scripted = ['failed']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    await p
    expect(piecesSeed).toEqual(DEMO_SEED)
    expect(realPieces).toBe(false)
  })
})

// -- 4 . unlock intent is untouched -------------------------------

describe('an unlock return behaves exactly as before', () => {
  it('finishes the unlock and does NOT open the collection', async () => {
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1', hasUnlockIntent: true })
    await vi.runAllTimersAsync()
    expect(await p).toBe('unlock')
    expect(unlockFinished).toBe('unlock')
    expect(opened).toBe(0)
    expect(pollStarted).toBe(false)
  })

  it('leaves the demo seed alone on an unlock return', async () => {
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1', hasUnlockIntent: true })
    await vi.runAllTimersAsync()
    await p
    expect(piecesSeed).toEqual(DEMO_SEED)
    expect(realPieces).toBe(false)
  })

  it('an unlock return gets the pending retry too, and still opens nothing', async () => {
    scripted = ['pending', 'paid']
    const p = runPaidReturn({ isPaid: true, sessionId: 'cs_1', hasUnlockIntent: true })
    await vi.runAllTimersAsync()
    expect(await p).toBe('unlock')
    expect(verifyCalls).toBe(2)
    expect(opened).toBe(0)
  })
})

// -- 5 . an ordinary page load is untouched -----------------------

describe('a page load that is not a Stripe return does nothing', () => {
  it('no params at all', async () => {
    const p = runPaidReturn({ isPaid: false, sessionId: null })
    await vi.runAllTimersAsync()
    expect(await p).toBe('not_a_paid_return')
    expect(verifyCalls).toBe(0)
    expect(opened).toBe(0)
    expect(pollStarted).toBe(false)
    expect(piecesSeed).toEqual(DEMO_SEED)
  })

  it('paid flag without a session id verifies nothing', async () => {
    const p = runPaidReturn({ isPaid: true, sessionId: null })
    await vi.runAllTimersAsync()
    expect(await p).toBe('not_a_paid_return')
    expect(verifyCalls).toBe(0)
    expect(opened).toBe(0)
  })

  it('a session id without the paid flag verifies nothing', async () => {
    const p = runPaidReturn({ isPaid: false, sessionId: 'cs_1' })
    await vi.runAllTimersAsync()
    expect(await p).toBe('not_a_paid_return')
    expect(verifyCalls).toBe(0)
    expect(opened).toBe(0)
  })
})

// -- the numbers above are the numbers that shipped ---------------

describe('the shipped handler uses these constants', () => {
  it('retries every 2500ms, the interval the unlock path already chose', () => {
    expect(HTML).toContain('var PAID_RETRY_EVERY = 2500;')
    expect(PAID_RETRY_EVERY).toBe(2500)
  })

  it('retries four times after the first check -- a ten second budget', () => {
    expect(HTML).toContain('var PAID_RETRY_TRIES = 4;')
    expect(PAID_RETRY_TRIES).toBe(4)
    // Five checks, four gaps: the last one lands at T+10s.
    expect(PAID_RETRY_TRIES * PAID_RETRY_EVERY).toBe(10_000)
  })

  it('opens from the paid branch, not from inside renderCollection', () => {
    expect(HTML).toContain('openCollectionForPaidRun();')
  })

  it('leaves the collection poll constants alone', () => {
    // Explicitly out of scope for this change.
    expect(HTML).toContain('var LAND_TRIES  = 60;')
    expect(HTML).toContain('var LAND_EVERY  = 3000;')
  })

  it('still guards the open behind a confirmed paid status', () => {
    expect(HTML).toContain("if (status === 'paid'){")
    expect(HTML).toContain("if (status === 'failed' || status === 'refunded'){")
  })
})
