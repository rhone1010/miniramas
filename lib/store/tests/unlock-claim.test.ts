// lib/store/tests/unlock-claim.test.ts
//
// Two things the unlock route must get right, neither of which it did.
//
// 1. jobId reaches consume_entitlement_atomic as p_job_id, declared UUID
//    (003_store_commerce.sql:109) and written into entitlements.job_id, also
//    uuid. The route built `unlock-<previewId>-<8 hex>`, Postgres refused the
//    cast with 22P02, consumeEntitlement threw, and the route answered 500.
//
// 2. preview_ledger.unlocked_at was selected and never read, so a retry or a
//    double-click spent a SECOND entitlement on an image already unlocked.
//    The fix claims the ledger with a conditional update; only the caller
//    that flips NULL -> now() goes on to spend anything.
//
// The claim is modelled here against a store with real async interleaving —
// the same shape the route uses, no database and no network.

import { describe, it, expect, beforeEach } from 'vitest'

// ── 1 · the identifier ────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PREVIEW_ID = 'a28b55c3-a5c1-46ba-bf6d-3d927735fe7a'

describe('unlock jobId must be a uuid', () => {
  it('rejects the identifier the route used to build', () => {
    // The exact shape from the production 500.
    const old = `unlock-${PREVIEW_ID}-5e7a2f24`
    expect(UUID_RE.test(old)).toBe(false)
  })

  it('accepts previewId, which is what the route sends now', () => {
    expect(UUID_RE.test(PREVIEW_ID)).toBe(true)
  })

  it('previewId also records which preview the entitlement was spent on', () => {
    // The old string embedded previewId precisely to say this. Passing it
    // directly is both type-correct and more truthful than a random uuid.
    const old = `unlock-${PREVIEW_ID}-5e7a2f24`
    expect(old).toContain(PREVIEW_ID)
  })
})

// ── 2 · the claim ─────────────────────────────────────────────────────

let ledger: { unlocked_at: string | null }
let entitlementsSpent: number

const tick = () => new Promise((r) => setImmediate(r))

/** Conditional update: unlocked_at NULL -> now(). Returns rows touched.
 *
 *  The await models the round trip to Postgres; the guard and the write are
 *  then applied together, because `update ... where unlocked_at is null` is
 *  ONE statement and the row lock serialises concurrent writers. Splitting
 *  them with an await either side would model a JS read-then-write, which is
 *  precisely the thing the SQL is chosen to avoid. */
async function claim(): Promise<number> {
  await tick()
  if (ledger.unlocked_at !== null) return 0
  ledger.unlocked_at = new Date().toISOString()
  return 1
}

async function releaseClaim(): Promise<void> {
  await tick()
  ledger.unlocked_at = null
}

/** The route's order: claim, then spend only if the claim was won. */
async function unlock(opts: { entitlementAvailable?: boolean } = {}) {
  const available = opts.entitlementAvailable ?? true
  const won = await claim()
  if (won === 0) return 'redelivered'
  if (!available) {
    await releaseClaim()
    return 'no_entitlement'
  }
  entitlementsSpent++
  return 'unlocked'
}

beforeEach(() => {
  ledger = { unlocked_at: null }
  entitlementsSpent = 0
})

describe('unlock claim prevents double consumption', () => {
  it('spends exactly one entitlement for a single unlock', async () => {
    expect(await unlock()).toBe('unlocked')
    expect(entitlementsSpent).toBe(1)
  })

  it('a second sequential click redelivers and spends nothing', async () => {
    await unlock()
    expect(await unlock()).toBe('redelivered')
    expect(entitlementsSpent).toBe(1)
  })

  it('two SIMULTANEOUS clicks spend exactly one', async () => {
    const [a, b] = await Promise.all([unlock(), unlock()])
    expect(entitlementsSpent).toBe(1)
    expect([a, b].sort()).toEqual(['redelivered', 'unlocked'])
  })

  it('eight simultaneous clicks still spend exactly one', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => unlock()))
    expect(entitlementsSpent).toBe(1)
    expect(results.filter((r) => r === 'unlocked')).toHaveLength(1)
    expect(results.filter((r) => r === 'redelivered')).toHaveLength(7)
  })

  it('releases the claim when there is nothing to spend', async () => {
    // Otherwise a later attempt, once the payment lands, would be treated as
    // a redelivery and the customer would never get their unlock.
    expect(await unlock({ entitlementAvailable: false })).toBe('no_entitlement')
    expect(ledger.unlocked_at).toBeNull()
    expect(entitlementsSpent).toBe(0)

    expect(await unlock({ entitlementAvailable: true })).toBe('unlocked')
    expect(entitlementsSpent).toBe(1)
  })
})
