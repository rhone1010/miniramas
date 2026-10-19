import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { createSession, setLines, startBatch, getSessionView, getBatchView, deleteSessionNow, purgeExpired, masterAspectFor, GiftError, type GiftDeps, type SourceAnalysis } from './service'
import { memoryGiftStore } from './store'
import { fillEffects, liveEffectIds, EffectSelectionError } from './effects'
import { allProducts } from '../print/catalog'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const photo = async (w = 800, h = 800) => (await sharp({ create: { width: w, height: h, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
const cleanMaster = async () => (await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64')

function rig(over: { analysis?: SourceAnalysis; failEffects?: Set<string> } = {}) {
  let t = Date.parse('2026-10-15T12:00:00Z')
  const files = new Map<string, Buffer>()
  const store = memoryGiftStore(() => t)
  const generate = vi.fn(async (i: { effectId: string; [k: string]: any }) => {
    if (over.failEffects?.has(i.effectId)) { over.failEffects.delete(i.effectId); throw new Error('nb2_failed') }   // fails once, then succeeds
    return { imageB64: await cleanMaster() }
  })
  const deps: GiftDeps = {
    store, clock: () => t,
    storage: {
      put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null,
      remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null),
    },
    analyze: async () => over.analysis ?? { status: 'supported', series: 'portraits', peopleCount: null },
    generate,
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
  }
  return { deps, store, files, generate, advance: (ms: number) => { t += ms } }
}
const key = (n: number | string) => 'idem-key-' + n
/** The purchase: an unpaid order row linked to the session, then payment confirmed. Mirrors checkout + the verified webhook. */
async function payOrder(r: ReturnType<typeof rig>, sessionId: string, user = U1) {
  const rec = (await r.store.getSession(sessionId, user))!
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
  r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 5000, retail_shipping_cents: 700, items: [], prodigi_order_id: null, placed_at: null })
  await r.store.linkOrder(sessionId, user, orderId, 'v1')
  const lines = rec.lines.length ? rec.lines : [{ lineId: 'a', productId: 'fine_art:8x8', size: '8x8', copies: 1 }]
  await r.store.confirmOrder({ sessionId, orderId, userId: user, stripeSessionId: cs, paymentIntent: 'pi_test_1', lines: lines.map(l => ({ lineId: l.lineId, productId: l.productId, sku: 'SKU-' + l.productId, copies: l.copies })) })
  return orderId
}
/** A session whose order is PAID by default (batches need it); pass paid=false for the steps that come before checkout. */
const newSession = async (r = rig(), user = U1, paid = true) => {
  const view = await createSession(r.deps, { userId: user, imageB64: await photo() })
  if (paid) await payOrder(r, view.sessionId, user)
  return { r, view }
}

describe('sessions', () => {
  it('creates an owned session with the source stored, the series identified and a master aspect chosen', async () => {
    const { r, view } = await newSession(rig(), U1, false)
    expect(view).toMatchObject({ source: { series: 'portraits', width: 800, height: 800, peopleCount: null }, masterAspect: '1:1', batches: [], usedEffectIds: [], nextBatch: { kind: 'free' } })
    expect(view.entitlement).toEqual({ freeBatchesTotal: 2, freeBatchesUsed: 0, paidPacksAvailable: 0, freeAvailable: true, freeBlockedReason: null })       // previews first: free, no purchase
    expect(view.order).toMatchObject({ state: 'none', orderId: null, freeBatchesGranted: 2 })
    expect([...r.files.keys()]).toEqual([`gift/${view.sessionId}/source.jpg`])
    expect(JSON.stringify({ ...view, source: { ...view.source, photoUrl: undefined } })).not.toMatch(/source\.jpg|masters|storage/)       // the signed photoUrl is the one intended exposure of the customer's own photo; no raw path appears
  })
  it('strips EXIF from the stored source', async () => {
    const withExif = (await sharp({ create: { width: 300, height: 300, channels: 3, background: '#fff' } }).withExif({ IFD0: { Copyright: 'x' } }).jpeg().toBuffer()).toString('base64')
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: withExif })
    expect((await sharp(r.files.get(`gift/${v.sessionId}/source.jpg`)!).metadata()).exif).toBeUndefined()
  })
  it('refuses bad images with the shared source-validation codes, and stores nothing', async () => {
    const r = rig()
    for (const [b, code] of [[undefined, 'image_b64_required'], ['!!!', 'image_not_base64'], [Buffer.from('not an image at all').toString('base64'), 'image_unreadable']] as const) {
      await expect(createSession(r.deps, { userId: U1, imageB64: b })).rejects.toMatchObject({ code })
    }
    expect(r.files.size).toBe(0); expect(r.store.sessions.size).toBe(0)
  })
  it('refuses age-restricted and unsupported subjects before storing anything', async () => {
    for (const [analysis, code] of [[{ status: 'age_restricted' }, 'age_restricted'], [{ status: 'unsupported' }, 'unsupported_subject']] as const) {
      const r = rig({ analysis }); await expect(createSession(r.deps, { userId: U1, imageB64: await photo() })).rejects.toMatchObject({ code, status: code === 'age_restricted' ? 403 : 422 })
      expect(r.files.size).toBe(0); expect(r.store.sessions.size).toBe(0)
    }
  })
  it('an analysis outage is a retryable 503, not an unsupported subject', async () => {
    const r = rig(); r.deps.analyze = async () => { throw new Error('openai down') }
    await expect(createSession(r.deps, { userId: U1, imageB64: await photo() })).rejects.toMatchObject({ code: 'analysis_unavailable', status: 503 })
  })
  it('only the owner can see or change a session; anyone else gets the same answer as a missing one', async () => {
    const { r, view } = await newSession()
    await expect(getSessionView(r.deps, U2, view.sessionId)).rejects.toMatchObject({ code: 'session_not_found', status: 404 })
    await expect(setLines(r.deps, U2, view.sessionId, [])).rejects.toMatchObject({ code: 'session_not_found' })
    await expect(startBatch(r.deps, U2, view.sessionId, { idempotencyKey: key(1) })).rejects.toMatchObject({ code: 'session_not_found' })
    await expect(getSessionView(r.deps, U1, 'not-a-uuid')).rejects.toMatchObject({ code: 'session_not_found' })
  })
  it('Groups sessions record the people count and pick a format that count allows', async () => {
    const { view } = await newSession(rig({ analysis: { status: 'supported', series: 'groups', peopleCount: 2 } }))
    expect(view.masterAspect).toBe('2:3'); expect(view.source.peopleCount).toBe(2)
    expect(masterAspectFor('groups', 5)).toBe('3:2'); expect(masterAspectFor('pets', null)).toBe('2:3')
  })
})

