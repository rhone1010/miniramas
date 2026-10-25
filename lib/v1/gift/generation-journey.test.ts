// The product-first journey from generation to the printer's source file: accept -> cart (the accepted picture IS the line's approved composition) -> checkout pins its sha256 -> payment ->
// Final Approval re-verifies it -> release -> the print source is byte-identical and print preparation adds nothing. Plus the one free post-purchase correction, and every way the picture
// could change after approval (all refused). Real service, real checkout, real print preparation; scripted Stripe/Prodigi/model.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { createHash, randomUUID } from 'node:crypto'
import { createGiftCheckout, confirmGiftOrder, DISCLOSURE, type GiftOrderDeps, type PrintOrdersPort } from './orders'
import { createSession, setLines, getSessionView, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { generateMaster } from './real'
import { liveEffectIds } from './effects'
import { chooseEffect, startGeneration, acceptGeneration, gridOf } from './generations'
import { approveComposition, correctLine, ensureCompositions, finalizeOrder, releaseOrder } from './compose'
import { loadApprovedCompositionWith } from './print-source'
import { getProduct } from '../print/catalog'

const U1 = '10000000-0000-4000-8000-000000000001'
const ADDRESS = { name: 'Ada Lovelace', line1: '1 Main St', city: 'Sonoma', state: 'CA', postcode: '95476', countryCode: 'us' }
const BODY = { email: 'ada@example.test', shippingAddress: ADDRESS, disclosureAccepted: true as const, disclosureVersion: DISCLOSURE.version, returnPath: '/gift-wizard' as const }
const key = (n: number | string) => `gen-key-${String(n).padStart(4, '0')}`
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')

/** A real picture (a gradient with detail, so any extension or resample would change pixels) at a requested ratio, slightly off like a model's output. */
async function modelImage(aspect: string, seed = 1) {
  const [a, b] = aspect.split(':').map(Number), h = 1200, w = Math.round(h * (a / b) * 1.006)
  const raw = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 3; raw[o] = (x * 255 / w + seed * 7) & 255; raw[o + 1] = (y * 255 / h) & 255; raw[o + 2] = ((x ^ y) + seed) & 255 }
  return (await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()).toString('base64')
}
let seed = 0
function rig() {
  const store = memoryGiftStore(), files = new Map<string, Buffer>(), calls: Array<{ body: Record<string, any> }> = []
  const state = { fail: false }
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)); calls.push({ body })
    if (state.fail) return { ok: true, status: 200, json: async () => ({ result: { ok: false, fatal_error: 'nb2_failed' } }) } as Response
    const asp = body.output_aspect_ratio ?? body.aspect_ratio ?? body.format ?? '1:1'
    return { ok: true, status: 200, json: async () => ({ result: { ok: true, image_b64: await modelImage(asp, ++seed), passed: true, attempts: [{ passed: true, pass_reason: 'pass' }] } }) } as Response
  })
  const gift: GiftDeps = {
    store, generate: generateMaster, compose: vi.fn() as any, watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => 'https://signed.test/' + p, list: async d => [...files.keys()].filter(k => k.startsWith(d)) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), kick: vi.fn(async () => ({})),
  } as GiftDeps
  const sessions = new Map<string, any>(); let n = 0
  const stripe: any = { checkout: { sessions: {
    create: vi.fn(async (p: any) => { const id = 'cs_test_gift' + String(++n).padStart(8, '0'); const s = { id, status: 'open', client_secret: 'secret_' + id, payment_status: 'unpaid', mode: 'payment', currency: 'usd', metadata: p.metadata, params: p, amount_total: p.line_items.reduce((t: number, l: any) => t + l.price_data.unit_amount * l.quantity, 0), payment_intent: null }; sessions.set(id, s); return s }),
    retrieve: vi.fn(async (id: string) => sessions.get(id)), expire: vi.fn(async (id: string) => { sessions.get(id).status = 'expired' }),
    listLineItems: vi.fn(async (id: string) => ({ has_more: false, data: sessions.get(id).params.line_items.map((l: any) => ({ amount_total: l.price_data.unit_amount * l.quantity })) })),
  } } }
  const printOrders: PrintOrdersPort = {
    async create(i) { const id = randomUUID(); store.orders.set(id, { id, status: 'created', paid_at: null, stripe_session_id: i.stripeSessionId, stripe_payment_intent: null, retail_total_cents: i.retailTotalCents, retail_shipping_cents: i.retailShippingCents, items: i.items as any, prodigi_order_id: null, placed_at: null, customer_email: i.customerEmail, shipping_address: i.shippingAddress as any, shipping_method: i.shippingMethod, prodigi_merchant_ref: i.prodigiMerchantRef } as any); return { id } },
    async updateUnpaid(orderId, i) { const o = store.orders.get(orderId)!; if (o.status !== 'created') return false; Object.assign(o, { stripe_session_id: i.stripeSessionId, items: i.items as any, retail_shipping_cents: i.retailShippingCents, retail_total_cents: i.retailTotalCents }); return true },
  }
  const deps: GiftOrderDeps & { gift: GiftDeps } = { store, stripe, printOrders, quote: vi.fn(async () => ({ outcome: 'Ok', quotes: [{ costSummary: { shipping: { amount: '6.85', currency: 'USD' } } }] }) as any), canFulfil: vi.fn(async () => true), publishableKey: 'pk_test_x', gift }
  const pay = (id: string) => { const s = sessions.get(id); s.payment_status = 'paid'; s.status = 'complete'; s.payment_intent = 'pi_test_1' }
  return { gift, store, files, calls, state, fetchMock, deps, pay, stripe }
}
type R = ReturnType<typeof rig>
const checkout = (r: R, sid: string) => createGiftCheckout(r.deps, { user: { id: U1 }, sessionId: sid, origin: 'https://x.test', body: BODY })

