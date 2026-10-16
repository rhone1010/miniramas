import { describe, it, expect, vi } from 'vitest'
import { fulfillPack, packReturnUrl, createPackCheckout, PackError } from './pack'
import { memoryGiftStore } from './store'
import { createSessionH, getSessionH, packCheckoutH, packConfirmH, startBatchH, setLinesH, cleanupH, fail, signInRequired } from './handlers'
import { GiftError } from './service'
import { PACK_KIND } from './policy'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const SID = 'cs_test_a1B2c3D4e5F6g7H8'
const paidSession = (over: any = {}) => ({ id: SID, mode: 'payment', currency: 'usd', amount_total: 299, payment_status: 'paid', metadata: { kind: PACK_KIND, userId: U1 }, ...over })
const stripeFor = (session: any, lines: any = { has_more: false, data: [{ quantity: 1, amount_total: 299 }] }) => ({
  checkout: { sessions: { retrieve: vi.fn(async () => session), listLineItems: vi.fn(async () => lines), create: vi.fn(async (p: any) => ({ id: 'cs_test_new00001', client_secret: 'secret_x', status: 'open', ...p })) } },
}) as any

describe('verified pack fulfilment', () => {
  it('records one pack for a verified paid session, idempotently, in any order of webhook and confirm', async () => {
    const store = memoryGiftStore(); const stripe = stripeFor(paidSession())
    const a = await fulfillPack({ stripe, store }, SID); const b = await fulfillPack({ stripe, store }, SID, U1)
    expect(a).toEqual({ confirmed: true, paidPacksAvailable: 1 }); expect(b).toEqual({ confirmed: true, paidPacksAvailable: 1 }); expect(store.packs.length).toBe(1)
  })
  it('an unpaid session grants nothing', async () => {
    const store = memoryGiftStore(); const out = await fulfillPack({ stripe: stripeFor(paidSession({ payment_status: 'unpaid' })), store }, SID)
    expect(out).toEqual({ confirmed: false, paidPacksAvailable: 0 }); expect(store.packs.length).toBe(0)
  })
  it('refuses a session that is another kind, another amount, another currency, not a payment, or has the wrong line', async () => {
    for (const over of [{ metadata: { kind: 'discovery_unlock', userId: U1 } }, { metadata: { kind: PACK_KIND } }]) {
      await expect(fulfillPack({ stripe: stripeFor(paidSession(over)), store: memoryGiftStore() }, SID)).rejects.toMatchObject({ code: 'pack_purchase_not_found' })
    }
    for (const over of [{ amount_total: 199 }, { currency: 'eur' }, { mode: 'subscription' }]) {
      await expect(fulfillPack({ stripe: stripeFor(paidSession(over)), store: memoryGiftStore() }, SID)).rejects.toMatchObject({ code: 'pack_payment_mismatch' })
    }
    for (const lines of [{ has_more: true, data: [{ quantity: 1, amount_total: 299 }] }, { has_more: false, data: [{ quantity: 2, amount_total: 299 }] }, { has_more: false, data: [] }]) {
      await expect(fulfillPack({ stripe: stripeFor(paidSession(), lines), store: memoryGiftStore() }, SID)).rejects.toMatchObject({ code: 'pack_payment_mismatch' })
    }
  })
  it('a browser can only confirm its own purchase, and learns nothing about anyone else purchases', async () => {
    const store = memoryGiftStore()
    await expect(fulfillPack({ stripe: stripeFor(paidSession()), store }, SID, U2)).rejects.toMatchObject({ code: 'pack_purchase_not_found' })
    expect(store.packs.length).toBe(0)
  })
  it('rejects malformed session ids without calling Stripe', async () => {
    const stripe = stripeFor(paidSession())
    for (const id of ['', 'pi_123', 'cs_', '../x', 5 as any]) await expect(fulfillPack({ stripe, store: memoryGiftStore() }, id)).rejects.toBeInstanceOf(PackError)
    expect(stripe.checkout.sessions.retrieve).not.toHaveBeenCalled()
  })
  it('the checkout is $2.99 for one pack, embedded, tagged with the kind and owner, and uses no existing price', async () => {
    const stripe = stripeFor(null); const out = await createPackCheckout(stripe, U1, packReturnUrl('https://x.test', '/gift-wizard'))
    expect(out).toMatchObject({ amountCents: 299, stripeSessionId: 'cs_test_new00001', clientSecret: 'secret_x' })
    const p = stripe.checkout.sessions.create.mock.calls[0][0]
    expect(p).toMatchObject({ mode: 'payment', ui_mode: 'embedded', metadata: { kind: PACK_KIND, userId: U1 }, line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 299 } }] })
    expect(JSON.stringify(p)).not.toMatch(/price_1|prod_/)
  })
  it('the return path is an allow-list on our own origin', () => {
    expect(packReturnUrl('https://x.test', '/gift-wizard.next.html')).toBe('https://x.test/gift-wizard.next.html?gift_pack_session={CHECKOUT_SESSION_ID}')
    for (const bad of ['https://evil.test', '//evil.test', '/other', undefined, '/gift-wizard/../x']) expect(() => packReturnUrl('https://x.test', bad)).toThrow(PackError)
  })
})

