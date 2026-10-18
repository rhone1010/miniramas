// The four Gift Shop products (matted frame, framed canvas, 11 oz mug, 7 x 5 card) end to end on the in-memory store, with the owner's launch gates opened for the
// test only: select -> composition -> clean mockup input -> approval -> the print file the lab would receive. Nothing here is paid or sent anywhere.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'

vi.mock('../shared/outpaint', () => ({
  // a stand-in for the paid extension: adds the requested sides in mid grey so the test can tell original pixels from generated ones
  outpaint: async (i: any) => ({ outpainted: true, image: await sharp({ create: { width: i.width + i.padding.left + i.padding.right, height: i.height + i.padding.up + i.padding.down, channels: 3, background: '#808080' } }).jpeg().toBuffer() }),
}))

const U1 = '10000000-0000-4000-8000-000000000001'
const ALL = ['matted', 'framed_canvas', 'mug', 'card']

/** A fresh module world in which the owner has approved prices, templates and launch for the four families. */
async function world() {
  vi.resetModules()
  vi.doMock('../print/gift-enablement', () => ({ GIFT_ENABLED_FAMILIES: ALL, GIFT_MOCKUP_READY: ALL, GIFT_PRODUCT_HOLDS: {} }))
  const skuMap = await import('../print/sku-map')
  for (const f of ALL) for (const e of Object.values(skuMap.SKU_MAP[f as 'matted']) as any[]) { delete e.retailApproved; e.retailCents = 5000 }      // test prices only
  const [catalog, service, store, compose, mockup, frozen, orderKind, profiles, layout, testOrder] = await Promise.all([
    import('../print/catalog'), import('./service'), import('./store'), import('./compose'), import('./mockup'), import('./frozen'), import('./order-kind'),
    import('../print/upscale/profiles'), import('../print/product-layout'), import('./test-order'),
  ])
  return { skuMap, catalog, service, store, compose, mockup, frozen, orderKind, profiles, layout, testOrder }
}

async function journey(W: Awaited<ReturnType<typeof world>>, productId: string) {
  const { service, store, compose, mockup, testOrder } = W
  const memory = store.memoryGiftStore(), files = new Map<string, Buffer>(), renders: Array<{ templateId: string; w: number; h: number; sku: string }> = []
  const generate = vi.fn(async (i: { aspect: string }) => { const [w, h] = i.aspect.split(':').map(Number); return { imageB64: (await sharp({ create: { width: 512 * w, height: 512 * h, channels: 3, background: '#c63' } }).png().toBuffer()).toString('base64') } })
  const renderer: import('./mockup').MockupRenderer = {
    revision: async () => 'rev-1',
    render: async i => { const m = await sharp(i.artwork).metadata(); renders.push({ templateId: i.templateId, w: m.width!, h: m.height!, sku: i.sku }); const p = W.catalog.getProductBySku(i.sku)!
      return { png: await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ddd' } }).png().toBuffer(), width: 400, height: 300, visualizationKey: 'vk', configuration: { sku: p.sku, requiredPx: p.requirements.finalPx }, crop: null } },
  }
  const deps: import('./service').GiftDeps = {
    store: memory, generate, compose: compose.composeWithPrintShop, mockup: renderer,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(), kick: vi.fn(async () => ({})),
  }
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const view = await service.createSession(deps, { userId: U1, imageB64: photo }); const sid = view.sessionId
  const lines = [{ lineId: 'a', productId, copies: 1 }]
  await service.setLines(deps, U1, sid, lines)                                                        // refused ('product_not_available') while the product is disabled: see the next describe
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
  memory.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: testOrder.purchasedItems(lines), prodigi_order_id: null, placed_at: null })
  await memory.linkOrder(sid, U1, orderId, 'v1')
  await memory.confirmOrder({ sessionId: sid, orderId, userId: U1, stripeSessionId: cs, paymentIntent: 'pi_1', lines: testOrder.purchasedLines(lines) })
  const batch = await service.startBatch(deps, U1, sid, { idempotencyKey: 'idem-key-1' })
  await compose.selectArtwork(deps, U1, sid, batch.batch.previews[0].previewId)
  return { deps, memory, files, sid, orderId, renders, generate }
}

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.doUnmock('../print/gift-enablement'); vi.resetModules() })