/** Two accepted pictures (2:3 and 1:1) bound to two lines. */
async function cart(r: R, flow = true) {
  void flow
  const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }); const sid = v.sessionId
  await chooseEffect(r.gift, U1, sid, liveEffectIds('portraits')[0])
  const tall = (await startGeneration(r.gift, U1, sid, { productId: 'fine_art:12x18', idempotencyKey: key(1) })).generation
  const sq = (await startGeneration(r.gift, U1, sid, { productId: 'canvas:12x12', idempotencyKey: key(2) })).generation
  await acceptGeneration(r.gift, U1, sid, tall.generationId); await acceptGeneration(r.gift, U1, sid, sq.generationId)
  const view = await setLines(r.gift, U1, sid, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1, generationId: tall.generationId }, { lineId: 'b', productId: 'canvas:12x12', copies: 2, generationId: sq.generationId }])
  return { sid, tall, sq, view }
}
async function pay(r: R, sid: string) {
  const out = await checkout(r, sid); r.pay(out.stripeSessionId); await confirmGiftOrder(r.deps, out.stripeSessionId, U1)
  return [...r.store.orders.values()][0]
}
let saved: Record<string, string | undefined>
beforeEach(() => { saved = { APP_URL: process.env.APP_URL, CRON_SECRET: process.env.CRON_SECRET, VERCEL_ENV: process.env.VERCEL_ENV, GIFT_NEW_SESSION_FLOW: process.env.GIFT_NEW_SESSION_FLOW }; process.env.APP_URL = 'https://app.test'; process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL_ENV; process.env.GIFT_NEW_SESSION_FLOW = 'generations' })
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }; vi.unstubAllGlobals() })

describe('from acceptance to the printer', () => {
  it('the cart binds the accepted pictures as the approved compositions; checkout pins their sha256; Final Approval and the print source verify them; print preparation adds nothing', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    const { sid, tall, sq, view } = await cart(r)
    expect(view.lines.map(l => l.generationId)).toEqual([tall.generationId, sq.generationId])
    const rows = r.store.compositions.filter(c => c.status === 'approved')
    expect(rows).toHaveLength(2); expect(rows.map(c => c.generation_id).sort()).toEqual([tall.generationId, sq.generationId].sort())
    expect(rows.find(c => c.line_id === 'a')).toMatchObject({ composed_path: `gift/${sid}/masters/${tall.generationId}.png`, geometry_key: 'a667', width: tall.width, height: tall.height, nb21_calls: 0 })
    expect(rows.find(c => c.line_id === 'a')!.plan).toMatchObject({ artworkSha256: tall.sha256, source: 'generation', fit: 'exact', outpainted: false })
    expect(r.calls).toHaveLength(2)                                                            // nothing else was generated for the cart

    const order = await pay(r, sid)
    const pins = order.items.map(i => (i.frozen as any).composition)
    expect(pins.map((p: any) => p.generationId)).toEqual([tall.generationId, sq.generationId]); expect(pins.map((p: any) => p.artworkSha256)).toEqual([tall.sha256, sq.sha256])
    expect((await ensureCompositions(r.gift, U1, sid)).compositions.map(c => c.status)).toEqual(['approved', 'approved'])          // nothing is composed after payment
    expect(r.calls).toHaveLength(2)

    const fin = await finalizeOrder(r.gift, U1, sid); expect(fin.order.state).toBe('approved'); expect(r.gift.kick).not.toHaveBeenCalled()
    await releaseOrder(r.gift, { operator: 'test-operator', userId: U1, sessionId: sid })
    for (const [i, g] of [tall, sq].entries()) {
      const bytes = await loadApprovedCompositionWith(r.store, r.gift.storage, { id: order.id }, { render_id: `gift:${sid}:${i ? 'b' : 'a'}`, item_index: i })
      expect(sha(bytes)).toBe(g.sha256)                                                                 // the printer's source is the accepted picture, byte for byte
    }
    // Print preparation (the real step) leaves the pixels alone: no outpaint, no mirror extension, same dimensions, same pixels.
    const { prepareComposition } = await import('../print/asset-pipeline')
    for (const [id, g, size, finish] of [['fine_art:12x18', tall, '12x18', 'fine_art'], ['canvas:12x12', sq, '12x12', 'canvas']] as const) {
      const bytes = r.files.get(`gift/${sid}/masters/${g.generationId}.png`)!
      const c = await prepareComposition({ imageB64: bytes.toString('base64'), size: size as any, finish: finish as any })
      expect(c.outpainted).toBe(false); expect([c.width, c.height]).toEqual([g.width, g.height]); expect(c.plan.composition.compatibility).toBe('recommended')
      const a = await sharp(bytes).raw().toBuffer(), b = await sharp(c.working).raw().toBuffer(); expect(b.equals(a), id).toBe(true)
    }
  })
  it('every launch product\'s shape lands on a whole grid, so a conformed picture is never padded; 1:1 and 2:3 are all there is today', () => {
    for (const id of ['fine_art:8x8', 'fine_art:20x20', 'fine_art:8x12', 'canvas:20x30', 'premium:16x24', 'classic_frame:12x18']) { const p = getProduct(id); if (p) expect(gridOf(p), id).toMatchObject({ w: expect.any(Number), h: expect.any(Number) }) }
    expect(gridOf(getProduct('fine_art:12x18')!)).toEqual({ w: 2, h: 3 }); expect(gridOf(getProduct('fine_art:8x8')!)).toEqual({ w: 1, h: 1 })
  })
})

