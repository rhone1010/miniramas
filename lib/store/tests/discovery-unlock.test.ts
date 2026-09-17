// lib/store/tests/discovery-unlock.test.ts
//
// The additional Discovery unlock, $2.99, one piece. Phase 1 A4.
//
// Five things are proven here, per Rich's requirements: the price is the
// server's and not the client's, the checkout contract is embedded and
// carries canonical ids, identity is validated against the database before
// Stripe is called, the entitlement is minted bound and not-yet-spendable,
// and confirmation is idempotent under duplicate webhook delivery.
//
// Working rule 6 applies: none of this is production proof of payment. It
// proves the contract, not the transaction. The transaction is proven in
// Preview by a real purchase.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── a tiny in-memory Supabase good enough for these paths ──────────
type Row = Record<string, any>
const db: Record<string, Row[]> = {}
let failInsert: string | null = null

/* A query builder that is awaitable at any point, like supabase-js: the
   chain collects filters and `then` resolves the matching rows. Without the
   `then`, `await sb.from(..).select(..).eq(..)` yields the builder itself and
   every caller sees "no rows" -- which is a bug in the double, not the code
   under test. */
function table(name: string) {
  const rows = () => (db[name] ||= [])
  const filters: Array<(r: Row) => boolean> = []
  const match = () => rows().filter(r => filters.every(f => f(r)))
  const api: any = {
    select() { return api },
    order() { return api },
    limit() { return api },
    eq(col: string, val: any) { filters.push((r: Row) => r[col] === val); return api },
    is(col: string, val: any) { filters.push((r: Row) => r[col] === val); return api },
    async maybeSingle() { return { data: match()[0] ?? null, error: null } },
    async single() { const m = match(); return { data: m[0] ?? null, error: m[0] ? null : { message: 'no row' } } },
    then(res: any) { return Promise.resolve({ data: match(), error: null }).then(res) },
    insert(payload: Row) {
      const boom = failInsert === name
      const row = boom ? null
        : { id: payload.id ?? `${name}-${rows().length + 1}`, created_at: new Date().toISOString(), ...payload }
      if (row) rows().push(row)
      const err = boom ? { message: 'boom' } : null
      const res: any = {
        select: () => ({ single: async () => ({ data: row, error: err }) }),
        then: (r: any) => Promise.resolve({ data: row, error: err }).then(r),
      }
      return res
    },
    update(patch: Row) {
      const f: Array<(r: Row) => boolean> = []
      const u: any = {
        eq(col: string, val: any) { f.push((r: Row) => r[col] === val); return u },
        select() {
          const hit = rows().filter(r => f.every(fn => fn(r)))
          hit.forEach(r => Object.assign(r, patch))
          return Promise.resolve({ data: hit.map(r => ({ id: r.id })), error: null })
        },
        then(r: any) {
          const hit = rows().filter(x => f.every(fn => fn(x)))
          hit.forEach(x => Object.assign(x, patch))
          return Promise.resolve({ data: hit, error: null }).then(r)
        },
      }
      return u
    },
  }
  return api
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (n: string) => table(n) },
}))

const created: any[] = []
vi.mock('@/lib/store/stripe', () => ({
  getStripe: () => ({
    prices: { retrieve: async (id: string) => ({ id, unit_amount: 299 }) },
    checkout: { sessions: { create: async (p: any) => { created.push(p); return { id: 'cs_test_unlock_1', client_secret: 'cs_secret_1' } } } },
  }),
  getAppUrl: () => 'https://litenco.com',
}))
vi.mock('@/lib/store/stripe-branding', async () => {
  const actual: any = await vi.importActual('@/lib/store/stripe-branding')
  return { ...actual }
})

import {
  createDiscoveryUnlockCheckout, activateDiscoveryUnlock,
  DISCOVERY_UNLOCK_SKU_ID, DISCOVERY_UNLOCK_LOCK,
} from '@/lib/store/discovery-unlock'

const USER = 'user-1', OTHER = 'user-2'
const PF = '11111111-1111-1111-1111-111111111111'
const PREVIEW = 'preview-abc'

