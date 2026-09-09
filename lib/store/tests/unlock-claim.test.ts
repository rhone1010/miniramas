// lib/store/tests/unlock-claim.test.ts
//
// Two things the unlock route must get right, neither of which it did.
//
// 1. jobId reaches consume_entitlement_atomic as p_job_id, declared UUID
//    (003_store_commerce.sql:109) and written into entitlements.job_id, also
//    uuid. The route built `unlock-<previewId>-<8 hex>`, Postgres refused the
//    cast with 22P02, consumeEntitlement threw, and the route answered 500.
//
//    It must be a FRESH uuid per attempt, not the previewId. job_id names the
//    generation attempt, not the thing unlocked: reserveEntitlement stamps it
//    beside generation_started_at, restoreEntitlement nulls it when an attempt
//    is abandoned, /result/[jobId] addresses one by it, and every other writer
//    mints randomUUID() per attempt. Reusing previewId would give two
//    entitlements the same job_id across a release-and-retry.
//
// 2. preview_ledger.unlocked_at was selected and never read, so a retry or a
//    double-click spent a SECOND entitlement on an image already unlocked.
//    The fix claims the ledger with a conditional update; only the caller
//    that flips NULL -> now() goes on to spend anything.
//
// The claim is modelled here against a store with real async interleaving —
// the same shape the route uses, no database and no network.

import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'

// ── 1 · the identifier ────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PREVIEW_ID = 'a28b55c3-a5c1-46ba-bf6d-3d927735fe7a'

/** What the route now sends as jobId, one call = one attempt. */
const jobIdForAttempt = () => randomUUID()

describe('unlock jobId', () => {
  it('never sends a synthetic unlock-... string', () => {
    // The exact shape from the production 500.
    const synthetic = `unlock-${PREVIEW_ID}-5e7a2f24`
    expect(UUID_RE.test(synthetic)).toBe(false)

    for (let i = 0; i < 20; i++) {
      const sent = jobIdForAttempt()
      expect(sent.startsWith('unlock-')).toBe(false)
      expect(sent).not.toContain(PREVIEW_ID)
    }
  })

  it('sends a valid uuid', () => {
    for (let i = 0; i < 20; i++) {
      expect(UUID_RE.test(jobIdForAttempt())).toBe(true)
    }
  })

  it('gives separate unlock attempts distinct uuids', () => {
    // job_id names the attempt. A release-and-retry on the same preview must
    // not stamp two entitlements with one id.
    const ids = Array.from({ length: 200 }, jobIdForAttempt)
    expect(new Set(ids).size).toBe(ids.length)
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

// ── 3 · entitlement scope ─────────────────────────────────────────────
//
// AN ENTITLEMENT HAS SCOPE. Owning one is not permission to spend it
// anywhere. The route used to take the oldest available entitlement the
// account held, from any purchase. In production on 2026-09-09 that unlocked
// three previews of portfolio 935148c0 while that portfolio's own included
// unlock sat untouched at 'available' — each one paid for by a leftover
// entitlement from an unrelated purchase, of which the account had fourteen.
//
// The rule modelled here: a preview may only be paid for by an entitlement
// belonging to ITS OWN portfolio's purchase. No fallback.

/** `portfolio:{portfolioId}:{slot}` — the ledger email the render route writes. */
function portfolioIdFromLedgerEmail(ledgerEmail: string | null): string | null {
  if (!ledgerEmail || !ledgerEmail.startsWith('portfolio:')) return null
  const id = ledgerEmail.slice('portfolio:'.length).split(':')[0]
  return id || null
}

const PF = '935148c0-d899-4e4c-98d7-9002436106a5'

describe('ledger email identifies the portfolio', () => {
  it('reads the id from a per-slot key', () => {
    expect(portfolioIdFromLedgerEmail(`portfolio:${PF}:2`)).toBe(PF)
  })
  it('reads the id from the older key with no slot', () => {
    expect(portfolioIdFromLedgerEmail(`portfolio:${PF}`)).toBe(PF)
  })
  it('returns null for a preview that came from no portfolio', () => {
    expect(portfolioIdFromLedgerEmail('someone@example.com')).toBeNull()
    expect(portfolioIdFromLedgerEmail(null)).toBeNull()
    expect(portfolioIdFromLedgerEmail('portfolio:')).toBeNull()
  })
})

type Ent = { id: string; purchase_id: string; status: 'available' | 'consumed'; created_at: number }

/** The scoped selection the route now performs. */
function selectEntitlement(all: Ent[], portfolioPurchaseId: string | null): Ent | null {
  if (!portfolioPurchaseId) return null              // no portfolio -> nothing to spend
  return all
    .filter((e) => e.status === 'available' && e.purchase_id === portfolioPurchaseId)
    .sort((a, b) => a.created_at - b.created_at)[0] ?? null
}

describe('unlock spends only its own portfolio purchase', () => {
  const OWN = 'purchase-26c47d1e'
  const OTHER_A = 'purchase-ba72ade9'
  const OTHER_B = 'purchase-4ac92f9a'

  it('spends the portfolio own included unlock', () => {
    const all: Ent[] = [
      { id: 'e-other', purchase_id: OTHER_A, status: 'available', created_at: 1 },
      { id: 'e-own',   purchase_id: OWN,     status: 'available', created_at: 9 },
    ]
    // The unrelated one is OLDER, so the old "oldest available" rule would
    // have taken it. Scope wins over age.
    expect(selectEntitlement(all, OWN)?.id).toBe('e-own')
  })

  it('never falls through to another purchase when its own is spent', () => {
    const all: Ent[] = [
      { id: 'e-own',     purchase_id: OWN,     status: 'consumed',  created_at: 1 },
      { id: 'e-other-a', purchase_id: OTHER_A, status: 'available', created_at: 2 },
      { id: 'e-other-b', purchase_id: OTHER_B, status: 'available', created_at: 3 },
    ]
    expect(selectEntitlement(all, OWN)).toBeNull()
  })

  it('reproduces the production case: 14 unrelated credits buy nothing here', () => {
    const all: Ent[] = Array.from({ length: 14 }, (_, i) => ({
      id: `stranded-${i}`, purchase_id: `single-purchase-${i}`,
      status: 'available' as const, created_at: i,
    }))
    all.push({ id: 'e-own', purchase_id: OWN, status: 'consumed', created_at: 99 })
    expect(selectEntitlement(all, OWN)).toBeNull()
  })

  it('spends nothing for a preview with no portfolio behind it', () => {
    const all: Ent[] = [{ id: 'e-any', purchase_id: OTHER_A, status: 'available', created_at: 1 }]
    expect(selectEntitlement(all, portfolioIdFromLedgerEmail('someone@example.com'))).toBeNull()
  })

  it('one portfolio unlock does not touch a sibling portfolio', () => {
    const SIB = 'purchase-sibling'
    const all: Ent[] = [
      { id: 'e-own', purchase_id: OWN, status: 'available', created_at: 1 },
      { id: 'e-sib', purchase_id: SIB, status: 'available', created_at: 2 },
    ]
    expect(selectEntitlement(all, OWN)?.id).toBe('e-own')
    expect(selectEntitlement(all, SIB)?.id).toBe('e-sib')
  })
})
