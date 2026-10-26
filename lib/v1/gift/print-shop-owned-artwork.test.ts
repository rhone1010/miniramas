// PRINT SHOP x GIFT SHOP PRODUCT ENGINE: all eight product families bought from artwork the customer ALREADY OWNS (My Collection), through the REAL route handlers
// (lib/v1/gift/handlers.ts, the functions the app/api/v1/gift/* routes call) on the in-memory store:
//
//   Collection -> Product -> Configuration -> Personalized Preview -> Approval -> Cart -> Stripe checkout -> payment confirmed -> final approval -> the print file the lab would receive
//
// What this proves, per the assignment:
//   * the owned artwork is the source, verified by ownership, used directly and never modified (byte-identical before and after)
//   * the customer's ORIGINAL PHOTOGRAPH is not needed: every journey here runs with the photograph deleted (60-day retention)
//   * nothing is generated for products the artwork already fits, and no Gift Shop preview allowance is touched or consumed
//   * a product that would need a generation the session cannot make is unavailable, never cropped or invented
//   * approval and manufacturing release stay separate (the order is not released, and the lab is never called, until the explicit release step)
//   * the artwork is identical through acceptance and manufacturing preparation, except for the explicitly approved product adaptation
//
// PRICES: the four Gift families are launched, but a product is sold only with an approved price and the rectangles, the mug and the card have none yet. world() therefore gives
// those products the PROPOSED prices from docs/GOVERNANCE/GIFT-FOUR-PRODUCTS-2026-10-18.md for this test only, exactly as four-products.test.ts does. Nothing here changes a real price.
// Nothing is paid, nothing is sent to Prodigi and no model is called: Stripe is a fake, outpaint and generation are stand-ins.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { createHash, randomUUID } from 'node:crypto'

vi.mock('../shared/outpaint', () => ({
  // stands in for the paid background extension: mid-grey on the requested sides, so the test can tell original pixels from generated ones
  outpaint: async (i: any) => ({ outpainted: true, image: await sharp({ create: { width: i.width + i.padding.left + i.padding.right, height: i.height + i.padding.up + i.padding.down, channels: 3, background: '#808080' } }).jpeg().toBuffer() }),
}))

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const OWNED = '30000000-0000-4000-8000-000000000001', PORTFOLIO = '40000000-0000-4000-8000-000000000001'
const ADDRESS = { name: 'Ada Lovelace', line1: '1 Main St', city: 'Sonoma', state: 'CA', postcode: '95476', countryCode: 'us' }
const GIFT_FAMILIES = ['matted', 'framed_canvas', 'mug', 'card']
/** TEST-ONLY prices: the proposals in docs/GOVERNANCE/GIFT-FOUR-PRODUCTS-2026-10-18.md section 5, for the products that have no approved price yet. */
const PROPOSED: Record<string, number> = {
  'GLOBAL-CFPM-8X12': 9900, 'GLOBAL-CFPM-12X18': 12900, 'GLOBAL-CFPM-16X24': 14900, 'GLOBAL-CFPM-20X30': 18900,
  'GLOBAL-FRA-CAN-12X18': 11900, 'GLOBAL-FRA-CAN-16X24': 15900, 'GLOBAL-FRA-CAN-20X30': 21900, 'GLOBAL-MUG-W': 1900, 'GLOBAL-GRE-MOH-7X5-BLA': 700,
}

/** A picture with structure everywhere (so "identical" means something): a diagonal gradient with a hard-edged block. */
async function artwork(w: number, h: number): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 3, block = x > w * 0.3 && x < w * 0.6 && y > h * 0.2 && y < h * 0.5; raw[i] = block ? 240 : (x * 255 / w) | 0; raw[i + 1] = (y * 255 / h) | 0; raw[i + 2] = block ? 20 : ((x + y) * 255 / (w + h)) | 0 }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}
const pixels = async (b: Buffer) => { const { data, info } = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height } }
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const req = (body: unknown, url = 'https://x.test/api') => new Request(url, { method: 'POST', body: JSON.stringify(body) })
const read = async (r: Response) => ({ status: r.status, body: await r.json() })

