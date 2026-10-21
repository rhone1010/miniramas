// Mixed-aspect Gift projects: a 12 x 18 print with an 8 x 8 canvas, products that share a composition, failed generation and its
// idempotent retry, independent line approval, and six artistic previews per batch whatever is bought. No model is called: the
// generator, the composer and the watermark are fakes that record how they were asked.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { createSession, setLines, startBatch, getSessionView, purgeExpired, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { purchasedItems, purchasedLines } from './test-order'
import { selectArtwork, ensureCompositions, correctLine, approveComposition, approveOrder } from './compose'
import { planFor, groupLines, geometryKeyFor, masterDims } from './composition-plan'
import { estimateCompositionCost } from './policy'
import { NB21_ASPECTS, NB21_RESOLUTIONS, routeAspects, generationAspectFor, mapCompositionToArea, extensionBetween } from './aspects'
import { allProducts, getProduct, type CanonicalProduct } from '../print/catalog'
process.env.GIFT_REQUIRE_APPROVED_SCENE = '0'   // these tests cover behaviour independent of the sale gate (default ON); the gate has its own tests in orders.test.ts

const U1 = '10000000-0000-4000-8000-000000000001'
const product = (id: string) => getProduct(id)!
const ctx = (series: 'portraits' | 'pets' | 'groups' = 'portraits', masterAspect = '1:1', peopleCount: number | null = null) => ({ series, peopleCount, masterAspect })

function rig(over: { failGenerateFor?: Set<string>; series?: 'portraits' | 'pets' | 'groups'; people?: number | null } = {}) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  let n = 0
  const generate = vi.fn(async (i: { effectId: string; aspect: string; sourceB64: string }) => {
    const tag = i.aspect === '1:1' ? 'master' : 'product'
    if (tag === 'product' && over.failGenerateFor?.has(i.aspect)) { over.failGenerateFor.delete(i.aspect); throw new Error('nb2_failed') }
    const [w, h] = i.aspect.split(':').map(Number)
    return { imageB64: (await sharp({ create: { width: 64 * w, height: 64 * h, channels: 3, background: tag === 'master' ? '#3a6' : '#a63' } }).png().toBuffer()).toString('base64') }
  })
  const compose = vi.fn(async (i: { masterB64: string; size: string; finish: string }) => {
    n++
    const p = allProducts().find(x => x.size === i.size && (x.family as string) === i.finish)!
    const [pw, ph] = [p.requirements.picturePx.w, p.requirements.picturePx.h]
    const w = 256, h = Math.round(256 * ph / pw)
    return { image: await sharp({ create: { width: w, height: h, channels: 3, background: '#036' } }).png().toBuffer(), width: w, height: h, fit: 'extend' as const, outpainted: false }
  })
  const deps: GiftDeps = {
    store, compose, generate,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: vi.fn(async (ps: string[]) => { for (const p of ps) files.delete(p) }), signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: async () => ({ status: 'supported', series: over.series ?? 'portraits', peopleCount: over.people ?? null }),
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    kick: vi.fn(async () => ({})),
  }
  return { deps, store, files, generate, compose }
}
type Line = { lineId: string; productId: string; copies: number }
async function project(r: ReturnType<typeof rig>, lines: Line[]) {
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const view = await createSession(r.deps, { userId: U1, imageB64: photo })
  await setLines(r.deps, U1, view.sessionId, lines)
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
  r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: purchasedItems(lines), prodigi_order_id: null, placed_at: null })
  await r.store.linkOrder(view.sessionId, U1, orderId, 'v1')
  await r.store.confirmOrder({ sessionId: view.sessionId, orderId, userId: U1, stripeSessionId: cs, paymentIntent: 'pi_1', lines: purchasedLines(lines) })
  const b = await startBatch(r.deps, U1, view.sessionId, { idempotencyKey: 'idem-key-1' })
  return { sid: view.sessionId, orderId, previews: b.batch.previews }
}
const pick = async (r: ReturnType<typeof rig>, sid: string, previewId: string) => { await selectArtwork(r.deps, U1, sid, previewId) }

