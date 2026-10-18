import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { createSession, setLines, startBatch, getSessionView, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { purchasedItems, purchasedLines } from './test-order'
import { allProducts } from '../print/catalog'
import { selectArtwork, ensureCompositions, correctLine, approveComposition, approveOrder } from './compose'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'

function rig(over: { failCompose?: Set<string> } = {}) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const master = async () => (await sharp({ create: { width: 512, height: 512, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64')
  const compose = vi.fn(async (i: { size: string; finish: string; masterB64: string }) => {
    const key = i.finish + ':' + i.size
    if (over.failCompose?.has(key)) { over.failCompose.delete(key); throw new Error('outpaint_failed') }
    const p = allProducts().find(x => x.size === i.size && (x.family as string) === i.finish)!         // a compositor returns the shape of the product it was asked for
    const w = 512, h = Math.round(512 * p.requirements.picturePx.h / p.requirements.picturePx.w)
    return { image: await sharp({ create: { width: w, height: h, channels: 3, background: '#3a6' } }).png().toBuffer(), width: w, height: h, fit: 'exact' as const, outpainted: false }
  })
  const kick = vi.fn(async (_orderId: string) => ({ status: 'pending' }))
  const deps: GiftDeps = {
    store,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }),
    generate: async () => ({ imageB64: await master() }),
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    compose, kick,
  }
  return { deps, store, files, compose, kick }
}

/** A paid order with the given lines and two generated batches, the way the purchase flow leaves it. */
async function paid(r: ReturnType<typeof rig>, lines = [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }, { lineId: 'b', productId: 'canvas:12x12', copies: 2 }], user = U1) {
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const view = await createSession(r.deps, { userId: user, imageB64: photo })
  await setLines(r.deps, user, view.sessionId, lines)
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
  r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: purchasedItems(lines), prodigi_order_id: null, placed_at: null })
  await r.store.linkOrder(view.sessionId, user, orderId, 'v1')
  await r.store.confirmOrder({ sessionId: view.sessionId, orderId, userId: user, stripeSessionId: cs, paymentIntent: 'pi_1', lines: purchasedLines(lines) })
  const b1 = await startBatch(r.deps, user, view.sessionId, { idempotencyKey: 'idem-key-1' })
  return { sid: view.sessionId, orderId, previews: b1.batch.previews, user }
}
const approveAll = async (r: ReturnType<typeof rig>, sid: string, user = U1) => {
  const v = await getSessionView(r.deps, user, sid)
  for (const c of v.compositions) await approveComposition(r.deps, user, sid, c.compositionId)
}

describe('selecting the artwork', () => {
  it('picks one ready preview of this order; may be changed until approval; superseding the old compositions', async () => {
    const r = rig(); const { sid, previews } = await paid(r)
    expect((await selectArtwork(r.deps, U1, sid, previews[0].previewId)).artworkPreviewId).toBe(previews[0].previewId)
    await ensureCompositions(r.deps, U1, sid)
    const v = await selectArtwork(r.deps, U1, sid, previews[1].previewId)
    expect(v.artworkPreviewId).toBe(previews[1].previewId); expect(v.compositions.every(c => c.status === 'none')).toBe(true)         // the old ones no longer count
    expect(r.store.compositions.filter(c => c.status === 'superseded').length).toBe(2)
  })
  it('refuses a preview that is not ready, not in this session, malformed, or someone elses session', async () => {
    const r = rig(); const { sid, previews } = await paid(r); const other = await paid(r, undefined, U2)
    await expect(selectArtwork(r.deps, U1, sid, randomUUID())).rejects.toMatchObject({ code: 'preview_not_ready' })
    await expect(selectArtwork(r.deps, U1, sid, 'nope')).rejects.toMatchObject({ code: 'preview_not_ready' })
    await expect(selectArtwork(r.deps, U1, sid, other.previews[0].previewId)).rejects.toMatchObject({ code: 'preview_not_ready' })
    await expect(selectArtwork(r.deps, U2, sid, previews[0].previewId)).rejects.toMatchObject({ code: 'session_not_found' })
  })
  it('needs a ready preview of this session (no purchase is needed to save a favorite)', async () => {
    const r = rig(); const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
    const v = await createSession(r.deps, { userId: U1, imageB64: photo })
    await expect(selectArtwork(r.deps, U1, v.sessionId, randomUUID())).rejects.toMatchObject({ code: 'preview_not_ready' })
  })
})

