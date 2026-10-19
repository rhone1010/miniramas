// End to end with SAFE FIXTURES: the real composition pipeline (composeWithPrintShop, no outpaint reached), the real scene renderer and the real calibrated renderer, the
// real mockup boundary, on the in-memory store. The only fakes are the generator (it returns a clean synthetic painting (or the image named by GIFT_SCENE_ARTWORK), shaped to
// the requested ratio), payment (an in-memory paid order) and storage. Nothing is generated, paid, sent to a lab or written to a database.
//
// Set GIFT_SCENE_EVIDENCE_DIR to keep the customer-visible JPEGs (the clean, paid mockups exactly as stored and signed).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// The composition step may extend a picture by outpaint for the shapes that need it (the card's 5:7 from a square master); here that paid call is a free grey stand-in, counted,
// so the test can prove the SCENE step never makes one.
const outpaintCalls = vi.hoisted(() => ({ n: 0 }))
vi.mock('../shared/outpaint', () => ({
  outpaint: async (i: any) => { outpaintCalls.n++; const s = (await import('sharp')).default; return { outpainted: true, image: await s(i.image).extend({ left: i.padding.left, right: i.padding.right, top: i.padding.up, bottom: i.padding.down, extendWith: 'mirror' }).jpeg().toBuffer() } },
}))

const U1 = '10000000-0000-4000-8000-000000000001'
const ALL = ['matted', 'framed_canvas', 'mug', 'card']
const EVIDENCE = process.env.GIFT_SCENE_EVIDENCE_DIR
// A clean (unwatermarked) fixture. GIFT_SCENE_ARTWORK may name a real sample image to make the kept evidence look like a customer's picture.
const PAINTING = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4c58a"/><stop offset="0.5" stop-color="#5fa3a8"/><stop offset="1" stop-color="#2b3a67"/></linearGradient></defs><rect width="1200" height="1200" fill="url(#g)"/><circle cx="380" cy="420" r="210" fill="#e4572e" opacity="0.85"/><circle cx="820" cy="760" r="260" fill="#f3e9d2" opacity="0.8"/><rect x="90" y="880" width="1020" height="90" fill="#1d2d44" opacity="0.7"/><rect x="560" y="120" width="70" height="520" fill="#a63d40" opacity="0.8"/></svg>')
const SAMPLE = process.env.GIFT_SCENE_ARTWORK ? fs.readFileSync(process.env.GIFT_SCENE_ARTWORK) : PAINTING

async function world() {
  vi.resetModules()
  vi.doMock('../print/gift-enablement', () => ({ GIFT_ENABLED_FAMILIES: ALL, GIFT_MOCKUP_READY: ALL, GIFT_PRODUCT_HOLDS: {} }))
  const skuMap = await import('../print/sku-map')
  for (const f of ALL) for (const e of Object.values(skuMap.SKU_MAP[f as 'matted']) as any[]) { delete e.retailApproved; e.retailCents = 5000 }      // test prices only
  const [service, store, compose, mockup, real, testOrder, catalog] = await Promise.all([import('./service'), import('./store'), import('./compose'), import('./mockup'), import('./mockup-real'), import('./test-order'), import('../print/catalog')])
  return { service, store, compose, mockup, real, testOrder, catalog }
}
type W = Awaited<ReturnType<typeof world>>

async function journey(W: W, productId: string) {
  const { service, store, compose, mockup, real, testOrder } = W
  const memory = store.memoryGiftStore(), files = new Map<string, Buffer>()
  const generate = vi.fn(async (i: { aspect: string }) => { const [w, h] = i.aspect.split(':').map(Number); return { imageB64: (await sharp(SAMPLE).resize(512 * w, 512 * h, { fit: 'cover' }).png().toBuffer()).toString('base64') } })
  const watermark = vi.fn(async (b64: string) => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer())
  const deps: import('./service').GiftDeps = {
    store: memory, generate, compose: compose.composeWithPrintShop, mockup: real.realMockupRenderer, watermark,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), kick: vi.fn(async () => ({})),
  }
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const view = await service.createSession(deps, { userId: U1, imageB64: photo }); const sid = view.sessionId
  const lines = [{ lineId: 'a', productId, copies: 1 }]
  await service.setLines(deps, U1, sid, lines)
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
  memory.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: testOrder.purchasedItems(lines), prodigi_order_id: null, placed_at: null } as any)
  await memory.linkOrder(sid, U1, orderId, 'v1')
  await memory.confirmOrder({ sessionId: sid, orderId, userId: U1, stripeSessionId: cs, paymentIntent: 'pi_1', lines: testOrder.purchasedLines(lines) })
  const batch = await service.startBatch(deps, U1, sid, { idempotencyKey: 'idem-key-1' })
  await compose.selectArtwork(deps, U1, sid, batch.batch.previews[0].previewId)
  await compose.ensureCompositions(deps, U1, sid)
  return { deps, memory, files, sid, watermark }
}

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.doUnmock('../print/gift-enablement'); vi.resetModules() })