describe('NB2.1 aspect ratios (verified against the model schema, read-only)', () => {
  it('the model supports 21:9 and the nine ratios Gift products can need; resolutions are 1K, 2K and 4K', () => {
    for (const a of ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']) expect(NB21_ASPECTS).toContain(a)
    expect(NB21_RESOLUTIONS).toEqual(['1K', '2K', '4K'])
  })
  it("product compositions: Portraits admits Discovery's four ratios plus 2:3, 3:2, 4:5, 5:4, 16:9 and 21:9; Groups by head count; Pets nearly all", () => {
    expect(routeAspects('portraits', null)).toEqual(['1:1', '3:4', '4:3', '9:16', '2:3', '3:2', '4:5', '5:4', '16:9', '21:9'])
    expect(routeAspects('groups', 2)).toContain('2:3'); expect(routeAspects('groups', 2)).not.toContain('3:2')
    expect(routeAspects('groups', 5)).toContain('3:2'); expect(routeAspects('groups', 5)).not.toContain('9:16')
    expect(routeAspects('pets', null)).toContain('21:9'); expect(routeAspects('pets', null)).not.toContain('1:8')
  })
  it('every verified product ratio is reached exactly on Portraits, with no extension; 21:9 for the mug included', () => {
    for (const [a, v] of [['2:3', 2 / 3], ['3:2', 3 / 2], ['4:5', 4 / 5], ['5:4', 5 / 4], ['16:9', 16 / 9], ['21:9', 21 / 9]] as const) expect(generationAspectFor('portraits', null, v), a).toEqual({ aspect: a, extensionFraction: 0 })
  })
  it('the nearest supported ratio for a 2:3 print is exactly 2:3 on Portraits, Pets and Groups', () => {
    expect(generationAspectFor('portraits', null, 2 / 3)).toEqual({ aspect: '2:3', extensionFraction: 0 })
    expect(generationAspectFor('pets', null, 2 / 3)).toEqual({ aspect: '2:3', extensionFraction: 0 })
    expect(generationAspectFor('groups', 4, 2 / 3)).toEqual({ aspect: '2:3', extensionFraction: 0 })
  })
  it('a shape no supported ratio can reach within the 20% bound has no generation plan', () => { expect(generationAspectFor('portraits', null, 4)).toBeNull() })
})

describe('the 21:9 mug mapping (mug and cards stay disabled)', () => {
  it('a 21:9 composition lands in the 2670 x 1110 mug area without distortion or cropping: scaled to height, 80 px of background added across the width', () => {
    const m = mapCompositionToArea(21 / 9, { w: 2670, h: 1110 })
    expect(m).toMatchObject({ scaledBy: 'height', content: { w: 2590, h: 1110 }, padding: { w: 80, h: 0 }, distorted: false, cropped: false, withinBound: true })
    expect(m.extensionFraction).toBeCloseTo(0.0309, 3)
    expect(extensionBetween(21 / 9, 2670 / 1110)).toBeLessThan(0.2)
    // scaling to the WIDTH instead would need 1144 px of height in a 1110 px area: that is a crop, so it is not used
    expect(Math.round(2670 / (21 / 9))).toBe(1144)
  })
  it('the mug and every card remain disabled and unselectable', () => {
    for (const p of allProducts().filter(x => x.kind === 'mug' || x.kind === 'greeting_card')) { expect(p.status).toBe('disabled'); expect(p.retailCents).toBeNull() }
  })
})

describe('composition plans from real product geometry', () => {
  it('Portraits 12 x 18 print: the 1:1 artwork cannot be extended to 2:3, so it is a separate NB2.1 generation at exactly 2:3', () => {
    expect(planFor(product('fine_art:12x18'), ctx())).toMatchObject({ method: 'generated', geometryKey: 'a667', generationAspect: '2:3', generationExtensionFraction: 0 })
  })
  it('an 8 x 8 canvas needs nothing but the artwork itself', () => {
    expect(planFor(product('canvas:8x8'), ctx())).toMatchObject({ method: 'deterministic', fit: 'exact', geometryKey: 'a1000', generationAspect: null })
  })
  it('products are grouped only when their picture shapes match: print and frame at 12 x 18 together, the canvas apart', () => {
    const items = [product('fine_art:12x18'), product('canvas:8x8'), product('framed:12x18'), product('fine_art:16x24')].map(p => ({ product: p }))
    const g = groupLines(items, ctx())
    expect(g.map(x => [x.geometryKey, x.items.map(i => i.product.productId)])).toEqual([['a667', ['fine_art:12x18', 'framed:12x18', 'fine_art:16x24']], ['a1000', ['canvas:8x8']]])
    expect(geometryKeyFor(product('canvas:12x18'))).toBe(geometryKeyFor(product('premium:16x24')))        // canvas wrap does not change the picture shape
  })
  it('mixed series: the same product gets the plan its series can actually generate', () => {
    expect(planFor(product('fine_art:12x18'), ctx('pets', '2:3'))).toMatchObject({ method: 'deterministic', fit: 'exact' })
    expect(planFor(product('fine_art:12x18'), ctx('groups', '2:3', 4))).toMatchObject({ method: 'deterministic', fit: 'exact' })
    expect(planFor(product('fine_art:12x18'), ctx('portraits', '3:4'))).toMatchObject({ method: 'deterministic', fit: 'extend', extensionFraction: 0.125 })      // bounded extension, no new generation
  })
})

describe('compositions in a real project', () => {
  it('Portraits 12 x 18 print: one generation at 2:3 from the photograph WITH the selected artwork as a reference, then one composer call; the customer approves what they see', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
    await pick(r, sid, previews[2].previewId)
    const before = r.generate.mock.calls.length
    const v = await ensureCompositions(r.deps, U1, sid)
    expect(r.generate.mock.calls.length).toBe(before + 1)
    const call = r.generate.mock.calls[before][0] as any
    expect(call).toMatchObject({ series: 'portraits', aspect: '2:3', effectId: previews[2].effectId, productComposition: true })
    expect(call.sourceB64).toBe(r.files.get(`gift/${sid}/source.jpg`)!.toString('base64'))                  // the customer's own photograph leads
    expect(call.referenceB64).toBeTruthy()                                                                    // the selected favorite follows
    expect(r.compose.mock.calls.map(c => [c[0].finish, c[0].size])).toEqual([['fine_art', '12x18']])
    expect(v.compositions[0]).toMatchObject({ lineId: 'a', status: 'ready', method: 'generated', geometryKey: 'a667', generationAspect: '2:3', generationMode: 'favorite_reference', sourceArtworkId: previews[2].previewId, picturePx: { w: 3600, h: 5400 }, correctionsRemaining: 1 })
    expect(v.compositions[0].previewUrl).toMatch(/\/compositions\/.+\.jpg$/); expect(JSON.stringify(v)).not.toMatch(/\.png|masters/)
  })
  it('12 x 18 print plus 8 x 8 canvas: two requirements, one generation (for the print) and two composer calls; the canvas uses the selected artwork itself', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'canvas:8x8', copies: 1 }])
    await pick(r, sid, previews[0].previewId); const before = r.generate.mock.calls.length
    const v = await ensureCompositions(r.deps, U1, sid)
    expect(r.generate.mock.calls.length).toBe(before + 1); expect(r.compose.mock.calls.length).toBe(2)
    const [a, b] = v.compositions
    expect([a.method, a.geometryKey, b.method, b.geometryKey]).toEqual(['generated', 'a667', 'deterministic', 'a1000'])
    expect(v.compositions.map(c => c.generationMode)).toEqual(['favorite_reference', 'none'])
    expect(a.compositionId).not.toBe(b.compositionId); expect(a.previewUrl).not.toBe(b.previewUrl)
    expect(v.geometries.map(g => [g.lineId, g.geometryKey, g.method, g.generationAspect, g.sharedWithLineIds])).toEqual([['a', 'a667', 'generated', '2:3', []], ['b', 'a1000', 'deterministic', null, []]])
  })
  it('two compatible print products share ONE composition: one generation, one composer call, two line records pointing at the same files', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'framed:12x18', copies: 1 }])
    await pick(r, sid, previews[0].previewId); const before = r.generate.mock.calls.length
    const v = await ensureCompositions(r.deps, U1, sid)
    expect(r.generate.mock.calls.length).toBe(before + 1); expect(r.compose.mock.calls.length).toBe(1)
    expect(r.store.compositions.length).toBe(2)
    const [x, y] = r.store.compositions
    expect(x.composed_path).toBe(y.composed_path); expect(x.preview_path).toBe(y.preview_path); expect(y.source_composition_id).toBe(x.id); expect(x.source_composition_id).toBeNull()
    expect(v.compositions.map(c => c.sharedWithLineIds)).toEqual([['b'], ['a']]); expect(v.compositions[0].compositionId).not.toBe(v.compositions[1].compositionId)   // stable, separate ids per line
  })
  it('multiple quantities of one product are one line and one composition; the quantity is preserved on the order', async () => {
    const r = rig(); const { sid, orderId, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 3 }])
    await pick(r, sid, previews[0].previewId); await ensureCompositions(r.deps, U1, sid)
    expect(r.store.compositions.length).toBe(1); expect(r.compose.mock.calls.length).toBe(1)
    expect((await r.store.orderLines(orderId))[0].copies).toBe(3)
  })
  it('a failed generation is retried on its own: the requirement that worked is not made again, and nothing is duplicated', async () => {
    const failing = new Set(['2:3']); const r = rig({ failGenerateFor: failing })
    const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'canvas:8x8', copies: 1 }])
    await pick(r, sid, previews[0].previewId); const g0 = r.generate.mock.calls.length
    await expect(ensureCompositions(r.deps, U1, sid)).rejects.toMatchObject({ code: 'composition_failed' })
    expect(r.store.compositions.map(c => c.line_id)).toEqual(['b'])                                           // the canvas finished
    const composeAfterFirst = r.compose.mock.calls.length
    const v = await ensureCompositions(r.deps, U1, sid)
    expect(r.generate.mock.calls.length).toBe(g0 + 2)                                                        // the failed attempt, then one retry: only the print's requirement
    expect(r.compose.mock.calls.length).toBe(composeAfterFirst + 1)
    expect(v.compositions.every(c => c.status === 'ready')).toBe(true); expect(r.store.compositions.length).toBe(2)
    await ensureCompositions(r.deps, U1, sid); await ensureCompositions(r.deps, U1, sid)
    expect(r.generate.mock.calls.length).toBe(g0 + 2); expect(r.store.compositions.length).toBe(2)           // idempotent from here
  })
  it('a failed composer call is also retried alone', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'canvas:8x8', copies: 1 }])
    await pick(r, sid, previews[0].previewId); r.compose.mockRejectedValueOnce(new Error('outpaint_failed'))
    await expect(ensureCompositions(r.deps, U1, sid)).rejects.toMatchObject({ code: 'composition_failed' })
    expect(r.store.compositions.length).toBe(0)
    expect((await ensureCompositions(r.deps, U1, sid)).compositions[0].status).toBe('ready')
  })
})

