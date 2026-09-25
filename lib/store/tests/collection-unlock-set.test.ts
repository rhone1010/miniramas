import { beforeEach, describe, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), product: vi.fn(), create: vi.fn(), retrieve: vi.fn(), lines: vi.fn(), attempt: null as any, session: null as any }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: h.rpc, from: h.from } }))
vi.mock('@/lib/store/stripe', () => ({ getStripe: () => ({ products: { retrieve: h.product }, checkout: { sessions: { retrieve: h.retrieve, listLineItems: h.lines } } }) }))
vi.mock('@/lib/store/stripe-branding', () => ({ createBrandedSession: h.create }))
import { createCollectionSetCheckout, fulfillCollectionSet } from '../collection-unlock-set'
beforeEach(() => {
  vi.clearAllMocks()
  h.attempt = { attempt_id: 'attempt', user_id: 'owner', quantity: 10, rate_cents: 179, amount_cents: 1790,
    params: { metadata: { kind: 'collection_unlock_set' } }, created_at: new Date().toISOString() }
  h.session = { id: 'session', status: 'open', payment_status: 'unpaid', client_secret: 'secret',
    currency: 'usd', amount_total: 1790, payment_intent: 'charge', metadata: { kind: 'collection_unlock_set', userId: 'owner', attemptId: 'attempt' } }
  h.product.mockResolvedValue({ active: true })
  h.create.mockImplementation(async () => h.session)
  h.retrieve.mockImplementation(async () => h.session)
  h.rpc.mockImplementation(async name => ({ data: name.startsWith('reserve') ? h.attempt : name.startsWith('fulfill') ? 10 : 'purchase', error: null }))
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: h.attempt, error: null }) }
  h.from.mockReturnValue(q)
  h.lines.mockResolvedValue({ has_more: false, data: [{ quantity: 10, price: { product: 'prod_VIC0Ff7OO7nFPj', currency: 'usd', unit_amount: 179, type: 'one_time' } }] })
})
describe('Collection-wide checkout and fulfillment', () => {
  it('uses persisted session parameters and an attempt idempotency key before exposing checkout', async () => {
    const r = await createCollectionSetCheckout('owner',10,'https://preview.example/discovery')
    expect(h.create).toHaveBeenCalledWith(expect.anything(),h.attempt.params,{ idempotencyKey:'collection-set:attempt' })
    expect(h.rpc).toHaveBeenLastCalledWith('complete_collection_unlock_set',{ p_attempt:'attempt',p_user:'owner',p_session:'session' })
    expect(r).toMatchObject({ count:10,priceCents:1790,clientSecret:'secret' })
  })
  it('reuses the original set even when a different count is requested during checkout', async () => {
    h.attempt.session_id='session'
    expect(await createCollectionSetCheckout('owner',20,'https://preview.example/discovery')).toMatchObject({ count:10,priceCents:1790 })
    expect(h.create).not.toHaveBeenCalled()
  })
  it('never exposes a payable checkout when persistence fails', async () => {
    h.rpc.mockImplementation(async name => name.startsWith('reserve') ? { data:h.attempt } : { error:{ message:'offline' } })
    await expect(createCollectionSetCheckout('owner',10,'https://preview.example')).rejects.toThrow('collection_set_persist_failed')
  })
  it('does not fulfill unpaid sessions or other owners', async () => {
    expect(await fulfillCollectionSet('session','owner')).toEqual({ confirmed:false })
    await expect(fulfillCollectionSet('session','other')).rejects.toThrow('collection_set_not_found')
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it.each(['kind','userId','attemptId'])('rejects incorrect %s metadata', async key => {
    h.session.payment_status='paid'; h.session.metadata[key]='wrong'
    await expect(fulfillCollectionSet('session','owner')).rejects.toThrow('collection_set_payment_mismatch')
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it('checks paid quantities, unit price and product before the transaction', async () => {
    h.session.payment_status='paid'
    h.lines.mockResolvedValue({ data:[{ quantity:20,price:{product:'prod_VIC0Ff7OO7nFPj',unit_amount:179,currency:'usd',type:'one_time'} }] })
    await expect(fulfillCollectionSet('session','owner')).rejects.toThrow('collection_set_line_mismatch')
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it('uses the same idempotent fulfillment on webhook and browser retry without a wallet grant', async () => {
    h.session.payment_status='paid'
    expect(await fulfillCollectionSet('session','owner')).toEqual({ confirmed:true,count:10 })
    await fulfillCollectionSet('session')
    expect(h.rpc.mock.calls[0]).toEqual(h.rpc.mock.calls[1])
    expect(h.rpc.mock.calls.every(c => c[0]==='fulfill_collection_unlock_set')).toBe(true)
  })
  it('does not report success if the transaction fails', async () => {
    h.session.payment_status='paid'; h.rpc.mockResolvedValue({ error:{message:'rollback'} })
    await expect(fulfillCollectionSet('session','owner')).rejects.toThrow('collection_set_fulfillment_failed')
  })
})
