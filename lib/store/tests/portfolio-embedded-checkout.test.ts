// lib/store/tests/portfolio-embedded-checkout.test.ts
//
// Portfolio checkout is drawn in Discovery's own modal, not on a Stripe page.
//
// Until now createPortfolioCheckout made a hosted session and the route
// handed back its url, and the client navigated to it -- so every portfolio
// purchase left Discovery entirely. The session is now embedded, with
// redirect_on_completion 'if_required'. That mode was probed against the
// account's real payment-method configuration before shipping (2026-09-10,
// test mode): it keeps all five methods the hosted page offered -- card,
// klarna, link, cashapp, amazon_pay -- where 'never' silently dropped three.
//
// These run the REAL createPortfolioCheckout through the REAL POST route.
// Only Stripe and the database are faked, and every call to them is kept so
// the exact session and rows can be asserted.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  sessionsCreate: vi.fn(),
  inserts: {} as Record<string, unknown[]>,
  skuPrice: 'price_1U9Cprobe',
}))

vi.mock('@/lib/store/auth', () => ({ getUser: h.getUser }))

vi.mock('@/lib/store/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { create: h.sessionsCreate } } }),
  getAppUrl: () => 'https://litenco.com',
}))

/* One small fake per table, shaped like the calls the function makes:
   skus .select().eq().single()
   purchases / portfolios .insert(row).select().single()
   portfolio_items .insert(rows)                                        */
vi.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const record = (row: unknown) => { (h.inserts[table] ??= []).push(row) }
    if (table === 'skus') {
      const b: any = {
        select: () => b,
        eq: () => b,
        single: async () => ({ data: { stripe_price_id: h.skuPrice }, error: null }),
      }
      return b
    }
    if (table === 'portfolio_items') {
      return { insert: async (rows: unknown) => { record(rows); return { error: null } } }
    }
    return {
      insert: (row: unknown) => {
        record(row)
        const id = table === 'purchases' ? 'purchase-1' : 'portfolio-1'
        return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) }
      },
    }
  }
  return { supabaseAdmin: { from }, supabase: {} }
})

import { POST } from '@/app/api/v1/portfolios/route'
import { createPortfolioCheckout } from '@/lib/store/portfolio-checkout'

const SESSION = { id: 'cs_test_embedded_1', client_secret: 'cs_test_embedded_1_secret_x', url: null }

const SIZES: Array<{ n: number; sku: string; cents: number; unlocks: number; delivery: string }> = [
  { n: 1,  sku: 'single',             cents: 299,  unlocks: 0, delivery: 'purchased' },
  { n: 4,  sku: 'basket_discover_5',  cents: 499,  unlocks: 1, delivery: 'preview'   },
  { n: 8,  sku: 'basket_discover_10', cents: 799,  unlocks: 1, delivery: 'preview'   },
  { n: 16, sku: 'basket_discover_20', cents: 1299, unlocks: 2, delivery: 'preview'   },
]

const ids = (n: number) => Array.from({ length: n }, (_, i) => `effect_${i}`)

function args(n: number, cents: number) {
  return {
    userId: 'user-1',
    series: 'portraits' as const,
    selectedEffectIds: ids(n),
    sourceImageRef: 'BASE64SOURCE',
    returnUrl: 'https://litenco.com/discovery',
    clientPriceUsd: cents / 100,
    pose: 'as_photographed',
    aspectRatio: '3:4',
    subject: null,
  }
}

beforeEach(() => {
  h.sessionsCreate.mockReset()
  h.sessionsCreate.mockResolvedValue(SESSION)
  h.getUser.mockReset()
  for (const k of Object.keys(h.inserts)) delete h.inserts[k]
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY = 'pk_test_probe'
})

// -- 1 . embedded + if_required ------------------------------------

describe('the portfolio session is embedded', () => {
  it('creates ui_mode embedded with redirect_on_completion if_required', async () => {
    await createPortfolioCheckout(args(4, 499))
    const p = h.sessionsCreate.mock.calls[0][0]
    expect(p.ui_mode).toBe('embedded')
    expect(p.redirect_on_completion).toBe('if_required')
  })

  it('returns through the existing portfolio_paid / session_id URL', async () => {
    await createPortfolioCheckout(args(4, 499))
    const p = h.sessionsCreate.mock.calls[0][0]
    expect(p.return_url).toBe(
      'https://litenco.com/discovery?portfolio_paid=1&session_id={CHECKOUT_SESSION_ID}',
    )
  })

  it('sends no hosted-only parameters', async () => {
    await createPortfolioCheckout(args(4, 499))
    const p = h.sessionsCreate.mock.calls[0][0]
    expect(p).not.toHaveProperty('success_url')
    expect(p).not.toHaveProperty('cancel_url')
  })

  it('does not pin payment methods -- the account configuration still decides', async () => {
    // Pinning would be a change to what customers are offered.
    await createPortfolioCheckout(args(4, 499))
    const p = h.sessionsCreate.mock.calls[0][0]
    expect(p).not.toHaveProperty('payment_method_types')
    expect(p).not.toHaveProperty('automatic_payment_methods')
  })

  it('returns the client secret and session id, never a url', async () => {
    const r = await createPortfolioCheckout(args(4, 499))
    expect(r).toEqual({
      clientSecret: SESSION.client_secret,
      sessionId: SESSION.id,
      purchaseId: 'purchase-1',
      portfolioId: 'portfolio-1',
    })
    expect(r).not.toHaveProperty('checkoutUrl')
  })

  it('refuses a session with no client secret BEFORE writing any row', async () => {
    h.sessionsCreate.mockResolvedValue({ id: 'cs_x', client_secret: null, url: null })
    await expect(createPortfolioCheckout(args(4, 499))).rejects.toThrow('stripe_session_missing_secret')
    expect(h.inserts.purchases).toBeUndefined()
    expect(h.inserts.portfolios).toBeUndefined()
    expect(h.inserts.portfolio_items).toBeUndefined()
  })
})

