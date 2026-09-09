// lib/store/tests/portfolios-list.test.ts
//
// GET /api/v1/portfolios — the owner-scoped list My Collection uses to
// discover which portfolios to load.
//
// Why this file exists: the route shipped to production with only a POST
// export, so the browser's GET answered 405 Method Not Allowed. That is
// the first call in renderCollection(), and every loadPortfolio(id) hangs
// off its result — so eight paid, fully rendered portfolios were invisible
// because the list they are discovered through did not exist.
//
// getUser and supabaseAdmin are mocked. No database, no network, no cookies.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  order:   vi.fn(),
  from:    vi.fn(),
  select:  vi.fn(),
  eq:      vi.fn(),
}))

vi.mock('@/lib/store/auth', () => ({ getUser: h.getUser }))
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: h.from },
  supabase: {},
}))

// Chainable query builder: .from().select().eq().order() resolves last.
const chain: any = { select: h.select, eq: h.eq, order: h.order }
h.from.mockReturnValue(chain)
h.select.mockReturnValue(chain)
h.eq.mockReturnValue(chain)

import { GET, POST } from '@/app/api/v1/portfolios/route'

const ROWS = [
  { id: '88d22bd8-06fc-47ef-b080-57faaa99eb3a', series: 'portraits', size: 4, status: 'ready' },
  { id: '22a41fcf-1547-4b11-92dc-ed291f08ac4a', series: 'portraits', size: 4, status: 'ready' },
]

beforeEach(() => {
  h.getUser.mockReset()
  h.order.mockReset()
  h.from.mockClear(); h.select.mockClear(); h.eq.mockClear()
})

describe('GET /api/v1/portfolios', () => {
  it('returns the signed-in user’s portfolios', async () => {
    h.getUser.mockResolvedValue({ id: 'b4f556b0-4003-47e6-81a9-4abe03350eac' })
    h.order.mockResolvedValue({ data: ROWS, error: null })

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ portfolios: ROWS })
  })

  it('scopes the query to the caller, newest first', async () => {
    h.getUser.mockResolvedValue({ id: 'b4f556b0-4003-47e6-81a9-4abe03350eac' })
    h.order.mockResolvedValue({ data: ROWS, error: null })

    await GET()
    expect(h.from).toHaveBeenCalledWith('portfolios')
    expect(h.select).toHaveBeenCalledWith('id, series, size, status')
    expect(h.eq).toHaveBeenCalledWith('user_id', 'b4f556b0-4003-47e6-81a9-4abe03350eac')
    expect(h.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('answers { portfolios: [] } when signed out — never an error', async () => {
    h.getUser.mockResolvedValue(null)

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ portfolios: [] })
    // Signed out must not reach the database at all.
    expect(h.from).not.toHaveBeenCalled()
  })

  it('answers { portfolios: [] } when the query fails', async () => {
    // An empty collection must never stop My Collection from opening.
    h.getUser.mockResolvedValue({ id: 'b4f556b0-4003-47e6-81a9-4abe03350eac' })
    h.order.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ portfolios: [] })
  })
})

describe('POST /api/v1/portfolios — unchanged by adding GET', () => {
  const post = (body: unknown) =>
    POST({ json: async () => body } as any)

  it('still refuses a signed-out purchase with 401', async () => {
    h.getUser.mockResolvedValue(null)
    const res = await post({ series: 'portraits' })
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'portfolio_purchase_requires_user' })
  })

  it('still rejects an invalid series with 400', async () => {
    h.getUser.mockResolvedValue({ id: 'b4f556b0-4003-47e6-81a9-4abe03350eac' })
    const res = await post({ series: 'not_a_series' })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'portfolio_invalid_series' })
  })

  it('still rejects unparseable JSON with 400', async () => {
    const res = await POST({ json: async () => { throw new Error('bad') } } as any)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'invalid_json' })
  })
})
