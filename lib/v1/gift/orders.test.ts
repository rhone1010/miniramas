import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { createGiftCheckout, confirmGiftOrder, verifyGiftPayment, giftOrderRecheck, DISCLOSURE, GIFT_ORDER_KIND, type GiftOrderDeps, type PrintOrdersPort } from './orders'
import { createSession, setLines, startBatch, getSessionView, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { giftRenderId, isGiftOrder, parseGiftRenderId } from './order-kind'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const ADDRESS = { name: 'Ada Lovelace', line1: '1 Main St', city: 'Sonoma', state: 'CA', postcode: '95476', countryCode: 'us' }
const BODY = { email: 'ada@example.test', shippingAddress: ADDRESS, disclosureAccepted: true as const, returnPath: '/gift-wizard' as const }

function rig(over: { shippingAmount?: string; canFulfil?: boolean; sandbox?: boolean } = {}) {
  const store = memoryGiftStore()
  const files = new Map<string, Buffer>()
  const gift: GiftDeps = {
    store,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async () => {}, signedUrl: async p => 'https://signed.test/' + p },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }),
    generate: async () => ({ imageB64: (await sharp({ create: { width: 512, height: 512, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64') }),
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
  }
  const sessions = new Map<string, any>()                           // fake Stripe: sessions by id
  let n = 0
  const stripe: any = {
    checkout: {
      sessions: {
        create: vi.fn(async (p: any) => { const id = 'cs_test_gift' + String(++n).padStart(8, '0'); const s = { id, status: 'open', client_secret: 'secret_' + id, payment_status: 'unpaid', mode: 'payment', currency: 'usd', metadata: p.metadata, params: p, amount_total: p.line_items.reduce((t: number, l: any) => t + l.price_data.unit_amount * l.quantity, 0), payment_intent: null }; sessions.set(id, s); return s }),
        retrieve: vi.fn(async (id: string) => { const s = sessions.get(id); if (!s) throw new Error('no such session'); return s }),
        listLineItems: vi.fn(async (id: string) => ({ has_more: false, data: sessions.get(id).params.line_items.map((l: any) => ({ amount_total: l.price_data.unit_amount * l.quantity })) })),
      },
    },
  }
  const printOrders: PrintOrdersPort = {
    async create(i) {
      const id = randomUUID()
      store.orders.set(id, { id, status: 'created', paid_at: null, stripe_session_id: i.stripeSessionId, stripe_payment_intent: null, retail_total_cents: i.retailTotalCents, retail_shipping_cents: i.retailShippingCents, items: i.items as any, prodigi_order_id: null, placed_at: null })
      return { id }
    },
    async replaceStripeSession(orderId, sid) { store.orders.get(orderId)!.stripe_session_id = sid },
  }
  const quote = vi.fn(async (_req: unknown) => ({ outcome: 'Ok', quotes: [{ costSummary: { shipping: { amount: over.shippingAmount ?? '6.85', currency: 'USD' } } }] }) as any)
  const deps: GiftOrderDeps & { gift: GiftDeps } = {
    store, stripe, printOrders, quote, canFulfil: vi.fn(async () => over.canFulfil ?? true), publishableKey: 'pk_test_x', gift,
    requireSandbox: over.sandbox === false ? () => { throw new Error('preview_only') } : undefined,
  }
  const pay = (id: string, intent = 'pi_test_1') => { const s = sessions.get(id); s.payment_status = 'paid'; s.status = 'complete'; s.payment_intent = intent }
  return { deps, store, stripe, sessions, quote, pay, gift }
}
async function sessionWithLines(r: ReturnType<typeof rig>, lines = [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }, { lineId: 'b', productId: 'canvas:12x12', copies: 2 }], user = U1) {
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const view = await createSession(r.gift, { userId: user, imageB64: photo })
  if (lines.length) await setLines(r.gift, user, view.sessionId, lines)
  return view.sessionId
}
const checkout = (r: ReturnType<typeof rig>, sessionId: string, body: any = BODY, user = U1) => createGiftCheckout(r.deps, { user: { id: user }, sessionId, origin: 'https://x.test', body })

describe('gift checkout', () => {
  it('prices the saved lines from the catalog, adds the Prodigi shipping quote, and creates one unpaid order linked to the session', async () => {
    const r = rig(); const sid = await sessionWithLines(r)
    const out = await checkout(r, sid)
    expect(out).toMatchObject({ clientSecret: expect.stringMatching(/^secret_cs_test_gift/), publishableKey: 'pk_test_x', disclosure: DISCLOSURE })
    expect(out.totals).toEqual({ itemsCents: 2900 + 2 * 6900, shippingCents: 685, totalCents: 2900 + 2 * 6900 + 685 })      // catalog retail, Prodigi shipping, nothing invented
    const order = [...r.store.orders.values()][0]
    expect(order).toMatchObject({ status: 'created', paid_at: null, retail_total_cents: out.totals.totalCents, retail_shipping_cents: 685, stripe_session_id: out.stripeSessionId })
    expect(order.items.map(i => ({ id: i.renderId, sku: i.sku, copies: i.copies, cents: i.retailCents }))).toEqual([
      { id: giftRenderId(sid, 'a'), sku: 'GLOBAL-FAP-8X8', copies: 1, cents: 2900 }, { id: giftRenderId(sid, 'b'), sku: 'GLOBAL-CAN-12X12', copies: 2, cents: 6900 }])
    expect((await r.store.getSession(sid, U1))!.order_id).toBe(order.id)
    expect(isGiftOrder(order as any)).toBe(true); expect(parseGiftRenderId(order.items[0].renderId)).toEqual({ sessionId: sid, lineId: 'a' })
  })
  it('asks Prodigi for the quote with the catalog SKU and attributes of each line (never client values)', async () => {
    const r = rig(); const sid = await sessionWithLines(r); await checkout(r, sid)
    expect(r.quote.mock.calls[0][0]).toMatchObject({ shippingMethod: 'Budget', destinationCountryCode: 'US', items: [{ sku: 'GLOBAL-FAP-8X8', copies: 1, attributes: {} }, { sku: 'GLOBAL-CAN-12X12', copies: 2, attributes: { wrap: 'MirrorWrap' } }] })
  })
  it('Stripe carries the disclosure, the kind, the owner and the session; amounts equal the catalog', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const out = await checkout(r, sid)
    const p = r.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(p).toMatchObject({ mode: 'payment', ui_mode: 'embedded', customer_email: 'ada@example.test', custom_text: { submit: { message: DISCLOSURE.text } }, metadata: { kind: GIFT_ORDER_KIND, giftSessionId: sid, userId: U1, disclosure: DISCLOSURE.version } })
    expect(p.return_url).toBe('https://x.test/gift-wizard?gift_order_session={CHECKOUT_SESSION_ID}')
    expect(DISCLOSURE.text).toMatch(/created after you pay/); expect(DISCLOSURE.text).toMatch(/Nothing is printed or manufactured until you approve/); expect(DISCLOSURE.text.length).toBeLessThan(1200)
    expect(out.totals.totalCents).toBe(r.sessions.get(out.stripeSessionId).amount_total)
  })
  it('records the version of the disclosure the customer accepted, and refuses without acceptance', async () => {
    const r = rig(); const sid = await sessionWithLines(r)
    for (const v of [undefined, false, 'yes', 1]) await expect(checkout(r, sid, { ...BODY, disclosureAccepted: v })).rejects.toMatchObject({ code: 'disclosure_required' })
    expect(r.stripe.checkout.sessions.create).not.toHaveBeenCalled()
    await checkout(r, sid)
    const rec = (await r.store.getSession(sid, U1))!; expect(rec.disclosure_version).toBe(DISCLOSURE.version); expect(rec.disclosure_accepted_at).toBeTruthy()
  })
  it('refuses bad input before any quote or Stripe call', async () => {
    const r = rig(); const sid = await sessionWithLines(r)
    await expect(checkout(r, sid, { ...BODY, email: 'nope' })).rejects.toMatchObject({ code: 'invalid_email' })
    await expect(checkout(r, sid, { ...BODY, shippingAddress: { ...ADDRESS, postcode: ' ' } })).rejects.toMatchObject({ code: 'invalid_address' })
    await expect(checkout(r, sid, { ...BODY, shippingAddress: { ...ADDRESS, countryCode: 'USA' } })).rejects.toMatchObject({ code: 'invalid_address' })
    await expect(checkout(r, sid, { ...BODY, returnPath: 'https://evil.test' })).rejects.toMatchObject({ code: 'checkout_unavailable' })
    const empty = await sessionWithLines(r, [])
    await expect(checkout(r, empty)).rejects.toMatchObject({ code: 'no_lines' })
    expect(r.quote).not.toHaveBeenCalled(); expect(r.stripe.checkout.sessions.create).not.toHaveBeenCalled(); expect(r.store.orders.size).toBe(0)
  })
  it('only the owner can check out a session', async () => {
    const r = rig(); const sid = await sessionWithLines(r)
    await expect(checkout(r, sid, BODY, U2)).rejects.toMatchObject({ code: 'session_not_found' })
    expect(r.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('refuses when the account cannot be fulfilled, when Preview safeguards fail, and when the shipping quote fails', async () => {
    const a = rig({ canFulfil: false }); await expect(checkout(a, await sessionWithLines(a))).rejects.toMatchObject({ code: 'fulfilment_unavailable' })
    const b = rig({ sandbox: false }); await expect(checkout(b, await sessionWithLines(b))).rejects.toMatchObject({ code: 'checkout_unavailable' })
    const c = rig(); c.quote.mockRejectedValue(new Error('prodigi down')); await expect(checkout(c, await sessionWithLines(c))).rejects.toMatchObject({ code: 'shipping_quote_failed', status: 502 })
    for (const x of [a, b, c]) { expect(x.stripe.checkout.sessions.create).not.toHaveBeenCalled(); expect(x.store.orders.size).toBe(0) }
  })
  it('a product the artwork this session makes cannot fit is refused before payment (a square portrait master cannot make a 2:3 print)', async () => {
    const r = rig(); const sid = await sessionWithLines(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'product_not_available_for_artwork', status: 409 })
    expect(r.store.orders.size).toBe(0)
  })
  it('an open unpaid checkout is reused, not duplicated; a fresh Stripe session replaces an expired one on the same order', async () => {
    const r = rig(); const sid = await sessionWithLines(r)
    const a = await checkout(r, sid); const again = await checkout(r, sid)
    expect(again.stripeSessionId).toBe(a.stripeSessionId); expect(r.store.orders.size).toBe(1); expect(r.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1)
    r.sessions.get(a.stripeSessionId).status = 'expired'
    const fresh = await checkout(r, sid)
    expect(fresh.stripeSessionId).not.toBe(a.stripeSessionId); expect(r.store.orders.size).toBe(1)
    expect([...r.store.orders.values()][0].stripe_session_id).toBe(fresh.stripeSessionId)
  })
  it('an order that is already paid is never sold again', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid); r.pay(a.stripeSessionId)
    await confirmGiftOrder(r.deps, a.stripeSessionId)
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'order_already_paid' })
  })
})