describe('product selection', () => {
  it('persists launch products with catalog sizes and geometry, ignoring any client size', async () => {
    const { r, view } = await newSession(rig(), U1, false)
    const v = await setLines(r.deps, U1, view.sessionId, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 2, size: 'hacked' }, { lineId: 'b', productId: 'canvas:12x12', copies: 1 }])
    expect(v.lines).toEqual([{ lineId: 'a', productId: 'fine_art:12x18', size: '12x18', copies: 2 }, { lineId: 'b', productId: 'canvas:12x12', size: '12x12', copies: 1 }])
    expect(v.geometries[0]).toMatchObject({ lineId: 'a', requiredPx: { w: 3600, h: 5400 }, orientation: 'portrait' })
    expect((await getSessionView(r.deps, U1, view.sessionId)).lines.length).toBe(2)            // survives a reload
  })
  it('refuses unapproved products: framed canvas, matted rectangles, mug, cards, unknown ids', async () => {
    const { r, view } = await newSession(rig(), U1, false)
    for (const id of ['framed_canvas:8x12', 'matted:12x18', 'mug:11oz-white', 'card:7x5-mohawk', 'nope:1x1']) {
      await expect(setLines(r.deps, U1, view.sessionId, [{ lineId: 'a', productId: id, copies: 1 }])).rejects.toMatchObject({ code: 'product_not_available' })
    }
    expect(allProducts().filter(p => p.status === 'launch').length).toBeGreaterThan(0)
  })
  it('validates quantity and line ids', async () => {
    const { r, view } = await newSession(rig(), U1, false)
    for (const copies of [0, 21, 1.5, '2']) await expect(setLines(r.deps, U1, view.sessionId, [{ lineId: 'a', productId: 'fine_art:8x8', copies }])).rejects.toMatchObject({ code: 'invalid_quantity' })
    await expect(setLines(r.deps, U1, view.sessionId, [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }, { lineId: 'a', productId: 'fine_art:8x8', copies: 1 }])).rejects.toMatchObject({ code: 'duplicate_line' })
    await expect(setLines(r.deps, U1, view.sessionId, 'x')).rejects.toMatchObject({ code: 'invalid_lines' })
  })
  it('the purchased products are frozen once an order exists', async () => {
    const { r, view } = await newSession(rig(), U1, false); await setLines(r.deps, U1, view.sessionId, [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }])
    await payOrder(r, view.sessionId)
    await expect(setLines(r.deps, U1, view.sessionId, [{ lineId: 'a', productId: 'fine_art:8x8', copies: 5 }])).rejects.toMatchObject({ code: 'lines_locked', status: 409 })
    expect((await getSessionView(r.deps, U1, view.sessionId)).lines).toEqual([{ lineId: 'a', productId: 'fine_art:8x8', size: '8x8', copies: 1 }])
  })
  it('keeps the selection through generation', async () => {
    const { r, view } = await newSession(rig(), U1, false); await setLines(r.deps, U1, view.sessionId, [{ lineId: 'a', productId: 'premium:16x16', copies: 3 }])
    await payOrder(r, view.sessionId)
    const out = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    expect(out.session.lines).toEqual([{ lineId: 'a', productId: 'premium:16x16', size: '16x16', copies: 3 }])
  })
})