async function world() {
  vi.resetModules()
  const skuMap = await import('../print/sku-map')
  for (const f of GIFT_FAMILIES) for (const e of Object.values(skuMap.SKU_MAP[f as 'matted']) as any[]) if (e.retailApproved === false) { delete e.retailApproved; e.retailCents = PROPOSED[e.sku] }
  const [catalog, handlers, service, store, compose, orders, profiles, printSource, orderKind, layout] = await Promise.all([
    import('../print/catalog'), import('./handlers'), import('./service'), import('./store'), import('./compose'), import('./orders'),
    import('../print/upscale/profiles'), import('./print-source'), import('./order-kind'), import('../print/product-layout'),
  ])
  return { skuMap, catalog, handlers, service, store, compose, orders, profiles, printSource, orderKind, layout }
}
type W = Awaited<ReturnType<typeof world>>

async function rig(W: W, o: { art: Buffer; width: number; height: number; series?: 'portraits' | 'pets' | 'groups'; photo: boolean }) {
  const store = W.store.memoryGiftStore(), files = new Map<string, Buffer>()
  files.set('portraits/owned.png', o.art)                                                          // the owned original, as My Collection stores it: must survive everything below
  store.ownedArtwork.set(OWNED, { userId: U1, portfolioId: PORTFOLIO, series: o.series ?? 'portraits', preset: 'bronze', unlocked: true, done: true })
  const photo = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()
  const generate = vi.fn(async (i: { aspect: string }) => { const [a, b] = i.aspect.split(':').map(Number); return { imageB64: (await sharp({ create: { width: 256 * a, height: 256 * b, channels: 3, background: '#c63' } }).png().toBuffer()).toString('base64') } })
  const analyze = vi.fn(async () => ({ status: 'supported', series: o.series ?? 'portraits', peopleCount: null }) as any)
  const kick = vi.fn(async () => ({}))
  const gift: import('./service').GiftDeps = {
    store, draftCompositions: true, generate, analyze, kick, compose: W.compose.composeWithPrintShop,
    collection: { resolve: async (u, id) => { const a = store.ownedArtwork.get(id); if (!a || a.userId !== u) throw new Error('owned_artwork_required'); return { previewId: id, portfolioId: a.portfolioId, series: a.series as any, preset: a.preset, bytes: o.art, width: o.width, height: o.height, sourcePhoto: o.photo ? photo : null } } },
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null) },
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    mockup: { revision: async () => 'rev-1', render: async () => { throw new Error('the artwork-only presentation needs no template renderer') } },
  }
  // fake Stripe test mode: sessions by id; nothing leaves the process
  const sessions = new Map<string, any>(); let n = 0
  const stripe: any = { checkout: { sessions: {
    create: vi.fn(async (p: any) => { const id = 'cs_test_print' + String(++n).padStart(8, '0'); const s = { id, status: 'open', client_secret: 'secret_' + id, payment_status: 'unpaid', mode: 'payment', currency: 'usd', metadata: p.metadata, params: p, amount_total: p.line_items.reduce((t: number, l: any) => t + l.price_data.unit_amount * l.quantity, 0) }; sessions.set(id, s); return s }),
    retrieve: vi.fn(async (id: string) => sessions.get(id)), expire: vi.fn(async (id: string) => { const s = sessions.get(id); s.status = 'expired'; return s }),
    listLineItems: vi.fn(async (id: string) => ({ has_more: false, data: sessions.get(id).params.line_items.map((l: any) => ({ amount_total: l.price_data.unit_amount * l.quantity })) })),
  } } }
  const printOrders = {
    async create(i: any) { const id = randomUUID(); store.orders.set(id, { id, status: 'created', paid_at: null, stripe_session_id: i.stripeSessionId, stripe_payment_intent: null, retail_total_cents: i.retailTotalCents, retail_shipping_cents: i.retailShippingCents, items: i.items, prodigi_order_id: null, placed_at: null, customer_email: i.customerEmail, shipping_address: i.shippingAddress, shipping_method: i.shippingMethod, prodigi_merchant_ref: i.prodigiMerchantRef } as any); return { id } },
    async updateUnpaid() { return true },
  }
  const quote = vi.fn(async (_r: any) => ({ outcome: 'Ok', quotes: [{ costSummary: { shipping: { amount: '6.85', currency: 'USD' } } }] }) as any)
  const orderDeps = { gift, store, stripe, printOrders, quote, canFulfil: vi.fn(async () => true), publishableKey: 'pk_test_x', requireReviewedCompositions: true } as any
  const pay = (id: string) => { const s = sessions.get(id); s.payment_status = 'paid'; s.status = 'complete'; s.payment_intent = 'pi_test_1' }
  const ownedSnapshot = () => JSON.stringify([[...store.ownedArtwork.entries()], sha(files.get('portraits/owned.png')!)])
  return { gift, store, files, generate, analyze, kick, stripe, orderDeps, quote, pay, ownedSnapshot }
}
type R = Awaited<ReturnType<typeof rig>>

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.resetModules() })