describe('payment verification', () => {
  const paidOrder = async (r: ReturnType<typeof rig>) => { const sid = await sessionWithLines(r); const out = await checkout(r, sid); return { sid, out } }
  it('an unpaid session confirms nothing, grants nothing and generates nothing', async () => {
    const r = rig(); const { sid, out } = await paidOrder(r)
    expect(await confirmGiftOrder(r.deps, out.stripeSessionId)).toMatchObject({ confirmed: false })
    expect([...r.store.orders.values()][0].status).toBe('created'); expect((await r.store.getSession(sid, U1))!.free_batches_granted).toBe(0)
    await expect(startBatch(r.gift, U1, sid, { idempotencyKey: 'idem-key-1' })).rejects.toMatchObject({ code: 'order_payment_required' })
  })
  it('verified payment moves the order to awaiting_artwork, freezes the lines, grants two free batches and retains the session', async () => {
    const r = rig(); const { sid, out } = await paidOrder(r); r.pay(out.stripeSessionId)
    expect(await confirmGiftOrder(r.deps, out.stripeSessionId, U1)).toMatchObject({ confirmed: true, sessionId: sid })
    const order = [...r.store.orders.values()][0]; expect(order).toMatchObject({ status: 'awaiting_artwork', stripe_payment_intent: 'pi_test_1' }); expect(order.paid_at).toBeTruthy()
    const rec = (await r.store.getSession(sid, U1))!; expect(rec).toMatchObject({ free_batches_granted: 2 }); expect(rec.pinned_at).toBeTruthy()
    expect((await r.store.orderLines(order.id)).map(l => ({ id: l.line_id, p: l.product_id, sku: l.sku, c: l.copies }))).toEqual([{ id: 'a', p: 'fine_art:8x8', sku: 'GLOBAL-FAP-8X8', c: 1 }, { id: 'b', p: 'canvas:12x12', sku: 'GLOBAL-CAN-12X12', c: 2 }])
    const v = await getSessionView(r.gift, U1, sid); expect(v.order).toMatchObject({ state: 'awaiting_artwork', freeBatchesGranted: 2 }); expect(v.nextBatch).toEqual({ kind: 'free' })
    expect((await startBatch(r.gift, U1, sid, { idempotencyKey: 'idem-key-1' })).batch.kind).toBe('free')
  })
  it('is idempotent: the webhook, a retry and the browser confirm leave one confirmed order and one grant', async () => {
    const r = rig(); const { sid, out } = await paidOrder(r); r.pay(out.stripeSessionId)
    for (let i = 0; i < 3; i++) await confirmGiftOrder(r.deps, out.stripeSessionId)
    await confirmGiftOrder(r.deps, out.stripeSessionId, U1)
    expect(r.store.lines.length).toBe(2); expect((await r.store.getSession(sid, U1))!.free_batches_granted).toBe(2); expect(r.store.orders.size).toBe(1)
  })
  it('re-confirming never undoes progress: a later status stays', async () => {
    const r = rig(); const { out } = await paidOrder(r); r.pay(out.stripeSessionId); await confirmGiftOrder(r.deps, out.stripeSessionId)
    const order = [...r.store.orders.values()][0]; order.status = 'paid'
    await confirmGiftOrder(r.deps, out.stripeSessionId); expect(order.status).toBe('paid')
  })
  it('refuses anything that does not match what was sold: wrong kind, amount, currency, mode, lines, owner, or an unknown session', async () => {
    const mk = async (mutate: (s: any, r: ReturnType<typeof rig>) => void) => { const r = rig(); const { out } = await paidOrder(r); r.pay(out.stripeSessionId); mutate(r.sessions.get(out.stripeSessionId), r); return { r, id: out.stripeSessionId } }
    for (const [mutate, code] of [
      [(s: any) => { s.metadata = { ...s.metadata, kind: 'gift_preview_pack' } }, 'order_not_found'],
      [(s: any) => { s.metadata = { ...s.metadata, userId: U2 } }, 'order_not_found'],
      [(s: any) => { s.metadata = { ...s.metadata, giftSessionId: randomUUID() } }, 'order_not_found'],
      [(s: any) => { s.amount_total = 100 }, 'payment_not_confirmed'],
      [(s: any) => { s.currency = 'eur' }, 'payment_not_confirmed'],
      [(s: any) => { s.mode = 'subscription' }, 'payment_not_confirmed'],
      [(s: any) => { s.payment_intent = null }, 'payment_not_confirmed'],
      [(s: any) => { s.params.line_items = s.params.line_items.slice(1) }, 'payment_not_confirmed'],
      [(s: any) => { s.params.line_items[0].price_data.unit_amount += 1 }, 'payment_not_confirmed'],
    ] as Array<[(s: any) => void, string]>) {
      const { r, id } = await mk(mutate)
      await expect(confirmGiftOrder(r.deps, id), code).rejects.toMatchObject({ code })
      expect([...r.store.orders.values()][0].status).toBe('created')
    }
    const r = rig(); await expect(confirmGiftOrder(r.deps, 'cs_test_unknown0001')).rejects.toThrow(); await expect(confirmGiftOrder(r.deps, 'nonsense')).rejects.toMatchObject({ code: 'order_not_found' })
  })
  it('a browser can only confirm its own order', async () => {
    const r = rig(); const { out } = await paidOrder(r); r.pay(out.stripeSessionId)
    await expect(confirmGiftOrder(r.deps, out.stripeSessionId, U2)).rejects.toMatchObject({ code: 'order_not_found' })
    expect([...r.store.orders.values()][0].status).toBe('created')
  })
  it('a cancelled order cannot be revived by a payment event', async () => {
    const r = rig(); const { out } = await paidOrder(r); r.pay(out.stripeSessionId); [...r.store.orders.values()][0].status = 'cancelled'
    await expect(confirmGiftOrder(r.deps, out.stripeSessionId)).rejects.toMatchObject({ code: 'order_not_payable' })
  })
})