describe('compositions', () => {
  it('prepares one per purchased line from the SELECTED artwork, watermarked for the customer, clean files kept private', async () => {
    const r = rig(); const { sid, previews } = await paid(r); await selectArtwork(r.deps, U1, sid, previews[2].previewId)
    const v = await ensureCompositions(r.deps, U1, sid)
    expect(v.compositions.map(c => ({ l: c.lineId, p: c.productId, s: c.status, a: c.attempt, c: c.correctionsRemaining, f: c.fit }))).toEqual([
      { l: 'a', p: 'fine_art:8x8', s: 'ready', a: 1, c: 1, f: 'exact' }, { l: 'b', p: 'canvas:12x12', s: 'ready', a: 1, c: 1, f: 'exact' }])
    for (const c of v.compositions) expect(c.previewUrl).toMatch(/^https:\/\/signed\.test\/gift\/.+\/compositions\/.+\.jpg$/)
    expect(JSON.stringify(v)).not.toMatch(/\.png|masters/)
    // Both products are square, so they share ONE composition (composed once, by the first line); each line still has its own record.
    expect(r.compose.mock.calls.map(c => [c[0].finish, c[0].size])).toEqual([['fine_art', '8x8']])
    expect(r.store.compositions.length).toBe(2); expect(new Set(r.store.compositions.map(c => c.composed_path)).size).toBe(1)
    expect(r.store.compositions.every(c => c.preview_id === previews[2].previewId)).toBe(true)
  })
  it('is idempotent and resumable: only requirements without a composition are made, a failed one is retried on its own', async () => {
    const r = rig({ failCompose: new Set(['fine_art:12x18']) })
    const { sid, previews } = await paid(r, [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }, { lineId: 'b', productId: 'fine_art:12x18', copies: 1 }]); await selectArtwork(r.deps, U1, sid, previews[0].previewId)
    await expect(ensureCompositions(r.deps, U1, sid)).rejects.toMatchObject({ code: 'composition_failed' })
    expect(r.store.compositions.length).toBe(1); const calls = r.compose.mock.calls.length
    const v = await ensureCompositions(r.deps, U1, sid)
    expect(r.compose.mock.calls.length).toBe(calls + 1); expect(v.compositions.every(c => c.status === 'ready')).toBe(true)
    await ensureCompositions(r.deps, U1, sid); expect(r.compose.mock.calls.length).toBe(calls + 1); expect(r.store.compositions.length).toBe(2)
  })
  it('needs a selected artwork and an order that is still awaiting artwork', async () => {
    const r = rig(); const { sid, orderId, previews } = await paid(r)
    await expect(ensureCompositions(r.deps, U1, sid)).rejects.toMatchObject({ code: 'artwork_not_selected' })
    await selectArtwork(r.deps, U1, sid, previews[0].previewId); r.store.orders.get(orderId)!.status = 'paid'
    await expect(ensureCompositions(r.deps, U1, sid)).rejects.toMatchObject({ code: 'order_not_awaiting_artwork' })
  })
  it('the ONE free correction: a second composition replaces the first; a second correction is refused and goes to Concierge', async () => {
    const r = rig(); const { sid, previews } = await paid(r); await selectArtwork(r.deps, U1, sid, previews[0].previewId); await ensureCompositions(r.deps, U1, sid)
    const first = (await getSessionView(r.deps, U1, sid)).compositions[0]
    const v = await correctLine(r.deps, U1, sid, 'a')
    const a = v.compositions.find(c => c.lineId === 'a')!; expect(a).toMatchObject({ attempt: 2, correctionsRemaining: 0, status: 'ready' }); expect(a.compositionId).not.toBe(first.compositionId)
    expect(v.compositions.find(c => c.lineId === 'b')!.correctionsRemaining).toBe(1)                                      // per line
    await expect(correctLine(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'correction_limit', status: 409 })
    expect(r.store.compositions.filter(c => c.line_id === 'a').map(c => [c.attempt, c.status])).toEqual([[1, 'superseded'], [2, 'ready']])
    await expect(correctLine(r.deps, U1, sid, 'zzz')).rejects.toMatchObject({ code: 'line_not_found' })
  })
  it('a failed correction attempt does not spend the free correction', async () => {
    const r = rig(); const { sid, previews } = await paid(r); await selectArtwork(r.deps, U1, sid, previews[0].previewId); await ensureCompositions(r.deps, U1, sid)
    r.compose.mockRejectedValueOnce(new Error('outpaint_failed'))
    await expect(correctLine(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'composition_failed' })
    expect((await getSessionView(r.deps, U1, sid)).compositions[0]).toMatchObject({ attempt: 1, correctionsRemaining: 1 })
    expect((await correctLine(r.deps, U1, sid, 'a')).compositions[0].attempt).toBe(2)
  })
  it('a correction replaces an approval, which must be given again', async () => {
    const r = rig(); const { sid, previews } = await paid(r); await selectArtwork(r.deps, U1, sid, previews[0].previewId); await ensureCompositions(r.deps, U1, sid); await approveAll(r, sid)
    const v = await correctLine(r.deps, U1, sid, 'a')
    expect(v.compositions.map(c => c.status)).toEqual(['ready', 'approved'])
  })
})