describe('line-level approval, correction and fulfilment records on a shared composition', () => {
  const shared = async () => {
    const r = rig(); const x = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'framed:12x18', copies: 2 }])
    await pick(r, x.sid, x.previews[0].previewId); await ensureCompositions(r.deps, U1, x.sid); return { r, ...x }
  }
  it('approving one line leaves the other open, and the order is not released until both lines are approved', async () => {
    const { r, sid, orderId } = await shared()
    const [a, b] = (await getSessionView(r.deps, U1, sid)).compositions
    await approveComposition(r.deps, U1, sid, a.compositionId)
    let v = await getSessionView(r.deps, U1, sid); expect(v.compositions.map(c => c.status)).toEqual(['approved', 'ready'])
    await expect(approveOrder(r.deps, U1, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' }); expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork')
    await approveComposition(r.deps, U1, sid, b.compositionId); v = await approveOrder(r.deps, U1, sid)
    expect(v.order.state).toBe('approved'); expect(r.store.orders.get(orderId)!.status).toBe('paid'); expect(r.deps.kick).toHaveBeenCalledTimes(1)
  })
  it("a line's free correction gives it files of its own and never changes the picture the other line approved", async () => {
    const { r, sid } = await shared()
    const [a, b] = (await getSessionView(r.deps, U1, sid)).compositions; await approveComposition(r.deps, U1, sid, a.compositionId)
    const sharedPath = r.store.compositions.find(c => c.line_id === 'a')!.composed_path
    const g = r.generate.mock.calls.length
    const v = await correctLine(r.deps, U1, sid, 'b')
    expect(r.generate.mock.calls.length).toBe(g + 1)                                                          // the correction is a new generation for that line
    const rowsB = r.store.compositions.filter(c => c.line_id === 'b')
    expect(rowsB.map(c => [c.attempt, c.status])).toEqual([[1, 'superseded'], [2, 'ready']])
    expect(rowsB[1].composed_path).not.toBe(sharedPath); expect(rowsB[1].source_composition_id).toBeNull()
    const rowA = r.store.compositions.find(c => c.line_id === 'a')!
    expect([rowA.status, rowA.composed_path]).toEqual(['approved', sharedPath])                                 // untouched
    expect(v.compositions.map(c => [c.lineId, c.status, c.correctionsRemaining])).toEqual([['a', 'approved', 1], ['b', 'ready', 0]])
    expect(v.compositions[1].compositionId).not.toBe(b.compositionId)
    await expect(correctLine(r.deps, U1, sid, 'b')).rejects.toMatchObject({ code: 'correction_limit' })
  })
  it('fulfilment records stay per line: each approved line still resolves to its own composition record', async () => {
    const { r, sid, orderId } = await shared(); await (async () => { for (const c of (await getSessionView(r.deps, U1, sid)).compositions) await approveComposition(r.deps, U1, sid, c.compositionId) })()
    await approveOrder(r.deps, U1, sid)
    const lines = await r.store.orderLines(orderId); expect(lines.map(l => [l.line_id, l.copies])).toEqual([['a', 1], ['b', 2]])
    const approved = r.store.compositions.filter(c => c.status === 'approved'); expect(approved.map(c => c.line_id).sort()).toEqual(['a', 'b'])
  })
})

