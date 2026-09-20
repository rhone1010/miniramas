import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from './helpers/fake-supabase'

const h = vi.hoisted(() => ({ fake: null as any, user: null as any }))
vi.mock('@/lib/supabase', () => ({ get supabaseAdmin() { return h.fake.sb } }))
vi.mock('@/lib/store/auth', () => ({ getUser: async () => h.user }))
import { GET } from '@/app/api/v1/collection/unlock-review/route'

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'preview')
  h.user = { id: 'owner' }
  h.fake = fakeSupabase({ tables: {
    portfolios: [{ id: 'p', user_id: 'owner', purchase_id: 'paid' }],
    purchases: [{ id: 'paid', user_id: 'owner', status: 'paid' }],
    entitlements: [
      { user_id: 'owner', purchase_id: 'paid', status: 'available', locked_style: null },
      { user_id: 'other', purchase_id: 'paid', status: 'available' },
      { user_id: 'owner', purchase_id: 'unpaid', status: 'available' },
      { user_id: 'owner', purchase_id: 'paid', status: 'consumed' },
    ],
  } })
})
afterEach(() => vi.unstubAllEnvs())

describe('Preview-only unlock presentation', () => {
  it('is absent in Production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await GET()).status).toBe(404)
  })
  it('does not invent a signed-out balance', async () => {
    h.user = null
    const d = await (await GET()).json()
    expect(d.balance).toBeNull()
    expect(d.checkoutEnabled).toBe(false)
    expect(d.offers).toEqual([{count:1,cents:299},{count:3,cents:799},{count:5,cents:1299},{count:10,cents:1999}])
  })
  it('counts only paid, available, owned included entitlements', async () => {
    const d = await (await GET()).json()
    expect(d.balance).toEqual({ included: 1, reusable: 0, total: 1 })
  })
  it.each([[9,null],[10,1790],[19,3401],[20,3180]])('quotes %i locked pieces without fulfillment', async (n, cents) => {
    h.fake.tables.portfolio_items = Array.from({length:n}, (_,i) => ({ portfolio_id:'p',status:'done',preview_id:String(i) }))
    h.fake.tables.preview_ledger = Array.from({length:n}, (_,i) => ({id:String(i),unlocked_at:null}))
    h.fake.tables.portfolio_items.push({portfolio_id:'p',status:'rendering',preview_id:'unfinished'})
    const before = JSON.stringify(h.fake.tables)
    const d = await (await GET()).json()
    expect(d.lockedCount).toBe(n)
    expect(d.all?.cents ?? null).toBe(cents)
    expect(JSON.stringify(h.fake.tables)).toBe(before)
  })
})