const SCENE_CASES: Array<[string, string]> = [['canvas:12x12', 'gallery-canvas-square'], ['mug:11oz', 'ceramic-mug'], ['card:7x5', 'greeting-card']]
const FALLBACK_CASES = ['fine_art:12x18', 'canvas:12x18', 'framed:12x18', 'fine_art:8x8']

describe('customer scene mockups, end to end on safe fixtures (real renderers, real composition)', () => {
  for (const [productId, sceneId] of SCENE_CASES) {
    it(`${productId}: a paid line gets the clean photographic scene, built from its composition, signed and stored once`, async () => {
      const W = await world(); const J = await journey(W, productId)
      const comp = J.memory.compositions[0], production = J.files.get(comp.composed_path!)!, paidCalls = outpaintCalls.n, marks = J.watermark.mock.calls.length, approvalBefore = JSON.stringify({ s: comp.status, a: comp.attempt, p: comp.composed_path })
      const m = await W.mockup.getLineMockup(J.deps, U1, J.sid, 'a')
      expect(m).toMatchObject({ renderer: 'scene', templateId: 'scene:' + sceneId, watermarked: false, cached: false, productionPrintFile: false, purchaseAuthorization: false, compositionId: comp.id, sourceArtworkId: comp.preview_id })
      expect(m.url).toMatch(/^https:\/\/signed\.test\//); expect(m.scene!.revision).toMatch(/^[0-9a-f]{64}$/)
      const stored = J.files.get(`gift/${J.sid}/mockups/${m.identityKey}.jpg`)!, meta = await sharp(stored).metadata()
      expect(meta.format).toBe('jpeg'); expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1800)
      expect(stored.equals(production)).toBe(false)
      // the production composition, its approval state and its file are exactly as they were
      expect(JSON.stringify({ s: comp.status, a: comp.attempt, p: comp.composed_path })).toBe(approvalBefore); expect(J.files.get(comp.composed_path!)!.equals(production)).toBe(true)
      expect((comp.plan as any).sceneRepresentation).toMatchObject({ sceneId, compositionId: comp.id, favoriteId: comp.preview_id })
      // the artwork really is in the opening: the scene's own sample painting is gone from the centre of the opening
      const scene = await sharp(path.join(process.cwd(), 'public/gift-wizard/mockup-scenes', sceneId, JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/gift-wizard/mockup-scenes', sceneId, 'scene.next.json'), 'utf8')).sourceImage)).removeAlpha().resize(1254, 1254).raw().toBuffer()
      const out = await sharp(stored).removeAlpha().resize(1254, 1254).raw().toBuffer(), b = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/gift-wizard/mockup-scenes', sceneId, 'scene.next.json'), 'utf8')).maskBounds
      const cx = Math.round((b.x0 + b.x1) / 2), cy = Math.round((b.y0 + b.y1) / 2), o = (cy * 1254 + cx) * 3
      expect(Math.abs(out[o] - scene[o]) + Math.abs(out[o + 1] - scene[o + 1]) + Math.abs(out[o + 2] - scene[o + 2])).toBeGreaterThan(12)
      expect(J.watermark.mock.calls.length).toBe(marks); expect(outpaintCalls.n).toBe(paidCalls)                               // the paid mockup was not watermarked, and the scene step made no outpaint call
      const again = await W.mockup.getLineMockup(J.deps, U1, J.sid, 'a'); expect(again).toMatchObject({ cached: true, identityKey: m.identityKey, renderer: 'scene' })
      expect([...J.files.keys()].filter(k => k.includes('/mockups/'))).toHaveLength(1)
      if (EVIDENCE) { fs.mkdirSync(EVIDENCE, { recursive: true }); fs.writeFileSync(path.join(EVIDENCE, productId.replace(':', '-') + '__' + sceneId + '__clean.jpg'), stored) }
    }, 120_000)
  }

  for (const productId of FALLBACK_CASES) {
    it(`${productId}: no scene shows this configuration, so the calibrated renderer makes the mockup exactly as before`, async () => {
      const W = await world(); const J = await journey(W, productId)
      const m = await W.mockup.getLineMockup(J.deps, U1, J.sid, 'a')
      expect(m).toMatchObject({ renderer: 'calibrated', scene: null, watermarked: false, productionPrintFile: false }); expect(m.templateId).not.toMatch(/^scene:/)
      expect((J.memory.compositions[0].plan as any).sceneRepresentation).toBeUndefined()
      if (EVIDENCE) { fs.mkdirSync(EVIDENCE, { recursive: true }); fs.writeFileSync(path.join(EVIDENCE, productId.replace(':', '-') + '__' + m.templateId + '__fallback-clean.jpg'), J.files.get(`gift/${J.sid}/mockups/${m.identityKey}.jpg`)!) }
    }, 120_000)
  }

  it('with GIFT_SCENE_MOCKUPS=0 the same canvas is shown by the calibrated renderer', async () => {
    const W = await world(); const J = await journey(W, 'canvas:12x12'); process.env.GIFT_SCENE_MOCKUPS = '0'
    try { expect(await W.mockup.getLineMockup(J.deps, U1, J.sid, 'a')).toMatchObject({ renderer: 'calibrated', templateId: 'gallery-canvas-square' }) } finally { delete process.env.GIFT_SCENE_MOCKUPS }
  }, 120_000)
})
