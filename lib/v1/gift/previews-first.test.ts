// PREVIEWS BEFORE PURCHASE: the first six and the second six previews are free with no product purchase; every further six is a verified $2.99 pack;
// the favorite is saved before buying and survives the purchase; free allocations are server-controlled and cannot be repeated; a product purchase grants no
// previews; and nothing is manufactured before the customer approves. The generator, composer and watermark are fakes.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { createSession, setLines, startBatch, getSessionView, deleteSessionNow, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { selectArtwork, ensureCompositions, approveComposition, approveOrder } from './compose'
import { giftOrderRecheck } from './orders'
import { FREE_PREVIEWS } from './policy'
import { purchasedItems, purchasedLines } from './test-order'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '20000000-0000-4000-8000-000000000002'
const key = (n: number | string) => `idem-key-${n}`
const LINE = [{ lineId: 'a', productId: 'canvas:8x8', copies: 1 }]

function rig() {
  const clock = { now: Date.parse('2026-10-18T10:00:00Z') }
  const store = memoryGiftStore(() => clock.now), files = new Map<string, Buffer>()
  const generate = vi.fn(async () => ({ imageB64: (await sharp({ create: { width: 128, height: 128, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64') }))
  const compose = vi.fn(async (i: { masterB64: string; size: string; finish: string }) => ({ image: await sharp({ create: { width: 96, height: 96, channels: 3, background: '#036' } }).png().toBuffer(), width: 96, height: 96, fit: 'exact' as const, outpainted: false }))
  const deps: GiftDeps = {
    store, generate, compose, clock: () => clock.now,
    watermark: async b => sharp(Buffer.from(b, 'base64')).jpeg().toBuffer(),
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }),
    kick: vi.fn(async () => ({})),
  }
  return { deps, store, files, generate, compose, clock }
}
let shade = 0
/** A photograph of its own: the stored source is hashed, so a different colour is a different photograph. */
const photo = async (n = ++shade) => (await sharp({ create: { width: 600, height: 600, channels: 3, background: { r: (n * 37) % 256, g: (n * 91) % 256, b: (n * 53) % 256 } } }).jpeg().toBuffer()).toString('base64')
const session = async (r: ReturnType<typeof rig>, user = U1, img?: string) => (await createSession(r.deps, { userId: user, imageB64: img ?? await photo() })).sessionId
const batch = (r: ReturnType<typeof rig>, sid: string, n: number | string, user = U1) => startBatch(r.deps, user, sid, { idempotencyKey: key(n) })
const view = (r: ReturnType<typeof rig>, sid: string, user = U1) => getSessionView(r.deps, user, sid)
/** The state a verified product payment leaves behind (what confirmGiftOrder does), without Stripe. */
async function pay(r: ReturnType<typeof rig>, sid: string, lines = LINE) {
  await setLines(r.deps, U1, sid, lines)
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.replace(/-/g, '').slice(0, 12)
  r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: purchasedItems(lines), prodigi_order_id: null, placed_at: null })
  await r.store.linkOrder(sid, U1, orderId, 'v1')
  await r.store.confirmOrder({ sessionId: sid, orderId, userId: U1, stripeSessionId: cs, paymentIntent: 'pi_1', lines: purchasedLines(lines) })
  return orderId
}

describe('the free previews', () => {
  it('the first six and the second six are free with no order at all; the third needs a verified pack and nothing is reserved or generated without one', async () => {
    const r = rig(); const sid = await session(r)
    expect((await view(r, sid)).nextBatch).toEqual({ kind: 'free' })
    const b1 = await batch(r, sid, 1), b2 = await batch(r, sid, 2)
    expect([b1.batch.kind, b2.batch.kind, b1.batch.previews.length, b2.batch.previews.length]).toEqual(['free', 'free', 6, 6]); expect(r.store.orders.size).toBe(0)
    const v = await view(r, sid)
    expect(v.entitlement).toEqual({ freeBatchesTotal: 2, freeBatchesUsed: 2, paidPacksAvailable: 0, freeAvailable: false, freeBlockedReason: 'session_limit' })
    expect(v.nextBatch).toEqual({ kind: 'payment_required', amountCents: 299, currency: 'USD' })
    const calls = r.generate.mock.calls.length
    await expect(batch(r, sid, 3)).rejects.toMatchObject({ code: 'payment_required', status: 402 })
    expect(r.generate.mock.calls.length).toBe(calls); expect(r.store.batches.length).toBe(2)
  })
  it('a verified pack buys one further six ($2.99), consumed exactly once; a client cannot claim one', async () => {
    const r = rig(); const sid = await session(r); await batch(r, sid, 1); await batch(r, sid, 2)
    await expect(startBatch(r.deps, U1, sid, { idempotencyKey: key(3), paid: true, packId: 'x' } as any)).rejects.toMatchObject({ code: 'payment_required' })
    await r.store.fulfillPack(U1, 'cs_test_pack000001', 299)
    expect((await view(r, sid)).nextBatch).toEqual({ kind: 'paid', packAvailable: true })
    const b3 = await batch(r, sid, 3); expect(b3.batch.kind).toBe('paid'); expect((await view(r, sid)).entitlement.paidPacksAvailable).toBe(0)
    await expect(batch(r, sid, 4)).rejects.toMatchObject({ code: 'payment_required' })
  })
  it('is idempotent: the same key is the same batch and takes no second allocation; concurrent calls make one batch', async () => {
    const r = rig(); const sid = await session(r)
    const [a, b] = await Promise.all([batch(r, sid, 1), batch(r, sid, 1)])
    expect(a.batch.batchIndex).toBe(1); expect(b.batch.batchIndex).toBe(1); expect(r.store.batches.length).toBe(1)
    await batch(r, sid, 1); expect((await view(r, sid)).entitlement.freeBatchesUsed).toBe(1)
  })
  it('a product purchase grants no previews: payment before, between and after the free batches changes no allocation', async () => {
    const r = rig(); const sid = await session(r); await batch(r, sid, 1)
    await pay(r, sid)
    const v = await view(r, sid)
    expect(v.order.state).toBe('awaiting_artwork'); expect(v.entitlement).toMatchObject({ freeBatchesTotal: 2, freeBatchesUsed: 1, freeAvailable: true })     // the second free batch is still just the second free batch
    await batch(r, sid, 2)
    await expect(batch(r, sid, 3)).rejects.toMatchObject({ code: 'payment_required' })                                                                           // paying for products did not add a third
  })
  it('generation stops at approval: while a paid order awaits artwork more previews can still be made, never after release to fulfilment', async () => {
    const r = rig(); const sid = await session(r); const orderId = await pay(r, sid)
    expect((await batch(r, sid, 1)).batch.kind).toBe('free')
    r.store.orders.get(orderId)!.status = 'paid'
    await expect(batch(r, sid, 2)).rejects.toMatchObject({ code: 'order_not_awaiting_artwork' }); expect((await view(r, sid)).nextBatch).toEqual({ kind: 'blocked', reason: 'order_not_awaiting_artwork' })
  })
})

describe('free allocations cannot be repeated', () => {
  it('a new session for the same photograph gets no further free previews once two batches were used, and deleting the first session does not reset it', async () => {
    const r = rig(); const img = await photo(1000)
    const a = await session(r, U1, img); await batch(r, a, 1); await batch(r, a, 2)
    const again = await session(r, U1, img)
    expect((await view(r, again)).entitlement).toMatchObject({ freeAvailable: false, freeBlockedReason: 'photo_limit', freeBatchesUsed: 0 })
    await expect(batch(r, again, 1)).rejects.toMatchObject({ code: 'payment_required' })
    await deleteSessionNow(r.deps, U1, a)                                                      // the ledger outlives the session
    const third = await session(r, U1, img); await expect(batch(r, third, 1)).rejects.toMatchObject({ code: 'payment_required' })
    expect((await view(r, third)).entitlement.freeBlockedReason).toBe('photo_limit')
  })
  it('a partly used photograph keeps its remainder: one free batch, delete, recreate, one more, then no more', async () => {
    const r = rig(); const img = await photo(2000)
    const a = await session(r, U1, img); await batch(r, a, 1); await deleteSessionNow(r.deps, U1, a)
    const b = await session(r, U1, img); expect((await batch(r, b, 1)).batch.kind).toBe('free')
    await expect(batch(r, b, 2)).rejects.toMatchObject({ code: 'payment_required' })
  })
  it('another photograph has its own allocation, and another account is never affected', async () => {
    const r = rig(); const img = await photo(3000)
    const a = await session(r, U1, img); await batch(r, a, 1); await batch(r, a, 2)
    const other = await session(r, U1); expect((await view(r, other)).entitlement.freeAvailable).toBe(true)
    const them = await session(r, U2, img); expect((await view(r, them, U2)).entitlement.freeAvailable).toBe(true); expect((await batch(r, them, 1, U2)).batch.kind).toBe('free')
  })
  it(`an account is capped at ${FREE_PREVIEWS.perAccount24h} free batches in 24 hours, restored after the day`, async () => {
    const r = rig()
    for (let i = 0; i < FREE_PREVIEWS.perAccount24h / 2; i++) { const s = await session(r); await batch(r, s, 1); await batch(r, s, 2) }
    const next = await session(r); expect((await view(r, next)).entitlement).toMatchObject({ freeAvailable: false, freeBlockedReason: 'daily_limit' })
    await expect(batch(r, next, 1)).rejects.toMatchObject({ code: 'payment_required' })
    r.clock.now += 25 * 3600_000
    expect((await view(r, next)).entitlement.freeAvailable).toBe(true); expect((await batch(r, next, 1)).batch.kind).toBe('free')
  })
  it(`an account is capped at ${FREE_PREVIEWS.perAccountLifetime} free batches in total`, async () => {
    const r = rig()
    for (let i = 0; i < FREE_PREVIEWS.perAccountLifetime / 2; i++) { const s = await session(r); await batch(r, s, 1); await batch(r, s, 2); r.clock.now += 25 * 3600_000 }
    const next = await session(r)
    expect((await view(r, next)).entitlement).toMatchObject({ freeAvailable: false, freeBlockedReason: 'lifetime_limit' }); await expect(batch(r, next, 1)).rejects.toMatchObject({ code: 'payment_required' })
  })
})

describe('the favorite is chosen and saved before buying, and survives the purchase', () => {
  it('can be selected with no order, is persisted on the session, can be changed, and needs a ready preview of this session', async () => {
    const r = rig(); const sid = await session(r); const b1 = await batch(r, sid, 1)
    await expect(selectArtwork(r.deps, U1, sid, randomUUID())).rejects.toMatchObject({ code: 'preview_not_ready' })
    expect((await selectArtwork(r.deps, U1, sid, b1.batch.previews[2].previewId)).artworkPreviewId).toBe(b1.batch.previews[2].previewId)
    expect((await view(r, sid)).artworkPreviewId).toBe(b1.batch.previews[2].previewId)
    await selectArtwork(r.deps, U1, sid, b1.batch.previews[0].previewId); expect((await view(r, sid)).artworkPreviewId).toBe(b1.batch.previews[0].previewId)
    await expect(selectArtwork(r.deps, U2, sid, b1.batch.previews[0].previewId)).rejects.toMatchObject({ code: 'session_not_found' })
  })
  it('the SAME artwork is the one composed, reviewed before payment and kept after it: payment, products and confirmation never reset the selection or the reviewed composition', async () => {
    const r = rig(); const sid = await session(r); const b1 = await batch(r, sid, 1); const fav = b1.batch.previews[3].previewId
    await selectArtwork(r.deps, U1, sid, fav); await setLines(r.deps, U1, sid, LINE)
    const draft = await ensureCompositions(r.deps, U1, sid)                                              // the approved journey: composed and reviewed BEFORE payment
    expect(draft.compositions.map(c => [c.lineId, c.sourceArtworkId, c.status])).toEqual([['a', fav, 'ready']])
    const reviewed = draft.compositions[0].compositionId!; await approveComposition(r.deps, U1, sid, reviewed); const made = r.compose.mock.calls.length
    await pay(r, sid)
    expect((await view(r, sid)).artworkPreviewId).toBe(fav)
    const v = await ensureCompositions(r.deps, U1, sid)                                                  // nothing is composed again: the reviewed composition IS the purchased one
    expect(v.compositions.map(c => [c.lineId, c.compositionId, c.sourceArtworkId, c.status])).toEqual([['a', reviewed, fav, 'approved']]); expect(r.compose.mock.calls.length).toBe(made)
  })
  it('before payment only the favorite is chosen: no product composition or print file exists until a purchased line has been composed from it', async () => {
    const r = rig(); const sid = await session(r); const b1 = await batch(r, sid, 1); await selectArtwork(r.deps, U1, sid, b1.batch.previews[0].previewId)
    expect(r.store.compositions.length).toBe(0); expect([...r.files.keys()].some(k => k.includes('/compositions/'))).toBe(false)
  })
  it('the favorite can be changed while a paid order awaits its artwork (its compositions are superseded), and not after approval', async () => {
    const r = rig(); const sid = await session(r); const b1 = await batch(r, sid, 1); await selectArtwork(r.deps, U1, sid, b1.batch.previews[0].previewId)
    const orderId = await pay(r, sid); await ensureCompositions(r.deps, U1, sid)
    await selectArtwork(r.deps, U1, sid, b1.batch.previews[1].previewId)
    expect(r.store.compositions.every(c => c.status === 'superseded')).toBe(true)
    r.store.orders.get(orderId)!.status = 'paid'
    await expect(selectArtwork(r.deps, U1, sid, b1.batch.previews[2].previewId)).rejects.toMatchObject({ code: 'order_not_awaiting_artwork' })
  })
})

describe('nothing is manufactured before the explicit final approval', () => {
  it('a paid order with a pre-selected favorite still needs every line approved, and the fulfilment recheck refuses until then', async () => {
    const r = rig(); const sid = await session(r); const b1 = await batch(r, sid, 1); await selectArtwork(r.deps, U1, sid, b1.batch.previews[0].previewId)
    const orderId = await pay(r, sid); const v = await ensureCompositions(r.deps, U1, sid)
    await expect(approveOrder(r.deps, U1, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
    await expect(giftOrderRecheck(r.store, orderId)).rejects.toThrow('artwork_not_approved'); expect(r.deps.kick).not.toHaveBeenCalled()
    await approveComposition(r.deps, U1, sid, v.compositions[0].compositionId)
    await expect(giftOrderRecheck(r.store, orderId)).rejects.toThrow('artwork_not_approved')                    // an approved COMPOSITION is not the final approval
    const done = await approveOrder(r.deps, U1, sid); expect(done.order.state).toBe('approved'); expect(r.deps.kick).toHaveBeenCalledTimes(1)
    await expect(giftOrderRecheck(r.store, orderId)).resolves.toBeUndefined()
  })
})