// -- 2 . economics and metadata unchanged ---------------------------

describe('what the customer buys is exactly what it was', () => {
  for (const s of SIZES) {
    it(`size ${s.n}: same SKU, price, quantity and metadata`, async () => {
      await createPortfolioCheckout(args(s.n, s.cents))
      const p = h.sessionsCreate.mock.calls[0][0]
      expect(p.mode).toBe('payment')
      expect(p.line_items).toEqual([{ price: h.skuPrice, quantity: 1 }])
      expect(p.metadata).toEqual({
        kind: 'portfolio',
        series: 'portraits',
        userId: 'user-1',
        count: String(s.n),
        skuId: s.sku,
      })
    })

    it(`size ${s.n}: purchase row keyed by the session id the webhook looks up`, async () => {
      await createPortfolioCheckout(args(s.n, s.cents))
      expect(h.inserts.purchases).toEqual([{
        user_id: 'user-1',
        guest_email: null,
        sku_id: s.sku,
        stripe_session_id: SESSION.id,
        amount_cents: s.cents,
        status: 'pending',
      }])
    })

    it(`size ${s.n}: portfolio row keeps its delivery and included unlocks`, async () => {
      await createPortfolioCheckout(args(s.n, s.cents))
      const row = (h.inserts.portfolios as any[])[0]
      expect(row.size).toBe(s.n)
      expect(row.free_unlocks).toBe(s.unlocks)
      expect(row.delivery).toBe(s.delivery)
      expect(row.status).toBe('pending')
      expect((h.inserts.portfolio_items as any[])[0]).toHaveLength(s.n)
    })
  }

  it('still rejects a price the server did not set', async () => {
    await expect(createPortfolioCheckout({ ...args(4, 499), clientPriceUsd: 1 }))
      .rejects.toThrow('price_mismatch')
    expect(h.sessionsCreate).not.toHaveBeenCalled()
  })
})

// -- 12 . one presentation for every size --------------------------

describe('size 1 and 4/8/16 share the same embedded presentation', () => {
  it('every size gets the identical session shape apart from price and count', async () => {
    const shapes: string[] = []
    for (const s of SIZES) {
      h.sessionsCreate.mockClear()
      await createPortfolioCheckout(args(s.n, s.cents))
      const p = h.sessionsCreate.mock.calls[0][0]
      shapes.push(JSON.stringify({
        ui_mode: p.ui_mode, redirect_on_completion: p.redirect_on_completion,
        return_url: p.return_url, keys: Object.keys(p).sort(),
      }))
    }
    expect(new Set(shapes).size).toBe(1)
  })
})

// -- the route hands the client what it mounts -----------------------

describe('POST /api/v1/portfolios returns an embeddable session', () => {
  const post = (body: unknown) => POST({ json: async () => body } as any)

  it('answers with clientSecret, publishableKey, sessionId and portfolioId -- no url', async () => {
    h.getUser.mockResolvedValue({ id: 'user-1' })
    const res = await post({
      series: 'portraits',
      selectedEffectIds: ids(4),
      sourceImageRef: 'BASE64SOURCE',
      returnUrl: 'https://litenco.com/discovery',
      clientPriceUsd: 4.99,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      clientSecret: SESSION.client_secret,
      publishableKey: 'pk_test_probe',
      sessionId: SESSION.id,
      portfolioId: 'portfolio-1',
    })
    expect(body).not.toHaveProperty('url')
  })

  it('size 1 comes back the same way', async () => {
    h.getUser.mockResolvedValue({ id: 'user-1' })
    const res = await post({
      series: 'portraits',
      selectedEffectIds: ids(1),
      sourceImageRef: 'BASE64SOURCE',
      returnUrl: 'https://litenco.com/discovery',
      clientPriceUsd: 2.99,
    })
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(['clientSecret', 'portfolioId', 'publishableKey', 'sessionId'])
  })
})
