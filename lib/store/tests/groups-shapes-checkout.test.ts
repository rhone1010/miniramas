import {NextRequest} from 'next/server'
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


import {GROUPS_FORMATS} from '@/lib/v1/groups/groups-effects'
import {readFileSync} from 'node:fs'
it.each(GROUPS_FORMATS)('persists exact Groups %s ratio through portfolio API',async ratio=>{
 h.getUser.mockResolvedValue({id:'user-1'})
 const response=await POST(new NextRequest('https://litenco.com/api/v1/portfolios',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({series:'groups',selectedEffectIds:['stone'],sourceImageRef:'BASE64SOURCE',clientPriceUsd:4.99,aspect_ratio:ratio})}) as any)
 expect(response.status).toBe(200)
 expect(h.inserts.portfolios[0]).toMatchObject({series:'groups',aspect_ratio:ratio,free_unlocks:0})
})
it.each([{n:1,cents:499,u:0},{n:4,cents:899,u:1},{n:8,cents:1399,u:2},{n:16,cents:2199,u:4}])('preserves Groups package $n',async({n,cents,u})=>{
 await createPortfolioCheckout({...args(n,cents),series:'groups',aspectRatio:'4:3'})
 expect(h.inserts.purchases[0]).toMatchObject({sku_id:'groups_'+n,amount_cents:cents})
 expect(h.inserts.portfolios[0]).toMatchObject({free_unlocks:u,aspect_ratio:'4:3'})
 expect((h.inserts.portfolio_items[0] as any[]).length).toBe(n)
})
it.each([null,'','5:4','3:4'])('rejects invalid Groups ratio %s before checkout',async ratio=>{
 await expect(createPortfolioCheckout({...args(1,499),series:'groups',aspectRatio:ratio})).rejects.toThrow('format_not_allowed')
 expect(h.sessionsCreate).not.toHaveBeenCalled()
})
it('existing portfolio renderer forwards the stored format',()=>{
 const code=readFileSync('lib/store/portfolio-render.ts','utf8')
 expect(code).toContain("format: portfolio.aspect_ratio || '3:2'")
})
