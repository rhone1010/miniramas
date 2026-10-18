import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { allProducts, catalogVersion } from '../print/catalog'
import { createGiftCheckout, confirmGiftOrder, verifyGiftPayment, giftOrderRecheck, DISCLOSURE, GIFT_ORDER_KIND, type GiftOrderDeps, type PrintOrdersPort } from './orders'
import { createSession, setLines, startBatch, getSessionView, type GiftDeps } from './service'
import { selectArtwork, ensureCompositions, approveComposition, approveOrder, repairLine, correctLine } from './compose'
import { memoryGiftStore } from './store'
import { giftRenderId, isGiftOrder, parseGiftRenderId } from './order-kind'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const ADDRESS = { name: 'Ada Lovelace', line1: '1 Main St', city: 'Sonoma', state: 'CA', postcode: '95476', countryCode: 'us' }
const BODY = { email: 'ada@example.test', shippingAddress: ADDRESS, disclosureAccepted: true as const, disclosureVersion: '2026-10-18-3', returnPath: '/gift-wizard' as const }

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
        expire: vi.fn(async (id: string) => { const s = sessions.get(id); if (!s) throw new Error('no such session'); if (s.status === 'complete') throw new Error('already complete'); s.status = 'expired'; return s }),
        listLineItems: vi.fn(async (id: string) => ({ has_more: false, data: sessions.get(id).params.line_items.map((l: any) => ({ amount_total: l.price_data.unit_amount * l.quantity })) })),
      },
    },
  }
  const printOrders: PrintOrdersPort = {
    async create(i) {
      const id = randomUUID()
      store.orders.set(id, { id, status: 'created', paid_at: null, stripe_session_id: i.stripeSessionId, stripe_payment_intent: null, retail_total_cents: i.retailTotalCents, retail_shipping_cents: i.retailShippingCents, items: i.items as any, prodigi_order_id: null, placed_at: null,
        customer_email: i.customerEmail, shipping_address: i.shippingAddress as any, shipping_method: i.shippingMethod, prodigi_merchant_ref: i.prodigiMerchantRef })
      return { id }
    },
    async updateUnpaid(orderId, i) {
      const o = store.orders.get(orderId)!; if (o.status !== 'created') return false
      Object.assign(o, { stripe_session_id: i.stripeSessionId, customer_email: i.customerEmail, shipping_address: i.shippingAddress as any, shipping_method: i.shippingMethod, items: i.items as any, retail_shipping_cents: i.retailShippingCents, retail_total_cents: i.retailTotalCents }); return true
    },
  }
  const quote = vi.fn(async (_req: unknown) => ({ outcome: 'Ok', quotes: [{ costSummary: { shipping: { amount: over.shippingAmount ?? '6.85', currency: 'USD' } } }] }) as any)
  const deps: GiftOrderDeps & { gift: GiftDeps } = {
    store, stripe, printOrders, quote, canFulfil: vi.fn(async () => over.canFulfil ?? true), publishableKey: 'pk_test_x', gift,
    requireSandbox: over.sandbox === false ? () => { throw new Error('preview_only') } : undefined,
  }
  const pay = (id: string, intent = 'pi_test_1') => { const s = sessions.get(id); s.payment_status = 'paid'; s.status = 'complete'; s.payment_intent = intent }
  return { deps, store, stripe, sessions, quote, pay, gift }
}
/** Previews first: the customer has generated the free previews and saved a favorite (unless `favorite` is false) before choosing gifts. */
async function sessionWithLines(r: ReturnType<typeof rig>, lines = [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }, { lineId: 'b', productId: 'canvas:12x12', copies: 2 }], user = U1, favorite = true) {
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const view = await createSession(r.gift, { userId: user, imageB64: photo })
  if (favorite) { const b = await startBatch(r.gift, user, view.sessionId, { idempotencyKey: 'pre-purchase-1' }); await selectArtwork(r.gift, user, view.sessionId, b.batch.previews[0].previewId) }
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
    expect(DISCLOSURE.text).toMatch(/first twelve personalized artwork previews are free/); expect(DISCLOSURE.text).toMatch(/Nothing is printed or manufactured until you've approved your gifts and submitted your order/); expect(DISCLOSURE.text.length).toBeLessThan(1200)
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
  it('mixed shapes are purchasable: a 12 x 18 print with an 8 x 8 canvas in one project, priced from the catalog, with the order lines frozen', async () => {
    const r = rig(); const sid = await sessionWithLines(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'canvas:8x8', copies: 2 }])
    const out = await checkout(r, sid)
    expect(out.totals).toEqual({ itemsCents: 4400 + 2 * 5900, shippingCents: 685, totalCents: 4400 + 2 * 5900 + 685 })
    const order = [...r.store.orders.values()][0]
    expect(order.items.map(i => [i.sku, i.copies, i.retailCents])).toEqual([['GLOBAL-FAP-12X18', 1, 4400], ['GLOBAL-CAN-8X8', 2, 5900]])
    expect((r.quote.mock.calls[0][0] as any).items.map((i: any) => i.sku)).toEqual(['GLOBAL-FAP-12X18', 'GLOBAL-CAN-8X8'])
  })
  it('freezes each purchased line geometry on the order item at checkout: SKU, picture and final pixels, wrap, attributes and the catalog version', async () => {
    const r = rig(); const sid = await sessionWithLines(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'canvas:8x8', copies: 2 }])
    await checkout(r, sid); const order = [...r.store.orders.values()][0]
    const frozen = order.items.map(i => (i as any).frozen)
    expect(frozen.map((f: any) => [f.snapshotVersion, f.catalogVersion, f.product.productId, f.product.sku])).toEqual([[1, catalogVersion(), 'fine_art:12x18', 'GLOBAL-FAP-12X18'], [1, catalogVersion(), 'canvas:8x8', 'GLOBAL-CAN-8X8']])
    expect(frozen[1].product.attributes).toEqual({ wrap: 'MirrorWrap' }); expect(frozen[1].product.requirements.picturePx).toEqual({ w: 2400, h: 2400 }); expect(frozen[1].product.requirements.finalPx).toEqual({ w: 2454, h: 2454 })
    expect(frozen[0].product.requirements.picturePx).toEqual({ w: 3600, h: 5400 }); expect(Date.parse(frozen[0].frozenAt)).toBeGreaterThan(0)
  })
  it('a series master of one shape no longer limits what can be bought: the same 12 x 18 print is accepted for a Pets or a Groups project', async () => {
    for (const series of ['pets', 'groups'] as const) {
      const r = rig(); r.gift.analyze = async () => ({ status: 'supported', series, peopleCount: series === 'groups' ? 4 : null })
      const sid = await sessionWithLines(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
      expect((await checkout(r, sid)).totals.itemsCents).toBe(4400)
    }
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
    expect((await getSessionView(r.gift, U1, sid)).nextBatch).toEqual({ kind: 'free' })        // an unpaid checkout takes nothing away: the free previews do not depend on payment
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

// ── checkout session consistency: reuse only when everything matches; otherwise replace safely and persist what was actually sold ──
describe('checkout session reuse and replacement', () => {
  const quoteOf = (amount: string) => ({ outcome: 'Ok', quotes: [{ costSummary: { shipping: { amount, currency: 'USD' } } }] }) as any
  const order = (r: ReturnType<typeof rig>) => [...r.store.orders.values()][0]

  it('reuses the open session only while products, address, shipping method, quote and total all still match', async () => {
    const r = rig(); const sid = await sessionWithLines(r)
    const a = await checkout(r, sid), again = await checkout(r, sid, { ...BODY, email: 'ADA@example.test', shippingAddress: { ...ADDRESS, countryCode: 'US', line1: ' 1 Main St ' } })
    expect(again.stripeSessionId).toBe(a.stripeSessionId); expect(r.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1)   // trivial case/space differences are the same details
  })
  it.each([
    ['a different address', { shippingAddress: { ...ADDRESS, line1: '99 Other Rd' } }],
    ['a different postcode', { shippingAddress: { ...ADDRESS, postcode: '90210' } }],
    ['a different country', { shippingAddress: { ...ADDRESS, countryCode: 'gb' } }],
    ['a different email', { email: 'other@example.test' }],
    ['a different shipping method', { shippingMethod: 'Express' as const }],
  ])('%s replaces the session, and the order then carries what was actually sold', async (_name, change) => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid)
    const b2 = await checkout(r, sid, { ...BODY, ...change })
    expect(b2.stripeSessionId).not.toBe(a.stripeSessionId); expect(r.store.orders.size).toBe(1)
    expect(order(r)).toMatchObject({ stripe_session_id: b2.stripeSessionId, retail_total_cents: b2.totals.totalCents, retail_shipping_cents: b2.totals.shippingCents })
    const want = { ...BODY, ...change }; expect(order(r).customer_email).toBe(want.email); expect((order(r).shipping_address as any).postcode).toBe(want.shippingAddress.postcode)
    expect(order(r).shipping_method).toBe((change as any).shippingMethod ?? 'Budget')
    expect(r.sessions.get(a.stripeSessionId).status).toBe('expired')                         // the replaced session can no longer be paid
  })
  it('a changed shipping quote or total replaces the session and persists the new quote, which the payment is then verified against', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid)
    r.quote.mockResolvedValueOnce(quoteOf('9.50'))
    const b2 = await checkout(r, sid)
    expect(b2.stripeSessionId).not.toBe(a.stripeSessionId); expect(b2.totals.shippingCents).toBe(950); expect(order(r).retail_shipping_cents).toBe(950); expect(order(r).retail_total_cents).toBe(b2.totals.totalCents)
    r.pay(b2.stripeSessionId)
    expect(await confirmGiftOrder(r.deps, b2.stripeSessionId, U1)).toMatchObject({ confirmed: true })       // amount and line items match the UPDATED order
    expect(order(r).status).toBe('awaiting_artwork')
  })
  it('a stale confirmation for the replaced session is refused and grants nothing; the current session confirms once with two batches, whatever the deliveries', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid); const b2 = await checkout(r, sid, { ...BODY, email: 'new@example.test' })
    r.pay(a.stripeSessionId)                                                                  // the old session is "completed" at Stripe in the fake: it must still not count
    await expect(confirmGiftOrder(r.deps, a.stripeSessionId, U1)).rejects.toMatchObject({ code: 'order_not_found' })
    expect((await r.store.getSession(sid, U1))!.free_batches_granted).toBe(0); expect(order(r).status).toBe('created')
    r.pay(b2.stripeSessionId)
    for (let i = 0; i < 3; i++) await confirmGiftOrder(r.deps, b2.stripeSessionId)            // duplicate webhooks
    await confirmGiftOrder(r.deps, b2.stripeSessionId, U1)                                    // and the browser
    expect((await r.store.getSession(sid, U1))!.free_batches_granted).toBe(2); expect(order(r).status).toBe('awaiting_artwork'); expect(r.store.lines.length).toBe(2)
    await expect(confirmGiftOrder(r.deps, a.stripeSessionId)).rejects.toMatchObject({ code: 'order_not_found' })   // still refused after the order is paid
  })
  it('a session already paid at Stripe (confirmation pending) is never replaced: the caller must confirm', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid); r.pay(a.stripeSessionId); r.sessions.get(a.stripeSessionId).status = 'complete'
    await expect(checkout(r, sid, { ...BODY, email: 'late@example.test' })).rejects.toMatchObject({ code: 'order_already_paid' })
    expect(r.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1); expect(order(r).stripe_session_id).toBe(a.stripeSessionId); expect(order(r).customer_email).toBe(BODY.email)
  })
  it('an order paid while a replacement was being prepared is left untouched, and the unused new session is expired', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid)
    const real = r.deps.printOrders.updateUnpaid; r.deps.printOrders.updateUnpaid = async (id, i) => { order(r).status = 'awaiting_artwork'; return real(id, i) }
    await expect(checkout(r, sid, { ...BODY, email: 'race@example.test' })).rejects.toMatchObject({ code: 'order_already_paid' })
    expect(order(r).stripe_session_id).toBe(a.stripeSessionId); expect(order(r).customer_email).toBe(BODY.email)
    const unused = [...r.sessions.values()].find(s => s.id !== a.stripeSessionId)!; expect(unused.status).toBe('expired')
  })
  it('frozen product geometry from the first checkout is kept across a replacement, never re-taken from a newer catalog', async () => {
    let t = Date.parse('2026-10-17T10:00:00Z'); const r = rig(); r.deps.now = () => t
    const sid = await sessionWithLines(r); await checkout(r, sid); const first = (order(r).items[0] as any).frozen.frozenAt
    t += 3600_000; await checkout(r, sid, { ...BODY, email: 'later@example.test' })
    expect((order(r).items[0] as any).frozen.frozenAt).toBe(first); expect((order(r).items[1] as any).frozen.snapshotVersion).toBe(1)
  })
  it('the merchant reference and the order id stay the same across replacements (one order, one Prodigi reference)', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid); const ref = order(r).prodigi_merchant_ref; const id = order(r).id
    const b2 = await checkout(r, sid, { ...BODY, shippingMethod: 'Standard' })
    expect([order(r).id, order(r).prodigi_merchant_ref, r.sessions.get(b2.stripeSessionId).metadata.merchant_ref]).toEqual([id, ref, ref]); expect(a.stripeSessionId).not.toBe(b2.stripeSessionId)
  })
  it('an unpaid session that Stripe expired is replaced on the same order', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid); r.sessions.get(a.stripeSessionId).status = 'expired'
    const b2 = await checkout(r, sid); expect(b2.stripeSessionId).not.toBe(a.stripeSessionId); expect(r.store.orders.size).toBe(1); expect(order(r).stripe_session_id).toBe(b2.stripeSessionId)
  })
})