describe('binding refusals, and nothing sold that was not accepted', () => {
  it('a line needs a delivered AND accepted generation of this effect and this shape', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }); const sid = v.sessionId; const effects = liveEffectIds('portraits')
    await chooseEffect(r.gift, U1, sid, effects[0])
    const g = (await startGeneration(r.gift, U1, sid, { productId: 'fine_art:12x18', idempotencyKey: key(1) })).generation
    const set = (generationId: string | undefined, productId = 'fine_art:12x18') => setLines(r.gift, U1, sid, [{ lineId: 'a', productId, copies: 1, ...(generationId ? { generationId } : {}) }])
    await expect(set(g.generationId)).rejects.toMatchObject({ code: 'generation_not_accepted' })                      // delivered is not enough: the customer must accept
    await acceptGeneration(r.gift, U1, sid, g.generationId)
    await expect(set(g.generationId, 'canvas:12x12')).rejects.toMatchObject({ code: 'composition_geometry_mismatch' })   // a 2:3 picture is not a square product's
    await expect(set('00000000-0000-4000-8000-0000000000aa')).rejects.toMatchObject({ code: 'generation_not_found' })
    await expect(set('not-a-uuid')).rejects.toMatchObject({ code: 'invalid_lines' })
    expect((await set(g.generationId)).lines[0].generationId).toBe(g.generationId)
    expect((await setLines(r.gift, U1, sid, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 3 }])).lines[0].generationId).toBe(g.generationId)      // quantity change keeps the binding
    expect(r.store.compositions.filter(c => c.status === 'approved')).toHaveLength(1)
    // a different effect: the old pictures no longer apply
    await chooseEffect(r.gift, U1, sid, effects[1])
    expect(r.store.compositions.filter(c => c.status === 'approved')).toHaveLength(0)
    await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
    await expect(set(g.generationId)).rejects.toMatchObject({ code: 'stale_composition' })
  })
  it('checkout refuses a line with no accepted picture, and never sells an unbound line in the generations flow', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }); await chooseEffect(r.gift, U1, v.sessionId, liveEffectIds('portraits')[0])
    await setLines(r.gift, U1, v.sessionId, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
    await expect(checkout(r, v.sessionId)).rejects.toMatchObject({ code: 'compositions_not_approved' })
    await expect(ensureCompositions(r.gift, U1, v.sessionId)).rejects.toBeInstanceOf(Error)
  })
  it('after payment the lines are locked: the picture of a paid line cannot be swapped', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); const { sid, sq } = await cart(r); await pay(r, sid)
    await expect(setLines(r.gift, U1, sid, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1, generationId: sq.generationId }])).rejects.toMatchObject({ code: 'lines_locked' })
  })
  it('any change to the stored picture is caught: at Final Approval and again at the print source', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); const { sid, tall } = await cart(r); const order = await pay(r, sid)
    const path = `gift/${sid}/masters/${tall.generationId}.png`, good = r.files.get(path)!
    r.files.set(path, await sharp(good).extend({ right: 4, extendWith: 'mirror' }).png().toBuffer())                  // a 4px mirrored extension, as the old flow would have added
    await expect(finalizeOrder(r.gift, U1, sid)).rejects.toMatchObject({ code: 'generation_changed' })
    r.files.set(path, good); await finalizeOrder(r.gift, U1, sid); await releaseOrder(r.gift, { operator: 'test-operator', userId: U1, sessionId: sid })
    r.files.set(path, await sharp(good).modulate({ brightness: 1.01 }).png().toBuffer())
    await expect(loadApprovedCompositionWith(r.store, r.gift.storage, { id: order.id }, { render_id: `gift:${sid}:a`, item_index: 0 })).rejects.toThrow('gift_generation_changed')
    r.files.set(path, good); expect(sha(await loadApprovedCompositionWith(r.store, r.gift.storage, { id: order.id }, { render_id: `gift:${sid}:a`, item_index: 0 }))).toBe(tall.sha256)
    const pinned = (order.items[0].frozen as any).composition; pinned.artworkSha256 = 'f'.repeat(64)                    // a pin that disagrees with the picture
    await expect(loadApprovedCompositionWith(r.store, r.gift.storage, { id: order.id }, { render_id: `gift:${sid}:a`, item_index: 0 })).rejects.toThrow('gift_generation_changed')
  })
})