/** The whole journey for a list of products, through the handlers. Returns what the assertions need. */
async function journey(W: W, R: R, productIds: string[]) {
  const H = W.handlers, user = { id: U1 }, dump = async (r: Response) => read(r)
  // 1. Collection: the owned piece becomes the session's favorite. Nothing is generated, nothing is charged, the owned piece is read only.
  const created = await dump(await H.createCollectionSessionH(req({ previewId: OWNED }), user, R.gift)); expect(created.status).toBe(201)
  const sid: string = created.body.sessionId
  // 2. Product: what this artwork can become
  const avail = await dump(await H.availabilityH(user, R.gift, sid)); expect(avail.status).toBe(200)
  // 3. Configuration: the lines (the server takes price, SKU and size from the catalog, never from the browser)
  const lines = productIds.map((productId, i) => ({ lineId: 'l' + i, productId, copies: 1 }))
  const set = await dump(await H.setLinesH(req({ lines }), user, R.gift, sid)); expect(set.status, JSON.stringify(set.body)).toBe(200)
  // 4. Personalized preview, before any payment
  const previews: Record<string, any> = {}
  for (const id of productIds) { const p = await dump(await H.productPreviewH(new Request('https://x.test/api?productId=' + encodeURIComponent(id)), user, R.gift, sid)); expect(p.status).toBe(200); previews[id] = p.body }
  // 5. Approval of each product-specific composition (the draft compositions of the approved journey)
  const comps = await dump(await H.compositionsH(user, R.gift, sid)); expect(comps.status, JSON.stringify(comps.body)).toBe(200)
  const approvals = []
  for (const c of comps.body.compositions) { expect(c.state).toBe('ready'); const a = await dump(await H.approveCompositionH(user, R.gift, sid, c.compositionId)); expect(a.status).toBe(200); approvals.push(c) }
  const afterApproval = await dump(await H.getSessionH(user, R.gift, sid))
  // 6. Cart -> Stripe checkout. Refused unless every line has an approved composition (the deps say reviewed compositions are required).
  const checkout = await dump(await H.checkoutH(req({ email: 'ada@example.test', shippingAddress: ADDRESS, disclosureAccepted: true, disclosureVersion: W.orders.DISCLOSURE.version, returnPath: '/gift-wizard' }), user, R.orderDeps, sid))
  expect(checkout.status, JSON.stringify(checkout.body)).toBe(200)
  return { sid, created: created.body, avail: avail.body, set: set.body, previews, comps: comps.body, afterApproval: afterApproval.body, checkout: checkout.body, lines }
}

async function payAndFinalize(W: W, R: R, sid: string, stripeSessionId: string) {
  const H = W.handlers, user = { id: U1 }
  R.pay(stripeSessionId)
  const confirmed = await read(await H.orderConfirmH(req({ stripeSessionId }), user, R.orderDeps, R.gift)); expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200); expect(confirmed.body.confirmed).toBe(true)
  const finalized = await read(await H.finalizeOrderH(user, R.gift, sid)); expect(finalized.status, JSON.stringify(finalized.body)).toBe(200)
  return { confirmed: confirmed.body, finalized: finalized.body }
}

