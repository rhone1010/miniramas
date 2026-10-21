// Stripe test events through the REAL main webhook route (/api/v1/webhooks/stripe): real signature verification (the Stripe library's own constructEvent against a test header),
// the real Gift confirmation, the real refund logic and the real dispatch. Only the outside world is faked: Stripe's API answers (retrieve / charges / refunds) and the database
// (the memory store mirrors gift_confirm_order's rules). Nothing is paid, sent or stored anywhere.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'

const h = vi.hoisted(() => ({ store: null as any, stripe: null as any, failure: vi.fn(), purchase: vi.fn() }))
vi.mock('@/lib/store/stripe', () => ({ getStripe: () => h.stripe }))
vi.mock('@/lib/store/collection-unlock-set', () => ({ COLLECTION_SET_KIND: 'collection_set', fulfillCollectionSet: vi.fn() }))
vi.mock('@/lib/store/collection-unlocks', () => ({ COLLECTION_UNLOCK_KIND: 'collection_unlock', fulfillCollectionUnlocks: vi.fn() }))
vi.mock('@/lib/store/entitlements', () => ({ confirmPurchase: h.purchase, handlePaymentFailure: h.failure }))
vi.mock('@/lib/store/portfolio-checkout', () => ({ activatePortfolio: vi.fn() }))
vi.mock('@/lib/store/discovery-unlock', () => ({ activateDiscoveryUnlock: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) } }))
vi.mock('@/lib/v1/gift/store', async orig => ({ ...(await orig<typeof import('@/lib/v1/gift/store')>()), supabaseGiftStore: () => h.store }))
vi.mock('@/lib/v1/print/webhook-handler', () => ({ handlePrintWebhook: vi.fn() }))
import { POST as webhook } from '../../../app/api/v1/webhooks/stripe/route'
import { createSession, setLines, getSessionView, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { purchasedItems } from './test-order'

const U1 = '10000000-0000-4000-8000-000000000001', SECRET = 'whsec_test_secret_for_unit_tests'
const LINES = [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }]
const real = new Stripe('sk_test_unit', { apiVersion: '2024-04-10' as any })
let sid = '', orderId = '', cs = '', pi = '', total = 0, deps: GiftDeps, session: any, refunds: any[] = []

