import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { createSession, setLines, startBatch, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { requestRefund, applyVerifiedRefunds, declineRefund, REFUND_CUSTOMER_MESSAGE, REFUND_POLICY_TEXT, type ConciergePort } from './refund'
import { selectArtwork } from './compose'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const TOTAL = 12345

function rig() {
  const store = memoryGiftStore(), files = new Map<string, Buffer>(), messages = new Map<string, any>()
  const concierge: ConciergePort = { create: vi.fn(async row => { if (!messages.has(row.id)) messages.set(row.id, row) }) }
  const deps: GiftDeps & { concierge: ConciergePort } = {
    store, concierge,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => 'https://signed.test/' + p },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }),
    generate: async () => ({ imageB64: (await sharp({ create: { width: 256, height: 256, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64') }),
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
  }
  return { deps, store, messages, concierge }
}
async function paid(r: ReturnType<typeof rig>, user = U1) {
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const v = await createSession(r.deps, { userId: user, imageB64: photo })
  await setLines(r.deps, user, v.sessionId, [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }])
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
  r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: TOTAL, retail_shipping_cents: 685, items: [], prodigi_order_id: null, placed_at: null, customer_email: 'ada@example.test', prodigi_merchant_ref: 'gift-ref-1' })
  await r.store.linkOrder(v.sessionId, user, orderId, 'v1')
  await r.store.confirmOrder({ sessionId: v.sessionId, orderId, userId: user, stripeSessionId: cs, paymentIntent: 'pi_test_' + orderId.slice(0, 6), lines: [{ lineId: 'a', productId: 'fine_art:8x8', sku: 'GLOBAL-FAP-8X8', copies: 1 }] })
  await startBatch(r.deps, user, v.sessionId, { idempotencyKey: 'idem-key-1' })
  return { sid: v.sessionId, orderId, intent: r.store.orders.get(orderId)!.stripe_payment_intent! }
}
const stripeWith = (intent: string, refunds: Array<{ id: string; amount: number; status?: string; created?: number }>, chargeIntent = intent) => ({
  charges: { retrieve: vi.fn(async (id: string) => ({ id, payment_intent: chargeIntent })) },
  refunds: { list: vi.fn(async () => ({ data: refunds.map(x => ({ status: 'succeeded', created: 1, ...x })) })) },
}) as any

describe('the refund request (Concierge)', () => {
  it('records one request, one Concierge message keyed by it, and tells the customer nothing will be manufactured', async () => {
    const r = rig(); const { sid, orderId } = await paid(r)
    const out = await requestRefund(r.deps, U1, sid, '  none of the twelve feel right  ')
    expect(out).toMatchObject({ state: 'requested', message: REFUND_CUSTOMER_MESSAGE }); expect(REFUND_CUSTOMER_MESSAGE).toMatch(/Nothing will be printed or manufactured/)
    expect(r.messages.size).toBe(1)
    expect(r.messages.get(out.requestId)).toMatchObject({ user_id: U1, reply_to: 'ada@example.test', subject: 'Gift Wizard refund request: order gift-ref-1', context: { kind: 'gift_refund_request', order_id: orderId, session_id: sid, total_cents: TOTAL, batches: 1 } })
    expect(r.messages.get(out.requestId).body).toMatch(/none of the twelve feel right/); expect(r.messages.get(out.requestId).body).toMatch(/Nothing has been sent to the print lab/)
    expect(r.store.sessions.get(sid)!.refund_requested_at).toBeTruthy(); expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork')
  })
  it('states the approved policy: previews come before purchase, refund until manufacturing, nothing automatic, no dissatisfaction-with-previews basis', async () => {
    const r = rig(); const { sid } = await paid(r)
    const out = await requestRefund(r.deps, U1, sid, '')
    const body: string = r.messages.get(out.requestId).body
    expect(body).toMatch(/full refund of the physical-product purchase/); expect(body).toMatch(/until the order is submitted to the print partner/)
    expect(body).toMatch(/first twelve previews are free and came before the purchase/); expect(body).toMatch(/issued in Stripe by a person/)
    expect(body).not.toMatch(/dissatisfied|included previews|recorded automatically\.$/)
    expect(REFUND_POLICY_TEXT).toBe('After purchasing physical gifts, you may request a full refund through Concierge until your order is submitted to our print partner. Once submitted, the order is no longer eligible for this refund.\n\nAdditional artwork preview packs are separate purchases and are not included in physical-product refunds.')
    expect(REFUND_CUSTOMER_MESSAGE).not.toMatch(/dissatisfied|automatic refund/i)
  })
  it('is idempotent: asking again returns the same request and creates no second message', async () => {
    const r = rig(); const { sid } = await paid(r)
    const a = await requestRefund(r.deps, U1, sid, 'x'); const b = await requestRefund(r.deps, U1, sid, 'again')
    expect(b.requestId).toBe(a.requestId); expect(r.messages.size).toBe(1); expect(r.store.refundRequests.size).toBe(1)
  })
  it('only the owner can ask, and an order that was never paid has nothing to refund', async () => {
    const r = rig(); const { sid } = await paid(r)
    await expect(requestRefund(r.deps, U2, sid, 'x')).rejects.toMatchObject({ code: 'session_not_found' })
    const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
    const unpaid = await createSession(r.deps, { userId: U1, imageB64: photo })
    await expect(requestRefund(r.deps, U1, unpaid.sessionId, 'x')).rejects.toMatchObject({ code: 'order_not_paid' })
    expect(r.messages.size).toBe(0)
  })
  it('is not available once the order is with the lab; that goes through ordinary support', async () => {
    const r = rig(); const { sid, orderId } = await paid(r); Object.assign(r.store.orders.get(orderId)!, { status: 'placed', prodigi_order_id: 'ord_1', placed_at: new Date().toISOString() })
    await expect(requestRefund(r.deps, U1, sid, 'x')).rejects.toMatchObject({ code: 'refund_not_available_after_manufacturing' })
    expect(r.messages.size).toBe(0)
  })
  it('stops everything until Concierge declines, then the customer carries on and may ask again', async () => {
    const r = rig(); const { sid, orderId } = await paid(r)
    await requestRefund(r.deps, U1, sid, 'x')
    await expect(startBatch(r.deps, U1, sid, { idempotencyKey: 'idem-key-2' })).rejects.toMatchObject({ code: 'refund_pending' })
    const prev = [...r.store.previews][0]
    await expect(selectArtwork(r.deps, U1, sid, prev.id)).rejects.toMatchObject({ code: 'refund_pending' })
    await declineRefund(r.store, orderId)
    expect((await startBatch(r.deps, U1, sid, { idempotencyKey: 'idem-key-2' })).batch.batchIndex).toBe(2)
    const again = await requestRefund(r.deps, U1, sid, 'still not right'); expect(again.state).toBe('requested')
  })
})

describe('verified refunds', () => {
  it('a full refund verified with Stripe cancels the unplaced order, releases the session for cleanup and manufactures nothing', async () => {
    const r = rig(); const { sid, orderId, intent } = await paid(r); await requestRefund(r.deps, U1, sid, 'x')
    const out = await applyVerifiedRefunds({ stripe: stripeWith(intent, [{ id: 're_1', amount: TOTAL }]), store: r.store }, { id: 'ch_1', payment_intent: intent })
    expect(out).toEqual([{ refundId: 're_1', result: 'cancelled' }])
    expect(r.store.orders.get(orderId)!.status).toBe('cancelled')
    const s = r.store.sessions.get(sid)!; expect(s.refunded_at).toBeTruthy(); expect(s.pinned_at).toBeNull(); expect(s.refund_requested_at).toBeNull()
    expect(r.store.refundRequests.get(orderId)!.status).toBe('refunded')
    await expect(startBatch(r.deps, U1, sid, { idempotencyKey: 'idem-key-9' })).rejects.toMatchObject({ code: 'order_refunded' })
  })
  it('works without a prior request: a refund a person issues in Stripe is recorded the same way', async () => {
    const r = rig(); const { orderId, intent } = await paid(r)
    const out = await applyVerifiedRefunds({ stripe: stripeWith(intent, [{ id: 're_direct', amount: TOTAL }]), store: r.store }, { id: 'ch_1', payment_intent: intent })
    expect(out[0].result).toBe('cancelled'); expect(r.store.orders.get(orderId)!.status).toBe('cancelled')
  })
  it('is idempotent on the Stripe refund id, however often and in whatever order the event arrives', async () => {
    const r = rig(); const { intent } = await paid(r); const stripe = stripeWith(intent, [{ id: 're_1', amount: TOTAL }])
    const first = await applyVerifiedRefunds({ stripe, store: r.store }, { id: 'ch_1', payment_intent: intent })
    const second = await applyVerifiedRefunds({ stripe, store: r.store }, { id: 'ch_1', payment_intent: intent })
    expect(first[0].result).toBe('cancelled'); expect(second).toEqual([{ refundId: 're_1', result: 'already' }]); expect(r.store.refunds.size).toBe(1)
  })
  it('a partial refund is recorded and cancels nothing; the refund that completes the total cancels', async () => {
    const r = rig(); const { orderId, intent } = await paid(r)
    expect((await applyVerifiedRefunds({ stripe: stripeWith(intent, [{ id: 're_a', amount: 500 }]), store: r.store }, { id: 'ch_1', payment_intent: intent }))[0].result).toBe('recorded_partial')
    expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork')
    const out = await applyVerifiedRefunds({ stripe: stripeWith(intent, [{ id: 're_a', amount: 500, created: 1 }, { id: 're_b', amount: TOTAL - 500, created: 2 }]), store: r.store }, { id: 'ch_1', payment_intent: intent })
    expect(out).toEqual([{ refundId: 're_a', result: 'already' }, { refundId: 're_b', result: 'cancelled' }]); expect(r.store.orders.get(orderId)!.status).toBe('cancelled')
  })
  it('only SUCCEEDED refunds count: pending and failed ones change nothing', async () => {
    const r = rig(); const { orderId, intent } = await paid(r)
    const out = await applyVerifiedRefunds({ stripe: stripeWith(intent, [{ id: 're_p', amount: TOTAL, status: 'pending' }, { id: 're_f', amount: TOTAL, status: 'failed' }]), store: r.store }, { id: 'ch_1', payment_intent: intent })
    expect(out).toEqual([]); expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork'); expect(r.store.refunds.size).toBe(0)
  })
  it('the event is only a pointer: a charge that does not belong to the claimed payment intent is ignored', async () => {
    const r = rig(); const { orderId, intent } = await paid(r)
    expect(await applyVerifiedRefunds({ stripe: stripeWith(intent, [{ id: 're_1', amount: TOTAL }], 'pi_someone_else'), store: r.store }, { id: 'ch_1', payment_intent: intent })).toEqual([])
    expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork')
  })
  it('refunds that are not for a gift order are left to the Print Shop', async () => {
    const r = rig(); const stripe = stripeWith('pi_other', [{ id: 're_1', amount: 100 }])
    expect(await applyVerifiedRefunds({ stripe, store: r.store }, { id: 'ch_1', payment_intent: 'pi_other' })).toEqual([])
    expect(await applyVerifiedRefunds({ stripe, store: r.store }, { id: 'ch_1', payment_intent: null })).toEqual([])
    expect(stripe.refunds.list).not.toHaveBeenCalled()
    const { orderId } = await paid(r); r.store.sessions.forEach(s => { if (s.order_id === orderId) s.order_id = null })      // an order with no gift session
    expect(await applyVerifiedRefunds({ stripe: stripeWith(r.store.orders.get(orderId)!.stripe_payment_intent!, [{ id: 're_x', amount: 1 }]), store: r.store }, { id: 'ch_1', payment_intent: r.store.orders.get(orderId)!.stripe_payment_intent })).toEqual([])
  })
  it('a refund after the order was placed with the lab is flagged for a person, and the lab order is untouched', async () => {
    const r = rig(); const { orderId, intent } = await paid(r); Object.assign(r.store.orders.get(orderId)!, { status: 'placed', prodigi_order_id: 'ord_1', placed_at: new Date().toISOString() })
    const out = await applyVerifiedRefunds({ stripe: stripeWith(intent, [{ id: 're_late', amount: TOTAL }]), store: r.store }, { id: 'ch_1', payment_intent: intent })
    expect(out[0].result).toBe('refunded_after_placement'); expect(r.store.orders.get(orderId)!.status).toBe('placed')
  })
})