function seed() {
  for (const k of Object.keys(db)) delete db[k]
  failInsert = null
  created.length = 0
  db.portfolios = [{ id: PF, user_id: USER, series: 'portraits', purchase_id: 'pur-portfolio' }]
  db.portfolio_items = [{ id: 'it-1', portfolio_id: PF, slot: 2, status: 'done', preview_id: PREVIEW }]
  db.preview_ledger = [{ id: PREVIEW, email: `portfolio:${PF}:2`, unlocked_at: null }]
  db.skus = [{ id: DISCOVERY_UNLOCK_SKU_ID, price_cents: 299, stripe_price_id: 'price_unlock_1', active: true }]
  db.purchases = []
  db.entitlements = []
}
beforeEach(seed)

const ok = () => createDiscoveryUnlockCheckout({ userId: USER, portfolioId: PF, previewId: PREVIEW, returnUrl: 'https://litenco.com/discovery' })

describe('price is the server\'s', () => {
  it('comes from the seeded unlock SKU, and the caller never supplies it', async () => {
    const r = await ok()
    expect(r.priceCents).toBe(299)
    // the session buys the SKU's own Stripe price, not an ad-hoc amount
    expect(created[0].line_items).toEqual([{ price: 'price_unlock_1', quantity: 1 }])
    expect(JSON.stringify(created[0])).not.toMatch(/price_data|unit_amount/)
  })

  it('refuses when the DB price and Stripe disagree', async () => {
    db.skus[0].price_cents = 399            // drift
    await expect(ok()).rejects.toThrow('unlock_price_mismatch')
    expect(db.purchases).toHaveLength(0)
    expect(db.entitlements).toHaveLength(0)
  })

  it('refuses an inactive SKU', async () => {
    db.skus[0].active = false
    await expect(ok()).rejects.toThrow('unlock_sku_unavailable')
  })
})

describe('checkout contract', () => {
  it('is embedded and returns a client secret, never a url', async () => {
    const r = await ok()
    expect(created[0].ui_mode).toBe('embedded')
    expect(created[0].redirect_on_completion).toBe('if_required')
    expect(created[0]).not.toHaveProperty('success_url')
    expect(created[0]).not.toHaveProperty('cancel_url')
    expect(r.clientSecret).toBe('cs_secret_1')
    expect(r).not.toHaveProperty('url')
  })

  it('carries canonical ids in metadata, never a display label', async () => {
    await ok()
    expect(created[0].metadata).toMatchObject({
      kind: 'discovery_unlock', portfolioId: PF, previewId: PREVIEW, userId: USER, slot: '2',
    })
    expect(JSON.stringify(created[0].metadata)).not.toMatch(/Bronze|Mosaic|Stained/)
  })
})

describe('identity is checked against the database, before Stripe', () => {
  it('another customer\'s portfolio is refused', async () => {
    await expect(createDiscoveryUnlockCheckout({ userId: OTHER, portfolioId: PF, previewId: PREVIEW, returnUrl: 'x' }))
      .rejects.toThrow('unlock_wrong_owner')
    expect(created).toHaveLength(0)
  })

  it('a preview belonging to a different portfolio is refused', async () => {
    db.portfolio_items[0].portfolio_id = 'someone-else'
    await expect(ok()).rejects.toThrow('unlock_preview_not_in_portfolio')
    expect(created).toHaveLength(0)
  })

  it('an already-unlocked preview is refused -- no second charge', async () => {
    db.preview_ledger[0].unlocked_at = new Date().toISOString()
    await expect(ok()).rejects.toThrow('unlock_already_unlocked')
    expect(created).toHaveLength(0)
  })

  it('a ledger naming a different portfolio is refused', async () => {
    db.preview_ledger[0].email = 'portfolio:99999999-9999-9999-9999-999999999999:2'
    await expect(ok()).rejects.toThrow('unlock_preview_portfolio_mismatch')
    expect(created).toHaveLength(0)
  })

  it('a piece that has not rendered is refused', async () => {
    db.portfolio_items[0].status = 'pending'
    await expect(ok()).rejects.toThrow('unlock_preview_not_ready')
  })
})

