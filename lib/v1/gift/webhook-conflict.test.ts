// A Gift order is also a print_orders row, so Stripe's checkout.session.completed can reach BOTH webhook entry points (the main
// /api/v1/webhooks/stripe route and the Print Shop's /api/v1/print/webhook handler). Whichever receives it, the Gift confirmation must be
// the one that runs: awaiting_artwork, exactly two included batches, nothing queued for manufacturing before the artwork is approved.
// The Stripe client is a fake that answers the way Stripe does; the memory store mirrors gift_confirm_order's rules.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'

const h = vi.hoisted(() => ({
  store: null as any, stripe: null as any, enqueue: vi.fn(), markPaid: vi.fn(), markError: vi.fn(), markWithheld: vi.fn(), notify: vi.fn(),
  allowed: true, refunds: vi.fn(),
}))
vi.mock('@/lib/store/stripe', () => ({ getStripe: () => h.stripe }))
vi.mock('@/lib/store/collection-unlock-set', () => ({ COLLECTION_SET_KIND: 'collection_set', fulfillCollectionSet: vi.fn() }))
vi.mock('@/lib/store/collection-unlocks', () => ({ COLLECTION_UNLOCK_KIND: 'collection_unlock', fulfillCollectionUnlocks: vi.fn() }))
vi.mock('@/lib/store/entitlements', () => ({ confirmPurchase: vi.fn(), handlePaymentFailure: vi.fn() }))
vi.mock('@/lib/store/portfolio-checkout', () => ({ activatePortfolio: vi.fn() }))
vi.mock('@/lib/store/discovery-unlock', () => ({ activateDiscoveryUnlock: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.store.orders.get([...h.store.orders.keys()][0]) ?? null, error: null }) }) }) }) } }))
vi.mock('@/lib/v1/gift/store', async orig => ({ ...(await orig<typeof import('@/lib/v1/gift/store')>()), supabaseGiftStore: () => h.store }))
vi.mock('@/lib/v1/print/order-email', () => ({ notifyPrintOrder: h.notify }))
vi.mock('@/lib/v1/print/upscale/runtime', () => ({ assetRuntime: () => ({ store: 'STORE' }) }))
vi.mock('@/lib/v1/print/upscale/pipeline', async () => ({ ...(await vi.importActual<typeof import('@/lib/v1/print/upscale/pipeline')>('@/lib/v1/print/upscale/pipeline')), pipelineState: async () => ({ flag: true, active: true, reason: null, problems: [] }) }))
vi.mock('@/lib/v1/print/upscale/orders', () => ({ enqueueOrderJobs: h.enqueue }))
vi.mock('@/lib/v1/print/owned-source', () => ({ requireSandboxPrint: vi.fn() }))
vi.mock('@/lib/v1/print/db', () => ({
  canFulfil: async () => h.allowed, markError: h.markError, markWithheld: h.markWithheld,
  getPrintOrderBySessionId: async (id: string) => [...h.store.orders.values()].find((o: any) => o.stripe_session_id === id) ?? null,
  markPaid: async (id: string, pi: string) => { h.markPaid(id, pi); const o: any = [...h.store.orders.values()].find((x: any) => x.stripe_session_id === id); if (o) { o.status = 'paid'; o.paid_at = new Date().toISOString(); o.stripe_payment_intent = pi } },
}))
import { POST as mainWebhook } from '../../../app/api/v1/webhooks/stripe/route'
import { handlePrintWebhook } from '../print/webhook-handler'
import { createSession, setLines, startBatch, getSessionView, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { confirmGiftOrder, giftOrderRecheck } from './orders'
import { loadApprovedCompositionWith } from './print-source'
import { purchasedItems, purchasedLines } from './test-order'

const U1 = '10000000-0000-4000-8000-000000000001'
const LINES = [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }]
let sid = '', orderId = '', cs = '', deps: GiftDeps