describe('the one free correction after purchase', () => {
  it('is a new generation of the same shape outside the allowance; the customer approves it; it is spent once and only when delivered', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); const { sid, tall } = await cart(r); await pay(r, sid)
    const before = (await getSessionView(r.gift, U1, sid)).generations!.allowance
    r.state.fail = true
    await expect(correctLine(r.gift, U1, sid, 'a')).rejects.toMatchObject({ code: 'composition_failed' })                // the model failed: nothing is spent
    expect((await getSessionView(r.gift, U1, sid)).compositions.find(c => c.lineId === 'a')!.correctionsRemaining).toBe(1)
    r.state.fail = false
    const after = await correctLine(r.gift, U1, sid, 'a')
    const a = after.compositions.find(c => c.lineId === 'a')!
    expect(a).toMatchObject({ correctionsRemaining: 0, status: 'ready', attempt: 2 }); expect(a.compositionId).not.toBe(tall.generationId)
    const corr = r.store.generations.filter(g => g.kind === 'correction'); expect(corr).toHaveLength(1)
    expect(corr[0]).toMatchObject({ status: 'ready', geometry_key: 'a667', pack_id: null }); expect(after.generations!.allowance).toMatchObject({ freeUsed: before.freeUsed, paidUnits: before.paidUnits })       // the allowance is untouched
    expect(Math.abs(corr[0].width! / corr[0].height! - 2 / 3)).toBeLessThan(1 / corr[0].height!)
    await expect(correctLine(r.gift, U1, sid, 'a')).rejects.toMatchObject({ code: 'correction_limit' })
    await expect(finalizeOrder(r.gift, U1, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })           // the corrected picture must be approved first
    await approveComposition(r.gift, U1, sid, a.compositionId!)
    expect(r.store.generations.find(g => g.id === corr[0].id)!.accepted_at).toBeTruthy()
    await finalizeOrder(r.gift, U1, sid)
  })
})