describe('the entitlement is minted bound, and not yet spendable', () => {
  it('is pending, bound to this one preview, on its own purchase', async () => {
    const r = await ok()
    expect(db.entitlements).toHaveLength(1)
    const e = db.entitlements[0]
    expect(e.status).toBe('pending')                 // portraits/unlock takes 'available' only
    expect(e.locked_style).toBe(DISCOVERY_UNLOCK_LOCK)
    expect(e.locked_variant).toBe(PREVIEW)           // this piece and no other
    expect(e.user_id).toBe(USER)
    expect(e.purchase_id).toBe(r.purchaseId)
    expect(e.purchase_id).not.toBe('pur-portfolio')  // not the portfolio's purchase
  })

  it('the purchase is pending and priced by the server', async () => {
    const r = await ok()
    const p = db.purchases.find((x: Row) => x.id === r.purchaseId)
    expect(p).toBeDefined()
    expect(p!.status).toBe('pending')
    expect(p!.amount_cents).toBe(299)
    expect(p!.sku_id).toBe(DISCOVERY_UNLOCK_SKU_ID)
    expect(p!.stripe_session_id).toBe('cs_test_unlock_1')
  })
})

describe('confirmation', () => {
  async function paid() {
    const r = await ok()
    const p = db.purchases.find((x: Row) => x.id === r.purchaseId)
    if (!p) throw new Error('test setup: purchase row missing')
    p.status = 'paid'
    return r
  }

  it('flips the bound entitlement to available', async () => {
    await paid()
    const res = await activateDiscoveryUnlock({ stripeSessionId: 'cs_test_unlock_1' })
    expect(res.activated).toBe(true)
    expect(db.entitlements[0].status).toBe('available')
  })

  it('IS IDEMPOTENT: a duplicate delivery changes nothing and mints nothing', async () => {
    await paid()
    await activateDiscoveryUnlock({ stripeSessionId: 'cs_test_unlock_1' })
    const after1 = JSON.parse(JSON.stringify(db.entitlements))
    const res2 = await activateDiscoveryUnlock({ stripeSessionId: 'cs_test_unlock_1' })
    expect(res2.activated).toBe(false)
    expect(db.entitlements).toHaveLength(1)
    expect(db.entitlements).toEqual(after1)
  })

  it('refuses to mint while the purchase is still pending', async () => {
    await ok()                                   // never marked paid
    const res = await activateDiscoveryUnlock({ stripeSessionId: 'cs_test_unlock_1' })
    expect(res.activated).toBe(false)
    expect(res.reason).toBe('purchase_not_paid')
    expect(db.entitlements[0].status).toBe('pending')
  })

  /* Metadata is transport. Even if a forged session claimed someone else's
     piece, confirmation re-reads OUR rows: the portfolio behind the bound
     preview must belong to the account that paid. */
  it('refuses when the piece does not belong to the payer', async () => {
    await paid()
    db.portfolios[0].user_id = OTHER
    const res = await activateDiscoveryUnlock({ stripeSessionId: 'cs_test_unlock_1' })
    expect(res.activated).toBe(false)
    expect(res.reason).toBe('owner_mismatch')
    expect(db.entitlements[0].status).toBe('pending')
  })

  it('says so loudly when a paid purchase carries no bound entitlement', async () => {
    await paid()
    db.entitlements.length = 0
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await activateDiscoveryUnlock({ stripeSessionId: 'cs_test_unlock_1' })
    expect(res.activated).toBe(false)
    expect(res.reason).toBe('entitlement_missing')
    expect(err.mock.calls.flat().join(' ')).toMatch(/Money taken, nothing to spend/)
    err.mockRestore()
  })

  it('an unknown session is reported, not thrown', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await activateDiscoveryUnlock({ stripeSessionId: 'cs_never_seen' })
    expect(res.activated).toBe(false)
    expect(res.reason).toBe('purchase_not_found')
    err.mockRestore()
  })
})

describe('the legacy cart is not touched', () => {
  it('nothing in this module imports the shared cart or its ladder', async () => {
    const { readFileSync } = await import('fs')
    const path = await import('path')
    const raw = readFileSync(path.join(process.cwd(), 'lib/store/discovery-unlock.ts'), 'utf8')
    /* Comments may NAME the legacy cart -- the header explains what this
       replaced. Only the code must not reach for it. */
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/createCartCheckout|VOLUME_LADDER|portrait_pieces_cart/)
    expect(code).not.toMatch(/from '\.\/checkout'/)
  })
})