describe('hybrid effect selection', () => {
  it('fills 0 picks to six from the live effects, and keeps picks first in the customer\'s order', () => {
    const live = liveEffectIds('portraits'); expect(live.length).toBeGreaterThan(20)
    expect(fillEffects('portraits', [], [])).toEqual(live.slice(0, 6))
    const picks = [live[10], live[3]]
    expect(fillEffects('portraits', picks, [])).toEqual([live[10], live[3], ...live.filter(id => !picks.includes(id)).slice(0, 4)])
    expect(new Set(fillEffects('portraits', live.slice(0, 6), [])).size).toBe(6)
  })
  it('never repeats a used effect and refuses picks that are used, unknown, duplicated or too many', () => {
    const live = liveEffectIds('portraits'), used = live.slice(0, 6)
    expect(fillEffects('portraits', [], used).some(id => used.includes(id))).toBe(false)
    const bad = (picks: string[], code: string) => expect(() => fillEffects('portraits', picks, used)).toThrow(expect.objectContaining({ code }))
    bad([used[0]], 'effect_already_used'); bad(['not_an_effect'], 'invalid_effect_selection'); bad([live[8], live[8]], 'invalid_effect_selection'); bad(live.slice(10, 17), 'invalid_effect_selection')
    expect(() => fillEffects('portraits', [], live.slice(0, live.length - 3))).toThrow(EffectSelectionError)         // fewer than six left
  })
  it('Groups uses only single-photograph effects, and Pets only effects the engine can render', () => {
    expect(liveEffectIds('groups').length).toBeGreaterThanOrEqual(6); expect(liveEffectIds('groups')).not.toContain('mosaic_faces')
    expect(liveEffectIds('pets').length).toBeGreaterThanOrEqual(6)
  })
})

