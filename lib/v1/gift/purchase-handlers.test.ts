import { describe, it, expect, vi } from 'vitest'
import { purchasedItems } from './test-order'
import sharp from 'sharp'
import { checkoutH, orderConfirmH, selectArtworkH, compositionsH, correctH, approveCompositionH, approveOrderH, refundRequestH } from './handlers'
import { createSession, setLines, startBatch, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { selectArtwork } from './compose'
import { randomUUID } from 'node:crypto'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const req = (body: unknown) => new Request('https://x.test/api', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })
const read = async (r: Response) => ({ status: r.status, body: r.status === 204 ? null : await r.json(), cache: r.headers.get('cache-control') })

function rig() {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const concierge = { create: vi.fn(async (_row: unknown) => {}) }
  const deps: GiftDeps & { concierge: typeof concierge } = {
    store, concierge,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async () => {}, signedUrl: async p => 'https://signed.test/' + p },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }),
    generate: async () => ({ imageB64: (await sharp({ create: { width: 256, height: 256, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64') }),
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    compose: async i => ({ image: await sharp(Buffer.from(i.masterB64, 'base64')).png().toBuffer(), width: 256, height: 256, fit: 'exact', outpainted: false }),
    kick: vi.fn(async () => ({})),
  }
  return { deps, store, concierge }
}
async function paidSession(r: ReturnType<typeof rig>) {
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const v = await createSession(r.deps, { userId: U1, imageB64: photo })
  await setLines(r.deps, U1, v.sessionId, [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }])
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
  r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 5000, retail_shipping_cents: 700, items: purchasedItems([{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }]), prodigi_order_id: null, placed_at: null, customer_email: 'a@example.test' })
  await r.store.linkOrder(v.sessionId, U1, orderId, 'v1')
  await r.store.confirmOrder({ sessionId: v.sessionId, orderId, userId: U1, stripeSessionId: cs, paymentIntent: 'pi_1', lines: [{ lineId: 'a', productId: 'fine_art:8x8', sku: 'GLOBAL-FAP-8X8', copies: 1 }] })
  const b = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
  return { sid: v.sessionId, previews: b.batch.previews }
}

describe('purchase and approval endpoints', () => {
  it('bad JSON is a 400 before any work, for every endpoint that takes a body', async () => {
    const r = rig(); const odeps: any = { gift: r.deps, store: r.store, stripe: {} }
    for (const h of [checkoutH(req('{'), { id: U1 }, odeps, 'x'), orderConfirmH(req('{'), { id: U1 }, { stripe: {} as any, store: r.store }, r.deps), selectArtworkH(req('{'), { id: U1 }, r.deps, 'x')]) expect((await h).status).toBe(400)
  })
  it('errors carry stable codes and the right status; every response is no-store', async () => {
    const r = rig(); const sid = '20000000-0000-4000-8000-000000000009'
    expect(await read(await compositionsH({ id: U1 }, r.deps, sid))).toEqual({ status: 404, body: { error: 'session_not_found' }, cache: 'no-store' })
    expect(await read(await approveOrderH({ id: U1 }, r.deps, sid))).toMatchObject({ status: 404 })
    expect(await read(await correctH({ id: U1 }, r.deps, sid, 'a'))).toMatchObject({ status: 404 })
    expect(await read(await approveCompositionH({ id: U1 }, r.deps, sid, 'c'))).toMatchObject({ status: 404 })
    const x = await paidSession(r)
    expect(await read(await approveOrderH({ id: U1 }, r.deps, x.sid))).toMatchObject({ status: 409, body: { error: 'artwork_not_selected' } })
    expect(await read(await compositionsH({ id: U1 }, r.deps, x.sid))).toMatchObject({ status: 409, body: { error: 'artwork_not_selected' } })
    expect(await read(await selectArtworkH(req({ previewId: 'nope' }), { id: U1 }, r.deps, x.sid))).toMatchObject({ status: 409, body: { error: 'preview_not_ready' } })
  })
  it('another customer gets a 404, never a hint that the session exists', async () => {
    const r = rig(); const x = await paidSession(r)
    for (const res of [await compositionsH({ id: U2 }, r.deps, x.sid), await approveOrderH({ id: U2 }, r.deps, x.sid), await selectArtworkH(req({ previewId: x.previews[0].previewId }), { id: U2 }, r.deps, x.sid)]) {
      expect(await read(res)).toMatchObject({ status: 404, body: { error: 'session_not_found' } })
    }
  })
  it('the happy path through the HTTP layer: select, compose, correct once, approve each, approve the order', async () => {
    const r = rig(); const x = await paidSession(r)
    expect((await read(await selectArtworkH(req({ previewId: x.previews[0].previewId }), { id: U1 }, r.deps, x.sid))).body.artworkPreviewId).toBe(x.previews[0].previewId)
    const c = await read(await compositionsH({ id: U1 }, r.deps, x.sid)); expect(c.status).toBe(200); expect(c.body.compositions[0]).toMatchObject({ lineId: 'a', status: 'ready', correctionsRemaining: 1 })
    expect((await read(await correctH({ id: U1 }, r.deps, x.sid, 'a'))).body.compositions[0]).toMatchObject({ attempt: 2, correctionsRemaining: 0 })
    expect(await read(await correctH({ id: U1 }, r.deps, x.sid, 'a'))).toMatchObject({ status: 409, body: { error: 'correction_limit' } })
    const id = (await read(await compositionsH({ id: U1 }, r.deps, x.sid))).body.compositions[0].compositionId
    expect((await read(await approveCompositionH({ id: U1 }, r.deps, x.sid, id))).body.compositions[0].status).toBe('approved')
    const done = await read(await approveOrderH({ id: U1 }, r.deps, x.sid)); expect(done.status).toBe(200); expect(done.body.order).toMatchObject({ state: 'approved' })
    expect(done.body.order.unlockPortfolioId).toBeTruthy(); expect(r.deps.kick).toHaveBeenCalledTimes(1)
  })
  it('a refund request is a 201 with the Concierge message and the customer text; a second is the same request', async () => {
    const r = rig(); const x = await paidSession(r)
    const a = await read(await refundRequestH(req({ reason: 'not right' }), { id: U1 }, r.deps, x.sid))
    expect(a).toMatchObject({ status: 201, body: { state: 'requested', message: expect.stringMatching(/Nothing will be printed or manufactured/) } })
    const b = await read(await refundRequestH(req({}), { id: U1 }, r.deps, x.sid)); expect(b.body.requestId).toBe(a.body.requestId)
    expect(r.concierge.create).toHaveBeenCalledTimes(2)             // the Concierge store is idempotent on id; the same id is sent
    expect(r.concierge.create.mock.calls[0][0]).toMatchObject({ id: a.body.requestId }); expect(r.concierge.create.mock.calls[1][0]).toMatchObject({ id: a.body.requestId })
    expect(await read(await approveOrderH({ id: U1 }, r.deps, x.sid))).toMatchObject({ status: 409, body: { error: 'refund_pending' } })
  })
  it('a refund request after the order is with the lab is refused', async () => {
    const r = rig(); const x = await paidSession(r); const o = [...r.store.orders.values()][0]; Object.assign(o, { status: 'placed', prodigi_order_id: 'ord_1', placed_at: 'x' })
    expect(await read(await refundRequestH(req({}), { id: U1 }, r.deps, x.sid))).toMatchObject({ status: 409, body: { error: 'refund_not_available_after_manufacturing' } })
  })
})
void selectArtwork
