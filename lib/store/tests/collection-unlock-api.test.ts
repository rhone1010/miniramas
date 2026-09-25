import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const h = vi.hoisted(() => ({ user: vi.fn(), balance: vi.fn(), create: vi.fn(), fulfill: vi.fn(), ready: vi.fn() }))
vi.mock('@/lib/store/auth', () => ({ getUser: h.user }))
vi.mock('@/lib/store/collection-unlock-summary', () => ({ collectionUnlockSummary: h.balance }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => ({ select: () => ({ limit: h.ready }) }) } }))
vi.mock('@/lib/store/collection-unlocks', () => ({
  COLLECTION_UNLOCK_OFFERS: [{ count: 1, cents: 299 }, { count: 3, cents: 799 }, { count: 5, cents: 1299 }, { count: 10, cents: 1999 }],
  collectionUnlockBalance: h.balance, createCollectionUnlockCheckout: h.create, fulfillCollectionUnlocks: h.fulfill,
}))
import { GET, POST } from '@/app/api/v1/collection/unlocks/route'
const post = (body: unknown) => POST(new NextRequest('https://litenco.com/api/v1/collection/unlocks', { method: 'POST', body: JSON.stringify(body) }))
beforeEach(() => {
  vi.clearAllMocks()
  h.user.mockResolvedValue({ id: 'owner' })
  h.ready.mockResolvedValue({ error: null })
  h.balance.mockResolvedValue({ balance: { total: 4, reusable: 3, included: 1 }, lockedCount: 2, all: null })
  h.create.mockResolvedValue({ sessionId: 'session', clientSecret: 'checkout', priceCents: 799 })
  h.fulfill.mockResolvedValue({ confirmed: true, balance: 3 })
  vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLIC_KEY', 'pk_test_fixture')
})
describe('Collection unlock API', () => {
  it('does not offer checkout before persistence is installed', async () => {
    h.ready.mockResolvedValue({ error: { message: 'missing relation' } })
    expect((await GET()).status).toBe(503)
  })
  it('reads the authenticated balance and only the four package offers', async () => {
    const body = await (await GET()).json()
    expect(body.balance).toEqual({ total: 4, reusable: 3, included: 1 })
    expect(body.offers.map((o: any) => o.count)).toEqual([1, 3, 5, 10])
    expect(body.all).toBeNull()
    expect(h.balance).toHaveBeenCalledWith('owner')
  })
  it('requires a session before creation or confirmation', async () => {
    h.user.mockResolvedValue(null)
    expect((await post({ count: 3 })).status).toBe(401)
    expect((await post({ sessionId: 'session' })).status).toBe(401)
    expect(h.create).not.toHaveBeenCalled()
    expect(h.fulfill).not.toHaveBeenCalled()
  })
  it('ignores client pricing and keeps the Pets return destination', async () => {
    expect((await post({ count: 3, cents: 1, returnPath: '/pets/discovery' })).status).toBe(200)
    expect(h.create).toHaveBeenCalledWith('owner', 3, 'https://litenco.com/pets/discovery?collection_unlock_session={CHECKOUT_SESSION_ID}')
  })
  it('does not accept an external return URL or unsupported quantity', async () => {
    await post({ count: 3, returnPath: 'https://evil.example/' })
    expect(h.create.mock.calls[0][2]).toMatch(/^https:\/\/litenco.com\/discovery\?/)
    expect((await post({ count: 4 })).status).toBe(400)
  })
  it('confirms for the authenticated owner and returns the authoritative balance', async () => {
    expect(await (await post({ sessionId: 'session' })).json()).toEqual({ confirmed: true, balance: 3 })
    expect(h.fulfill).toHaveBeenCalledWith('session', 'owner')
  })
  it('does not acknowledge failed fulfillment', async () => {
    h.fulfill.mockRejectedValue(new Error('transaction failed'))
    expect((await post({ sessionId: 'session' })).status).toBe(503)
  })
})
