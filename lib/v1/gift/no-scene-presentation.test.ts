// ANY selected artwork -> ANY supported product -> adaptation where needed -> review and approval. A missing in-situ photograph affects only HOW the product is previewed: the exact
// product-shaped artwork, labelled as such, never a template picture of a product and never a reason a product cannot be bought or approved. Default presentation (no legacy env).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { purchasedItems, purchasedLines } from './test-order'
import { createSession, setLines, startBatch, getSessionView } from './service'
import { memoryGiftStore } from './store'
import { selectArtwork, ensureCompositions, approveComposition, finalizeOrder } from './compose'
import { getProductPreview } from './product-preview'
import { getLineMockup } from './mockup'
import { getProductAvailability } from './availability'
import { allProducts } from '../print/catalog'
import { ARTWORK_ONLY_DISCLOSURE } from './presentation'
import { realSceneRenderer } from './mockup-real'

const U1 = '10000000-0000-4000-8000-000000000001'
const SQUARE_COLOR = { r: 200, g: 40, b: 40 }

function rig(series: 'portraits' | 'groups' = 'portraits', people: number | null = null) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const render = vi.fn(async () => { throw new Error('a template renderer must not be used') }), revision = vi.fn(async () => 'legacy-rev')
  const deps: any = {
    store, draftCompositions: false,
    storage: { put: async (p: string, b: Buffer) => { files.set(p, b) }, get: async (p: string) => files.get(p) ?? null, remove: async () => {}, signedUrl: async (p: string) => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: async () => ({ status: 'supported', series, peopleCount: people }),
    generate: async () => ({ imageB64: (await sharp({ create: { width: 800, height: 800, channels: 3, background: SQUARE_COLOR } }).png().toBuffer()).toString('base64') }),
    watermark: async (b64: string) => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    compose: async (i: { size: string }) => { const m = i.size.split('x').map(Number), h = m[0] === m[1] ? 400 : Math.round(400 * m[1] / m[0]); return { image: await sharp({ create: { width: 400, height: h, channels: 3, background: SQUARE_COLOR } }).png().toBuffer(), width: 400, height: h, fit: 'exact' as const, outpainted: false } },
    mockup: { render, revision, scenes: realSceneRenderer },
    kick: vi.fn(async () => ({})),
  }
  return { deps, store, files, render, revision }
}
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
async function withFavorite(r: ReturnType<typeof rig>) {
  const v = await createSession(r.deps, { userId: U1, imageB64: await photo() }); const b = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
  await selectArtwork(r.deps, U1, v.sessionId, b.batch.previews[0].previewId); return v.sessionId
}
let saved: Record<string, string | undefined>
beforeEach(() => { saved = { a: process.env.GIFT_NO_SCENE_PRESENTATION, b: process.env.GIFT_REQUIRE_APPROVED_SCENE, c: process.env.GIFT_SCENE_MOCKUPS }; delete process.env.GIFT_NO_SCENE_PRESENTATION; delete process.env.GIFT_REQUIRE_APPROVED_SCENE; delete process.env.GIFT_SCENE_MOCKUPS })
afterEach(() => { for (const [k, n] of [['a', 'GIFT_NO_SCENE_PRESENTATION'], ['b', 'GIFT_REQUIRE_APPROVED_SCENE'], ['c', 'GIFT_SCENE_MOCKUPS']] as const) { if (saved[k] === undefined) delete process.env[n]; else process.env[n] = saved[k] } })