describe('batches: free, free, then paid', () => {
  it('batch 1 and 2 are free, generate six distinct ready previews with signed watermarked URLs and private masters', async () => {
    const { r, view } = await newSession()
    const b1 = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    expect(b1.complete).toBe(true); expect(b1.batch).toMatchObject({ batchIndex: 1, kind: 'free' })
    expect(b1.batch.previews.map(p => p.status)).toEqual(Array(6).fill('ready')); expect(new Set(b1.batch.previews.map(p => p.effectId)).size).toBe(6)
    for (const p of b1.batch.previews) expect(p.url).toMatch(/^https:\/\/signed\.test\/gift\/.+\/previews\/.+\.jpg$/)
    expect(JSON.stringify(b1)).not.toMatch(/masters/)                                         // a clean master path never leaves the server
    expect([...r.files.keys()].filter(k => k.includes('/masters/')).length).toBe(6)
    const b2 = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2) })
    expect(b2.batch).toMatchObject({ batchIndex: 2, kind: 'free' })
    expect(b2.session.usedEffectIds.length).toBe(12); expect(new Set(b2.session.usedEffectIds).size).toBe(12)
    expect(b2.session.nextBatch).toEqual({ kind: 'payment_required', amountCents: 299, currency: 'USD' })
    expect(b2.session.entitlement).toEqual({ freeBatchesTotal: 2, freeBatchesUsed: 2, paidPacksAvailable: 0, freeAvailable: false, freeBlockedReason: 'session_limit' })
  })
  it('generation needs no purchase: a session with no order and one with an unpaid checkout both get free batches, and approval ends generation', async () => {
    const none = await newSession(rig(), U1, false)
    expect((await startBatch(none.r.deps, U1, none.view.sessionId, { idempotencyKey: key(1) })).batch.kind).toBe('free')
    const open = await newSession(rig(), U1, false)
    const orderId = randomUUID(); open.r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: 'cs_test_open000001', stripe_payment_intent: null, retail_total_cents: 100, retail_shipping_cents: 0, items: [], prodigi_order_id: null, placed_at: null })
    await open.r.store.linkOrder(open.view.sessionId, U1, orderId, 'v1')
    expect((await startBatch(open.r.deps, U1, open.view.sessionId, { idempotencyKey: key(1) })).batch.kind).toBe('free')
    open.r.store.orders.get(orderId)!.status = 'paid'                                                                  // released to fulfilment (approved): no more generation
    await expect(startBatch(open.r.deps, U1, open.view.sessionId, { idempotencyKey: key(2) })).rejects.toMatchObject({ code: 'order_not_awaiting_artwork' })
  })
  it('payment grants exactly two free batches; a refunded or refund-pending order generates nothing more', async () => {
    const { r, view } = await newSession()
    expect((await getSessionView(r.deps, U1, view.sessionId)).nextBatch).toEqual({ kind: 'free' })
    await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    const rec = r.store.sessions.get(view.sessionId)!
    rec.refund_requested_at = new Date().toISOString()
    await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2) })).rejects.toMatchObject({ code: 'refund_pending' })
    rec.refund_requested_at = null; rec.refunded_at = new Date().toISOString()
    await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2) })).rejects.toMatchObject({ code: 'order_refunded' })
  })
  it('a third batch needs payment: 402, nothing reserved, nothing generated, and no client flag changes that', async () => {
    const { r, view } = await newSession()
    await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) }); await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2) })
    const calls = r.generate.mock.calls.length
    const attempt = startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(3), paid: true, paymentConfirmed: true, packId: 'x' } as any)
    await expect(attempt).rejects.toMatchObject({ code: 'payment_required', status: 402 })
    expect(r.generate.mock.calls.length).toBe(calls); expect(r.store.batches.length).toBe(2)
  })
  it('a verified pack pays for exactly one further batch, then payment is required again', async () => {
    const { r, view } = await newSession()
    await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) }); await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2) })
    await r.store.fulfillPack(U1, 'cs_test_1', 299)
    expect((await getSessionView(r.deps, U1, view.sessionId)).nextBatch).toEqual({ kind: 'paid', packAvailable: true })
    const b3 = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(3) })
    expect(b3.batch).toMatchObject({ batchIndex: 3, kind: 'paid', complete: true }); expect(b3.session.entitlement.paidPacksAvailable).toBe(0)
    await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(4) })).rejects.toMatchObject({ code: 'payment_required' })
  })
  it('another user\'s pack cannot pay for this session', async () => {
    const { r, view } = await newSession()
    await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) }); await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2) })
    await r.store.fulfillPack(U2, 'cs_test_other', 299)
    await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(3) })).rejects.toMatchObject({ code: 'payment_required' })
  })
  it('a repeated idempotency key returns the same batch: no second reservation, no regeneration, no second pack consumed', async () => {
    const { r, view } = await newSession()
    await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) }); await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2) })
    await r.store.fulfillPack(U1, 'cs_test_1', 299); await r.store.fulfillPack(U1, 'cs_test_2', 299)
    const a = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(3) }); const calls = r.generate.mock.calls.length
    const again = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(3), effectIds: ['whatever'] })        // picks are ignored on a repeat
    expect(again.batch.previews.map(p => p.previewId)).toEqual(a.batch.previews.map(p => p.previewId))
    expect(r.generate.mock.calls.length).toBe(calls); expect(r.store.batches.length).toBe(3)
    expect(r.store.packs.filter(p => p.status === 'paid').length).toBe(1)                 // one of two used, one left
  })
  it('hybrid selection is honoured and never repeats across batches', async () => {
    const { r, view } = await newSession(); const live = liveEffectIds('portraits')
    const b1 = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1), effectIds: [live[12], live[5]] })
    expect(b1.batch.previews.slice(0, 2).map(p => p.effectId)).toEqual([live[12], live[5]])
    await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2), effectIds: [live[12]] })).rejects.toMatchObject({ code: 'effect_already_used' })
    expect(r.store.batches.length).toBe(1)
    const b2 = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2) })
    expect(b2.batch.previews.some(p => b1.batch.previews.map(q => q.effectId).includes(p.effectId))).toBe(false)
  })
  it('validates the idempotency key and the effect list before anything happens', async () => {
    const { r, view } = await newSession()
    for (const k of [undefined, '', 'short', 'has spaces in it!', 'x'.repeat(81)]) await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: k as any })).rejects.toMatchObject({ code: 'invalid_idempotency_key' })
    await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1), effectIds: 'x' as any })).rejects.toMatchObject({ code: 'invalid_effect_selection' })
    await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1), effectIds: ['nope'] })).rejects.toMatchObject({ code: 'invalid_effect_selection' })
    expect(r.store.batches.length).toBe(0); expect(r.generate).not.toHaveBeenCalled()
  })
})