async function setup(opts: { renderIds?: string[]; kind?: string | null } = {}) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  h.store = store; h.allowed = true
  for (const f of [h.enqueue, h.markPaid, h.markError, h.markWithheld, h.notify, h.refunds]) f.mockReset().mockResolvedValue(undefined)
  deps = {
    store, generate: async () => ({ imageB64: (await sharp({ create: { width: 128, height: 128, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64') }),
    watermark: async b => sharp(Buffer.from(b, 'base64')).jpeg().toBuffer(),
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async () => {}, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }),
  }
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const v = await createSession(deps, { userId: U1, imageB64: photo }); sid = v.sessionId
  await setLines(deps, U1, sid, LINES)
  orderId = randomUUID(); cs = 'cs_test_' + orderId.replace(/-/g, '').slice(0, 12)
  const items = purchasedItems(LINES).map((i, k) => ({ ...i, renderId: opts.renderIds?.[k] ?? `gift:${sid}:${LINES[k].lineId}` }))
  const total = items.reduce((n, i) => n + i.retailCents * i.copies, 0) + 700
  store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: total, retail_shipping_cents: 700, items, prodigi_order_id: null, placed_at: null, owner_key: U1 } as any)
  await store.linkOrder(sid, U1, orderId, 'v1')
  const session = { id: cs, mode: 'payment', currency: 'usd', amount_total: total, payment_status: 'paid', status: 'complete', payment_intent: 'pi_1', livemode: false,
    metadata: opts.kind === null ? {} : { kind: opts.kind ?? 'gift_order', giftSessionId: sid, userId: U1 } }
  h.stripe = {
    webhooks: { constructEvent: (raw: string) => JSON.parse(raw) },
    checkout: { sessions: { retrieve: vi.fn(async () => session), listLineItems: vi.fn(async () => ({ has_more: false, data: [...items.map(i => ({ amount_total: i.retailCents * i.copies })), { amount_total: 700 }] })) } },
  }
  return { session, store }
}
const event = () => ({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: cs, payment_intent: 'pi_1', payment_status: 'paid', livemode: false, metadata: h.stripe.checkout.sessions.retrieve.mock.results[0] ? undefined : undefined } } })
const evt = (session: any) => ({ id: 'evt_' + randomUUID().slice(0, 6), type: 'checkout.session.completed', data: { object: session } })
const mainRoute = (e: unknown) => mainWebhook(new NextRequest('https://x.test/api/v1/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: JSON.stringify(e) }))
const rec = () => h.store.sessions.get(sid)!
const order = () => h.store.orders.get(orderId)!
beforeEach(() => { process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test' })
void event

describe('a Gift payment received by either webhook', () => {
  it('the Print Shop handler hands it to the Gift confirmation: awaiting_artwork, two batches, session pinned, nothing marked paid or queued', async () => {
    const { session } = await setup()
    const res = await handlePrintWebhook(evt(session) as any)
    expect(await res.json()).toEqual({ ok: true, gift: true })
    expect(order().status).toBe('awaiting_artwork'); expect(rec().free_batches_granted).toBe(2); expect(rec().pinned_at).toBeTruthy()
    expect(h.markPaid).not.toHaveBeenCalled(); expect(h.enqueue).not.toHaveBeenCalled(); expect(h.notify).not.toHaveBeenCalled(); expect(h.markWithheld).not.toHaveBeenCalled()
    expect((await h.store.orderLines(orderId)).length).toBe(1)
  })
  it('the main webhook route does the same', async () => {
    const { session } = await setup()
    const res = await mainRoute(evt(session)); expect(res.status).toBe(200)
    expect(order().status).toBe('awaiting_artwork'); expect(rec().free_batches_granted).toBe(2); expect(h.markPaid).not.toHaveBeenCalled(); expect(h.enqueue).not.toHaveBeenCalled()
  })
  it('the Print Shop handler recognises a Gift order even if the Stripe metadata is missing (the items say so)', async () => {
    const { session } = await setup({ kind: null })
    // with no metadata the Gift confirmation cannot verify the owner, so it refuses: what matters is the order is NOT marked paid or queued as a print
    const res = await handlePrintWebhook(evt(session) as any)
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ gift: true, ok: false, error: 'order_not_found' })
    expect(h.markPaid).not.toHaveBeenCalled(); expect(h.enqueue).not.toHaveBeenCalled(); expect(order().status).toBe('created')
  })
})

describe('both webhooks, duplicates and the browser confirm', () => {
  it('both endpoints receiving the same event, concurrently and repeatedly, give ONE confirmation and exactly two included batches', async () => {
    const { session } = await setup(); const e = evt(session)
    await Promise.all([handlePrintWebhook(e as any), mainRoute(e), handlePrintWebhook(e as any), mainRoute(e)])
    await handlePrintWebhook(e as any); await mainRoute(e)
    expect(order().status).toBe('awaiting_artwork'); expect(rec().free_batches_granted).toBe(2); expect((await h.store.orderLines(orderId)).length).toBe(1)
    expect(h.markPaid).not.toHaveBeenCalled(); expect(h.enqueue).not.toHaveBeenCalled()
  })
  it('the browser confirm after webhook processing is a no-op that reports the same state', async () => {
    const { session } = await setup(); await handlePrintWebhook(evt(session) as any)
    const out = await confirmGiftOrder({ stripe: h.stripe, store: h.store }, cs, U1)
    expect(out.confirmed).toBe(true); expect(rec().free_batches_granted).toBe(2)
    const v = await getSessionView(deps, U1, sid)
    expect(v.order).toMatchObject({ state: 'awaiting_artwork', freeBatchesGranted: 2, approvedAt: null }); expect(v.entitlement).toMatchObject({ freeBatchesTotal: 2, freeBatchesUsed: 0 }); expect(v.nextBatch).toEqual({ kind: 'free' })
  })
  it('the browser confirm BEFORE the webhooks gives the same result, and the webhooks then change nothing', async () => {
    const { session } = await setup(); await confirmGiftOrder({ stripe: h.stripe, store: h.store }, cs, U1)
    await Promise.all([handlePrintWebhook(evt(session) as any), mainRoute(evt(session))])
    expect(order().status).toBe('awaiting_artwork'); expect(rec().free_batches_granted).toBe(2)
  })
  it('exactly two included six-preview batches can be generated, and a third asks for payment', async () => {
    const { session } = await setup(); await handlePrintWebhook(evt(session) as any); await mainRoute(evt(session))
    const b1 = await startBatch(deps, U1, sid, { idempotencyKey: 'idem-key-1' }), b2 = await startBatch(deps, U1, sid, { idempotencyKey: 'idem-key-2' })
    expect([b1.batch.kind, b2.batch.kind, b1.batch.previews.length, b2.batch.previews.length]).toEqual(['free', 'free', 6, 6])
    await expect(startBatch(deps, U1, sid, { idempotencyKey: 'idem-key-3' })).rejects.toMatchObject({ code: 'payment_required' })
  })
})

describe('no manufacturing before the final artwork approval', () => {
  it('an order confirmed by either webhook cannot be released or have its picture prepared until approved', async () => {
    const { session } = await setup(); await handlePrintWebhook(evt(session) as any)
    await expect(giftOrderRecheck(h.store, orderId)).rejects.toThrow('artwork_not_approved')
    await expect(loadApprovedCompositionWith(h.store, deps.storage, { id: orderId }, { render_id: `gift:${sid}:a`, item_index: 0 })).rejects.toThrow('gift_artwork_not_approved')
    expect(h.enqueue).not.toHaveBeenCalled(); expect(rec().approved_at).toBeNull()
  })
  it('a refusal the Gift logic cannot recover from is acknowledged (200) so Stripe stops retrying; a transient failure is 500 so Stripe retries', async () => {
    const { session } = await setup()
    expect((await handlePrintWebhook(evt({ ...session, amount_total: 1 }) as any, { confirmGift: async () => { throw Object.assign(new Error('payment_not_confirmed')) } })).status).toBe(200)
    const transient = await handlePrintWebhook(evt(session) as any, { confirmGift: async () => { throw new Error('socket hang up') } })
    expect(transient.status).toBe(500); expect(await transient.json()).toMatchObject({ gift: true, error: 'gift_confirmation_failed' })
  })
})

describe('Gift refunds through the Print Shop endpoint', () => {
  const refundEvent = { id: 'evt_r', type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_1', livemode: false, refunds: { data: [{ id: 're_1', status: 'succeeded', amount: 100 }] } } } }
  it('are recorded by the Gift refund logic, not as an ordinary print refund notice', async () => {
    await setup(); order().stripe_payment_intent = 'pi_1'
    const res = await handlePrintWebhook(refundEvent as any, { applyGiftRefunds: h.refunds })
    expect(await res.json()).toEqual({ ok: true, gift: true }); expect(h.refunds).toHaveBeenCalledTimes(1); expect(h.notify).not.toHaveBeenCalled()
  })
})

describe('ordinary Print Shop orders are unchanged', () => {
  it('a normal print is marked paid, passes the account gate and is queued exactly as before; the Gift logic is never called', async () => {
    const { session } = await setup({ renderIds: ['a-plain-render'], kind: 'print' }); const confirmGift = vi.fn()
    const res = await handlePrintWebhook(evt({ ...session, metadata: {} }) as any, { confirmGift })
    expect(await res.json()).toEqual({ ok: true, queued: true }); expect(h.markPaid).toHaveBeenCalledWith(cs, 'pi_1'); expect(h.enqueue).toHaveBeenCalledTimes(1); expect(confirmGift).not.toHaveBeenCalled()
  })
  it('a normal print already past created is still deduplicated, and an uncleared account is still withheld', async () => {
    const { session } = await setup({ renderIds: ['a-plain-render'] })
    h.allowed = false
    expect(await (await handlePrintWebhook(evt({ ...session, metadata: {} }) as any)).json()).toMatchObject({ withheld: true })
    order().status = 'paid'; h.markWithheld.mockClear()
    expect(await (await handlePrintWebhook(evt({ ...session, metadata: {} }) as any)).json()).toMatchObject({ deduped: true })
  })
  it('an ordinary refund notice is unchanged', async () => {
    await setup({ renderIds: ['a-plain-render'] }); order().stripe_payment_intent = 'pi_1'
    const res = await handlePrintWebhook({ id: 'evt_r', type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_1', livemode: false, refunds: { data: [{ id: 're_1', status: 'succeeded', amount: 100 }] } } } } as any, { applyGiftRefunds: h.refunds })
    expect(await res.json()).toEqual({ ok: true }); expect(h.notify).toHaveBeenCalledWith(cs, { id: 're_1', amount: 100 }); expect(h.refunds).not.toHaveBeenCalled()
  })
})

describe('orderView no longer mistakes an unexpected state for approval', () => {
  it('maps every status exactly: only a released, approved order is "approved"', async () => {
    const { session } = await setup(); await handlePrintWebhook(evt(session) as any)
    const state = async (status: string, approved: boolean) => { order().status = status as any; rec().approved_at = approved ? new Date().toISOString() : null; return (await getSessionView(deps, U1, sid)).order.state }
    expect(await state('created', false)).toBe('checkout_open'); expect(await state('awaiting_artwork', false)).toBe('awaiting_artwork'); expect(await state('cancelled', false)).toBe('cancelled')
    for (const s of ['paid', 'withheld', 'error']) { expect(await state(s, false), s + ' unapproved').toBe('needs_attention'); expect(await state(s, true), s + ' approved').toBe('approved') }
    for (const s of ['placed', 'in_production', 'shipped', 'delivered']) expect(await state(s, true)).toBe('with_lab')
    expect(await state('something_new', false)).toBe('needs_attention'); expect(await state('something_new', true)).toBe('needs_attention')
  })
  it('the exact failed-run situation (paid by another path, nothing granted) reads needs_attention with 0 batches, never approved', async () => {
    await setup(); order().status = 'paid'; order().paid_at = new Date().toISOString()
    const v = await getSessionView(deps, U1, sid)
    expect(v.order).toMatchObject({ state: 'needs_attention', approvedAt: null }); expect(v.nextBatch).toMatchObject({ kind: 'blocked', reason: 'order_not_awaiting_artwork' })     // free previews no longer depend on payment, so nothing is lost
  })
})