describe('beauty scenes and the mug full wrap stay tied to the same composition identity', () => {
  it('Premium reuses the Fine Art generation and its beauty scene (the shared photograph, scene family fine_art); the preview shows the generation itself', async () => {
    const { getProductPreview } = await import('./product-preview'); const { realSceneRenderer } = await import('./mockup-real')
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    const sceneRender = vi.fn(async (i: { sceneId: string; productFamily: string; artwork: Buffer }) => ({ png: await sharp({ create: { width: 1254, height: 1254, channels: 3, background: '#789' } }).png().toBuffer(), width: 1254, height: 1254, templateRevision: 'rev-1', visualizationKey: 'k', metadata: {} }))
    ;(r.gift as any).mockup = { revision: async () => 'cal', render: vi.fn(), scenes: { describe: (id: string) => realSceneRenderer.describe(id), revision: async () => 'rev-1', render: sceneRender } }
    const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }); const sid = v.sessionId
    await chooseEffect(r.gift, U1, sid, liveEffectIds('portraits')[0])
    const fa = (await startGeneration(r.gift, U1, sid, { productId: 'fine_art:12x18', idempotencyKey: key(1) })).generation
    const pr = await startGeneration(r.gift, U1, sid, { productId: 'premium:12x18', idempotencyKey: key(2) })
    expect(pr.generation.generationId).toBe(fa.generationId); expect(pr.reused).toBe(true); expect(r.calls).toHaveLength(1)          // separate SKU and price, one composition
    const view = await getProductPreview(r.gift, U1, sid, 'premium:12x18', { generationId: fa.generationId })
    expect(view).toMatchObject({ status: 'ready', renderer: 'scene', sceneId: 'fine-art-portrait' })
    // the display-only beauty scene for this configuration, and the exact artwork the browser composites into it (the generation itself, watermarked)
    expect((view as any).beauty).toMatchObject({ sceneId: 'beauty-fine_art_print_portrait', family: 'fine_art', displayOnly: true, productionPrintFile: false })
    const bi = (view as any).beautyInput; expect(bi).toMatchObject({ kind: 'generation_picture', generationId: fa.generationId, sha256: fa.sha256, width: fa.width, height: fa.height }); expect(bi.url).toMatch(/\/product-previews\/premium_12x18-input-/)
    const storedIn = r.files.get(bi.url.replace('https://signed.test/', ''))!; expect(await sharp(storedIn).metadata()).toMatchObject({ format: 'jpeg', width: fa.width, height: fa.height })
    const again = await getProductPreview(r.gift, U1, sid, 'premium:12x18', { generationId: fa.generationId }); expect((again as any).cached).toBe(true); expect((again as any).beautyInput.url).toBe(bi.url)
    expect(sceneRender).toHaveBeenCalledWith(expect.objectContaining({ sceneId: 'fine-art-portrait', productFamily: 'fine_art' }))
    const shown = sceneRender.mock.calls[0][0].artwork; expect((await sharp(shown).metadata()).width! / (await sharp(shown).metadata()).height!).toBeCloseTo(2 / 3, 2)      // the generation's own shape, nothing adapted
    await expect(getProductPreview(r.gift, U1, sid, 'canvas:12x12', { generationId: fa.generationId })).rejects.toMatchObject({ code: 'composition_geometry_mismatch' })
    await expect(getProductPreview(r.gift, U1, sid, 'premium:12x18', { generationId: '00000000-0000-4000-8000-0000000000aa' })).rejects.toMatchObject({ code: 'generation_not_found' })
    // the same generation id, size and sha256 are what is accepted, bound and bought
    await acceptGeneration(r.gift, U1, sid, fa.generationId)
    const cartView = await setLines(r.gift, U1, sid, [{ lineId: 'a', productId: 'premium:12x18', copies: 1, generationId: fa.generationId }])
    expect(cartView.lines[0].generationId).toBe(fa.generationId); expect(r.store.compositions.find(c => c.line_id === 'a')).toMatchObject({ generation_id: fa.generationId, width: fa.width, height: fa.height })
  })

  for (const shape of [{ composition: 'square', aspect: '1:1', w: 1034, h: 1034 }, { composition: 'landscape', aspect: '3:2', w: 1122, h: 748 }] as const) {
    it(`the mug, ${shape.composition}: one picture panel from generation to the lab file, with the same generation id, size and sha256 all the way`, async () => {
      const { profileFor } = await import('../print/upscale/profiles')
      const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
      const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }); const sid = v.sessionId
      await chooseEffect(r.gift, U1, sid, liveEffectIds('portraits')[0])
      const out = await startGeneration(r.gift, U1, sid, { productId: 'mug:11oz', composition: shape.composition, idempotencyKey: key(1) }); const g = out.generation
      expect(r.calls[0].body).toMatchObject({ output_aspect_ratio: shape.aspect, product_composition: true })                    // the model is asked for the panel ratio directly (never a wrap ratio)
      expect(g).toMatchObject({ status: 'ready' }); expect(g.width! * shape.h).toBe(g.height! * shape.w)                          // exactly the panel's shape
      expect(g.conform!.trimFraction).toBeLessThan(0.1)
      await acceptGeneration(r.gift, U1, sid, g.generationId)
      await setLines(r.gift, U1, sid, [{ lineId: 'm', productId: 'mug:11oz', copies: 1, generationId: g.generationId }])
      const comp = r.store.compositions.find(c => c.line_id === 'm')!; expect(comp).toMatchObject({ status: 'approved', generation_id: g.generationId, width: g.width, height: g.height }); expect(comp.plan as any).toMatchObject({ artworkSha256: g.sha256, layout: 'mug_single_panel_v2', composition: shape.composition, placement: { layoutVersion: 2, rectPx: { w: shape.w, h: shape.h }, face: 'front', reverse: 'white' } })
      const order = await pay(r, sid); expect((order.items[0].frozen as any).composition).toMatchObject({ generationId: g.generationId, artworkSha256: g.sha256, width: g.width, height: g.height, layout: 'mug_single_panel_v2', composition: shape.composition, placement: { rectPx: { w: shape.w, h: shape.h } } })          // layout and orientation are pinned with the sale
      await finalizeOrder(r.gift, U1, sid); await releaseOrder(r.gift, { operator: 'test-operator', userId: U1, sessionId: sid })
      const bytes = await loadApprovedCompositionWith(r.store, r.gift.storage, { id: order.id }, { render_id: `gift:${sid}:m`, item_index: 0 }); expect(sha(bytes)).toBe(g.sha256)
      const { approvedLayoutWith } = await import('./print-source'); expect(await approvedLayoutWith(r.store, { id: order.id }, { render_id: `gift:${sid}:m`, item_index: 0 })).toBe('mug_single_panel_v2')          // what the print job freezes
      // the lab file: the real mug profile places exactly this picture on the 2670 x 1110 file, both faces, changing nothing in it
      const job: any = { id: 'j', finish: 'mug', size: '11oz', sku: 'GLOBAL-MUG-W', settings_snapshot: { layout: (comp.plan as any).layout } }, profile = profileFor(job), p = await profile.prepare({ job, source: bytes, ppi: 300 })
      expect(p).toMatchObject({ width: g.width, height: g.height, outpainted: false }); expect((await sharp(p.working).raw().toBuffer()).equals(await sharp(bytes).removeAlpha().raw().toBuffer())).toBe(true)
      const f = await profile.finish({ job: { ...job, input_w: g.width, input_h: g.height, required_front_w: p.requiredFront.w, required_front_h: p.requiredFront.h }, image: bytes, upscaled: false, targetMp: 8 } as any)
      expect(await sharp(f.jpeg).metadata()).toMatchObject({ width: 2670, height: 1110 })
      // ONE panel on the front face at the returned placement; everything else, the reverse included, is white
      const pl = (comp.plan as any).placement.rectPx as { x: number; y: number; w: number; h: number }, full = await sharp(f.jpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const at = (x: number, y: number) => { const o = (y * full.info.width + x) * 3; return [full.data[o], full.data[o + 1], full.data[o + 2]] }
      for (const [x, y] of [[100, 100], [598, 555], [1300, 555], [pl.x - 20, 555], [pl.x + pl.w + 20, 555], [2069, pl.y - 20], [2069, pl.y + pl.h + 20], [2650, 1090]]) expect(at(x, y).every(v => v >= 250), `white at ${x},${y}`).toBe(true)
      const inside = await sharp(f.jpeg).extract({ left: pl.x, top: pl.y, width: pl.w, height: pl.h }).removeAlpha().raw().toBuffer(), want = await sharp(bytes).resize(pl.w, pl.h, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer()
      let diff = 0; for (let i = 0; i < inside.length; i += 97) diff += Math.abs(inside[i] - want[i]); expect(diff / (inside.length / 97)).toBeLessThan(4)          // the picture, whole, unmirrored
      expect(pl.x + pl.w / 2).toBe(2069)
    })
  }

  it('an existing mug (no layout recorded, or the version-1 layout) keeps the two-face layout: the square on both faces', async () => {
    const { profileFor } = await import('../print/upscale/profiles')
    const picture = await sharp({ create: { width: 910, height: 910, channels: 3, background: '#b33' } }).png().toBuffer()
    const job: any = { id: 'j', finish: 'mug', size: '11oz', sku: 'GLOBAL-MUG-W', settings_snapshot: null }, profile = profileFor(job), p = await profile.prepare({ job, source: picture, ppi: 300 })
    const f = await profile.finish({ job: { ...job, input_w: 910, input_h: 910, required_front_w: p.requiredFront.w, required_front_h: p.requiredFront.h }, image: picture, upscaled: false, targetMp: 8 } as any)
    const raw = await sharp(f.jpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true }), at = (x: number, y: number) => { const o = (y * raw.info.width + x) * 3; return [raw.data[o], raw.data[o + 1], raw.data[o + 2]] }
    expect(at(598, 555)[0]).toBeGreaterThan(150); expect(at(598, 555)[1]).toBeLessThan(100); expect(at(2069, 555)[1]).toBeLessThan(100)          // red on BOTH faces, exactly as before
  })

  it('the mug: a portrait or unknown composition is refused, and a composition on another product is refused', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }); const sid = v.sessionId
    await chooseEffect(r.gift, U1, sid, liveEffectIds('portraits')[0])
    await expect(startGeneration(r.gift, U1, sid, { productId: 'mug:11oz', composition: 'portrait' as any, idempotencyKey: key(1) })).rejects.toMatchObject({ code: 'invalid_composition' })
    await expect(startGeneration(r.gift, U1, sid, { productId: 'matted:12x18', composition: 'square' as any, idempotencyKey: key(2) })).rejects.toMatchObject({ code: 'invalid_composition' })
    expect(r.calls.length).toBe(0)                                                                                              // nothing reached a model
  })

  it('Groups, five people, Action Figures: the mug is selectable and its generation goes to the Groups handler with a normal Groups format', async () => {
    const { getProductAvailability } = await import('./availability')
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    ;(r.gift as any).analyze = async () => ({ status: 'supported', series: 'groups', peopleCount: 5 })
    const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }); const sid = v.sessionId
    const av = await getProductAvailability(r.gift, U1, sid); const mug = av.products.find(x => x.productId === 'mug:11oz')!
    expect(mug.purchasable).toBe(true); expect((mug.generation as any).supported).toBe(true)
    expect(((mug.generation as any).options as any[]).map(o => [o.composition, o.supported, o.requestedAspect])).toEqual([['square', true, '1:1'], ['landscape', true, '3:2']])
    await chooseEffect(r.gift, U1, sid, 'action_figures')
    for (const [i, c] of (['square', 'landscape'] as const).entries()) {
      const out = await startGeneration(r.gift, U1, sid, { productId: 'mug:11oz', composition: c, idempotencyKey: key(10 + i) }); expect(out.generation.status).toBe('ready')
    }
    expect(r.fetchMock.mock.calls.map(c => String(c[0]))).toEqual(Array(2).fill(expect.stringContaining('/api/v1/groups/generate')))
    expect(r.calls.map(c => c.body)).toMatchObject([{ format: '1:1', subject_count: 5, effect_id: 'action_figures' }, { format: '3:2', subject_count: 5, effect_id: 'action_figures' }])
    expect(r.calls.some(c => JSON.stringify(c.body).includes('21:9'))).toBe(false)
  })

  it('Groups, twelve people: only the landscape mug is supported (square is outside the head-count formats)', async () => {
    const { getProductAvailability } = await import('./availability')
    const r = rig(); ;(r.gift as any).analyze = async () => ({ status: 'supported', series: 'groups', peopleCount: 12 })
    const v = await createSession(r.gift, { userId: U1, imageB64: await photo() })
    const mug = (await getProductAvailability(r.gift, U1, v.sessionId)).products.find(x => x.productId === 'mug:11oz')!
    expect(((mug.generation as any).options as any[]).map(o => [o.composition, o.supported])).toEqual([['square', false], ['landscape', true]])
    expect(mug.generation).toMatchObject({ supported: true, requestedAspect: '3:2' })
  })
})