describe('resumable generation', () => {
  it('a failed preview leaves the batch partial; a retry regenerates ONLY the failed one, with no new charge', async () => {
    const live = liveEffectIds('portraits'); const failing = new Set([live[2]])
    const { r, view } = await newSession(rig({ failEffects: failing }))
    const first = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    expect(first.complete).toBe(false); expect(first.batch.previews.filter(p => p.status === 'ready').length).toBe(5)
    const bad = first.batch.previews.find(p => p.status === 'failed')!; expect(bad).toMatchObject({ effectId: live[2], retryable: true, url: null })
    expect(first.session.nextBatch).toEqual({ kind: 'blocked', reason: 'previous_batch_incomplete' })
    const readyIds = first.batch.previews.filter(p => p.status === 'ready').map(p => p.previewId), calls = r.generate.mock.calls.length
    const retry = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })          // same key = retry
    expect(retry.complete).toBe(true); expect(r.generate.mock.calls.length).toBe(calls + 1)         // one render, not six
    expect(retry.batch.previews.map(p => p.previewId)).toEqual(first.batch.previews.map(p => p.previewId))
    expect(retry.batch.previews.filter(p => readyIds.includes(p.previewId)).every(p => p.status === 'ready')).toBe(true)
    expect(r.store.batches.length).toBe(1); expect(r.store.packs.length).toBe(0)
  })
  it('a new batch cannot be taken while the last one is incomplete, so a paid pack is never spent past missing previews', async () => {
    const live = liveEffectIds('portraits'); const { r, view } = await newSession(rig({ failEffects: new Set([live[0]]) }))
    await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(2) })).rejects.toMatchObject({ code: 'previous_batch_incomplete', status: 409 })
    expect(r.store.batches.length).toBe(1)
  })
  it('previews are capped at three attempts and then stay failed, not retryable', async () => {
    const { r, view } = await newSession(); r.generate.mockImplementation(async () => { throw new Error('always') })
    for (let i = 0; i < 4; i++) await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    const b = await getBatchView(r.deps, U1, view.sessionId, 1)
    expect(b.previews.every(p => p.status === 'failed' && p.retryable === false)).toBe(true); expect(r.generate).toHaveBeenCalledTimes(18)
  })
  it('a preview whose lease lapsed (a crashed request) is taken over; a live lease is not', async () => {
    const { r, view } = await newSession()
    const gate = Promise.withResolvers<void>(); const original = r.generate.getMockImplementation()!
    r.generate.mockImplementationOnce(async () => { await gate.promise; return original({} as any) })
    // Simulate a crashed worker: claim a preview and walk away.
    await r.store.reserveBatch({ sessionId: view.sessionId, userId: U1, key: key(1), effects: liveEffectIds('portraits').slice(0, 6) })
    const p = r.store.previews[0]; await r.store.claimPreview(p.id, U1)
    expect(await r.store.claimPreview(p.id, U1)).toBeNull()                            // live lease: refused
    r.advance(6 * 60_000)
    expect((await r.store.claimPreview(p.id, U1))?.attempts).toBe(2)                    // lapsed: taken over
    gate.resolve()
  })
  it('a ready preview is never regenerated, even by a retry', async () => {
    const { r, view } = await newSession(); await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    const calls = r.generate.mock.calls.length
    await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) }); await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    expect(r.generate.mock.calls.length).toBe(calls)
  })
  it('the watermark failing fails the preview and publishes no unmarked image', async () => {
    const { r, view } = await newSession(); r.deps.watermark = async () => { throw new Error('mark_failed') }
    const out = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    expect(out.batch.previews.every(p => p.status === 'failed' && p.url === null)).toBe(true)
    expect([...r.files.keys()].filter(k => k.includes('/previews/') || k.includes('/masters/'))).toEqual([])   // nothing stored without a mark
  })
  it('the master is generated at the session aspect, from the stored source, for the right series and user', async () => {
    const { r, view } = await newSession(rig({ analysis: { status: 'supported', series: 'pets', peopleCount: null } }))
    await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })
    expect(r.generate.mock.calls[0][0]).toMatchObject({ series: 'pets', aspect: '2:3', userId: U1, peopleCount: null })
    expect(r.generate.mock.calls[0][0].sourceB64.length).toBeGreaterThan(100)
  })
})