// ── the disclosure: exact wording, and the version the page displayed must be submitted and must be current ──
const APPROVED_TEXT = `Your first twelve personalized artwork previews are free, provided in two sets of six. Additional sets of six are available for $2.99.

Once you've chosen your favorite artwork, you can select and purchase the gifts you'd like us to create.

After payment, we'll prepare your artwork for each product. You'll review a clean preview of how it looks on each gift and approve each one before production begins.

Nothing is printed or manufactured until you've approved your gifts and submitted your order.

After purchasing physical gifts, you may request a full refund through Concierge until your order is submitted to our print partner. Once submitted, the order is no longer eligible for this refund.

Additional artwork preview packs are separate purchases and are not included in physical-product refunds.`

describe('previews before purchase: checkout needs a saved favorite', () => {
  it('refuses checkout until the customer has chosen a favorite, before any quote, Stripe session or order; works once one is saved', async () => {
    const r = rig(); const sid = await sessionWithLines(r, undefined, U1, false)
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'artwork_not_selected', status: 409 })
    expect(r.quote).not.toHaveBeenCalled(); expect(r.stripe.checkout.sessions.create).not.toHaveBeenCalled(); expect(r.store.orders.size).toBe(0)
    const b = await startBatch(r.gift, U1, sid, { idempotencyKey: 'late-favorite-1' }); await selectArtwork(r.gift, U1, sid, b.batch.previews[1].previewId)
    const out = await checkout(r, sid); expect(out.stripeSessionId).toMatch(/^cs_test_gift/)
    expect((await getSessionView(r.gift, U1, sid)).artworkPreviewId).toBe(b.batch.previews[1].previewId)         // the favorite is kept through checkout
  })
})