describe('availability: three separate answers per product', () => {
  it('every launch product is purchasable for any artwork; shape and photography never decide it; the disabled ones say why', async () => {
    const r = rig(); const sid = await withFavorite(r); const a = await getProductAvailability(r.deps, U1, sid)
    const launch = allProducts().filter(p => p.status === 'launch'); expect(launch).toHaveLength(40)          // 32 Print Shop products + the 8 Matted Frame and Framed Canvas squares
    for (const p of launch) { const x = a.products.find(y => y.productId === p.productId)!; expect(x, p.productId).toMatchObject({ purchasable: true, disabledReason: null, approval: { possible: true } }); expect(x.adaptation, p.productId).not.toBeNull() }
    for (const id of ['matted:12x18', 'framed_canvas:12x18', 'mug:11oz', 'card:7x5']) expect(a.products.find(y => y.productId === id)).toMatchObject({ purchasable: false, adaptation: null, approval: { possible: false } })
    expect(a.products.find(y => y.productId === 'matted:12x18')!.disabledReason).not.toBeNull()
  })
  it('the preview basis is data: a scene where a photograph truthfully shows the configuration, otherwise the product-shaped artwork with a disclosure; neither changes purchasability', async () => {
    const r = rig(); const sid = await withFavorite(r); const a = await getProductAvailability(r.deps, U1, sid); const by = (id: string) => a.products.find(p => p.productId === id)!
    for (const id of ['fine_art:12x18', 'fine_art:8x8', 'premium:12x12', 'canvas:20x20']) expect(by(id).preview, id).toMatchObject({ representation: 'scene', physicalProductShown: true, previewBasis: 'in_situ_mockup', disclosureCode: null })
    for (const id of ['framed:12x12', 'framed:12x18', 'premium:12x18', 'canvas:12x18', 'canvas:8x12']) expect(by(id).preview, id).toMatchObject({ representation: 'artwork_only', sceneId: null, physicalProductShown: false, previewBasis: 'product_shaped_artwork', disclosureCode: 'artwork_only_preview', disclosure: ARTWORK_ONLY_DISCLOSURE })
    process.env.GIFT_SCENE_MOCKUPS = '0'; const off = await getProductAvailability(r.deps, U1, sid)
    expect(off.products.filter(p => p.purchasable).map(p => p.productId)).toEqual(a.products.filter(p => p.purchasable).map(p => p.productId)); expect(off.products.filter(p => p.purchasable).every(p => p.preview.representation === 'artwork_only')).toBe(true)
  })
  it('adaptation per product for THIS artwork: a square portrait master needs nothing for squares and one NB2.1 generation for portrait products; a Groups master (3:2) needs generations for both', async () => {
    const r = rig(); const sid = await withFavorite(r); const a = await getProductAvailability(r.deps, U1, sid); const by = (id: string) => a.products.find(p => p.productId === id)!
    expect(by('canvas:12x12').adaptation).toMatchObject({ required: false, method: 'none', paidCalls: { nb21: 0, outpaint: 0 }, originalPreserved: true })
    expect(by('framed:12x18').adaptation).toMatchObject({ required: true, method: 'generated', generationAspect: '2:3', paidCalls: { nb21: 1 }, originalPreserved: true })
    const g = rig('groups', 5); const gs = await withFavorite(g); const ga = await getProductAvailability(g.deps, U1, gs); const gb = (id: string) => ga.products.find(p => p.productId === id)!
    expect(gb('fine_art:12x18').adaptation).toMatchObject({ method: 'generated', generationAspect: '2:3' }); expect(gb('fine_art:12x12').adaptation).toMatchObject({ method: 'generated', generationAspect: '1:1' })
  })
  it('orientation support is reported as data: square and portrait are supported; landscape is not (no verified Prodigi landscape SKU)', async () => {
    const r = rig(); const sid = await withFavorite(r); const a = await getProductAvailability(r.deps, U1, sid)
    expect(a.orientations).toEqual({ square: { supported: true, reason: null }, portrait: { supported: true, reason: null }, landscape: { supported: false, reason: 'no_landscape_sku_verified_with_prodigi' } })
    expect(a.products.filter(p => p.purchasable).some(p => p.orientation === 'landscape')).toBe(false)
  })
})

