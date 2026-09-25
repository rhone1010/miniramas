import { beforeEach, describe, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ price: vi.fn(), retrieve: vi.fn(), lines: vi.fn(), create: vi.fn(), rpc: vi.fn(), from: vi.fn(), purchase: null as any, session: null as any, balance: 0 }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: h.from, rpc: h.rpc } }))
vi.mock('@/lib/store/stripe', () => ({ getStripe: () => ({ prices: { retrieve: h.price }, checkout: { sessions: { retrieve: h.retrieve, listLineItems: h.lines } } }) }))
vi.mock('@/lib/store/stripe-branding', () => ({ createBrandedSession: h.create }))
import { COLLECTION_UNLOCK_OFFERS, createCollectionUnlockCheckout, fulfillCollectionUnlocks, collectionUnlockBalance } from '../collection-unlocks'

beforeEach(() => {
  vi.clearAllMocks()
  h.balance = 0
  const offer = COLLECTION_UNLOCK_OFFERS[1]
  h.purchase = { id: 'purchase', user_id: 'owner', sku_id: offer.sku, amount_cents: offer.cents }
  h.session = { id: 'session', payment_status: 'paid', payment_intent: 'payment', amount_total: offer.cents, currency: 'usd', metadata: { kind: 'collection_unlock_bundle', userId: 'owner', sku: offer.sku } }
  h.retrieve.mockImplementation(async () => h.session)
  h.lines.mockResolvedValue({ has_more: false, data: [{ quantity: 1, price: { id: offer.price } }] })
  h.from.mockImplementation(() => {
    const query: any = { select: () => query, eq: () => query, is: () => query,
      maybeSingle: async () => ({ data: h.purchase, error: null }),
      then: (resolve: any) => resolve({ count: h.balance, error: null }),
    }
    return query
  })
  h.rpc.mockResolvedValue({ data: 'purchase', error: null })
  h.create.mockResolvedValue({ id: 'session', status: 'open', payment_status: 'unpaid', client_secret: 'secret' })
})

describe('approved Collection unlock checkout', () => {
  it.each(COLLECTION_UNLOCK_OFFERS)('sells exactly $count unlocks for $cents cents with the supplied Stripe mapping', async offer => {
    h.price.mockResolvedValue({ active: true, currency: 'usd', unit_amount: offer.cents, product: offer.product, type: 'one_time' })
    h.rpc.mockImplementation(async (name: string, args: any) => name.startsWith('reserve') ? {
      data: { attempt_id: 'attempt', params: args.p_params, created_at: new Date().toISOString() }, error: null,
    } : { data: 'purchase', error: null })
    const result = await createCollectionUnlockCheckout('owner', offer.count, 'https://litenco.com/pets/discovery')
    expect(h.price).toHaveBeenCalledWith(offer.price)
    expect(h.create.mock.calls[0][1].line_items).toEqual([{ price: offer.price, quantity: 1 }])
    expect(h.create.mock.calls[0][2]).toEqual({ idempotencyKey: 'collection-unlocks:attempt' })
    expect(result.priceCents).toBe(offer.cents)
    expect(h.rpc).toHaveBeenLastCalledWith('complete_collection_unlock_checkout', expect.objectContaining({ p_user: 'owner', p_session: 'session' }))
  })
  it('rejects unsupported quantities before Stripe or database writes', async () => {
    await expect(createCollectionUnlockCheckout('owner', 4, 'https://litenco.com/discovery')).rejects.toThrow('invalid_unlock_quantity')
    expect(h.rpc).not.toHaveBeenCalled()
    expect(h.price).not.toHaveBeenCalled()
  })
  it('refuses mismatched Stripe prices without creating a session', async () => {
    h.price.mockResolvedValue({ active: true, currency: 'usd', unit_amount: 1, product: COLLECTION_UNLOCK_OFFERS[0].product, type: 'one_time' })
    await expect(createCollectionUnlockCheckout('owner', 1, 'https://litenco.com/discovery')).rejects.toThrow('unlock_price_mismatch')
    expect(h.create).not.toHaveBeenCalled()
  })
  it('does not return a payable secret when local persistence fails', async () => {
    const offer = COLLECTION_UNLOCK_OFFERS[0]
    h.price.mockResolvedValue({ active: true, currency: 'usd', unit_amount: offer.cents, product: offer.product, type: 'one_time' })
    h.rpc.mockImplementation(async (name: string, args: any) => name.startsWith('reserve') ? {
      data: { attempt_id: 'attempt', params: args.p_params, created_at: new Date().toISOString() }, error: null,
    } : { error: { message: 'offline' } })
    await expect(createCollectionUnlockCheckout('owner', 1, 'https://litenco.com/discovery')).rejects.toThrow('unlock_bundle_persist_failed')
  })
})

describe('server-authoritative bundle fulfillment', () => {
  it('does not credit an unpaid session', async () => {
    h.session.payment_status = 'unpaid'
    expect(await fulfillCollectionUnlocks('session', 'owner')).toEqual({ confirmed: false })
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it('refuses another account', async () => {
    await expect(fulfillCollectionUnlocks('session', 'other')).rejects.toThrow('unlock_purchase_not_found')
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it.each(['amount_total', 'currency'])('refuses incorrect %s', async key => {
    h.session[key] = key === 'currency' ? 'eur' : 1
    await expect(fulfillCollectionUnlocks('session', 'owner')).rejects.toThrow('unlock_payment_mismatch')
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it('verifies actual paid line-item price and quantity', async () => {
    h.lines.mockResolvedValue({ data: [{ quantity: 10, price: { id: COLLECTION_UNLOCK_OFFERS[1].price } }] })
    await expect(fulfillCollectionUnlocks('session', 'owner')).rejects.toThrow('unlock_line_item_mismatch')
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it('retries the same fulfillment transaction after a failure without acknowledging success', async () => {
    h.rpc.mockResolvedValueOnce({ error: { message: 'database offline' } }).mockResolvedValueOnce({ error: null })
    await expect(fulfillCollectionUnlocks('session', 'owner')).rejects.toThrow('unlock_bundle_fulfillment_failed')
    h.balance = 3
    expect(await fulfillCollectionUnlocks('session', 'owner')).toEqual({ confirmed: true, balance: 3 })
    expect(h.rpc.mock.calls[0]).toEqual(h.rpc.mock.calls[1])
  })
  it('uses the same persisted transaction on webhook and browser replay', async () => {
    h.balance = 3
    await fulfillCollectionUnlocks('session')
    await fulfillCollectionUnlocks('session', 'owner')
    expect(h.rpc.mock.calls[0]).toEqual(h.rpc.mock.calls[1])
    expect(await collectionUnlockBalance('owner')).toBe(3)
  })
})