describe('retention', () => {
  it('an expired, unpinned (unpaid) session is purged with its source and rows; a paid or pinned one is retained until resolved', async () => {
    const { r, view } = await newSession(rig(), U1, false)
    const paid = await newSession(r, U1, true); await startBatch(r.deps, U1, paid.view.sessionId, { idempotencyKey: key(1) })
    r.advance(40 * 864e5)
    const out = await purgeExpired(r.deps)
    expect(out.purged).toBe(1); expect(r.store.sessions.has(view.sessionId)).toBe(false); expect([...r.files.keys()].some(k => k.includes(view.sessionId))).toBe(false)
    expect(r.store.sessions.has(paid.view.sessionId)).toBe(true); expect(r.files.has(`gift/${paid.view.sessionId}/source.jpg`)).toBe(true)
    expect([...r.files.keys()].filter(k => k.includes(paid.view.sessionId) && k.includes('/masters/')).length).toBe(6)
    expect((await getSessionView(r.deps, U1, paid.view.sessionId)).nextBatch).not.toEqual({ kind: 'blocked', reason: 'session_expired' })   // still usable after 40 days
  })
  it('a released session (order with the lab, or refunded and cancelled) expires after a grace period and is then purged', async () => {
    const { r, view } = await newSession(); const orderId = r.store.sessions.get(view.sessionId)!.order_id!
    await r.store.releaseSession(orderId); r.advance(6 * 864e5); expect((await purgeExpired(r.deps)).purged).toBe(0)
    r.advance(2 * 864e5); expect((await purgeExpired(r.deps)).purged).toBe(1)
  })
  it('paid preview packs survive session purge and can pay in a new session', async () => {
    const { r } = await newSession(rig(), U1, false)
    await r.store.fulfillPack(U1, 'cs_test_keep', 299); r.advance(8 * 864e5); await purgeExpired(r.deps)
    expect(r.store.packs.length).toBe(1); expect(await r.store.paidPackCount(U1)).toBe(1)
  })
  it('unpaid activity extends expiry but never past the 30-day ceiling', async () => {
    const { r, view } = await newSession(rig(), U1, false)
    for (let i = 0; i < 6; i++) { r.advance(6 * 864e5); await setLines(r.deps, U1, view.sessionId, []) }
    const rec = r.store.sessions.get(view.sessionId)!
    expect(Date.parse(rec.expires_at)).toBeLessThanOrEqual(Date.parse(rec.created_at) + 30 * 864e5)
  })
  it('an idle unpaid session untouched for more than 7 days is expired', async () => {
    const { r, view } = await newSession(rig(), U1, false); r.advance(8 * 864e5)
    await expect(startBatch(r.deps, U1, view.sessionId, { idempotencyKey: key(1) })).rejects.toMatchObject({ code: 'session_expired' })
  })
  it('the customer can delete an unpaid session now; a storage failure keeps the rows to retry; a paid one is retained', async () => {
    const { r, view } = await newSession(rig(), U1, false)
    const remove = r.deps.storage.remove; r.deps.storage.remove = async () => { throw new Error('storage down') }
    await expect(deleteSessionNow(r.deps, U1, view.sessionId)).rejects.toThrow('storage down'); expect(r.store.sessions.has(view.sessionId)).toBe(true)
    r.deps.storage.remove = remove
    await deleteSessionNow(r.deps, U1, view.sessionId)
    expect(r.store.sessions.has(view.sessionId)).toBe(false); expect(r.files.size).toBe(0)
    await expect(deleteSessionNow(r.deps, U2, view.sessionId)).rejects.toBeInstanceOf(GiftError)
    const paid = await newSession(r, U1, true)
    await expect(deleteSessionNow(r.deps, U1, paid.view.sessionId)).rejects.toMatchObject({ code: 'session_retained' })
    expect(r.store.sessions.has(paid.view.sessionId)).toBe(true)
  })
})