async function setup() {
  const store = memoryGiftStore(); h.store = store; h.failure.mockReset(); h.purchase.mockReset(); refunds = []
  deps = {
    store, generate: async () => ({ imageB64: (await sharp({ create: { width: 128, height: 128, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64') }),
    watermark: async b => sharp(Buffer.from(b, 'base64')).jpeg().toBuffer(), storage: { put: async () => {}, get: async () => null, remove: async () => {}, signedUrl: async () => null },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }),
  }
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  sid = (await createSession(deps, { userId: U1, imageB64: photo })).sessionId; await setLines(deps, U1, sid, LINES)
  orderId = randomUUID(); cs = 'cs_test_' + orderId.replace(/-/g, '').slice(0, 12); pi = 'pi_' + orderId.slice(0, 8)
  const items = purchasedItems(LINES).map((i, k) => ({ ...i, renderId: `gift:${sid}:${LINES[k].lineId}` }))
  total = items.reduce((n, i) => n + i.retailCents * i.copies, 0) + 700
  store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: total, retail_shipping_cents: 700, items, prodigi_order_id: null, placed_at: null, owner_key: U1 } as any)
  await store.linkOrder(sid, U1, orderId, 'v1')
  session = { id: cs, mode: 'payment', currency: 'usd', amount_total: total, payment_status: 'paid', status: 'complete', payment_intent: pi, livemode: false, metadata: { kind: 'gift_order', giftSessionId: sid, userId: U1 } }
  h.stripe = {
    webhooks: real.webhooks,                                                                                    // the real signature check
    checkout: { sessions: { retrieve: vi.fn(async () => session), listLineItems: vi.fn(async () => ({ has_more: false, data: [...items.map(i => ({ amount_total: i.retailCents * i.copies })), { amount_total: 700 }] })) } },
    charges: { retrieve: vi.fn(async (id: string) => ({ id, payment_intent: pi })) },
    refunds: { list: vi.fn(async () => ({ data: refunds })) },
  }
}
const sign = (e: unknown, secret = SECRET) => { const payload = JSON.stringify(e); return { payload, header: real.webhooks.generateTestHeaderString({ payload, secret }) } }
const send = (e: unknown, opts: { secret?: string; header?: string | null } = {}) => {
  const { payload, header } = sign(e, opts.secret)
  const headers: Record<string, string> = {}; const sig = opts.header === undefined ? header : opts.header; if (sig) headers['stripe-signature'] = sig
  return webhook(new NextRequest('https://x.test/api/v1/webhooks/stripe', { method: 'POST', headers, body: payload }))
}
const ev = (type: string, object: unknown) => ({ id: 'evt_' + randomUUID().slice(0, 8), object: 'event', api_version: '2024-04-10', created: Math.floor(Date.now() / 1000), type, livemode: false, data: { object } })
const order = () => h.store.orders.get(orderId)!, rec = () => h.store.sessions.get(sid)!
beforeEach(() => { process.env.STRIPE_WEBHOOK_SECRET = SECRET })

describe('signature and configuration', () => {
  it('a missing, wrong or unconfigured signature never reaches a handler', async () => {
    await setup()
    expect((await send(ev('checkout.session.completed', session), { header: null })).status).toBe(400)
    expect((await send(ev('checkout.session.completed', session), { secret: 'whsec_someone_else' })).status).toBe(400)
    expect(order().status).toBe('created'); expect(h.stripe.checkout.sessions.retrieve).not.toHaveBeenCalled()
    delete process.env.STRIPE_WEBHOOK_SECRET; expect((await send(ev('checkout.session.completed', session))).status).toBe(503)
  })
})

describe('successful payment', () => {
  it('checkout.session.completed (signed) confirms the Gift order: awaiting_artwork, two batches, session pinned', async () => {
    await setup(); const res = await send(ev('checkout.session.completed', session)); expect(res.status).toBe(200)
    expect(order().status).toBe('awaiting_artwork'); expect(rec().free_batches_granted).toBe(2); expect(rec().pinned_at).toBeTruthy()
    expect(h.purchase).not.toHaveBeenCalled()                                                                  // never mistaken for a portfolio purchase
  })
  it('three deliveries of the same event, in parallel and again, give one confirmation', async () => {
    await setup(); const e = ev('checkout.session.completed', session)
    const rs = await Promise.all([send(e), send(e), send(e)]); await send(e)
    expect(rs.map(r => r.status)).toEqual([200, 200, 200]); expect(order().status).toBe('awaiting_artwork'); expect(rec().free_batches_granted).toBe(2); expect((await h.store.orderLines(orderId)).length).toBe(1)
  })
  it('a delayed payment method: "completed" while unpaid changes nothing; async_payment_succeeded then confirms', async () => {
    await setup(); const unpaid = { ...session, payment_status: 'unpaid' }
    expect((await send(ev('checkout.session.completed', unpaid))).status).toBe(200); expect(order().status).toBe('created'); expect(rec().free_batches_granted).toBe(0)
    expect((await send(ev('checkout.session.async_payment_succeeded', session))).status).toBe(200); expect(order().status).toBe('awaiting_artwork'); expect(rec().free_batches_granted).toBe(2)
  })
  it('a transient failure answers 500 so Stripe retries, and the retry succeeds', async () => {
    await setup(); h.stripe.checkout.sessions.retrieve.mockRejectedValueOnce(new Error('socket hang up'))
    expect((await send(ev('checkout.session.completed', session))).status).toBe(500); expect(order().status).toBe('created')
    expect((await send(ev('checkout.session.completed', session))).status).toBe(200); expect(order().status).toBe('awaiting_artwork')
  })
})

describe('refund', () => {
  it('charge.refunded is applied from Stripe\'s own refund list, once per refund id, partial then full; duplicates change nothing', async () => {
    await setup(); await send(ev('checkout.session.completed', session))
    const charge = { id: 'ch_1', payment_intent: pi, livemode: false }
    refunds = [{ id: 're_1', status: 'succeeded', amount: 500, created: 1 }, { id: 're_pending', status: 'pending', amount: 999, created: 2 }]
    expect((await send(ev('charge.refunded', charge))).status).toBe(200); expect((await send(ev('charge.refunded', charge))).status).toBe(200)
    expect(rec().refunded_at ?? null).toBeNull()                                                              // partial: the order is not "refunded"
    refunds = [...refunds.slice(0, 1), { id: 're_2', status: 'succeeded', amount: total - 500, created: 3 }]
    expect((await send(ev('charge.refunded', charge))).status).toBe(200); await send(ev('charge.refunded', charge))
    expect(rec().refunded_at).toBeTruthy(); expect(order().status).not.toBe('placed')
  })
  it('a charge that belongs to no Gift order is ignored (200), not an error', async () => {
    await setup(); expect((await send(ev('charge.refunded', { id: 'ch_x', payment_intent: 'pi_unknown', livemode: false }))).status).toBe(200); expect(h.stripe.charges.retrieve).not.toHaveBeenCalled()
  })
})

describe('failed payment and expired checkout leave a confirmed Gift order exactly as it was', () => {
  it('charge.failed and checkout.session.expired are acknowledged and change neither the order, the batches nor the approval state', async () => {
    await setup(); await send(ev('checkout.session.completed', session))
    const before = JSON.stringify({ o: order(), r: rec() }), view = JSON.stringify((await getSessionView(deps, U1, sid)).order)
    expect((await send(ev('charge.failed', { id: 'ch_f', payment_intent: pi, failure_message: 'card_declined', livemode: false }))).status).toBe(200)
    expect((await send(ev('checkout.session.expired', { ...session, status: 'expired', payment_status: 'unpaid' }))).status).toBe(200)
    expect(JSON.stringify({ o: order(), r: rec() })).toBe(before); expect(JSON.stringify((await getSessionView(deps, U1, sid)).order)).toBe(view)
    expect(order().status).toBe('awaiting_artwork'); expect(rec().approved_at ?? null).toBeNull()
  })
  it('an expired checkout for an unpaid Gift order leaves the order created (checkout can be started again) and is acknowledged', async () => {
    await setup(); expect((await send(ev('checkout.session.expired', { ...session, status: 'expired', payment_status: 'unpaid' }))).status).toBe(200)
    expect(order().status).toBe('created'); expect(rec().free_batches_granted).toBe(0)
  })
  it('an event type nobody subscribed to is acknowledged and ignored', async () => {
    await setup(); expect((await send(ev('customer.created', { id: 'cus_1' }))).status).toBe(200); expect(order().status).toBe('created')
  })
})