describe('approving compositions and the order', () => {
  const ready = async (r: ReturnType<typeof rig>, pick = 0) => { const x = await paid(r); await selectArtwork(r.deps, U1, x.sid, x.previews[pick].previewId); await ensureCompositions(r.deps, U1, x.sid); return x }
  it('does not release the order until EVERY line is approved for the selected artwork', async () => {
    const r = rig(); const { sid, orderId } = await ready(r)
    await expect(approveOrder(r.deps, U1, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
    const [a] = (await getSessionView(r.deps, U1, sid)).compositions; await approveComposition(r.deps, U1, sid, a.compositionId)
    await expect(approveOrder(r.deps, U1, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
    expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork'); expect(r.kick).not.toHaveBeenCalled(); expect(r.store.portfolios.length).toBe(0)
  })
  it('approval creates ONE unlocked My Collection piece with no credit consumed, moves the order to paid, and releases it to fulfilment', async () => {
    const r = rig(); const { sid, orderId, previews } = await ready(r, 3); await approveAll(r, sid)
    const v = await approveOrder(r.deps, U1, sid)
    expect(r.store.orders.get(orderId)!.status).toBe('paid'); expect(v.order).toMatchObject({ state: 'approved', approvedAt: expect.any(String), unlockPortfolioId: expect.any(String) })
    expect(r.store.portfolios).toEqual([expect.objectContaining({ user_id: U1, origin: 'gift', preview_id: previews[3].previewId, unlocked: true, clean_path: `portraits/${previews[3].previewId}.png` })])
    expect(r.files.has(`portraits/${previews[3].previewId}.png`)).toBe(true); expect(r.files.has(`locked/portraits/${previews[3].previewId}.jpg`)).toBe(true)     // survive session cleanup
    expect(r.store.packs.length).toBe(0)                                                                               // no entitlement, pack or credit touched
    expect(r.kick).toHaveBeenCalledWith(orderId); expect(r.kick).toHaveBeenCalledTimes(1)
  })
  it('is idempotent: a second approval changes nothing, creates no second unlock and does not release twice', async () => {
    const r = rig(); const { sid } = await ready(r); await approveAll(r, sid); await approveOrder(r.deps, U1, sid)
    await approveOrder(r.deps, U1, sid); await approveOrder(r.deps, U1, sid)
    expect(r.store.portfolios.length).toBe(1); expect(r.kick).toHaveBeenCalledTimes(1)
  })
  it('a failure releasing to fulfilment never undoes the approval; the poller picks the order up', async () => {
    const r = rig(); const { sid, orderId } = await ready(r); await approveAll(r, sid); r.kick.mockRejectedValueOnce(new Error('pipeline off'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {}); const v = await approveOrder(r.deps, U1, sid); spy.mockRestore()
    expect(v.order.state).toBe('approved'); expect(r.store.orders.get(orderId)!.status).toBe('paid')
  })
  it('only the owner can approve; approving someone elses composition id is refused', async () => {
    const r = rig(); const { sid } = await ready(r); const other = await ready(r)
    await expect(approveOrder(r.deps, U2, sid)).rejects.toMatchObject({ code: 'session_not_found' })
    const foreign = (await getSessionView(r.deps, U1, other.sid)).compositions[0].compositionId
    await expect(approveComposition(r.deps, U1, sid, foreign)).rejects.toMatchObject({ code: 'composition_not_found' })
    await expect(approveComposition(r.deps, U1, sid, 'nope')).rejects.toMatchObject({ code: 'composition_not_found' })
  })
  it('a superseded composition cannot be approved, so a changed artwork cannot ride on an old approval', async () => {
    const r = rig(); const { sid, previews } = await ready(r); const old = (await getSessionView(r.deps, U1, sid)).compositions[0].compositionId!
    await selectArtwork(r.deps, U1, sid, previews[1].previewId)
    await expect(approveComposition(r.deps, U1, sid, old)).rejects.toMatchObject({ code: 'composition_not_found' })
    await ensureCompositions(r.deps, U1, sid); await approveAll(r, sid); await approveOrder(r.deps, U1, sid)
    expect(r.store.portfolios[0].preview_id).toBe(previews[1].previewId)
  })
  it('a refund request blocks selection, composition, approval and release until Concierge resolves it', async () => {
    const r = rig(); const { sid, orderId, previews } = await ready(r); await approveAll(r, sid)
    await r.store.requestRefund({ sessionId: sid, userId: U1, reason: 'not what I hoped' })
    await expect(approveOrder(r.deps, U1, sid)).rejects.toMatchObject({ code: 'refund_pending' })
    await expect(selectArtwork(r.deps, U1, sid, previews[1].previewId)).rejects.toMatchObject({ code: 'refund_pending' })
    await expect(ensureCompositions(r.deps, U1, sid)).rejects.toMatchObject({ code: 'refund_pending' })
    await expect(correctLine(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'refund_pending' })
    expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork'); expect(r.kick).not.toHaveBeenCalled()
    await r.store.declineRefund(orderId); await approveOrder(r.deps, U1, sid); expect(r.kick).toHaveBeenCalledTimes(1)
  })
})