/** The lab file for one purchased line, built the way the manufacturing preparation builds it (profile.prepare, a resampling stand-in for the paid upscaler, profile.finish). */
async function labFile(W: W, R: R, sid: string, orderId: string, lineId: string, lineIndex: number, product: import('../print/catalog').CanonicalProduct) {
  const source = await W.printSource.loadApprovedCompositionWith(R.store, R.gift.storage, { id: orderId }, { render_id: W.orderKind.giftRenderId(sid, lineId), item_index: lineIndex })
  const job: any = { id: 'job', finish: product.family, size: product.size, sku: product.sku }
  const profile = W.profiles.profileFor(job), prep = await profile.prepare({ job, source, ppi: 300 })
  const full = { ...job, input_w: prep.width, input_h: prep.height, required_front_w: prep.requiredFront.w, required_front_h: prep.requiredFront.h }
  const image = prep.scale ? await sharp(prep.working).resize(prep.requiredFront.w + 2, prep.requiredFront.h + 2, { kernel: 'lanczos3', fit: 'fill' }).png().toBuffer() : prep.working
  const done = await profile.finish({ job: full, image, upscaled: !!prep.scale, targetMp: 30 })
  return { source, jpeg: done.jpeg, expected: done.expected, region: await profile.qaRegion({ job: full, final: done.jpeg }), prepared: prep }
}

/** Mean absolute difference per channel between two pictures, after bringing the larger to the smaller's size. */
async function difference(a: Buffer, b: Buffer): Promise<number> {
  const ma = await sharp(a).metadata(), mb = await sharp(b).metadata(), w = Math.min(ma.width!, mb.width!), h = Math.min(ma.height!, mb.height!)
  const A = await pixels(await sharp(a).resize(w, h, { fit: 'fill' }).png().toBuffer()), B = await pixels(await sharp(b).resize(w, h, { fit: 'fill' }).png().toBuffer())
  let t = 0; for (let i = 0; i < A.data.length; i++) t += Math.abs(A.data[i] - B.data[i]); return t / A.data.length
}