describe('purchase disclosure 2026-10-18-3', () => {
  const order = (r: ReturnType<typeof rig>) => [...r.store.orders.values()][0]
  it('is exactly the approved wording and version, and the same text goes to Stripe and back to the page', async () => {
    expect(DISCLOSURE).toEqual({ version: '2026-10-18-3', text: APPROVED_TEXT })
    const r = rig(); const sid = await sessionWithLines(r); const out = await checkout(r, sid)
    expect(out.disclosure).toEqual(DISCLOSURE); expect(r.sessions.get(out.stripeSessionId).params.custom_text.submit.message).toBe(APPROVED_TEXT)
    expect(r.sessions.get(out.stripeSessionId).metadata.disclosure).toBe('2026-10-18-3'); expect(APPROVED_TEXT.length).toBeLessThan(1200)       // Stripe's limit for the submit message
  })
  it('requires the version with the acceptance: missing, empty, non-string, stale and invented versions are refused before any quote, Stripe session or order', async () => {
    const r = rig(); const sid = await sessionWithLines(r)
    const { disclosureVersion: _v, ...noVersion } = BODY
    for (const body of [noVersion, { ...BODY, disclosureVersion: '' }, { ...BODY, disclosureVersion: 20261017 }, { ...BODY, disclosureVersion: null }]) await expect(checkout(r, sid, body)).rejects.toMatchObject({ code: 'disclosure_version_required', status: 400 })
    for (const v of ['2026-10-16-1', '2026-10-17-1', '2026-10-18-1', '2026-10-18-2', '2026-10-19-1', 'latest', ' 2026-10-18-3']) await expect(checkout(r, sid, { ...BODY, disclosureVersion: v })).rejects.toMatchObject({ code: 'disclosure_version_mismatch', status: 409 })
    await expect(checkout(r, sid, { ...BODY, disclosureAccepted: false })).rejects.toMatchObject({ code: 'disclosure_required' })
    expect(r.quote).not.toHaveBeenCalled(); expect(r.stripe.checkout.sessions.create).not.toHaveBeenCalled(); expect(r.store.orders.size).toBe(0)
  })
  it('a stale version is refused even when an open session exists: that session is neither reused nor replaced, and the order is untouched', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid); const before = JSON.stringify(order(r))
    await expect(checkout(r, sid, { ...BODY, disclosureVersion: '2026-10-17-1' })).rejects.toMatchObject({ code: 'disclosure_version_mismatch' })
    expect(r.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1); expect(r.sessions.get(a.stripeSessionId).status).toBe('open'); expect(JSON.stringify(order(r))).toBe(before)
    expect((await checkout(r, sid)).stripeSessionId).toBe(a.stripeSessionId)                                 // the current version still reuses it
  })
  it('an open session created under an older disclosure is not reused (it would show the old wording at payment): it is replaced and expired', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const a = await checkout(r, sid)
    r.sessions.get(a.stripeSessionId).metadata.disclosure = '2026-10-17-1'
    const b2 = await checkout(r, sid)
    expect(b2.stripeSessionId).not.toBe(a.stripeSessionId); expect(r.sessions.get(a.stripeSessionId).status).toBe('expired'); expect(r.sessions.get(b2.stripeSessionId).metadata.disclosure).toBe('2026-10-18-3')
  })
  it('existing acceptance timestamps and version records are preserved: a replacement checkout never rewrites what the session recorded when its order was first created', async () => {
    const r = rig(); const sid = await sessionWithLines(r); await checkout(r, sid)
    const rec = r.store.sessions.get(sid)!; rec.disclosure_version = '2026-10-16-1'; rec.disclosure_accepted_at = '2026-10-16T09:00:00.000Z'      // a session created under the previous wording
    await checkout(r, sid, { ...BODY, email: 'later@example.test' })
    expect([rec.disclosure_version, rec.disclosure_accepted_at]).toEqual(['2026-10-16-1', '2026-10-16T09:00:00.000Z'])
  })
  it('the first checkout records the accepted version and a timestamp on the session; nothing else about refunds, prices or entitlements changed', async () => {
    const r = rig(); const sid = await sessionWithLines(r); const out = await checkout(r, sid)
    const rec = (await r.store.getSession(sid, U1))!; expect(rec.disclosure_version).toBe('2026-10-18-3'); expect(rec.disclosure_accepted_at).toBeTruthy()
    expect(out.totals.shippingCents).toBe(685); expect(out.totals.totalCents).toBe(out.totals.itemsCents + 685)
    r.pay(out.stripeSessionId); await confirmGiftOrder(r.deps, out.stripeSessionId, U1); expect((await r.store.getSession(sid, U1))!.free_batches_granted).toBe(2)
  })
})

