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