describe('a square owned artwork, original photograph deleted: six families and the mug', () => {
  const PRODUCTS = ['fine_art:12x12', 'premium:8x8', 'canvas:16x16', 'framed:8x8', 'matted:12x12', 'framed_canvas:8x8', 'mug:11oz']
  it('Collection -> Product -> Configuration -> Preview -> Approval -> Cart -> Stripe -> final approval -> lab file, with the artwork identical throughout and nothing generated', async () => {
    const W = await world(), art = await artwork(1024, 1024), R = await rig(W, { art, width: 1024, height: 1024, photo: false })
    const before = R.ownedSnapshot()
    const J = await journey(W, R, PRODUCTS)

    // the session: the owned artwork alone. No photograph was needed, kept or analysed; nothing to generate; no allowance touched.
    expect(J.created).toMatchObject({ entrance: 'collection', collection: { previewId: OWNED }, masterAspect: '1:1', source: { photoUrl: null } })
    expect(R.analyze).not.toHaveBeenCalled(); expect([...R.files.keys()].some(k => k.endsWith('/source.jpg'))).toBe(false)
    expect(J.created.entitlement).toMatchObject({ freeBatchesUsed: 0, paidPacksAvailable: 0, freeAvailable: false }); expect(J.created.nextBatch).toEqual({ kind: 'blocked', reason: 'collection_session' })
    const startBatch = await read(await W.handlers.startBatchH(req({ idempotencyKey: 'attempt-1234' }), { id: U1 }, R.gift, J.sid)); expect(startBatch).toMatchObject({ status: 409, body: { error: 'collection_session_no_generation' } })

    // availability: every product this artwork can become without a generation is purchasable; the others say why, and are never "cropped to fit"
    const a = new Map<string, any>(J.avail.products.map((p: any) => [p.productId, p]))
    for (const id of PRODUCTS) expect(a.get(id), id).toMatchObject({ purchasable: true, adaptation: { required: false, method: 'none', originalPreserved: true } })
    for (const id of ['fine_art:12x18', 'matted:12x18', 'framed_canvas:12x18', 'card:7x5']) expect(a.get(id), id).toMatchObject({ purchasable: false, disabledReason: 'source_photograph_not_kept' })
    expect(a.get('framed_canvas:8x12')).toMatchObject({ purchasable: false, disabledReason: 'source_photograph_not_kept' })

    // the personalized preview: the artwork as it will be printed, in the product's shape, watermarked, never a purchase authorization
    for (const id of PRODUCTS) expect(J.previews[id], id).toMatchObject({ status: 'ready', watermarked: true, productionPrintFile: false, purchaseAuthorization: false, representation: 'artwork_only' })

    // compositions: every one exact (the owned artwork already has the product's shape), made without a model, and approved before the cart
    expect(R.generate).not.toHaveBeenCalled()
    expect(J.comps.compositions.map((c: any) => [c.productId, c.method, c.fit])).toEqual(PRODUCTS.map(id => [id, 'deterministic', 'exact']))
    expect(J.afterApproval.compositions.every((c: any) => c.state === 'approved')).toBe(true)

    // cart -> Stripe: price, SKU and attributes come from the one catalog; the order is created UNPAID and not releasable
    const products = PRODUCTS.map(id => W.catalog.getProduct(id)!)
    expect(J.checkout.totals).toEqual({ itemsCents: products.reduce((t, p) => t + p.retailCents!, 0), shippingCents: 685, totalCents: products.reduce((t, p) => t + p.retailCents!, 0) + 685 })
    const stripeParams = R.stripe.checkout.sessions.create.mock.calls[0][0]
    expect(stripeParams.line_items.slice(0, PRODUCTS.length).map((l: any) => l.price_data.unit_amount)).toEqual(products.map(p => p.retailCents)); expect(stripeParams.metadata).toMatchObject({ kind: W.orders.GIFT_ORDER_KIND, giftSessionId: J.sid })
    expect(R.quote.mock.calls[0][0].items.map((i: any) => i.sku)).toEqual(products.map(p => p.sku))
    const order = [...R.store.orders.values()][0]; expect(order).toMatchObject({ status: 'created', paid_at: null })

    // payment, then the customer's FINAL APPROVAL: the order is paid and approved, and still NOT released; the lab is untouched
    const { finalized } = await payAndFinalize(W, R, J.sid, J.checkout.stripeSessionId)
    expect(finalized.order).toMatchObject({ state: 'approved', manufacturing: 'not_released', releasedAt: null }); expect(R.store.orders.get(order.id)!.status).toBe('awaiting_artwork'); expect(R.kick).not.toHaveBeenCalled()
    await expect(W.printSource.loadApprovedCompositionWith(R.store, R.gift.storage, { id: order.id }, { render_id: W.orderKind.giftRenderId(J.sid, 'l0'), item_index: 0 })).rejects.toThrow('gift_artwork_not_approved')      // no print source until release
    expect(finalized.collection).toMatchObject({ previewId: OWNED }); expect(finalized.order.unlockPortfolioId).toBe(PORTFOLIO)      // no second My Collection piece was created

    // release is the separate, explicit, operator step; only then does the pipeline read the approved composition
    const released = await W.compose.releaseOrder(R.gift, { operator: 'test-operator', userId: U1, sessionId: J.sid }); expect(released.status).toBe('released'); expect(R.kick).toHaveBeenCalledTimes(1)

    // the artwork through acceptance and manufacturing preparation: the owned pixels, exactly, in every product
    const own = await pixels(art)
    for (let i = 0; i < products.length; i++) {
      const p = products[i], F = await labFile(W, R, J.sid, order.id, 'l' + i, i, p)
      const composed = await pixels(F.source)
      expect([composed.w, composed.h], p.productId).toEqual([own.w, own.h]); expect(Buffer.compare(composed.data, own.data), p.productId + ' composition is the owned artwork, pixel for pixel').toBe(0)
      expect(await sharp(F.jpeg).metadata(), p.productId).toMatchObject({ format: 'jpeg', width: p.requirements.finalPx.w, height: p.requirements.finalPx.h })
      expect(F.expected).toEqual(p.requirements.finalPx)
      const region = await sharp(F.region).metadata(); expect([region.width, region.height], p.productId).toEqual([p.requirements.picturePx.w, p.requirements.picturePx.h])
      expect(await difference(F.region, art), p.productId + ' lab picture vs owned artwork').toBeLessThan(2.5)         // jpeg + resampling only
    }

    // the owned original and everything of the customer's: untouched
    expect(R.ownedSnapshot()).toBe(before); expect(R.generate).not.toHaveBeenCalled(); expect(R.analyze).not.toHaveBeenCalled()
  }, 240_000)
})