describe('six artistic previews per batch, whatever is purchased', () => {
  it('one product or three products of different shapes: still six previews per batch, all generated at the series master aspect, never at a product aspect', async () => {
    for (const lines of [[{ lineId: 'a', productId: 'canvas:8x8', copies: 1 }], [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'canvas:8x8', copies: 2 }, { lineId: 'c', productId: 'premium:16x24', copies: 1 }]] as Line[][]) {
      const r = rig(); const x = await project(r, lines)
      expect(x.previews.length).toBe(6); expect(new Set(x.previews.map(p => p.effectId)).size).toBe(6)
      expect(r.generate).toHaveBeenCalledTimes(6)
      expect(r.generate.mock.calls.every(c => (c[0] as any).aspect === '1:1')).toBe(true)
      const b2 = await startBatch(r.deps, U1, x.sid, { idempotencyKey: 'idem-key-2' }); expect(b2.batch.previews.length).toBe(6)
    }
  })
  it('compositions cost nothing until a favorite is chosen: no composer or product generation runs during the previews', async () => {
    const r = rig(); await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
    expect(r.compose).not.toHaveBeenCalled()
  })
})

describe('the contract Codex consumes', () => {
  it('geometries are available as soon as products are chosen, before payment, with the authoritative requirements', async () => {
    const r = rig(); const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
    const view = await createSession(r.deps, { userId: U1, imageB64: photo })
    const v = await setLines(r.deps, U1, view.sessionId, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'canvas:12x18', copies: 1 }, { lineId: 'c', productId: 'canvas:8x8', copies: 1 }])
    expect(v.geometries.find(g => g.lineId === 'b')).toMatchObject({ pictureAspect: 0.666667, picturePx: { w: 3600, h: 5400 }, requiredPx: { w: 3654, h: 5454 }, wrapPx: { left: 27, right: 27, top: 27, bottom: 27 }, geometryKey: 'a667', sharedWithLineIds: ['a'], method: 'generated', generationAspect: '2:3' })
    expect(v.geometries.find(g => g.lineId === 'c')).toMatchObject({ geometryKey: 'a1000', method: 'deterministic', sharedWithLineIds: [] })
  })
  it('composition ids are stable across reads and survive a retry', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
    await pick(r, sid, previews[0].previewId); const first = (await ensureCompositions(r.deps, U1, sid)).compositions[0].compositionId
    expect((await getSessionView(r.deps, U1, sid)).compositions[0].compositionId).toBe(first)
    expect((await ensureCompositions(r.deps, U1, sid)).compositions[0].compositionId).toBe(first)
  })
  it('customer previews are watermarked JPEGs; clean files never appear in any view', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'canvas:8x8', copies: 1 }])
    await pick(r, sid, previews[0].previewId); const v = await ensureCompositions(r.deps, U1, sid)
    for (const c of v.compositions) { expect(c.previewUrl).toMatch(/\.jpg$/); expect(sharp(r.files.get(c.previewUrl!.replace('https://signed.test/', ''))!).metadata()).resolves.toMatchObject({ format: 'jpeg' }) }
    expect(JSON.stringify(v)).not.toMatch(/\.png|\/masters\/|composed_path|master_path/)
  })
})