describe('customer-selected frame colour (Gift Shop only), black by default, part of the approval', () => {
  async function framed(r: R, productId = 'framed_canvas:12x18') {
    const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }); const sid = v.sessionId
    await chooseEffect(r.gift, U1, sid, liveEffectIds('portraits')[0])
    const g = (await startGeneration(r.gift, U1, sid, { productId, idempotencyKey: key(1) })).generation; await acceptGeneration(r.gift, U1, sid, g.generationId)
    return { sid, g }
  }
  const line = (g: { generationId: string }, over: Record<string, unknown> = {}, productId = 'framed_canvas:12x18') => ({ lineId: 'f', productId, copies: 1, generationId: g.generationId, ...over })

  it('the exact Prodigi colours per product, black by default; the matted 8x12 loses the two greys Prodigi prints at another size', async () => {
    const { frameColorsFor, resolveFrameColor, FRAME_COLOR_DEFAULT } = await import('./frame-colors'); const gp = (id: string) => getProduct(id)!
    expect(frameColorsFor(gp('framed:12x12'))).toEqual(['black', 'white', 'natural', 'brown', 'dark grey', 'light grey', 'gold', 'silver'])
    expect(frameColorsFor(gp('matted:12x18'))).toEqual(['black', 'white', 'natural', 'brown', 'dark grey', 'light grey', 'gold', 'silver'])
    expect(frameColorsFor(gp('framed_canvas:12x18'))).toEqual(['black', 'white', 'natural', 'brown', 'gold', 'silver'])
    expect(frameColorsFor(gp('matted:8x12'))).toEqual(['black', 'white', 'natural', 'brown', 'gold', 'silver'])
    for (const id of ['fine_art:12x18', 'premium:8x8', 'canvas:12x12', 'mug:11oz', 'card:7x5']) expect(frameColorsFor(gp(id)), id).toBeNull()
    expect(resolveFrameColor(gp('framed:12x12'), undefined)).toBe(FRAME_COLOR_DEFAULT); expect(FRAME_COLOR_DEFAULT).toBe('black'); expect(resolveFrameColor(gp('canvas:12x12'), undefined)).toBeNull()
    expect(() => resolveFrameColor(gp('framed_canvas:12x18'), 'dark grey')).toThrow(); expect(() => resolveFrameColor(gp('canvas:12x12'), 'black')).toThrow(); expect(() => resolveFrameColor(gp('framed:12x12'), 'Black')).toThrow()
  })

  it('validated on the server, stated explicitly when a picture is bound, kept through the cart and restoration', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); const { sid, g } = await framed(r)
    await expect(setLines(r.gift, U1, sid, [line(g)])).rejects.toMatchObject({ code: 'finish_required' })                                       // the colour is stated, not assumed, when a picture is bound to a frame
    await expect(setLines(r.gift, U1, sid, [line(g, { frameColor: 'purple' })])).rejects.toMatchObject({ code: 'invalid_frame_color', details: { supported: ['black', 'white', 'natural', 'brown', 'gold', 'silver'] } })
    await expect(setLines(r.gift, U1, sid, [line(g, { frameColor: 'dark grey' })])).rejects.toMatchObject({ code: 'invalid_frame_color' })      // a classic-frame colour, not a framed-canvas one
    await expect(setLines(r.gift, U1, sid, [{ lineId: 'c', productId: 'canvas:12x12', copies: 1, frameColor: 'black' }])).rejects.toMatchObject({ code: 'invalid_frame_color' })   // a product with no frame colour
    expect((await setLines(r.gift, U1, sid, [{ lineId: 'f', productId: 'framed_canvas:12x18', copies: 1 }])).lines[0]).toMatchObject({ frameColor: 'black' })          // unbound lines default to black
    const v = await setLines(r.gift, U1, sid, [line(g, { frameColor: 'gold' })])
    expect(v.lines[0]).toMatchObject({ frameColor: 'gold', generationId: g.generationId })
    expect(r.store.compositions.find(c => c.status === 'approved')!.plan).toMatchObject({ frameColor: 'gold', artworkSha256: g.sha256 })
    expect((await setLines(r.gift, U1, sid, [{ lineId: 'f', productId: 'framed_canvas:12x18', copies: 4 }])).lines[0]).toMatchObject({ frameColor: 'gold', generationId: g.generationId, copies: 4 })      // a quantity change keeps colour and binding
    const { restoreSession } = await import('./service'); expect((await restoreSession(r.gift, U1)).current!.lines[0]).toMatchObject({ frameColor: 'gold', generationId: g.generationId })
    const av = await (await import('./availability')).getProductAvailability(r.gift, U1, sid); const p = av.products.find(x => x.productId === 'framed_canvas:12x18')!
    expect(p.frameColors).toEqual({ supported: ['black', 'white', 'natural', 'brown', 'gold', 'silver'], default: 'black', selected: 'gold' }); expect(p.beauty).toMatchObject({ sceneId: 'beauty-framed_canvas_portrait', frame: { selected: 'gold' } })
    expect(av.products.find(x => x.productId === 'canvas:12x12')!.frameColors).toBeNull(); expect(av.products.find(x => x.productId === 'framed:12x12')!.frameColors).toMatchObject({ selected: 'black', default: 'black' })
  })

  it('a different finish is a different approval: it drops the binding unless the customer explicitly accepts that finish for that picture', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); const { sid, g } = await framed(r)
    await setLines(r.gift, U1, sid, [line(g, { frameColor: 'gold' })])
    await expect(setLines(r.gift, U1, sid, [line(g, { frameColor: 'silver' })])).rejects.toMatchObject({ code: 'finish_not_accepted' })       // re-sending the picture is not accepting the new finish
    const dropped = await setLines(r.gift, U1, sid, [{ lineId: 'f', productId: 'framed_canvas:12x18', copies: 1, frameColor: 'silver' }])
    expect(dropped.lines[0]).toMatchObject({ frameColor: 'silver' }); expect(dropped.lines[0].generationId).toBeUndefined()                  // the gold approval did not follow the line to silver
    expect(r.store.compositions.filter(c => c.status === 'approved')).toHaveLength(0); await expect(checkout(r, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
    const again = await setLines(r.gift, U1, sid, [line(g, { frameColor: 'silver', acceptFinish: true })]); expect(again.lines[0]).toMatchObject({ frameColor: 'silver', generationId: g.generationId })
    const live = r.store.compositions.filter(c => c.status === 'approved'); expect(live).toHaveLength(1); expect(live[0].plan).toMatchObject({ frameColor: 'silver' })
    expect(r.store.compositions.filter(c => (c.plan as any).frameColor === 'gold' && c.status === 'superseded').length).toBeGreaterThanOrEqual(1)
  })

  it('checkout quotes, freezes, pins and Final Approval verifies the selected colour; fulfilment places exactly what was sold; tampering is refused', async () => {
    const { soldAttributes } = await import('../print/fulfillment'); const { getSku } = await import('../print/sku-map')
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); const { sid, g } = await framed(r)
    await setLines(r.gift, U1, sid, [line(g, { frameColor: 'brown' })])
    const out = await checkout(r, sid)
    expect((r.deps.quote as any).mock.calls.at(-1)[0].items[0].attributes).toEqual({ color: 'brown', wrap: 'MirrorWrap' })               // the quote is for the colour chosen
    r.pay(out.stripeSessionId); await confirmGiftOrder(r.deps, out.stripeSessionId, U1); const order = [...r.store.orders.values()][0]
    const frozen = order.items[0].frozen as any; expect(frozen.product.attributes).toEqual({ color: 'brown', wrap: 'MirrorWrap' }); expect(frozen.composition).toMatchObject({ frameColor: 'brown', generationId: g.generationId, artworkSha256: g.sha256 })
    expect(soldAttributes(order.items[0] as any, getSku('12x18' as any, 'framed_canvas' as any))).toEqual({ color: 'brown', wrap: 'MirrorWrap' })           // what Prodigi is given
    // an order sold before colours existed (frozen black) and one with no snapshot are unchanged; a malformed snapshot can never add or drop an attribute
    const base = getSku('12x18' as any, 'framed_canvas' as any)
    expect(soldAttributes({ sku: base.sku, frozen: { product: { sku: base.sku, attributes: { color: 'black', wrap: 'MirrorWrap' } } } }, base)).toEqual({ color: 'black', wrap: 'MirrorWrap' })
    expect(soldAttributes({ sku: base.sku }, base)).toEqual(base.attributes)
    expect(soldAttributes({ sku: base.sku, frozen: { product: { sku: base.sku, attributes: { color: 'brown' } } } }, base)).toEqual(base.attributes)
    expect(soldAttributes({ sku: base.sku, frozen: { product: { sku: 'OTHER', attributes: { color: 'brown', wrap: 'MirrorWrap' } } } }, base)).toEqual(base.attributes)
    // Final Approval: the finish approved, pinned and sold must agree
    const comp = r.store.compositions.find(c => c.status === 'approved')!; (comp.plan as any).frameColor = 'gold'
    await expect(finalizeOrder(r.gift, U1, sid)).rejects.toMatchObject({ code: 'finish_not_accepted' }); (comp.plan as any).frameColor = 'brown'
    await finalizeOrder(r.gift, U1, sid); await releaseOrder(r.gift, { operator: 'test-operator', userId: U1, sessionId: sid })
    const src = () => loadApprovedCompositionWith(r.store, r.gift.storage, { id: order.id }, { render_id: `gift:${sid}:f`, item_index: 0 })
    expect(sha(await src())).toBe(g.sha256); (comp.plan as any).frameColor = 'gold'; await expect(src()).rejects.toThrow('gift_finish_changed')
  })

  it('the preview is per colour: validated, echoed, and a different colour is a different cache entry with the recolour instruction', async () => {
    const { getProductPreview } = await import('./product-preview'); const { realSceneRenderer } = await import('./mockup-real')
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    ;(r.gift as any).mockup = { revision: async () => 'cal', render: vi.fn(), scenes: { describe: (id: string) => realSceneRenderer.describe(id), revision: async () => 'rev-1', render: vi.fn() } }
    const { sid, g } = await framed(r)
    const a: any = await getProductPreview(r.gift, U1, sid, 'framed_canvas:12x18', { generationId: g.generationId }), b: any = await getProductPreview(r.gift, U1, sid, 'framed_canvas:12x18', { generationId: g.generationId, frameColor: 'gold' })
    expect(a.frameColor).toBe('black'); expect(b.frameColor).toBe('gold'); expect(b.cached).toBe(false); expect(b.beautyInput.url).not.toBe(a.beautyInput.url); expect(b.url).not.toBe(a.url)       // not the same cache entry
    expect(b.beauty.frame).toMatchObject({ selected: 'gold', recolor: { mask: 'frame-mask.svg', toColor: 'gold', photographedColor: 'natural', needed: true } }); expect(a.beauty.frame).toMatchObject({ selected: 'black' })
    const again: any = await getProductPreview(r.gift, U1, sid, 'framed_canvas:12x18', { generationId: g.generationId, frameColor: 'gold' }); expect(again.cached).toBe(true); expect(again.url).toBe(b.url)
    await expect(getProductPreview(r.gift, U1, sid, 'framed_canvas:12x18', { generationId: g.generationId, frameColor: 'dark grey' })).rejects.toMatchObject({ code: 'invalid_frame_color' })
    await expect(getProductPreview(r.gift, U1, sid, 'fine_art:12x18', { generationId: g.generationId, frameColor: 'black' })).rejects.toMatchObject({ code: 'invalid_frame_color' })
  })

  it('the Print Shop is untouched: its catalog carries no frame colours and its Classic Frame stays black', async () => {
    const { catalogResponse } = await import('../print/catalog'); const c: any = catalogResponse(null)
    for (const p of c.products.filter((x: any) => x.family === 'framed')) { expect(p.attributes).toEqual({ color: 'black' }); expect(p.frameColors).toBeUndefined(); expect(p.selectable).toBe(true) }
    for (const p of c.products.filter((x: any) => x.family === 'matted' || x.family === 'framed_canvas')) { expect(p.attributes.color).toBe('black'); expect(p.selectable).toBe(false) }
  })
})