describe('HTTP handlers', () => {
  const req = (body: unknown, url = 'https://x.test/api') => new Request(url, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })
  const read = async (r: Response) => ({ status: r.status, body: r.status === 204 ? null : await r.json(), cache: r.headers.get('cache-control') })
  it('sign-in is required: 401 with the stable code, never cached', async () => {
    expect(await read(signInRequired())).toEqual({ status: 401, body: { error: 'sign_in_required' }, cache: 'no-store' })
  })
  it('maps stable error codes to statuses, and payment_required carries the price', async () => {
    expect(await read(fail(new GiftError('payment_required')))).toMatchObject({ status: 402, body: { error: 'payment_required', amountCents: 299, currency: 'USD' } })
    expect(await read(fail(new GiftError('session_not_found')))).toMatchObject({ status: 404 })
    expect(await read(fail(new GiftError('previous_batch_incomplete')))).toMatchObject({ status: 409 })
    expect(await read(fail(new PackError('pack_payment_mismatch')))).toMatchObject({ status: 409 })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await read(fail(new Error('secret db detail')))).toEqual({ status: 500, body: { error: 'gift_unavailable' }, cache: 'no-store' }); spy.mockRestore()
  })
  it('bad JSON is a 400 before any work', async () => {
    const deps: any = { store: {}, storage: {} }
    for (const h of [createSessionH(req('{'), { id: U1 }, deps), setLinesH(req('{'), { id: U1 }, deps, 'x'), startBatchH(req('{'), { id: U1 }, deps, 'x')]) expect((await h).status).toBe(400)
  })
  it('a session that is not yours reads exactly like a missing one', async () => {
    const deps: any = { store: memoryGiftStore(), storage: {} }
    expect(await read(await getSessionH({ id: U1 }, deps, '20000000-0000-4000-8000-000000000009'))).toMatchObject({ status: 404, body: { error: 'session_not_found' } })
  })
  it('the pack checkout needs a publishable key and a valid return path', async () => {
    const stripe = stripeFor(null)
    expect((await packCheckoutH(req({ returnPath: '/gift-wizard' }), { id: U1 }, stripe, undefined)).status).toBe(503)
    expect((await packCheckoutH(req({ returnPath: 'https://evil.test' }), { id: U1 }, stripe, 'pk_test_x')).status).toBe(400)
    const ok = await read(await packCheckoutH(req({ returnPath: '/gift-wizard' }, 'https://x.test/api'), { id: U1 }, stripe, 'pk_test_x'))
    expect(ok).toMatchObject({ status: 200, body: { amountCents: 299, publishableKey: 'pk_test_x' } })
  })
  it('confirm returns the verified result and never accepts a client-asserted payment', async () => {
    const store = memoryGiftStore()
    const r = await read(await packConfirmH(req({ stripeSessionId: SID, paid: true, confirmed: true }), { id: U1 }, { stripe: stripeFor(paidSession({ payment_status: 'unpaid' })), store }))
    expect(r.body).toEqual({ confirmed: false, paidPacksAvailable: 0 })
  })
  it('cleanup reports what it purged', async () => {
    const deps: any = { store: memoryGiftStore(), storage: { remove: vi.fn() }, clock: Date.now }
    expect(await read(await cleanupH(deps))).toMatchObject({ status: 200, body: { purged: 0, failed: 0 } })
  })
})