describe('compositions reviewed before payment (the approved journey)', () => {
  const reviewedRig = () => {
    const r = rig(); r.deps.requireReviewedCompositions = true; r.gift.draftCompositions = true         // the optional compose-before-payment capability, enabled for these tests
    r.gift.compose = vi.fn(async (i: { size: string; finish: string }) => {
      const p = allProducts().find(x => x.size === i.size && (x.family as string) === i.finish)!, w = 256, h = Math.round(256 * p.requirements.picturePx.h / p.requirements.picturePx.w)
      return { image: await sharp({ create: { width: w, height: h, channels: 3, background: '#036' } }).png().toBuffer(), width: w, height: h, fit: 'exact' as const, outpainted: false }
    })
    return r
  }
  const reviewed = async (r: ReturnType<typeof rig>) => {
    const sid = await sessionWithLines(r); await ensureCompositions(r.gift, U1, sid)
    for (const c of r.store.compositions) await approveComposition(r.gift, U1, sid, c.id)
    return sid
  }
  const pins = (r: ReturnType<typeof rig>) => [...r.store.orders.values()][0].items.map(i => (i.frozen as any).composition?.compositionId)

  it('is off by default: the current flow (checkout, then compose) is unchanged', async () => {
    const r = rig(); const sid = await sessionWithLines(r); await checkout(r, sid)
    expect([...r.store.orders.values()][0].items.every(i => (i.frozen as any).composition === undefined)).toBe(true)
  })
  it('when on, refuses before any quote or Stripe session unless every line has an APPROVED composition of the selected artwork', async () => {
    const r = reviewedRig(); const sid = await sessionWithLines(r)
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })              // none yet
    await ensureCompositions(r.gift, U1, sid)
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })              // composed and shown, not yet approved
    await approveComposition(r.gift, U1, sid, r.store.compositions[0].id)
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })              // one of two
    expect(r.quote).not.toHaveBeenCalled(); expect(r.stripe.checkout.sessions.create).not.toHaveBeenCalled(); expect(r.store.orders.size).toBe(0)
  })
  it('records exactly the approved compositions on the order, keeps them through payment, and approval-to-manufacture still needs payment', async () => {
    const r = reviewedRig(); const sid = await reviewed(r); const ids = r.store.compositions.map(c => c.id)
    await expect(approveOrder(r.gift, U1, sid)).rejects.toMatchObject({ code: 'order_payment_required' })      // approved artwork alone releases nothing
    const out = await checkout(r, sid)
    expect(pins(r)).toEqual(ids)
    const pin = ([...r.store.orders.values()][0].items[0].frozen as any)
    expect(pin.composition).toMatchObject({ compositionId: ids[0], previewId: r.store.compositions[0].preview_id, attempt: 1, repairSeq: 0, sku: pin.product.sku }); expect(pin.product.sku).toBeTruthy()   // the geometry snapshot is still there beside it
    await expect(approveOrder(r.gift, U1, sid)).rejects.toBeTruthy()                                            // an unpaid order cannot be approved either
    r.pay(out.stripeSessionId); await confirmGiftOrder({ stripe: r.stripe, store: r.store }, out.stripeSessionId, U1)
    const v = await getSessionView(r.gift, U1, sid)
    expect(v.compositions.map(c => [c.compositionId, c.status])).toEqual(ids.map(id => [id, 'approved']))      // identity and approval survive payment
    expect(r.store.compositions.map(c => c.id)).toEqual(ids)                                                    // nothing was recomposed or replaced
    expect((await approveOrder(r.gift, U1, sid)).order.state).toBe('approved')                                  // then the explicit order approval, only now
  })
  it('a repair of a draft composition makes its replacement "ready": checkout waits for re-approval, then pins the replacement under a new Stripe session', async () => {
    const r = reviewedRig(); const sid = await reviewed(r); const first = await checkout(r, sid); const oldIds = pins(r)
    expect((await checkout(r, sid)).stripeSessionId).toBe(first.stripeSessionId)                                // unchanged: the open session is reused
    const bad = r.store.compositions.find(c => c.line_id === 'a')!; Object.assign(bad, { width: 1575, height: 1050 })
    const fixed = await repairLine(r.gift, { operator: 'ops@liten.test', userId: U1, sessionId: sid, lineId: 'a' }) as any
    expect(fixed.status).toBe('repaired')                                                                       // works while the order is only 'created' (unpaid)
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
    await approveComposition(r.gift, U1, sid, fixed.compositionId)
    const again = await checkout(r, sid)
    expect(again.stripeSessionId).not.toBe(first.stripeSessionId); expect(r.sessions.get(first.stripeSessionId).status).toBe('expired')
    expect(pins(r)).toEqual([fixed.compositionId, oldIds[1]])                                                   // the replacement for line a; line b is the composition it always had
    expect(r.store.compositions.find(c => c.id === bad.id)).toMatchObject({ status: 'superseded', plan: { supersededReason: 'geometry_defect' } })
  })
  it('a composition for another product or the wrong shape is never pinned', async () => {
    const r = reviewedRig(); const sid = await reviewed(r)
    Object.assign(r.store.compositions[0], { width: 1575, height: 1050 })
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
    Object.assign(r.store.compositions[0], { width: 256, height: 256, plan: { ...r.store.compositions[0].plan, sku: 'SOME-OTHER-SKU' } })
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
  })
  it('changing a chosen product retires that line\'s composition and approval; the other line keeps its own', async () => {
    const r = reviewedRig(); const sid = await reviewed(r); const keep = r.store.compositions.find(c => c.line_id === 'b')!.id
    await setLines(r.gift, U1, sid, [{ lineId: 'a', productId: 'fine_art:12x12', copies: 1 }, { lineId: 'b', productId: 'canvas:12x12', copies: 2 }])
    expect(r.store.compositions.find(c => c.line_id === 'a')).toMatchObject({ status: 'superseded', plan: { supersededReason: 'line_changed' } }); expect(r.store.compositions.find(c => c.id === keep)!.status).toBe('approved')
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
    const v = await ensureCompositions(r.gift, U1, sid)                                                          // a new composition for line a only, as the next repair_seq
    expect(v.compositions.map(c => [c.lineId, c.status])).toEqual([['a', 'ready'], ['b', 'approved']]); expect(r.store.compositions.filter(c => c.line_id === 'a').map(c => c.repair_seq ?? 0)).toEqual([0, 1])
  })
  it('switching the favorite away and back reuses the stored composition files and pays for nothing', async () => {
    const r = reviewedRig(); const sid = await sessionWithLines(r); await ensureCompositions(r.gift, U1, sid); const made = (r.gift.compose as any).mock.calls.length
    const batch = (await getSessionView(r.gift, U1, sid)).batches[0].previews, first = batch[0].previewId
    await selectArtwork(r.gift, U1, sid, batch[1].previewId); await selectArtwork(r.gift, U1, sid, first)
    const v = await ensureCompositions(r.gift, U1, sid)
    expect(v.compositions.every(c => c.status === 'ready' && c.sourceArtworkId === first)).toBe(true); expect((r.gift.compose as any).mock.calls.length).toBe(made)
  })

  it('ONE included correction per product, counted across the purchase boundary: used on the draft, still spent after payment, and a technical repair never uses it', async () => {
    const r = reviewedRig(); const sid = await sessionWithLines(r); await ensureCompositions(r.gift, U1, sid)
    const remaining = async (line: string) => (await getSessionView(r.gift, U1, sid)).compositions.find(c => c.lineId === line)!.correctionsRemaining
    expect([await remaining('a'), await remaining('b')]).toEqual([1, 1])
    await correctLine(r.gift, U1, sid, 'a')                                                                    // before payment: line a's correction
    expect(r.store.compositions.filter(c => c.line_id === 'a').map(c => [c.attempt, c.status])).toEqual([[1, 'superseded'], [2, 'ready']])
    expect([await remaining('a'), await remaining('b')]).toEqual([0, 1])
    await expect(correctLine(r.gift, U1, sid, 'a')).rejects.toMatchObject({ code: 'correction_limit' })
    for (const c of r.store.compositions.filter(k => k.status === 'ready')) await approveComposition(r.gift, U1, sid, c.id)
    const out = await checkout(r, sid); r.pay(out.stripeSessionId); await confirmGiftOrder({ stripe: r.stripe, store: r.store }, out.stripeSessionId, U1)
    expect([await remaining('a'), await remaining('b')]).toEqual([0, 1])                                       // the paid order line starts at 0, the entitlement is not reset
    await expect(correctLine(r.gift, U1, sid, 'a')).rejects.toMatchObject({ code: 'correction_limit' })
    // a technical repair of line b does not touch b's correction
    Object.assign(r.store.compositions.find(c => c.line_id === 'b' && c.status !== 'superseded')!, { width: 1575, height: 1050 })
    expect((await repairLine(r.gift, { operator: 'ops@liten.test', userId: U1, sessionId: sid, lineId: 'b' })).status).toBe('repaired')
    expect(await remaining('b')).toBe(1); await correctLine(r.gift, U1, sid, 'b'); expect(await remaining('b')).toBe(0)       // b's one correction is still available after the repair
  })
})