for (const productId of ['matted:8x8', 'matted:12x18', 'framed_canvas:8x8', 'framed_canvas:12x18', 'mug:11oz', 'card:7x5']) {
  describe(productId, () => {
    it('composes at its own shape, shows a mockup built from that composition, and its approved composition becomes exactly the lab file', async () => {
      const W = await world(), { compose, mockup, frozen, orderKind, profiles, catalog } = W
      const product = catalog.getProduct(productId)!
      expect(product.status).toBe('launch')
      const J = await journey(W, productId)

      // composition: product-specific, and the shape the product needs (never the Print Shop's turned shape)
      await compose.ensureCompositions(J.deps, U1, J.sid)
      const comp = J.memory.compositions[0]
      expect(frozen.compositionFitsProduct(comp, product)).toBe(true); expect((comp.plan as any).sku).toBe(product.sku)
      const m = await sharp(J.files.get(comp.composed_path!)!).metadata()
      expect(m.width! / m.height!).toBeCloseTo(product.requirements.pictureAspect, 2)

      // the mockup: the renderer is given what the product needs and the clean mockup is returned for a paid line. Matted frame and framed canvas have NO
      // template yet (Codex builds them): the review image cannot be made, which is why their mockup gate stays closed in gift-enablement.ts.
      if (!mockup.templateFor(product)) {
        expect(['matted', 'framed_canvas']).toContain(product.family)
        await expect(mockup.getLineMockup(J.deps, U1, J.sid, 'a')).rejects.toMatchObject({ code: 'product_not_available' })
      } else {
        const out = await mockup.getLineMockup(J.deps, U1, J.sid, 'a')
        expect(out).toMatchObject({ sku: product.sku, watermarked: false, productionPrintFile: false, purchaseAuthorization: false })
        const r = J.renders[0]; expect(r.sku).toBe(product.sku); expect(r.templateId).toBe(mockup.templateFor(product))
        if (product.family === 'mug') expect([r.w, r.h]).toEqual([1335, 555])
        if (product.family === 'card') expect([r.w, r.h]).toEqual([750, 1050])
      }

      // approval, then the print file: the profile builds exactly the lab file and its picture region is the approved composition
      await compose.approveComposition(J.deps, U1, J.sid, comp.id); await compose.approveOrder(J.deps, U1, J.sid)
      const { loadApprovedCompositionWith } = await import('./print-source')
      const source = await loadApprovedCompositionWith(J.memory, J.deps.storage, { id: J.orderId }, { render_id: orderKind.giftRenderId(J.sid, 'a'), item_index: 0 })
      const job: any = { id: 'job', finish: product.family, size: product.size, sku: product.sku }
      const profile = profiles.profileFor(job), prep = await profile.prepare({ job, source, ppi: 300 })
      const full = { ...job, input_w: prep.width, input_h: prep.height, required_front_w: prep.requiredFront.w, required_front_h: prep.requiredFront.h }
      const front = prep.requiredFront                                                                          // a stand-in for the upscaler: resample to a little over what it was asked for
      const image = prep.scale ? await sharp(prep.working).resize(front.w + 2, front.h + 2, { kernel: 'lanczos3', fit: 'fill' }).png().toBuffer() : prep.working
      const done = await profile.finish({ job: full, image, upscaled: !!prep.scale, targetMp: 30 })
      expect(done.expected).toEqual(product.requirements.finalPx)
      expect(await sharp(done.jpeg).metadata()).toMatchObject({ format: 'jpeg', width: product.requirements.finalPx.w, height: product.requirements.finalPx.h })
      const qa = await sharp(await profile.qaRegion({ job: full, final: done.jpeg })).metadata()
      expect([qa.width, qa.height]).toEqual([product.requirements.picturePx.w, product.requirements.picturePx.h])
    }, 120_000)
  })
}

describe('the four products are visible but cannot be bought until the owner opens them', () => {
  it('stay in the catalog as disabled with the first open item as the reason, and no price', async () => {
    const { allProducts, getProduct } = await import('../print/catalog')
    for (const id of ['matted:8x8', 'matted:12x18', 'framed_canvas:8x8', 'framed_canvas:12x18', 'mug:11oz', 'card:7x5']) {
      const p = getProduct(id)!; expect(p.status).toBe('disabled'); expect(p.disabledReason).toBeTruthy()
    }
    expect(getProduct('matted:8x8')!.retailCents).toBe(9400)                       // the existing square prices are kept
    expect(getProduct('matted:12x18')!.retailCents).toBeNull(); expect(getProduct('mug:11oz')!.retailCents).toBeNull(); expect(getProduct('card:7x5')!.retailCents).toBeNull()
    expect(getProduct('framed_canvas:8x12')!.disabledReason).toBe('orientation_unverified')
    expect(allProducts().filter(p => p.status === 'launch').every(p => ['fine_art', 'premium', 'canvas', 'framed'].includes(p.family))).toBe(true)
  })
  it('a line for any of them is refused at selection, so checkout never sees one', async () => {
    const service = await import('./service'), store = await import('./store')
    const memory = store.memoryGiftStore(), deps: any = { store: memory, storage: { put: async () => {}, get: async () => null, remove: async () => {}, signedUrl: async () => null }, analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), generate: async () => ({}), watermark: async () => Buffer.alloc(0) }
    const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
    const v = await service.createSession(deps, { userId: U1, imageB64: photo })
    for (const productId of ['matted:8x8', 'framed_canvas:12x18', 'mug:11oz', 'card:7x5']) await expect(service.setLines(deps, U1, v.sessionId, [{ lineId: 'a', productId, copies: 1 }])).rejects.toMatchObject({ code: 'product_not_available' })
  })
  it('the Print Shop never offers them (its catalog is the four launch families)', async () => {
    const { catalogFor } = await import('../print/geometry')
    const text = JSON.stringify(catalogFor(1200, 1800)) + JSON.stringify(catalogFor(1200, 1200))
    for (const k of ['matted', 'framed_canvas', 'mug', 'card']) expect(text).not.toContain(`"${k}"`)
  })
})