describe('a 2:3 owned artwork, original photograph deleted: the rectangles and the card', () => {
  const PRODUCTS = ['fine_art:12x18', 'premium:8x12', 'canvas:16x24', 'framed:20x30', 'matted:12x18', 'framed_canvas:12x18', 'card:7x5']
  it('is adapted only by the bounded extension the Print Shop already has, shows the customer exactly that, and leaves the owned artwork alone', async () => {
    const W = await world(), art = await artwork(1024, 1536), R = await rig(W, { art, width: 1024, height: 1536, series: 'pets', photo: false })
    const before = R.ownedSnapshot()
    const J = await journey(W, R, PRODUCTS)
    expect(J.created).toMatchObject({ masterAspect: '2:3', source: { photoUrl: null } }); expect(R.analyze).not.toHaveBeenCalled()
    const a = new Map<string, any>(J.avail.products.map((p: any) => [p.productId, p]))
    expect(a.get('mug:11oz')).toMatchObject({ purchasable: false, disabledReason: 'source_photograph_not_kept' })              // a tall picture is 50% off the mug's square panel: only a generation could make it
    expect(a.get('fine_art:12x12')).toMatchObject({ purchasable: false, disabledReason: 'source_photograph_not_kept' })
    for (const id of PRODUCTS) expect(a.get(id), id).toMatchObject({ purchasable: true })
    expect(R.generate).not.toHaveBeenCalled()

    // fits: the print shapes are exact; the mount opening and the card are bounded extensions the customer approves
    const byId = Object.fromEntries(J.comps.compositions.map((c: any) => [c.productId, c]))
    for (const id of ['fine_art:12x18', 'premium:8x12', 'canvas:16x24', 'framed:20x30', 'framed_canvas:12x18']) expect(byId[id], id).toMatchObject({ method: 'deterministic', fit: 'exact' })
    for (const id of ['matted:12x18', 'card:7x5']) expect(byId[id], id).toMatchObject({ method: 'deterministic', fit: 'extend' })
    for (const id of PRODUCTS) expect(J.previews[id].status, id).toBe(id === 'matted:12x18' || id === 'card:7x5' ? 'adaptation_required' : 'ready')       // an extension is never previewed as if it were the artwork: it needs the real composition

    const { finalized } = await payAndFinalize(W, R, J.sid, J.checkout.stripeSessionId)
    const order = [...R.store.orders.values()][0]; expect(finalized.order.manufacturing).toBe('not_released'); expect(R.kick).not.toHaveBeenCalled()
    await W.compose.releaseOrder(R.gift, { operator: 'test-operator', userId: U1, sessionId: J.sid })
    const own = await pixels(art), products = PRODUCTS.map(id => W.catalog.getProduct(id)!)
    for (let i = 0; i < products.length; i++) {
      const p = products[i], F = await labFile(W, R, J.sid, order.id, 'l' + i, i, p), composed = await pixels(F.source)
      expect(await sharp(F.jpeg).metadata(), p.productId).toMatchObject({ width: p.requirements.finalPx.w, height: p.requirements.finalPx.h })
      if (byId[p.productId].fit === 'exact') { expect(Buffer.compare(composed.data, own.data), p.productId).toBe(0); continue }
      // an approved extension: the owned artwork sits WHOLE inside the composition, pixel for pixel; only the margin is new
      const x = Math.floor((composed.w - own.w) / 2), y = Math.floor((composed.h - own.h) / 2), inner = await pixels(await sharp(F.source).extract({ left: x, top: y, width: own.w, height: own.h }).png().toBuffer())
      expect(Buffer.compare(inner.data, own.data), p.productId + ' the whole owned artwork is inside the composition, unchanged').toBe(0)
      expect(composed.w * composed.h).toBeGreaterThan(own.w * own.h)
    }
    expect(R.ownedSnapshot()).toBe(before)
  }, 240_000)
})