describe('pre-checkout preview without a photograph: the exact product-shaped artwork, never a product picture', () => {
  it('a product no scene shows is previewed as the favorite in the product\'s shape (artwork-only), watermarked, with the disclosure; no template renderer runs', async () => {
    const r = rig(); const sid = await withFavorite(r)
    const v: any = await getProductPreview(r.deps, U1, sid, 'framed:12x12'); expect(v).toMatchObject({ status: 'ready', renderer: 'artwork', representation: 'artwork_only', physicalProductShown: false, previewBasis: 'product_shaped_artwork', disclosureCode: 'artwork_only_preview', disclosure: ARTWORK_ONLY_DISCLOSURE, watermarked: true, productionPrintFile: false, purchaseAuthorization: false, sceneId: null })
    expect(r.render).not.toHaveBeenCalled(); expect(r.revision).not.toHaveBeenCalled()
    const stored = [...r.files.entries()].find(([k]) => v.url.endsWith(k))![1]; const m = await sharp(stored).metadata(); expect(m.format).toBe('jpeg'); expect(m.width! / m.height!).toBeCloseTo(1, 2)
    const { data } = await sharp(stored).resize(1, 1).raw().toBuffer({ resolveWithObject: true }); expect(Math.abs(data[0] - SQUARE_COLOR.r)).toBeLessThan(30); expect(Math.abs(data[1] - SQUARE_COLOR.g)).toBeLessThan(30)      // the artwork itself, no frame, wall or product imagery
    expect((await getProductPreview(r.deps, U1, sid, 'framed:12x12') as any).cached).toBe(true)
  })
  it('a different shape than the favorite: adaptation_required with the numbers, or (opt-in) provisional on a neutral surround, also artwork-only; a scene product keeps its scene', async () => {
    const r = rig(); const sid = await withFavorite(r)
    expect(await getProductPreview(r.deps, U1, sid, 'framed:12x18')).toMatchObject({ status: 'adaptation_required', reason: 'shape_needs_composition', method: 'generated' })
    const p: any = await getProductPreview(r.deps, U1, sid, 'framed:12x18', { provisional: true }); expect(p).toMatchObject({ status: 'provisional', renderer: 'artwork', provisional: { representation: 'artwork_only', physicalProductShown: false, finalComposition: 'generated' } })
    expect(await getProductPreview(r.deps, U1, sid, 'canvas:12x12')).toMatchObject({ status: 'ready', renderer: 'scene', representation: 'scene' })
    expect(await getProductPreview(r.deps, U1, sid, 'mug:11oz')).toMatchObject({ status: 'not_available', reason: 'product_not_available' })
  })
})

describe('approval without in-situ photography: purchase, composition, review, approval, finalize', () => {
  const LINES = [{ lineId: 'a', productId: 'framed:12x18', copies: 1 }, { lineId: 'b', productId: 'premium:12x18', copies: 1 }, { lineId: 'c', productId: 'canvas:12x12', copies: 1 }]
  async function paid(r: ReturnType<typeof rig>) {
    const sid = await withFavorite(r); await setLines(r.deps, U1, sid, LINES)                          // framed and premium portraits have no approved scene and are accepted
    const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
    r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: purchasedItems(LINES), prodigi_order_id: null, placed_at: null, owner_key: U1 } as any)
    await r.store.linkOrder(sid, U1, orderId, 'v1'); await r.store.confirmOrder({ sessionId: sid, orderId, userId: U1, stripeSessionId: cs, paymentIntent: 'pi_1', lines: purchasedLines(LINES) })
    return { sid, orderId }
  }
  it('each composed line is shown as its exact product-shaped artwork (clean, since paid) or its scene; approval and finalize need no photograph and no template; nothing is released', async () => {
    const r = rig(); const { sid, orderId } = await paid(r); const v = await ensureCompositions(r.deps, U1, sid); expect(v.compositions.every(c => c.status === 'ready')).toBe(true)
    const a: any = await getLineMockup(r.deps, U1, sid, 'a'), b: any = await getLineMockup(r.deps, U1, sid, 'b'), c: any = await getLineMockup(r.deps, U1, sid, 'c')
    for (const m of [a, b]) expect(m).toMatchObject({ renderer: 'artwork', representation: 'artwork_only', physicalProductShown: false, previewBasis: 'product_shaped_artwork', disclosureCode: 'artwork_only_preview', watermarked: false, productionPrintFile: false, purchaseAuthorization: false })
    expect(c).toMatchObject({ renderer: 'scene', representation: 'scene', physicalProductShown: true, previewBasis: 'in_situ_mockup' })
    for (const m of [a, b]) expect(m.width / m.height).toBeCloseTo(2 / 3, 2)                          // the product's own shape
    expect(r.render).not.toHaveBeenCalled(); expect(((await getLineMockup(r.deps, U1, sid, 'a')) as any).cached).toBe(true)
    for (const comp of r.store.compositions.filter(x => x.status === 'ready')) await approveComposition(r.deps, U1, sid, comp.id)
    const done = await finalizeOrder(r.deps, U1, sid); expect(done.order).toMatchObject({ state: 'approved', manufacturing: 'not_released' }); expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork'); expect(r.deps.kick).not.toHaveBeenCalled()
  })
  it('corrections are unchanged: one free correction per line, spent by the customer, not by the missing photograph', async () => {
    const r = rig(); const { sid } = await paid(r); await ensureCompositions(r.deps, U1, sid)
    const view = await getSessionView(r.deps, U1, sid); expect(view.compositions.map(c => c.correctionsRemaining)).toEqual([1, 1, 1])
  })
})