describe('fulfilment-time re-verification', () => {
  const order = { stripe_session_id: 'cs_test_x0000001', stripe_payment_intent: 'pi_1', retail_total_cents: 1000, paid_at: new Date().toISOString() }
  const stripeWith = (over: { session?: any; intent?: any; charge?: any; refunds?: any }) => ({
    checkout: { sessions: { retrieve: async () => ({ metadata: { kind: GIFT_ORDER_KIND }, status: 'complete', payment_status: 'paid', payment_intent: 'pi_1', amount_total: 1000, livemode: false, ...over.session }) } },
    paymentIntents: { retrieve: async () => ({ id: 'pi_1', status: 'succeeded', currency: 'usd', amount_received: 1000, livemode: false, latest_charge: { paid: true, refunded: false, amount_refunded: 0, disputed: false, ...over.charge }, ...over.intent }) },
    refunds: { list: async () => ({ has_more: false, data: [], ...over.refunds }) },
  }) as any
  it('accepts a clean paid order, in test mode or live', async () => {
    await expect(verifyGiftPayment(stripeWith({}), order, { testModeOnly: true })).resolves.toBeUndefined()
    await expect(verifyGiftPayment(stripeWith({ session: { livemode: true }, intent: { livemode: true } }), order, { testModeOnly: false })).resolves.toBeUndefined()
  })
  it('refuses refunded, disputed, mismatched, live-in-test and unpaid orders', async () => {
    for (const [over, msg] of [
      [{ charge: { refunded: true } }, 'gift_charge_ineligible'], [{ charge: { amount_refunded: 5 } }, 'gift_charge_ineligible'], [{ charge: { disputed: true } }, 'gift_charge_ineligible'],
      [{ refunds: { data: [{ status: 'succeeded' }] } }, 'gift_refunded'], [{ refunds: { data: [{ status: 'pending' }] } }, 'gift_refunded'],
      [{ session: { amount_total: 999 } }, 'gift_payment_not_confirmed'], [{ intent: { amount_received: 1 } }, 'gift_payment_not_confirmed'], [{ session: { metadata: { kind: 'x' } } }, 'gift_payment_not_confirmed'],
      [{ session: { livemode: true } }, 'gift_payment_not_test_mode'],
    ] as Array<[any, string]>) await expect(verifyGiftPayment(stripeWith(over), order, { testModeOnly: true }), msg).rejects.toThrow(msg)
    await expect(verifyGiftPayment(stripeWith({}), { ...order, paid_at: null }, { testModeOnly: true })).rejects.toThrow('gift_unpaid')
    await expect(verifyGiftPayment(stripeWith({ refunds: { data: [{ status: 'failed' }] } }), order, { testModeOnly: true })).resolves.toBeUndefined()
  })
  it('the database gate stops an order that is refunded, has a refund request, or has not been approved', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const out = await checkout(r, sid); r.pay(out.stripeSessionId); await confirmGiftOrder(r.deps, out.stripeSessionId)
    const orderId = [...r.store.orders.values()][0].id; const rec = r.store.sessions.get(sid)!
    await expect(giftOrderRecheck(r.store, orderId)).rejects.toThrow('artwork_not_approved')
    rec.approved_at = new Date().toISOString(); await expect(giftOrderRecheck(r.store, orderId)).resolves.toBeUndefined()
    rec.refund_requested_at = new Date().toISOString(); await expect(giftOrderRecheck(r.store, orderId)).rejects.toThrow('refund_pending')
    rec.refund_requested_at = null; rec.refunded_at = new Date().toISOString(); await expect(giftOrderRecheck(r.store, orderId)).rejects.toThrow('order_refunded')
    await expect(giftOrderRecheck(r.store, 'not-a-gift-order')).resolves.toBeUndefined()           // other orders are unaffected
  })
})