describe('a square owned artwork whose photograph still exists: a rectangle and the card need the existing generated adaptation', () => {
  it('generates only when the customer asks for the composition of a product that needs it, once, from the existing contract, and marks it as an adaptation of the owned artwork', async () => {
    const W = await world(), art = await artwork(1024, 1024), R = await rig(W, { art, width: 1024, height: 1024, photo: true })
    const before = R.ownedSnapshot()
    const created = await read(await W.handlers.createCollectionSessionH(req({ previewId: OWNED }), { id: U1 }, R.gift)); const sid = created.body.sessionId
    expect(R.analyze).toHaveBeenCalledTimes(1); expect(R.generate).not.toHaveBeenCalled()                 // choosing a session generates nothing
    const avail = await read(await W.handlers.availabilityH({ id: U1 }, R.gift, sid)); const a = new Map<string, any>(avail.body.products.map((p: any) => [p.productId, p]))
    expect(a.get('card:7x5')).toMatchObject({ purchasable: true, adaptation: { required: true, method: 'generated', originalPreserved: true, paidCalls: { nb21: 1 } } })
    expect(a.get('matted:12x18')).toMatchObject({ purchasable: true, adaptation: { method: 'generated' } })
    await read(await W.handlers.setLinesH(req({ lines: [{ lineId: 'a', productId: 'card:7x5', copies: 1 }, { lineId: 'b', productId: 'fine_art:8x8', copies: 1 }] }), { id: U1 }, R.gift, sid))
    for (const id of ['card:7x5', 'fine_art:8x8']) { const p = await read(await W.handlers.productPreviewH(new Request('https://x.test/api?productId=' + id), { id: U1 }, R.gift, sid)); expect(p.body.status).toBe(id === 'card:7x5' ? 'adaptation_required' : 'ready') }
    expect(R.generate).not.toHaveBeenCalled()                                                              // previewing generates nothing either
    const comps = await read(await W.handlers.compositionsH({ id: U1 }, R.gift, sid)); expect(comps.status).toBe(200)
    expect(R.generate).toHaveBeenCalledTimes(1)                                                            // exactly one paid adaptation: the card's; the exact fine art print cost nothing
    expect(R.generate.mock.calls[0][0]).toMatchObject({ productComposition: true, aspect: expect.any(String) })
    const card = comps.body.compositions.find((c: any) => c.productId === 'card:7x5'), print = comps.body.compositions.find((c: any) => c.productId === 'fine_art:8x8')
    expect(card).toMatchObject({ method: 'generated', generationMode: 'favorite_reference', sourceArtworkId: created.body.artworkPreviewId, adaptationValidation: 'provisional', state: 'ready' })
    expect(print).toMatchObject({ method: 'deterministic', fit: 'exact', generationMode: 'none' })
    expect(R.ownedSnapshot()).toBe(before)                                                                 // the adaptation is a separate file; the original is the favorite it was made from
    expect((await read(await W.handlers.getSessionH({ id: U1 }, R.gift, sid))).body.entitlement).toMatchObject({ freeBatchesUsed: 0, paidPacksAvailable: 0 })
  }, 240_000)
})