describe('reference-image adaptation of the selected favorite', () => {
  it('Portraits sends the selected favorite as the reference image after the photograph', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
    await pick(r, sid, previews[0].previewId); const g = r.generate.mock.calls.length
    await ensureCompositions(r.deps, U1, sid)
    const call = r.generate.mock.calls[g][0] as any
    expect(call.referenceB64).toBeTruthy(); expect(call.referenceB64).not.toBe(call.sourceB64)
  })
  it('Pets takes the favorite as a reference too, and Groups cannot: it regenerates from the photograph alone and the record says so', async () => {
    const pets = rig({ series: 'pets' }); const p = await project(pets, [{ lineId: 'a', productId: 'canvas:8x8', copies: 1 }])
    await pick(pets, p.sid, p.previews[0].previewId); await ensureCompositions(pets.deps, U1, p.sid)
    // Pets previews are 2:3, so a square canvas is a new generation (too far to extend) and the favorite rides along
    expect((pets.store.compositions[0] as any).generation_mode).toBe('favorite_reference')
    const groups = rig({ series: 'groups', people: 4 }); const g = await project(groups, [{ lineId: 'a', productId: 'canvas:8x8', copies: 1 }])
    await pick(groups, g.sid, g.previews[0].previewId); const n = groups.generate.mock.calls.length
    await ensureCompositions(groups.deps, U1, g.sid)
    const call = groups.generate.mock.calls[n][0] as any
    expect(call.referenceB64).toBeUndefined(); expect(groups.store.compositions[0]).toMatchObject({ generation_mode: 'photo_regeneration', generation_aspect: '1:1', nb21_calls: 1 })
  })
  it('a new generation is never assumed identical to the favorite: it is its own ready composition that still needs approval', async () => {
    const r = rig(); const { sid, orderId, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
    await pick(r, sid, previews[0].previewId); const v = await ensureCompositions(r.deps, U1, sid)
    expect(v.compositions[0]).toMatchObject({ status: 'ready', generationMode: 'favorite_reference' })
    await expect(approveOrder(r.deps, U1, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' }); expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork')
  })
  it('the record keeps method, mode, aspect, call counts and the source artwork; cost is null until a unit price is configured', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'framed:12x18', copies: 1 }, { lineId: 'c', productId: 'canvas:8x8', copies: 1 }])
    await pick(r, sid, previews[1].previewId); await ensureCompositions(r.deps, U1, sid)
    const rows = Object.fromEntries(r.store.compositions.map(c => [c.line_id, c]))
    expect(rows.a).toMatchObject({ method: 'generated', generation_mode: 'favorite_reference', generation_aspect: '2:3', nb21_calls: 1, outpaint_calls: 0, cost_usd_est: null, preview_id: previews[1].previewId })
    expect(rows.b).toMatchObject({ generation_mode: 'favorite_reference', nb21_calls: 0, outpaint_calls: 0, source_composition_id: rows.a.id })   // reuse costs nothing of its own
    expect(rows.c).toMatchObject({ method: 'deterministic', generation_mode: 'none', generation_aspect: null, nb21_calls: 0, preview_id: previews[1].previewId })
  })
  it('cost is an estimate from configured unit prices only, never a guess', () => {
    expect(estimateCompositionCost({ nb21: 1, outpaint: 0 }, {})).toBeNull()
    expect(estimateCompositionCost({ nb21: 0, outpaint: 0 }, {})).toBe(0)
    expect(estimateCompositionCost({ nb21: 1, outpaint: 1 }, { GIFT_NB21_COST_USD: '0.07', GIFT_OUTPAINT_COST_USD: '0.04' })).toBe(0.11)
    expect(estimateCompositionCost({ nb21: 1, outpaint: 1 }, { GIFT_NB21_COST_USD: '0.07' })).toBeNull()
  })
  it('a correction is a new generation from the favorite for that line, recorded with its own source, mode and call count', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
    await pick(r, sid, previews[0].previewId); await ensureCompositions(r.deps, U1, sid)
    const g = r.generate.mock.calls.length; await correctLine(r.deps, U1, sid, 'a')
    const call = r.generate.mock.calls[g][0] as any; expect(call.referenceB64).toBeTruthy(); expect(call.productComposition).toBe(true)
    expect(r.store.compositions.find(c => c.line_id === 'a' && c.attempt === 2)).toMatchObject({ generation_mode: 'favorite_reference', generation_aspect: '2:3', nb21_calls: 1, preview_id: previews[0].previewId })
  })
  it('a canvas that fits the favorite is adapted without any model call, and says so', async () => {
    const r = rig(); const { sid, previews } = await project(r, [{ lineId: 'c', productId: 'canvas:8x8', copies: 1 }])
    await pick(r, sid, previews[0].previewId); const g = r.generate.mock.calls.length
    const v = await ensureCompositions(r.deps, U1, sid)
    expect(r.generate.mock.calls.length).toBe(g); expect(v.compositions[0]).toMatchObject({ generationMode: 'none', method: 'deterministic' })
  })
})

describe('retention', () => {
  it('shared composition files are removed once and none are left behind when the session is cleaned up', async () => {
    const r = rig(); const { sid, orderId, previews } = await project(r, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'framed:12x18', copies: 1 }])
    await pick(r, sid, previews[0].previewId); await ensureCompositions(r.deps, U1, sid)
    await r.store.releaseSession(orderId); r.store.sessions.get(sid)!.expires_at = new Date(Date.now() - 1000).toISOString()
    await purgeExpired(r.deps)
    const removed = (r.deps.storage.remove as any).mock.calls.flat(2) as string[]
    expect(new Set(removed).size).toBe(removed.length)                                                        // no path twice
    expect([...r.files.keys()].filter(k => k.includes(sid))).toEqual([])
  })
})

void (null as unknown as CanonicalProduct); void masterDims