// OPT-IN, and the only test here that talks to anything outside the process: PRINT_SHOP_LIVE_STRIPE_TEST=1 with a Stripe TEST key (sk_test_...) creates ONE embedded Checkout Session in Stripe's
// test mode for a mixed cart of owned-artwork products (a quote stand-in replaces Prodigi), reads it back from Stripe, and expires it. No card is entered, nothing is paid, no live key is accepted.
describe('Stripe test mode (opt-in)', () => {
  it.skipIf(process.env.PRINT_SHOP_LIVE_STRIPE_TEST !== '1')('creates a real test-mode embedded Checkout Session for the approved owned-artwork cart, with the catalog amounts, then expires it', async () => {
    expect(process.env.STRIPE_SECRET_KEY, 'a Stripe TEST secret key is required').toMatch(/^sk_test_/)
    const W = await world(), art = await artwork(1024, 1024), R = await rig(W, { art, width: 1024, height: 1024, photo: false })
    const { getStripe } = await import('../../store/stripe'), stripe = getStripe()
    R.orderDeps.stripe = stripe; R.orderDeps.requireSandbox = () => { if (!process.env.STRIPE_SECRET_KEY!.startsWith('sk_test_')) throw new Error('stripe_test_mode_required') }
    const PRODUCTS = ['matted:8x8', 'framed_canvas:8x8', 'mug:11oz', 'fine_art:8x8']
    const J = await journey(W, R, PRODUCTS)
    const s = await stripe.checkout.sessions.retrieve(J.checkout.stripeSessionId)
    try {
      const products = PRODUCTS.map(id => W.catalog.getProduct(id)!)
      expect(s).toMatchObject({ livemode: false, mode: 'payment', currency: 'usd', status: 'open', payment_status: 'unpaid', amount_total: J.checkout.totals.totalCents, ui_mode: 'embedded' })
      expect(s.metadata).toMatchObject({ kind: W.orders.GIFT_ORDER_KIND, giftSessionId: J.sid })
      const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 20 })
      expect(items.data.map(l => l.amount_total).sort((a, b) => a - b)).toEqual([...products.map(p => p.retailCents!), 685].sort((a, b) => a - b))
    } finally { await stripe.checkout.sessions.expire(s.id).catch(() => {}) }
  }, 120_000)
})

describe('ownership and gates', () => {
  it('another customer\'s artwork, a piece that is not finished, or an unknown id never starts a session and writes nothing', async () => {
    const W = await world(), art = await artwork(512, 512), R = await rig(W, { art, width: 512, height: 512, photo: false })
    for (const [who, id] of [[U2, OWNED], [U1, '30000000-0000-4000-8000-0000000000ff'], [U1, 'not-a-uuid']] as const) expect(await read(await W.handlers.createCollectionSessionH(req({ previewId: id }), { id: who }, R.gift)), String(id)).toMatchObject({ status: 404, body: { error: 'artwork_not_found' } })
    expect(R.store.sessions.size).toBe(0); expect([...R.files.keys()]).toEqual(['portraits/owned.png'])
  })
  it('a product the artwork cannot become without its deleted photograph is refused at selection and at preview, with a stable code, before anything is paid', async () => {
    const W = await world(), art = await artwork(1024, 1024), R = await rig(W, { art, width: 1024, height: 1024, photo: false })
    const created = await read(await W.handlers.createCollectionSessionH(req({ previewId: OWNED }), { id: U1 }, R.gift)); const sid = created.body.sessionId
    for (const id of ['card:7x5', 'matted:12x18', 'fine_art:12x18']) {
      expect(await read(await W.handlers.setLinesH(req({ lines: [{ lineId: 'x', productId: id, copies: 1 }] }), { id: U1 }, R.gift, sid)), id).toMatchObject({ status: 409, body: { error: 'product_not_available_for_artwork' } })
      expect((await read(await W.handlers.productPreviewH(new Request('https://x.test/api?productId=' + id), { id: U1 }, R.gift, sid))).body, id).toMatchObject({ status: 'not_available', reason: 'product_not_available_for_artwork' })
    }
    expect(R.generate).not.toHaveBeenCalled(); expect(R.stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('a product without an approved price is never offered, selectable or sold, whatever the artwork', async () => {
    vi.resetModules()
    const [catalog, skuMap] = await Promise.all([import('../print/catalog'), import('../print/sku-map')])           // NOT world(): the real, unapproved prices
    for (const id of ['card:7x5-gloss']) { const p = catalog.getProduct(id)!; expect(p.status, id).toBe('disabled'); expect(p.disabledReason).toBe('not_a_launch_candidate'); expect(p.retailCents).toBeNull() }
    expect(catalog.getProduct('framed_canvas:8x12')!.disabledReason).toBeNull()
    expect(catalog.getProduct('matted:8x8')!.status).toBe('launch'); void skuMap
  })
})
