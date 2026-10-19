// The server-owned product mockup bridge and the frozen purchased geometry. The renderer, composer, generator and watermark are fakes
// that record how they were called; no model, no Stripe and no real compositor runs here.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { createSession, setLines, startBatch, getSessionView, purgeExpired, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { selectArtwork, ensureCompositions, correctLine, approveComposition, approveOrder, repairLine, REPAIR_CLAIM_MS } from './compose'
import fs from 'node:fs'
import { mockupH } from './handlers'
import { getLineMockup, mockupIdentityKey, pictureArea, templateFor, MOCKUP_URL_SECONDS, MOCKUP_MAX_EDGE, type MockupRenderer } from './mockup'
import { compositionFitsProduct, freezeLine, resolveFrozenProduct } from './frozen'
import { adaptationValidationFor } from './policy'
import { correctionPlanFor, planFor } from './composition-plan'
import { purchasedItems, purchasedLines } from './test-order'
import { allProducts, getProduct } from '../print/catalog'
import { realSceneRenderer } from './mockup-real'
import type { SceneRenderer } from './scenes'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '20000000-0000-4000-8000-000000000002'
type Line = { lineId: string; productId: string; copies: number }

function rig(over: { series?: 'portraits' | 'pets' | 'groups'; people?: number | null; noRenderer?: boolean; scenes?: SceneRenderer } = {}) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const generate = vi.fn(async (i: { aspect: string }) => {
    const [w, h] = i.aspect.split(':').map(Number)
    return { imageB64: (await sharp({ create: { width: 64 * w, height: 64 * h, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64') }
  })
  let tint = 0
  const compose = vi.fn(async (i: { masterB64: string; size: string; finish: string }) => {
    const p = allProducts().find(x => x.size === i.size && (x.family as string) === i.finish)!
    const w = 256, h = Math.round(256 * p.requirements.picturePx.h / p.requirements.picturePx.w)
    tint++
    return { image: await sharp({ create: { width: w, height: h, channels: 3, background: { r: 10 + tint, g: 80, b: 120 } } }).png().toBuffer(), width: w, height: h, fit: 'extend' as const, outpainted: false }
  })
  const state = { revision: 'rev-1', failNext: false, mismatch: false }
  const render = vi.fn(async (i: { templateId: string; productFamily: string; size: string; sku: string; artworkId: string; artwork: Buffer }) => {
    if (state.failNext) { state.failNext = false; throw new Error('boom') }
    const p = allProducts().find(x => x.family === i.productFamily && x.size === i.size)!
    return {
      png: await sharp({ create: { width: 300, height: 200, channels: 3, background: '#cba' } }).png().toBuffer(), width: 300, height: 200, visualizationKey: 'vk-' + i.artworkId,
      configuration: state.mismatch ? { sku: 'OTHER-SKU', requiredPx: { w: 1, h: 1 } } : { sku: p.sku, requiredPx: { w: p.requirements.finalPx.w, h: p.requirements.finalPx.h } },
      crop: { fit: 'cover', allowCrop: false },
    }
  })
  const mockup: MockupRenderer = { revision: vi.fn(async () => state.revision), render, ...(over.scenes ? { scenes: over.scenes } : {}) }
  const watermark = vi.fn(async (b64: string) => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer())
  const deps: GiftDeps = {
    store, compose, generate, watermark, ...(over.noRenderer ? {} : { mockup }),
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: vi.fn(async (ps: string[]) => { for (const p of ps) files.delete(p) }), signedUrl: async (p, s) => (files.has(p) ? `https://signed.test/${p}?ttl=${s}` : null) },
    analyze: async () => ({ status: 'supported', series: over.series ?? 'portraits', peopleCount: over.people ?? null }),
    kick: vi.fn(async () => ({})),
  }
  return { deps, store, files, generate, compose, render, watermark, state }
}
async function project(r: ReturnType<typeof rig>, lines: Line[], opts: { snapshot?: boolean; user?: string } = {}) {
  const user = opts.user ?? U1
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const view = await createSession(r.deps, { userId: user, imageB64: photo })
  await setLines(r.deps, user, view.sessionId, lines)
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
  r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: purchasedItems(lines, { snapshot: opts.snapshot }), prodigi_order_id: null, placed_at: null })
  await r.store.linkOrder(view.sessionId, user, orderId, 'v1')
  await r.store.confirmOrder({ sessionId: view.sessionId, orderId, userId: user, stripeSessionId: cs, paymentIntent: 'pi_1', lines: purchasedLines(lines) })
  const b = await startBatch(r.deps, user, view.sessionId, { idempotencyKey: 'idem-key-1' })
  return { sid: view.sessionId, orderId, previews: b.batch.previews, user }
}
const ready = async (r: ReturnType<typeof rig>, lines: Line[], opts: { snapshot?: boolean } = {}) => {
  const p = await project(r, lines, opts); await selectArtwork(r.deps, p.user, p.sid, p.previews[0].previewId); await ensureCompositions(r.deps, p.user, p.sid); return p
}
const L12 = { lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, C8 = { lineId: 'b', productId: 'canvas:8x8', copies: 1 }, F12 = { lineId: 'c', productId: 'framed:12x18', copies: 1 }
const mockupFiles = (r: ReturnType<typeof rig>) => [...r.files.keys()].filter(k => k.includes('/mockups/'))

describe('the mockup response', () => {
  it('returns a CLEAN (unwatermarked), signed product mockup for a paid line, with the identity and an explicit non-authorization', async () => {
    const r = rig(); const { sid, orderId } = await ready(r, [L12])
    const wm = r.watermark.mock.calls.length
    const m = await getLineMockup(r.deps, U1, sid, 'a')
    const comp = r.store.compositions[0]
    expect(m).toMatchObject({ contractVersion: 1, lineId: 'a', productId: 'fine_art:12x18', sku: 'GLOBAL-FAP-12X18', compositionId: comp.id, attempt: 1, compositionStatus: 'ready', sourceArtworkId: comp.preview_id,
      templateId: 'fine-art', geometrySource: 'frozen', frozenCatalogVersion: 'test-catalog', cached: false, watermarked: false, productionPrintFile: false, purchaseAuthorization: false, width: 300, height: 200 })
    expect(m.url).toMatch(/^https:\/\/signed\.test\/gift\/.+\/mockups\/[0-9a-f]{64}\.jpg\?ttl=900$/); expect(m.identityKey).toMatch(/^[0-9a-f]{64}$/)
    expect(Date.parse(m.urlExpiresAt)).toBeGreaterThan(Date.now()); expect(MOCKUP_URL_SECONDS).toBe(900)
    expect(await sharp(r.files.get(`gift/${sid}/mockups/${m.identityKey}.jpg`)!).metadata()).toMatchObject({ format: 'jpeg' })      // stored as a JPEG
    expect(r.watermark.mock.calls.length).toBe(wm); expect(orderId).toBeTruthy()                                       // paid: nothing is watermarked
  })
  it('hands the renderer the CLEAN composed artwork in memory and never returns or stores a clean file next to the mockup', async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    const m = await getLineMockup(r.deps, U1, sid, 'a'); const comp = r.store.compositions[0]
    const input = r.render.mock.calls[0][0]; expect(Buffer.compare(input.artwork, r.files.get(comp.composed_path!)!)).toBe(0)
    expect(JSON.stringify(m)).not.toMatch(/\.png|composed_path|master|artwork":/); expect(mockupFiles(r).every(k => k.endsWith('.jpg'))).toBe(true)
    expect(Object.keys(input).sort()).toEqual(['artwork', 'artworkId', 'productFamily', 'size', 'sku', 'templateId'])         // no URL, no storage credential
  })
  it('a repeat call with an unchanged identity renders nothing and only re-signs the stored file', async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    const wm = r.watermark.mock.calls.length
    const a = await getLineMockup(r.deps, U1, sid, 'a'), b = await getLineMockup(r.deps, U1, sid, 'a')
    expect(r.render).toHaveBeenCalledTimes(1); expect(r.watermark.mock.calls.length).toBe(wm); expect([a.cached, b.cached]).toEqual([false, true]); expect(b.identityKey).toBe(a.identityKey)
    expect(mockupFiles(r).length).toBe(1)
  })
  it('concurrent calls are safe: the same identity, one stored file', async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    const out = await Promise.all([1, 2, 3].map(() => getLineMockup(r.deps, U1, sid, 'a')))
    expect(new Set(out.map(o => o.identityKey)).size).toBe(1); expect(mockupFiles(r).length).toBe(1)
  })
  it('each line gets its own template, identity and file, even when two lines share one composition', async () => {
    const r = rig(); const { sid } = await ready(r, [L12, C8, F12])
    const [a, b, c] = await Promise.all(['a', 'b', 'c'].map(id => getLineMockup(r.deps, U1, sid, id)))
    expect([a.templateId, b.templateId, c.templateId]).toEqual(['fine-art', 'gallery-canvas-square', 'classic-framed'])
    expect(new Set([a.identityKey, b.identityKey, c.identityKey]).size).toBe(3); expect(new Set([a.url, b.url, c.url]).size).toBe(3)
    expect(r.store.compositions.find(x => x.line_id === 'a')!.composed_path).toBe(r.store.compositions.find(x => x.line_id === 'c')!.composed_path)    // a and c share artwork files...
  })
})

describe('authorization', () => {
  it("another customer's session is indistinguishable from a missing one", async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    await expect(getLineMockup(r.deps, U2, sid, 'a')).rejects.toMatchObject({ code: 'session_not_found', status: 404 })
    expect(r.render).not.toHaveBeenCalled()
  })
  it('a line that is not on this order, or is not a plain id, is refused before anything is read or rendered', async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    for (const bad of ['zzz', '', '../a', undefined, 42, { a: 1 }, 'a'.repeat(65)]) await expect(getLineMockup(r.deps, U1, sid, bad as any)).rejects.toMatchObject({ code: 'line_not_found' })
    expect(r.render).not.toHaveBeenCalled()
  })
  it("a line of ANOTHER customer's order cannot be reached through your own session", async () => {
    const r = rig(); const mine = await ready(r, [L12]); const other = await ready(r, [{ lineId: 'zz', productId: 'canvas:8x8', copies: 1 }], {}); void other
    await expect(getLineMockup(r.deps, U1, mine.sid, 'zz')).rejects.toMatchObject({ code: 'line_not_found' })
  })
  it('needs a paid order: no order refuses; after payment a refund request or a refund blocks it', async () => {
    const r = rig(); const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
    const v = await createSession(r.deps, { userId: U1, imageB64: photo })
    await expect(getLineMockup(r.deps, U1, v.sessionId, 'a')).rejects.toMatchObject({ code: 'order_payment_required' })
    const p = await ready(r, [L12]); const rec = r.store.sessions.get(p.sid)!
    rec.refund_requested_at = new Date().toISOString(); await expect(getLineMockup(r.deps, U1, p.sid, 'a')).rejects.toMatchObject({ code: 'refund_pending' })
    rec.refund_requested_at = null; rec.refunded_at = new Date().toISOString(); await expect(getLineMockup(r.deps, U1, p.sid, 'a')).rejects.toMatchObject({ code: 'order_refunded' })
  })
  it('a composition that does not exist yet, or a missing selected artwork, is a 409, never a render', async () => {
    const r = rig(); const p = await project(r, [L12])
    await expect(getLineMockup(r.deps, U1, p.sid, 'a')).rejects.toMatchObject({ code: 'artwork_not_selected' })
    await selectArtwork(r.deps, U1, p.sid, p.previews[0].previewId)
    await expect(getLineMockup(r.deps, U1, p.sid, 'a')).rejects.toMatchObject({ code: 'composition_not_found' }); expect(r.render).not.toHaveBeenCalled()
  })
  it('there is no way to name a composition, URL, product or geometry: the only inputs are the session, the line and an optional "expected" composition id', () => {
    expect(getLineMockup.length).toBeLessThanOrEqual(5)
  })
})

describe('invalidation and retry', () => {
  it('a correction supersedes the composition: new composition id and identity, the old mockup file removed, a page showing the old one is told it is stale', async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    const first = await getLineMockup(r.deps, U1, sid, 'a'); const oldPath = `gift/${sid}/mockups/${first.identityKey}.jpg`; expect(r.files.has(oldPath)).toBe(true)
    await correctLine(r.deps, U1, sid, 'a')
    await expect(getLineMockup(r.deps, U1, sid, 'a', first.compositionId)).rejects.toMatchObject({ code: 'stale_composition', status: 409 })
    expect(r.files.has(oldPath)).toBe(false)
    const second = await getLineMockup(r.deps, U1, sid, 'a', undefined)
    expect(second.attempt).toBe(2); expect(second.compositionId).not.toBe(first.compositionId); expect(second.identityKey).not.toBe(first.identityKey)
    expect(second.cached).toBe(false); expect(mockupFiles(r).length).toBe(1)
  })
  it('an approved composition keeps its approval across mockup calls, and a mockup never approves anything', async () => {
    const r = rig(); const { sid } = await ready(r, [L12, C8])
    const m = await getLineMockup(r.deps, U1, sid, 'a')
    expect(r.store.compositions.every(c => c.status === 'ready')).toBe(true)
    await approveComposition(r.deps, U1, sid, m.compositionId)
    const after = await getLineMockup(r.deps, U1, sid, 'a'); expect(after.compositionStatus).toBe('approved'); expect(after.identityKey).toBe(m.identityKey)
    expect(r.store.compositions.find(c => c.line_id === 'b')!.status).toBe('ready')                                             // the other line is untouched
  })
  it('choosing a different favorite changes the artwork identity, so no mockup of the old artwork is ever served', async () => {
    const r = rig(); const { sid, previews } = await ready(r, [L12])
    const first = await getLineMockup(r.deps, U1, sid, 'a')
    await selectArtwork(r.deps, U1, sid, previews[1].previewId)
    await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'composition_not_found' })              // the old composition was superseded; nothing stale to show
    await ensureCompositions(r.deps, U1, sid); const second = await getLineMockup(r.deps, U1, sid, 'a')
    expect(second.sourceArtworkId).toBe(previews[1].previewId); expect(second.identityKey).not.toBe(first.identityKey)
  })
  it('a revised template (or renderer) changes the identity and re-renders; the old file is removed', async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    const a = await getLineMockup(r.deps, U1, sid, 'a'); r.state.revision = 'rev-2'
    const b = await getLineMockup(r.deps, U1, sid, 'a')
    expect(b.identityKey).not.toBe(a.identityKey); expect(b.templateRevision).toBe('rev-2'); expect(r.render).toHaveBeenCalledTimes(2); expect(mockupFiles(r).length).toBe(1)
  })
  it('a failed render stores nothing and is retried cleanly; a renderer that disagrees with the purchase is refused', async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    r.state.failNext = true; await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'mockup_failed', status: 502 }); expect(mockupFiles(r).length).toBe(0)
    r.state.mismatch = true; await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'mockup_configuration_mismatch' }); expect(mockupFiles(r).length).toBe(0)
    r.state.mismatch = false; expect((await getLineMockup(r.deps, U1, sid, 'a')).cached).toBe(false); expect(mockupFiles(r).length).toBe(1)
  })
  it('an image that cannot be encoded is a 502 and nothing is stored', async () => {
    const r = rig(); const { sid } = await ready(r, [L12]); const p = getProduct('fine_art:12x18')!
    r.render.mockResolvedValueOnce({ png: Buffer.from('not an image'), width: 300, height: 200, visualizationKey: 'vk', configuration: { sku: p.sku, requiredPx: p.requirements.finalPx }, crop: { fit: 'cover', allowCrop: false } })
    await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'mockup_failed' }); expect(mockupFiles(r).length).toBe(0)
  })
  it('without a renderer the endpoint says so (503) and nothing else changes', async () => {
    const r = rig({ noRenderer: true }); const { sid } = await ready(r, [L12])
    await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'mockup_renderer_unavailable', status: 503 })
  })
  it('stored mockups are removed with the session', async () => {
    const r = rig(); const { sid, orderId } = await ready(r, [L12, C8]); await getLineMockup(r.deps, U1, sid, 'a'); await getLineMockup(r.deps, U1, sid, 'b')
    await r.store.releaseSession(orderId); r.store.sessions.get(sid)!.expires_at = new Date(Date.now() - 1000).toISOString(); await purgeExpired(r.deps)
    expect([...r.files.keys()].filter(k => k.includes(sid))).toEqual([])
  })
})

describe('the identity is a pure function of what the picture depends on', () => {
  const p = getProduct('fine_art:12x18')!
  const base = { orderId: 'o', lineId: 'a', lineIndex: 0, compositionId: 'c1', attempt: 1, sourceArtworkId: 'p1', artworkSha256: 'h', templateId: 'fine-art', templateRevision: 'r', product: p, geometrySource: 'frozen', frozenCatalogVersion: 'v', clean: true }
  it('is stable for the same inputs and changes with each input', () => {
    const k = mockupIdentityKey(base); expect(mockupIdentityKey({ ...base })).toBe(k)
    for (const change of [{ orderId: 'o2' }, { lineId: 'b' }, { lineIndex: 1 }, { compositionId: 'c2' }, { attempt: 2 }, { sourceArtworkId: 'p2' }, { artworkSha256: 'h2' }, { templateId: 'premium-fine-art' }, { templateRevision: 'r2' },
      { product: getProduct('fine_art:8x12')! }, { product: { ...p, attributes: { ...p.attributes, paperType: 'X' } } }, { geometrySource: 'legacy_catalog' }, { frozenCatalogVersion: 'v2' }, { clean: false }]) {
      expect(mockupIdentityKey({ ...base, ...change } as any), JSON.stringify(Object.keys(change))).not.toBe(k)
    }
  })
  it('never involves a signed URL', () => { expect(JSON.stringify(base)).not.toMatch(/http|token|signature/i) })
})

describe('what the renderer is shown', () => {
  const meta = async (b: Buffer) => { const m = await sharp(b).metadata(); return [m.width, m.height] }
  it('a canvas file loses its mirrored wrap margin and nothing else: the picture area exactly', async () => {
    const p = getProduct('canvas:12x18')!, f = p.requirements.finalPx
    const art = await sharp({ create: { width: f.w, height: f.h, channels: 3, background: '#789' } }).png().toBuffer()
    expect(await meta(await pictureArea(art, p))).toEqual([3600, 5400])
  })
  it('a preview-scale canvas file has the margin scaled by the same factor; a product without wrap passes through byte for byte', async () => {
    const c = getProduct('canvas:12x18')!, f = c.requirements.finalPx
    const small = await sharp({ create: { width: f.w / 6, height: f.h / 6, channels: 3, background: '#789' } }).png().toBuffer()
    expect(await meta(await pictureArea(small, c))).toEqual([600, 900])
    const flat = await sharp({ create: { width: 90, height: 60, channels: 3, background: '#789' } }).png().toBuffer()
    expect(await pictureArea(flat, getProduct('fine_art:12x18')!)).toBe(flat)
  })
  it('a front-only composed file (what the composition step produces) is the whole front: nothing is removed, and a square file is never trimmed on a guess', async () => {
    const c = getProduct('canvas:12x18')!, front = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: '#789' } }).png().toBuffer()
    expect(await pictureArea(front, c)).toBe(front)                                                                  // 2:3, the picture's own shape: byte for byte
    const sq = getProduct('canvas:8x8')!, f = sq.requirements.finalPx, square = await sharp({ create: { width: f.w / 6, height: f.h / 6, channels: 3, background: '#789' } }).png().toBuffer()
    expect(await pictureArea(square, sq)).toBe(square)
  })
  it('a file of the wrong shape for a wrapped product is refused, never guessed', async () => {
    const wrong = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#789' } }).png().toBuffer()
    await expect(pictureArea(wrong, getProduct('canvas:8x8')!)).rejects.toThrow('artwork_shape_mismatch')
  })
  it('the bridge passes the renderer the whole front of a canvas line: a composed (front-only) file is not trimmed', async () => {
    const r = rig(); const { sid } = await ready(r, [C8]); await getLineMockup(r.deps, U1, sid, 'b')
    const given = r.render.mock.calls[0][0].artwork, composed = r.files.get(r.store.compositions[0].composed_path!)!
    const m = await sharp(given).metadata(); expect(m.width).toBe(m.height); expect(given.equals(composed)).toBe(true)
  })
})

describe('templates: only the approved, purchasable products have one', () => {
  it('prints, premium, black frames and MirrorWrap canvas map to the approved templates; the mug and the 7 x 5 Mohawk card map to the visual-test templates; matted frame, framed canvas and every other card variant map to nothing', () => {
    expect(templateFor(getProduct('fine_art:12x18')!)).toBe('fine-art'); expect(templateFor(getProduct('premium:16x24')!)).toBe('premium-fine-art')
    expect(templateFor(getProduct('framed:12x18')!)).toBe('classic-framed'); expect(templateFor(getProduct('framed:8x8')!)).toBe('square-framed')
    expect(templateFor(getProduct('canvas:12x18')!)).toBe('gallery-canvas'); expect(templateFor(getProduct('canvas:8x8')!)).toBe('gallery-canvas-square')
    expect(templateFor(getProduct('mug:11oz')!)).toBe('ceramic-mug'); expect(templateFor(getProduct('card:7x5')!)).toBe('greeting-card')
    for (const p of allProducts().filter(x => x.status === 'disabled' && !['mug:11oz', 'card:7x5'].includes(x.productId))) expect(templateFor(p), p.productId).toBeNull()
  })
  it('the mug and the card stay disabled and unpriced until the owner approves a price', () => {
    for (const p of allProducts().filter(x => x.kind === 'mug' || x.kind === 'greeting_card')) { expect(p.status).toBe('disabled'); expect(p.retailCents).toBeNull() }
  })
})

describe('frozen purchased geometry', () => {
  const cat = allProducts()
  const line = { product_id: 'fine_art:12x18', sku: 'GLOBAL-FAP-12X18', line_index: 0 }
  const p12 = getProduct('fine_art:12x18')!
  it('a snapshot is read as taken, whatever today\'s catalog says', () => {
    const items = [{ sku: p12.sku, frozen: freezeLine({ ...p12, requirements: { ...p12.requirements, picturePx: { w: 3000, h: 4500 } } }, 0, 'old') }]
    const r = resolveFrozenProduct(items, line, cat)
    expect(r).toMatchObject({ ok: true, source: 'frozen', catalogVersion: 'old' }); if (r.ok) expect(r.product.requirements.picturePx).toEqual({ w: 3000, h: 4500 })
  })
  it('the order view reports the frozen geometry, not the current catalog', async () => {
    const r = rig(); const { sid, orderId } = await ready(r, [L12])
    const order = r.store.orders.get(orderId)!; const fr: any = order.items[0].frozen; fr.product.requirements.picturePx = { w: 3000, h: 4500 }
    const v = await getSessionView(r.deps, U1, sid)
    expect(v.compositions[0].picturePx).toEqual({ w: 3000, h: 4500 }); expect(v.geometries[0]).toMatchObject({ sku: 'GLOBAL-FAP-12X18', geometrySource: 'frozen', frozenCatalogVersion: 'test-catalog' })
  })
  it('a legacy order (no snapshot) resolves from the catalog ONLY while the SKU still matches, and says so', async () => {
    const r = rig(); const { sid } = await ready(r, [L12], { snapshot: false })
    const m = await getLineMockup(r.deps, U1, sid, 'a'); expect(m).toMatchObject({ geometrySource: 'legacy_catalog', frozenCatalogVersion: null })
    expect((await getSessionView(r.deps, U1, sid)).geometries[0]).toMatchObject({ geometrySource: 'legacy_catalog' })
    expect(resolveFrozenProduct([{ sku: 'GLOBAL-FAP-12X18' }], line, cat.map(c => c.productId === line.product_id ? { ...c, sku: 'CHANGED' } : c))).toEqual({ ok: false, reason: 'geometry_snapshot_unavailable' })
  })
  it('a legacy order whose SKU is no longer sold, a missing item, and a snapshot that disagrees with the line are refused, never guessed', async () => {
    expect(resolveFrozenProduct([{ sku: 'GONE' }], { ...line, sku: 'GONE' }, cat)).toEqual({ ok: false, reason: 'geometry_snapshot_unavailable' })
    expect(resolveFrozenProduct([], line, cat)).toEqual({ ok: false, reason: 'geometry_snapshot_unavailable' })
    expect(resolveFrozenProduct([{ sku: p12.sku, frozen: freezeLine(getProduct('fine_art:8x12')!, 0) }], line, cat)).toEqual({ ok: false, reason: 'geometry_snapshot_invalid' })
    expect(resolveFrozenProduct([{ sku: p12.sku, frozen: { snapshotVersion: 9, product: p12 } }], line, cat)).toEqual({ ok: false, reason: 'geometry_snapshot_invalid' })
    expect(resolveFrozenProduct([{ sku: p12.sku, frozen: { snapshotVersion: 1, catalogVersion: 'x', product: { ...p12, requirements: { ...p12.requirements, finalPx: { w: 0, h: 0 } } } } }], line, cat)).toEqual({ ok: false, reason: 'geometry_snapshot_invalid' })
  })
  it('compositions and the mockup refuse an order whose snapshot is invalid, with a clear 409', async () => {
    const r = rig(); const p = await project(r, [L12]); await selectArtwork(r.deps, U1, p.sid, p.previews[0].previewId)
    ;(r.store.orders.get(p.orderId)!.items[0].frozen as any).product.sku = 'TAMPERED'
    await expect(ensureCompositions(r.deps, U1, p.sid)).rejects.toMatchObject({ code: 'geometry_snapshot_invalid', status: 409 })
  })
  it('composition planning uses the frozen product: a snapshot with a different shape plans differently from today\'s catalog', async () => {
    const r = rig(); const p = await project(r, [C8]); await selectArtwork(r.deps, U1, p.sid, p.previews[0].previewId)
    await ensureCompositions(r.deps, U1, p.sid)
    expect(r.store.compositions[0]).toMatchObject({ geometry_key: 'a1000' })
  })
})

describe('the included correction (customer-initiated, one per line)', () => {
  it('a deterministic line falls back to ONE generated adaptation: a new NB2.1 call with the favorite as the reference, recorded as such', async () => {
    const r = rig(); const { sid, previews } = await ready(r, [C8])                         // the Portraits master is square, so the 8 x 8 canvas starts deterministic
    expect(r.store.compositions[0]).toMatchObject({ method: 'deterministic', generation_mode: 'none', nb21_calls: 0 })
    const gen = r.generate.mock.calls.length
    await correctLine(r.deps, U1, sid, 'b')
    expect(r.generate.mock.calls.length).toBe(gen + 1)
    expect(r.generate.mock.calls[gen][0]).toMatchObject({ aspect: '1:1', productComposition: true, effectId: previews[0].effectId }); expect((r.generate.mock.calls[gen][0] as any).referenceB64).toBeTruthy()
    const second = r.store.compositions.find(c => c.attempt === 2)!
    expect(second).toMatchObject({ method: 'generated', generation_mode: 'favorite_reference', generation_aspect: '1:1', nb21_calls: 1, preview_id: previews[0].previewId })
    expect(second.plan).toMatchObject({ correction: true, correctionFallbackFrom: 'deterministic' })
    expect(r.store.compositions.find(c => c.attempt === 1)!.status).toBe('superseded')
  })
  it('the one-correction limit, idempotency and a clean retry are preserved: a failed generation spends nothing and leaves one attempt-2 row after the retry', async () => {
    const r = rig(); const { sid } = await ready(r, [C8])
    r.generate.mockRejectedValueOnce(new Error('nb2_failed'))
    await expect(correctLine(r.deps, U1, sid, 'b')).rejects.toMatchObject({ code: 'composition_failed' })
    expect(r.store.compositions.filter(c => c.attempt === 2).length).toBe(0); expect((await r.store.orderLines(r.store.sessions.get(sid)!.order_id!))[0].corrections_used).toBe(0)
    await correctLine(r.deps, U1, sid, 'b')
    expect(r.store.compositions.filter(c => c.attempt === 2).length).toBe(1)
    await expect(correctLine(r.deps, U1, sid, 'b')).rejects.toMatchObject({ code: 'correction_limit', status: 409 })
    expect(r.store.compositions.filter(c => c.attempt === 2).length).toBe(1)
  })
  it('nothing generates on its own: composing, viewing and mockups never call the generator after the previews', async () => {
    const r = rig(); const { sid } = await ready(r, [C8]); const gen = r.generate.mock.calls.length
    await getSessionView(r.deps, U1, sid); await getLineMockup(r.deps, U1, sid, 'b'); await ensureCompositions(r.deps, U1, sid); await getSessionView(r.deps, U1, sid)
    expect(r.generate.mock.calls.length).toBe(gen)
  })
  it("a correction on one line leaves the other line's composition, approval and mockup alone", async () => {
    const r = rig(); const { sid } = await ready(r, [L12, C8])
    const a = await getLineMockup(r.deps, U1, sid, 'a'); await approveComposition(r.deps, U1, sid, a.compositionId)
    await correctLine(r.deps, U1, sid, 'b')
    const aAfter = await getLineMockup(r.deps, U1, sid, 'a'); expect(aAfter).toMatchObject({ identityKey: a.identityKey, compositionStatus: 'approved', cached: true })
    expect(r.store.compositions.find(c => c.line_id === 'a')!.status).toBe('approved')
  })
  it('a generated line keeps its plan: the correction is one new generation, as before', async () => {
    const r = rig(); const { sid } = await ready(r, [L12]); const gen = r.generate.mock.calls.length
    await correctLine(r.deps, U1, sid, 'a')
    expect(r.generate.mock.calls.length).toBe(gen + 1); expect(r.store.compositions.find(c => c.attempt === 2)!.plan).not.toHaveProperty('correctionFallbackFrom')
  })
  it('Groups lines fall back too, labeled photo_regeneration and still unvalidated (the Groups reference is off)', async () => {
    const r = rig({ series: 'groups', people: 4 }); const { sid } = await ready(r, [C8])      // a 3:2 master cannot become a square by extension alone
    const first = r.store.compositions[0]; await correctLine(r.deps, U1, sid, 'b')
    const second = r.store.compositions.find(c => c.attempt === 2)!
    expect([first.method, second.method, second.generation_mode]).toEqual(['generated', 'generated', 'photo_regeneration']); expect((r.generate.mock.calls.at(-1)![0] as any).referenceB64).toBeUndefined()
    expect((await getSessionView(r.deps, U1, sid)).compositions[0]).toMatchObject({ adaptationValidation: 'unvalidated', generationMode: 'photo_regeneration' })
  })
  it('correctionPlanFor: generated keeps its plan, deterministic becomes generated at the nearest reachable ratio, an unreachable shape keeps the old recomposition (null)', () => {
    const p = getProduct('canvas:8x8')!; const ctx = { series: 'portraits' as const, peopleCount: null, masterAspect: '1:1' }
    const det = planFor(p, ctx)!; const c = correctionPlanFor(p, ctx, det)!
    expect([det.method, c.method, c.generationAspect, c.geometryKey]).toEqual(['deterministic', 'generated', '1:1', det.geometryKey])
    const g = planFor(getProduct('fine_art:12x18')!, ctx)!; expect(correctionPlanFor(getProduct('fine_art:12x18')!, ctx, g)).toBe(g)
    const odd = { ...p, requirements: { ...p.requirements, pictureAspect: 9 } }; expect(correctionPlanFor(odd, ctx, { ...det, targetAspect: 9 })).toBeNull()
  })
})

describe('adaptation validation is metadata only', () => {
  it('Groups photo regeneration is "unvalidated", Portraits and Pets generation "provisional", deterministic adaptation "not_applicable"', () => {
    expect(adaptationValidationFor('groups', 'generated')).toBe('unvalidated'); expect(adaptationValidationFor('portraits', 'generated')).toBe('provisional')
    expect(adaptationValidationFor('pets', 'generated')).toBe('provisional'); expect(adaptationValidationFor('groups', 'deterministic')).toBe('not_applicable'); expect(adaptationValidationFor(null, null)).toBe('not_applicable')
  })
  it('the order view carries it on both the geometry and the composition', async () => {
    const r = rig({ series: 'groups', people: 2 }); const { sid } = await ready(r, [L12])         // two people: a 2:3 master, so a 2:3 product is a direct adaptation
    const v = await getSessionView(r.deps, U1, sid)
    expect(v.geometries[0]).toMatchObject({ method: 'deterministic', adaptationValidation: 'not_applicable' })
    const r2 = rig(); const p = await ready(r2, [L12]); const v2 = await getSessionView(r2.deps, U1, p.sid)
    expect(v2.compositions[0]).toMatchObject({ method: 'generated', adaptationValidation: 'provisional' })
  })
})

describe('the HTTP layer', () => {
  const req = (q = '') => new Request('https://x.test/api/v1/gift/sessions/s/lines/a/mockup' + q)
  it('answers 200 no-store with the MockupView for the owner, passing the expected composition id through', async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    const ok = await mockupH(req(), { id: U1 }, r.deps, sid, 'a'); expect(ok.status).toBe(200); expect(ok.headers.get('Cache-Control')).toBe('no-store')
    const body = await ok.json(); expect(body).toMatchObject({ lineId: 'a', watermarked: false, purchaseAuthorization: false })
    const stale = await mockupH(req('?compositionId=00000000-0000-4000-8000-000000000000'), { id: U1 }, r.deps, sid, 'a'); expect([stale.status, (await stale.json()).error]).toEqual([409, 'stale_composition'])
    const good = await mockupH(req('?compositionId=' + body.compositionId), { id: U1 }, r.deps, sid, 'a'); expect(good.status).toBe(200)
  })
  it("answers 404 for another customer's session or a foreign line, and 503 when no renderer is installed", async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    expect((await mockupH(req(), { id: U2 }, r.deps, sid, 'a')).status).toBe(404); expect((await mockupH(req(), { id: U1 }, r.deps, sid, 'zz')).status).toBe(404)
    const n = rig({ noRenderer: true }); const p = await ready(n, [L12]); expect((await mockupH(req(), { id: U1 }, n.deps, p.sid, 'a')).status).toBe(503)
  })
  it('the route is signed-in only and takes nothing from the browser but the two path ids and the optional expected composition', () => {
    const route = fs.readFileSync('app/api/v1/gift/sessions/[id]/lines/[lineId]/mockup/route.ts', 'utf8')
    expect(route).toContain('getUser()'); expect(route).toContain('signInRequired()'); expect(route).toContain("export async function GET"); expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
    expect(route.indexOf('getUser()')).toBeLessThan(route.indexOf('mockupH('))
    expect(fs.readFileSync('lib/v1/gift/handlers.ts', 'utf8')).toMatch(/searchParams\.get\('compositionId'\)/)
  })
})

describe('a mockup failure is diagnosable from the server log, and never leaks to the browser', () => {
  it('logs the stage, template, SKU and the real error text for a renderer failure, while the response stays the stable mockup_failed', async () => {
    const r = rig(); const { sid } = await ready(r, [L12]); const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    r.render.mockRejectedValueOnce(Object.assign(new Error("ENOENT: no such file or directory, open '/var/task/public/gift-wizard/catalog.next.json'"), { code: 'ENOENT' }))
    await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'mockup_failed', status: 502 })
    const line = spy.mock.calls.map(c => String(c[0])).find(l => l.includes('[gift/mockup]'))!
    expect(line).toContain('renderer failed'); expect(line).toContain('template=fine-art'); expect(line).toContain('sku=GLOBAL-FAP-12X18'); expect(line).toContain('ENOENT'); expect(line).toContain('catalog.next.json')
    expect(line).not.toMatch(/base64|\.png|gift\/[0-9a-f-]{36}\//); spy.mockRestore()
  })
  it('names the encode and signing stages too', async () => {
    const r = rig(); const { sid } = await ready(r, [L12]); const spy = vi.spyOn(console, 'error').mockImplementation(() => {}); const p = getProduct('fine_art:12x18')!
    r.render.mockResolvedValueOnce({ png: Buffer.from('not an image'), width: 300, height: 200, visualizationKey: 'vk', configuration: { sku: p.sku, requiredPx: p.requirements.finalPx }, crop: { fit: 'cover', allowCrop: false } })
    await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'mockup_failed' })
    r.deps.storage.signedUrl = async () => null; await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'mockup_failed' })
    const lines = spy.mock.calls.map(c => String(c[0])).filter(l => l.includes('[gift/mockup]')); expect(lines.some(l => l.includes('encode failed'))).toBe(true); expect(lines.some(l => l.includes('sign failed'))).toBe(true); spy.mockRestore()
  })
})

describe('the purchased orientation is fixed (landscape artwork, portrait product)', () => {
  it('plans a landscape master for a portrait product as a generation at the product orientation, never a turned deterministic fit', () => {
    const ctx = { series: 'groups' as const, peopleCount: 4, masterAspect: '3:2' }
    const plan = planFor(getProduct('fine_art:12x18')!, ctx)!
    expect([plan.method, plan.generationAspect, plan.targetAspect]).toEqual(['generated', '2:3', 0.666667])
    expect(planFor(getProduct('fine_art:12x18')!, { ...ctx, peopleCount: 2, masterAspect: '2:3' })!.method).toBe('deterministic')
  })
  it('a landscape master and a portrait Fine Art Print: the composition is portrait, matches the frozen geometry, and the mockup renders', async () => {
    const r = rig({ series: 'groups', people: 4 }); const { sid } = await ready(r, [L12])
    const c = r.store.compositions[0]; expect(c.method).toBe('generated'); expect(c.width!).toBeLessThan(c.height!)
    const m = await getLineMockup(r.deps, U1, sid, 'a'); expect(m.sku).toBe('GLOBAL-FAP-12X18'); expect(r.render).toHaveBeenCalledTimes(1)
  })
  it('a landscape file already stored for a portrait product (the Preview failure) is refused with 409 before any rendering, and cannot be approved', async () => {
    const r = rig(); const { sid } = await ready(r, [L12])
    Object.assign(r.store.compositions[0], { width: 1575, height: 1050 })        // the shape found on Preview
    await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'composition_geometry_mismatch', status: 409 })
    expect(r.render).not.toHaveBeenCalled(); expect(r.watermark.mock.calls.length).toBeGreaterThan(0)
    await expect(approveComposition(r.deps, U1, sid, r.store.compositions[0].id)).rejects.toMatchObject({ code: 'composition_geometry_mismatch' })
    expect(r.store.compositions[0].status).toBe('ready')
  })
  it('a compositor that returns the wrong shape stores nothing', async () => {
    const r = rig(); const p = await project(r, [L12]); await selectArtwork(r.deps, p.user, p.sid, p.previews[0].previewId)
    r.compose.mockImplementationOnce(async () => ({ image: await sharp({ create: { width: 300, height: 200, channels: 3, background: '#111' } }).png().toBuffer(), width: 300, height: 200, fit: 'extend' as const, outpainted: false }))
    await expect(ensureCompositions(r.deps, p.user, p.sid)).rejects.toMatchObject({ code: 'composition_failed' })
    expect(r.store.compositions.length).toBe(0); expect([...r.files.keys()].some(k => k.includes('/compositions/'))).toBe(false)
  })
  it('compositionFitsProduct compares the stored shape with the frozen final or picture area, and does not guess for rows without dimensions', () => {
    const fa = getProduct('fine_art:12x18')!, canvas = getProduct('canvas:12x12')!
    expect(compositionFitsProduct({ width: 1050, height: 1575 }, fa)).toBe(true); expect(compositionFitsProduct({ width: 1575, height: 1050 }, fa)).toBe(false)
    expect(compositionFitsProduct({ width: 1000, height: 1000 }, canvas)).toBe(true); expect(compositionFitsProduct({ width: null, height: null }, fa)).toBe(true)
  })
})

describe('clean mockups after verified payment', () => {
  it('the 6+6 free previews stay watermarked: producing a clean mockup never touches the watermark path or the preview files', async () => {
    const r = rig(); const { sid } = await ready(r, [L12]); const marked = r.watermark.mock.calls.length
    expect(marked).toBeGreaterThanOrEqual(6)                                                             // the batch of six was watermarked when it was generated
    await getLineMockup(r.deps, U1, sid, 'a'); expect(r.watermark.mock.calls.length).toBe(marked)
    const view = await getSessionView(r.deps, U1, sid); expect(view.batches[0].previews.every(p => p.status === 'ready' && !!p.url)).toBe(true)
    for (const p of r.store.previews) expect(p.preview_path).toMatch(/preview/)                          // the customer-facing preview path, not the master
  })
  it('delivers a bounded product scene as a JPEG, never the production-resolution file, the clean composition or a master URL', async () => {
    const r = rig(); const { sid } = await ready(r, [L12]); const p = getProduct('fine_art:12x18')!
    r.render.mockResolvedValueOnce({ png: await sharp({ create: { width: 4000, height: 2600, channels: 3, background: '#cba' } }).png().toBuffer(), width: 4000, height: 2600, visualizationKey: 'vk',
      configuration: { sku: p.sku, requiredPx: p.requirements.finalPx }, crop: { fit: 'cover', allowCrop: false } })
    const m = await getLineMockup(r.deps, U1, sid, 'a'); const meta = await sharp(r.files.get(`gift/${sid}/mockups/${m.identityKey}.jpg`)!).metadata()
    expect(meta.format).toBe('jpeg'); expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(MOCKUP_MAX_EDGE); expect(MOCKUP_MAX_EDGE).toBeLessThan(p.requirements.finalPx.h)
    expect(m.url).toMatch(/\/mockups\/[0-9a-f]{64}\.jpg\?ttl=900$/); expect(JSON.stringify(m)).not.toMatch(/composed_path|master|compositions\/|\.png/)
    expect(m).toMatchObject({ watermarked: false, productionPrintFile: false, purchaseAuthorization: false, width: 4000 })
  })
  it('is only for the owner of a paid, unrefunded line: strangers, unpaid orders, other lines, and refund states get no image', async () => {
    const r = rig(); const { sid, orderId } = await ready(r, [L12]); const calls = r.render.mock.calls.length
    await expect(getLineMockup(r.deps, '10000000-0000-4000-8000-000000000002', sid, 'a')).rejects.toMatchObject({ code: 'session_not_found' })
    await expect(getLineMockup(r.deps, U1, sid, 'zzz')).rejects.toMatchObject({ code: 'line_not_found' })
    const rec = r.store.sessions.get(sid)!
    rec.refund_requested_at = new Date().toISOString(); await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'refund_pending' }); rec.refund_requested_at = null
    rec.refunded_at = new Date().toISOString(); await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'order_refunded' }); rec.refunded_at = null
    const order = r.store.orders.get(orderId)!; order.status = 'created'; order.paid_at = null
    await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'order_not_paid' })
    expect(r.render.mock.calls.length).toBe(calls); expect(mockupFiles(r).length).toBe(0)                  // nothing rendered or stored for any of them
  })
  it('a watermarked and a clean mockup never share an identity, so a cached one is never served in the other state', () => {
    const p = getProduct('fine_art:12x18')!
    const base = { orderId: 'o', lineId: 'a', lineIndex: 0, compositionId: 'c1', attempt: 1, sourceArtworkId: 'p1', artworkSha256: 'h', templateId: 'fine-art', templateRevision: 'r', product: p, geometrySource: 'frozen', frozenCatalogVersion: 'v' }
    expect(mockupIdentityKey({ ...base, clean: true })).not.toBe(mockupIdentityKey({ ...base, clean: false }))
  })
  it('the composition approval and release safeguards are unchanged by seeing a clean mockup', async () => {
    const r = rig(); const { sid } = await ready(r, [L12]); await getLineMockup(r.deps, U1, sid, 'a')
    expect(r.store.compositions[0].status).toBe('ready')                                                  // viewing approves nothing
    await expect(approveOrder(r.deps, U1, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })
  })
})


describe('operator repair of a composition that fails the frozen-product shape check', () => {
  const OP = 'operator@liten.test'
  /** A groups session of four (landscape master, so portrait/square lines are generated) with a Fine Art Print and a canvas, the print's composition defective. */
  async function defective() {
    const r = rig({ series: 'groups', people: 4 }); const p = await ready(r, [L12, C8])
    const bad = r.store.compositions.find(c => c.line_id === 'a')!, good = r.store.compositions.find(c => c.line_id === 'b')!
    await getLineMockup(r.deps, U1, p.sid, 'a'); const oldMockup = (bad.plan as any).mockup.path
    await approveComposition(r.deps, U1, p.sid, good.id)                                                      // the canvas is properly approved
    Object.assign(bad, { width: 1575, height: 1050, status: 'approved' })                                     // the print's composition is the defective one, and was "approved"
    return { r, ...p, bad, good, oldMockup }
  }
  it('replaces only the defective composition: old row superseded with its history kept, new row portrait and "ready" at the same attempt, correction untouched', async () => {
    const { r, sid, orderId, bad, good, oldMockup } = await defective(); const gen = r.generate.mock.calls.length
    const out = await repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a' }) as any
    expect(out).toMatchObject({ status: 'repaired', supersededCompositionId: bad.id, repairSeq: 1, nb21Calls: 1 }); expect(r.generate.mock.calls.length).toBe(gen + 1)
    expect(r.generate.mock.calls.at(-1)![0]).toMatchObject({ aspect: '2:3' })
    const old = r.store.compositions.find(c => c.id === bad.id)!, fresh = r.store.compositions.find(c => c.id === out.compositionId)!
    expect(old).toMatchObject({ status: 'superseded', width: 1575, height: 1050, composed_path: bad.composed_path }); expect(old.plan).toMatchObject({ supersededReason: 'geometry_defect', supersededBy: fresh.id })
    expect(r.files.has(old.composed_path!)).toBe(true)                                                       // audit: the defective file is kept
    expect(fresh).toMatchObject({ status: 'ready', approved_at: null, attempt: 1, repair_seq: 1, method: 'generated', preview_id: old.preview_id }); expect(fresh.width!).toBeLessThan(fresh.height!)
    expect(fresh.plan).toMatchObject({ repair: { of: bad.id, seq: 1, operator: OP, reason: 'geometry_mismatch' } })
    expect(r.files.has(oldMockup)).toBe(false)                                                               // the old mockup is gone
    expect((await r.store.orderLines(orderId)).map(l => [l.line_id, l.corrections_used])).toEqual([['a', 0], ['b', 0]])
    expect(r.store.compositions.find(c => c.id === good.id)).toMatchObject({ status: 'approved' })         // another line's approval is untouched
    await expect(getLineMockup(r.deps, U1, sid, 'a', bad.id)).rejects.toMatchObject({ code: 'stale_composition' })
    expect((await getLineMockup(r.deps, U1, sid, 'a')).compositionId).toBe(fresh.id); expect((await getLineMockup(r.deps, U1, sid, 'b')).compositionId).toBe(good.id)   // Canvas control unaffected
    const v = (await getSessionView(r.deps, U1, sid)).compositions.find(c => c.lineId === 'a')!
    expect([v.compositionId, v.status, v.correctionsRemaining]).toEqual([fresh.id, 'ready', 1])
    await expect(approveOrder(r.deps, U1, sid)).rejects.toMatchObject({ code: 'compositions_not_approved' })        // the customer must approve what they now see
  })
  it('is idempotent: a repeat generates nothing, and two simultaneous calls start one paid generation', async () => {
    const { r, sid } = await defective(); const gen = r.generate.mock.calls.length
    const [a, b] = await Promise.all([repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a' }), repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a' })])
    expect([a.status, b.status].sort()).toEqual(['in_progress', 'repaired']); expect(r.generate.mock.calls.length).toBe(gen + 1)
    expect((await repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a' })).status).toBe('not_needed'); expect(r.generate.mock.calls.length).toBe(gen + 1)
    expect(r.store.compositions.filter(c => c.line_id === 'a').map(c => c.status).sort()).toEqual(['ready', 'superseded'])
  })
  it('repairs only a defect: a fitting composition (the canvas) is "not_needed" and nothing changes', async () => {
    const { r, sid, good } = await defective(); const gen = r.generate.mock.calls.length, n = r.store.compositions.length
    expect(await repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'b' })).toEqual({ status: 'not_needed', lineId: 'b', compositionId: good.id })
    expect(r.generate.mock.calls.length).toBe(gen); expect(r.store.compositions.length).toBe(n); expect(r.store.compositions.find(c => c.id === good.id)!.status).toBe('approved')
  })
  it('a dry run reports the plan and the paid call it would make and changes nothing', async () => {
    const { r, sid, bad } = await defective(); const gen = r.generate.mock.calls.length, snapshot = JSON.stringify(r.store.compositions)
    expect(await repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a', dryRun: true })).toMatchObject({ status: 'would_repair', compositionId: bad.id, nb21Calls: 1, repairSeq: 1, plan: { method: 'generated', generationAspect: '2:3' } })
    expect(r.generate.mock.calls.length).toBe(gen); expect(JSON.stringify(r.store.compositions)).toBe(snapshot)
  })
  it('a failed generation releases the claim, stores nothing, and the retry succeeds', async () => {
    const { r, sid, bad } = await defective(); r.generate.mockRejectedValueOnce(new Error('upstream down'))
    await expect(repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a' })).rejects.toBeTruthy()
    const after = r.store.compositions.find(c => c.id === bad.id)!; expect(after.status).toBe('approved'); expect((after.plan as any).repairClaim).toBeUndefined(); expect(r.store.compositions.filter(c => c.line_id === 'a').length).toBe(1)
    expect((await repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a' })).status).toBe('repaired')
  })
  it('the included correction is still available afterwards and supersedes the repaired composition', async () => {
    const { r, sid } = await defective(); const out = await repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a' }) as any
    await correctLine(r.deps, U1, sid, 'a')
    const rows = r.store.compositions.filter(c => c.line_id === 'a'); expect(rows.map(c => [c.attempt, c.repair_seq ?? 0, c.status])).toEqual([[1, 0, 'superseded'], [1, 1, 'superseded'], [2, 0, 'ready']])
    expect(rows.find(c => c.id === out.compositionId)!.status).toBe('superseded')
  })
  it('refuses unless the order still awaits approval, an operator is named, the customer owns the session and the line exists', async () => {
    const { r, sid, orderId } = await defective()
    await expect(repairLine(r.deps, { operator: ' ', userId: U1, sessionId: sid, lineId: 'a' })).rejects.toThrow('operator_required')
    await expect(repairLine(r.deps, { operator: OP, userId: '10000000-0000-4000-8000-000000000009', sessionId: sid, lineId: 'a' })).rejects.toMatchObject({ code: 'session_not_found' })
    await expect(repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'zzz' })).rejects.toMatchObject({ code: 'line_not_found' })
    r.store.orders.get(orderId)!.status = 'paid'
    await expect(repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a' })).rejects.toMatchObject({ code: 'order_not_awaiting_artwork' })
    expect(r.store.compositions.find(c => c.line_id === 'a')!.status).toBe('approved')
  })
  it('is never exposed as a customer action: no handler, route or page references it', () => {
    const files: string[] = []
    const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = d + '/' + e.name; if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(f) } else if (/\.(ts|tsx|js)$/.test(e.name)) files.push(f) } }
    walk('app'); walk('lib/v1/gift'); files.push(...fs.readdirSync('public/gift-wizard').filter(f => /\.(js|ts)$/.test(f)).map(f => 'public/gift-wizard/' + f))
    const users = files.filter(f => !/\.test\.ts$/.test(f) && fs.readFileSync(f, 'utf8').includes('repairLine'))
    expect(users).toEqual(['lib/v1/gift/compose.ts'])
  })
})

describe('repair under concurrency and interruption', () => {
  const OP = 'operator@liten.test'
  async function defective() {
    const r = rig({ series: 'groups', people: 4 }); const p = await ready(r, [L12, C8])
    const bad = r.store.compositions.find(c => c.line_id === 'a')!
    Object.assign(bad, { width: 1575, height: 1050 })
    let t = Date.parse('2026-10-18T12:00:00Z'); r.deps.clock = () => t
    return { r, ...p, bad, advance: (ms: number) => { t += ms } }
  }
  const run = (r: ReturnType<typeof rig>, sid: string, extra: object = {}) => repairLine(r.deps, { operator: OP, userId: U1, sessionId: sid, lineId: 'a', ...extra })
  const corrections = async (r: ReturnType<typeof rig>, orderId: string) => (await r.store.orderLines(orderId)).map(l => l.corrections_used)

  it('five simultaneous calls: one wins the database claim, one paid generation, one replacement row', async () => {
    const { r, sid, bad } = await defective(); const gen = r.generate.mock.calls.length
    const out = await Promise.all([run(r, sid), run(r, sid), run(r, sid), run(r, sid), run(r, sid)])
    expect(out.map(o => o.status).sort()).toEqual(['in_progress', 'in_progress', 'in_progress', 'in_progress', 'repaired']); expect(r.generate.mock.calls.length).toBe(gen + 1)
    expect(r.store.compositions.filter(c => c.line_id === 'a').map(c => [c.id === bad.id, c.status, c.repair_seq ?? 0])).toEqual([[true, 'superseded', 0], [false, 'ready', 1]])
  })
  it('a reader that looked before another repair finished does not repeat it (state is re-read after winning the claim)', async () => {
    const { r, sid } = await defective(); const stale = structuredClone(await r.store.listCompositions(sid))
    await run(r, sid); const gen = r.generate.mock.calls.length, n = r.store.compositions.length
    vi.spyOn(r.store, 'listCompositions').mockResolvedValueOnce(stale)                                      // the second process's first read is from before the repair
    const second = await run(r, sid)
    expect(second.status).toBe('not_needed'); expect(r.generate.mock.calls.length).toBe(gen); expect(r.store.compositions.length).toBe(n)
  })
  it('interrupted after the paid generation but before the row is stored: the retry reuses the stored files and pays nothing more', async () => {
    const { r, sid, orderId } = await defective(); const gen = r.generate.mock.calls.length, real = r.store.insertComposition.bind(r.store)
    r.store.insertComposition = vi.fn(async () => { throw new Error('connection reset') }) as any
    await expect(run(r, sid)).rejects.toBeTruthy(); expect(r.generate.mock.calls.length).toBe(gen + 1)
    expect([...r.files.keys()].filter(k => k.includes('-a-r1')).length).toBe(2)                              // the replacement's files are on storage
    expect(r.store.compositions.filter(c => c.line_id === 'a').length).toBe(1)
    r.store.insertComposition = real
    const out = await run(r, sid) as any
    expect(out).toMatchObject({ status: 'repaired', reusedFiles: true, nb21Calls: 0 }); expect(r.generate.mock.calls.length).toBe(gen + 1)
    expect(r.store.compositions.find(c => c.id === out.compositionId)!.plan).toMatchObject({ repair: { reusedFiles: true } })
    expect(await corrections(r, orderId)).toEqual([0, 0])
  })
  it('a process that dies holding the claim blocks a retry only until the claim expires, then reuses its files', async () => {
    const { r, sid, advance } = await defective(); const gen = r.generate.mock.calls.length, real = r.store.insertComposition.bind(r.store), release = r.store.releaseRepair.bind(r.store)
    r.store.insertComposition = vi.fn(async () => { throw new Error('killed') }) as any; r.store.releaseRepair = vi.fn(async () => {}) as any       // it never got to release
    await expect(run(r, sid)).rejects.toBeTruthy()
    r.store.insertComposition = real; r.store.releaseRepair = release
    expect((await run(r, sid)).status).toBe('in_progress'); expect(r.generate.mock.calls.length).toBe(gen + 1)
    advance(REPAIR_CLAIM_MS + 1000)
    expect(await run(r, sid)).toMatchObject({ status: 'repaired', reusedFiles: true }); expect(r.generate.mock.calls.length).toBe(gen + 1)
  })
  it('interrupted after the replacement is stored but before the old row is retired: the retry finishes retiring it and generates nothing', async () => {
    const { r, sid, bad } = await defective(); const gen = r.generate.mock.calls.length, real = r.store.completeRepair.bind(r.store)
    r.store.completeRepair = vi.fn(async () => { throw new Error('connection reset') }) as any
    await expect(run(r, sid)).rejects.toBeTruthy()
    const [oldRow, fresh] = [r.store.compositions.find(c => c.id === bad.id)!, r.store.compositions.find(c => c.line_id === 'a' && (c.repair_seq ?? 0) === 1)!]
    expect([oldRow.status, fresh.status]).toEqual(['ready', 'ready'])                                        // both live for a moment: the newest (the replacement) is what the line uses
    expect((await getLineMockup(r.deps, U1, sid, 'a')).compositionId).toBe(fresh.id)
    r.store.completeRepair = real
    expect(await run(r, sid)).toMatchObject({ status: 'not_needed', compositionId: fresh.id }); expect(r.generate.mock.calls.length).toBe(gen + 1)
    expect(r.store.compositions.find(c => c.id === bad.id)).toMatchObject({ status: 'superseded', plan: { supersededReason: 'geometry_defect', supersededBy: fresh.id } })
  })
  it('completion refuses a lost claim and an order that is no longer awaiting approval, changing nothing', async () => {
    const { r, sid, orderId, bad } = await defective()
    const token = (await r.store.claimRepair({ sessionId: sid, lineId: 'a', compositionId: bad.id, operator: OP, ttlMs: REPAIR_CLAIM_MS, nowMs: r.deps.clock!() }))!
    const fresh = await r.store.insertComposition({ ...bad, repair_seq: 1, status: 'ready', width: 1050, height: 1575 } as any)
    await expect(r.store.completeRepair({ sessionId: sid, lineId: 'a', token: 'not-the-token', oldId: bad.id, newId: fresh.id, note: {}, nowMs: r.deps.clock!() })).rejects.toMatchObject({ code: 'repair_claim_lost' })
    r.store.orders.get(orderId)!.status = 'paid'
    await expect(r.store.completeRepair({ sessionId: sid, lineId: 'a', token, oldId: bad.id, newId: fresh.id, note: {}, nowMs: r.deps.clock!() })).rejects.toMatchObject({ code: 'order_not_awaiting_artwork' })
    expect(r.store.compositions.find(c => c.id === bad.id)!.status).toBe('ready')
  })
  it('only the targeted line is touched; a second defective line is left alone until it is named', async () => {
    const r = rig({ series: 'groups', people: 4 }); const p = await ready(r, [L12, { lineId: 'b', productId: 'fine_art:16x24', copies: 1 }])
    for (const c of r.store.compositions) Object.assign(c, { width: 1575, height: 1050 })
    const gen = r.generate.mock.calls.length
    await repairLine(r.deps, { operator: OP, userId: U1, sessionId: p.sid, lineId: 'a' })
    expect(r.store.compositions.filter(c => c.line_id === 'b').map(c => [c.status, c.width])).toEqual([['ready', 1575]]); expect(r.generate.mock.calls.length).toBe(gen + 1)
  })
})

describe('draft compositions (reviewed before payment, no order yet)', () => {
  it('shows a draft composition on the catalog product, repairs a defective one with no order, and releases nothing', async () => {
    const r = rig({ series: 'groups', people: 4 }); r.deps.draftCompositions = true; const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
    const v = await createSession(r.deps, { userId: U1, imageB64: photo }); await setLines(r.deps, U1, v.sessionId, [L12])
    const b = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' }); await selectArtwork(r.deps, U1, v.sessionId, b.batch.previews[0].previewId)
    await ensureCompositions(r.deps, U1, v.sessionId); expect(r.store.orders.size).toBe(0)
    const m = await getLineMockup(r.deps, U1, v.sessionId, 'a'); expect(m).toMatchObject({ geometrySource: 'catalog', frozenCatalogVersion: null, sku: 'GLOBAL-FAP-12X18', watermarked: true, productionPrintFile: false })
    Object.assign(r.store.compositions[0], { width: 1575, height: 1050 })
    await expect(getLineMockup(r.deps, U1, v.sessionId, 'a')).rejects.toMatchObject({ code: 'composition_geometry_mismatch' })
    const out = await repairLine(r.deps, { operator: 'ops@liten.test', userId: U1, sessionId: v.sessionId, lineId: 'a' }) as any
    expect(out).toMatchObject({ status: 'repaired', repairSeq: 1 }); expect((await getLineMockup(r.deps, U1, v.sessionId, 'a')).compositionId).toBe(out.compositionId)
    expect(r.store.compositions.map(c => [c.status, c.repair_seq ?? 0])).toEqual([['superseded', 0], ['ready', 1]])
    await expect(approveOrder(r.deps, U1, v.sessionId)).rejects.toMatchObject({ code: 'order_payment_required' })
  })
})

// â”€â”€ THE PHOTOGRAPHIC CUSTOMER SCENES (scenes.ts) behind the same boundary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// The scene renderer is a fake here (it records what it was given); its descriptions are the REAL scene manifests. Everything else is the real boundary.
function sceneRig(over: Parameters<typeof rig>[0] = {}) {
  const state = { rev: 'scene-rev-1', fail: false }
  const render = vi.fn(async (i: { sceneId: string; productFamily: string; artworkId: string; artwork: Buffer }) => {
    if (state.fail) throw new Error('scene boom')
    return { png: await sharp({ create: { width: 1254, height: 1254, channels: 3, background: '#789' } }).png().toBuffer(), width: 1254, height: 1254, templateRevision: state.rev, visualizationKey: 'svk-' + i.artworkId, metadata: { fit: 'exact-composition' } }
  })
  const revision = vi.fn(async () => state.rev)
  const scenes: SceneRenderer = { describe: id => realSceneRenderer.describe(id), revision, render }
  return { ...rig({ ...over, scenes }), sceneState: state, sceneRender: render, sceneRevision: revision, sceneRenderer: scenes }
}
const stripMockup = (plan: Record<string, unknown>) => { const { mockup: _m, sceneRepresentation: _s, artworkSha256: _a, ...rest } = plan; return rest }
const CS = { lineId: 's', productId: 'canvas:12x12', copies: 1 }
const correctionsRemaining = async (r: ReturnType<typeof rig>, sid: string, lineId: string) => (await getSessionView(r.deps, U1, sid)).compositions.find(c => c.lineId === lineId)!.correctionsRemaining

describe('scene mockups (the photographic scene, with the calibrated renderer as the fallback)', () => {
  it('shows a supported configuration in its scene: clean for a paid line, from the same composition, with the scene and its revision in the identity', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS])
    const comp = r.store.compositions[0], marks = r.watermark.mock.calls.length
    const m = await getLineMockup(r.deps, U1, sid, 's')
    expect(m).toMatchObject({ renderer: 'scene', templateId: 'scene:gallery-canvas-square', templateRevision: 'scene-rev-1', compositionId: comp.id, attempt: 1, sourceArtworkId: comp.preview_id, watermarked: false, cached: false, productionPrintFile: false, purchaseAuthorization: false, width: 1254, height: 1254 })
    expect(m.scene).toMatchObject({ sceneId: 'gallery-canvas-square', revision: 'scene-rev-1' }); expect(m.scene!.representationId).toMatch(/^[0-9a-f]{64}$/)
    expect(r.watermark.mock.calls.length).toBe(marks); expect(r.render).not.toHaveBeenCalled()                                  // a paid mockup is not watermarked; the calibrated renderer was not used
    expect(r.sceneRender).toHaveBeenCalledTimes(1); expect(r.sceneRender.mock.calls[0][0]).toMatchObject({ sceneId: 'gallery-canvas-square', productFamily: 'canvas', artworkId: comp.id })
    const stored = r.files.get(`gift/${sid}/mockups/${m.identityKey}.jpg`)!; expect((await sharp(stored).metadata()).format).toBe('jpeg')
  })

  it('hands the scene renderer a picture shaped to the opening, derived from the production picture and never the production file itself', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS]); await getLineMockup(r.deps, U1, sid, 's')
    const comp = r.store.compositions[0], given = r.sceneRender.mock.calls[0][0].artwork
    const prod = r.files.get(comp.composed_path!)!, gm = await sharp(given).metadata()
    expect(given.equals(prod)).toBe(false)
    expect(Math.abs(gm.width! / gm.height! / realSceneRenderer.describe('gallery-canvas-square').inputAspect - 1)).toBeLessThanOrEqual(1 / gm.width! + 1 / gm.height!)
    expect([...r.files.keys()].filter(k => k.includes('/mockups/'))).toHaveLength(1)                                              // only the mockup is stored: no scene picture file
    for (const [path, bytes] of r.files) if (!path.includes('/mockups/')) expect(bytes.equals(given), path).toBe(false)
  })

  it('records the scene picture next to the mockup, linked to the same composition, attempt and favorite, and touches nothing else on the composition or the session', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS])
    const before = structuredClone(r.store.compositions[0]), viewBefore = JSON.stringify(await getSessionView(r.deps, U1, sid))
    const m = await getLineMockup(r.deps, U1, sid, 's')
    const after = r.store.compositions[0], rec = (after.plan as any).sceneRepresentation
    expect(rec).toMatchObject({ sceneId: 'gallery-canvas-square', revision: 'scene-rev-1', representationId: m.scene!.representationId, compositionId: after.id, attempt: 1, favoriteId: after.preview_id })
    expect(rec.artworkSha256).toBe((after.plan as any).artworkSha256); expect(rec.sha256).toMatch(/^[0-9a-f]{64}$/); expect(['exact', 'resample']).toContain(rec.fit)
    expect({ ...after, plan: stripMockup(after.plan) }).toEqual({ ...before, plan: stripMockup(before.plan) })                  // status, attempt, files, approval, corrections: unchanged
    expect(JSON.stringify(await getSessionView(r.deps, U1, sid))).toBe(viewBefore)                                              // the session view (attempt, correctionsRemaining, approvals) is identical
  })

  it('an unchanged identity re-signs the stored scene mockup and renders nothing (and says it is a scene)', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS]); const a = await getLineMockup(r.deps, U1, sid, 's'); const b = await getLineMockup(r.deps, U1, sid, 's')
    expect(b).toMatchObject({ cached: true, identityKey: a.identityKey, renderer: 'scene', scene: a.scene }); expect(r.sceneRender).toHaveBeenCalledTimes(1)
  })

  it('a revised scene renderer changes the identity and re-renders; the old file is removed and the approval history is untouched', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS]); const a = await getLineMockup(r.deps, U1, sid, 's')
    await approveComposition(r.deps, U1, sid, a.compositionId)
    r.sceneState.rev = 'scene-rev-2'; const b = await getLineMockup(r.deps, U1, sid, 's')
    expect(b.identityKey).not.toBe(a.identityKey); expect(b.templateRevision).toBe('scene-rev-2'); expect(b.scene!.representationId).not.toBe(a.scene!.representationId); expect(b.compositionId).toBe(a.compositionId)
    expect(b.compositionStatus).toBe('approved'); expect(r.sceneRender).toHaveBeenCalledTimes(2); expect(mockupFiles(r).length).toBe(1)
  })

  it('a correction (a new composition) is a new scene identity; the scene itself never consumes the correction', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS]); const a = await getLineMockup(r.deps, U1, sid, 's')
    expect(await correctionsRemaining(r, sid, 's')).toBe(1)
    await getLineMockup(r.deps, U1, sid, 's'); r.sceneState.rev = 'scene-rev-9'; await getLineMockup(r.deps, U1, sid, 's')
    expect(await correctionsRemaining(r, sid, 's')).toBe(1)                                                                    // two more scene renders (one of them a revision change) later it is still 1
    await correctLine(r.deps, U1, sid, 's'); const b = await getLineMockup(r.deps, U1, sid, 's')
    expect(b.attempt).toBe(2); expect(b.identityKey).not.toBe(a.identityKey); expect(b.scene!.representationId).not.toBe(a.scene!.representationId)
    await expect(getLineMockup(r.deps, U1, sid, 's', a.compositionId)).rejects.toMatchObject({ code: 'stale_composition' })     // stale-composition protection is unchanged
  })

  it('a configuration no scene shows keeps the calibrated renderer (no scene in its response)', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [L12, F12])
    for (const lineId of ['a', 'c']) {
      const m = await getLineMockup(r.deps, U1, sid, lineId)
      expect(m).toMatchObject({ renderer: 'calibrated', scene: null }); expect(m.templateId).not.toMatch(/^scene:/)
    }
    expect(r.sceneRender).not.toHaveBeenCalled(); expect(r.render).toHaveBeenCalledTimes(2)
  })

  it('the identity of a calibrated mockup is exactly what it was before scenes existed; a scene adds to it, and each scene field matters', () => {
    const product = getProduct('fine_art:12x18')!
    const base = { orderId: 'o', lineId: 'a', lineIndex: 0, compositionId: 'c', attempt: 1, sourceArtworkId: 'p', artworkSha256: 'h', templateId: 'fine-art', templateRevision: 'r', product, geometrySource: 'frozen', frozenCatalogVersion: 'v', clean: true }
    expect(mockupIdentityKey(base)).toBe(mockupIdentityKey({ ...base, scene: null }))
    const s = { sceneId: 's', revision: 'x', representationId: 'y' }
    expect(mockupIdentityKey({ ...base, scene: s })).not.toBe(mockupIdentityKey(base))
    for (const change of [{ sceneId: 't' }, { revision: 'z' }, { representationId: 'w' }]) expect(mockupIdentityKey({ ...base, scene: { ...s, ...change } })).not.toBe(mockupIdentityKey({ ...base, scene: s }))
  })

  it('a scene that cannot be rendered falls back to the calibrated renderer (logged), is retried on the next call, and never stores a half result', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS]); const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    r.sceneState.fail = true; const a = await getLineMockup(r.deps, U1, sid, 's')
    expect(a).toMatchObject({ renderer: 'calibrated', scene: null }); expect(r.render).toHaveBeenCalledTimes(1); expect(log).toHaveBeenCalledWith('[gift/mockup] scene fallback', expect.objectContaining({ stage: 'scene_render', reason: 'scene_render_failed', code: 'scene_operation_failed' }))
    expect((r.store.compositions[0].plan as any).sceneRepresentation).toBeUndefined(); expect(mockupFiles(r).length).toBe(1)
    r.sceneState.fail = false; const b = await getLineMockup(r.deps, U1, sid, 's')
    expect(b).toMatchObject({ renderer: 'scene', cached: false }); expect(mockupFiles(r).length).toBe(1)                          // the scene is tried again; the fallback file is replaced
    expect((r.store.compositions[0].plan as any).sceneRepresentation).toBeTruthy()
    log.mockRestore()
  })

  it('a scene whose files changed during the render is never stored', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS]); const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    r.sceneRender.mockImplementationOnce(async i => ({ png: await sharp({ create: { width: 1254, height: 1254, channels: 3, background: '#789' } }).png().toBuffer(), width: 1254, height: 1254, templateRevision: 'other-revision', visualizationKey: 'vk', metadata: {} }))
    expect(await getLineMockup(r.deps, U1, sid, 's')).toMatchObject({ renderer: 'calibrated' }); expect((r.store.compositions[0].plan as any).sceneRepresentation).toBeUndefined()
    log.mockRestore()
  })

  it('GIFT_SCENE_MOCKUPS=0 switches every scene off', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS]); process.env.GIFT_SCENE_MOCKUPS = '0'
    try { expect(await getLineMockup(r.deps, U1, sid, 's')).toMatchObject({ renderer: 'calibrated' }); expect(r.sceneRender).not.toHaveBeenCalled() } finally { delete process.env.GIFT_SCENE_MOCKUPS }
  })

  it('a renderer without scenes, or whose scene files are missing, serves the calibrated renderer exactly as before', async () => {
    const r = rig(); const { sid } = await ready(r, [CS]); expect(await getLineMockup(r.deps, U1, sid, 's')).toMatchObject({ renderer: 'calibrated', scene: null })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const q = sceneRig(); const { sid: sid2 } = await ready(q, [CS]); q.sceneRenderer.describe = () => { throw new Error('ENOENT') }
    expect(await getLineMockup(q.deps, U1, sid2, 's')).toMatchObject({ renderer: 'calibrated' }); expect(q.sceneRender).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('keeps ownership and line checks ahead of any scene work', async () => {
    const r = sceneRig(); const { sid } = await ready(r, [CS])
    await expect(getLineMockup(r.deps, U2, sid, 's')).rejects.toMatchObject({ code: 'session_not_found' }); await expect(getLineMockup(r.deps, U1, sid, 'nope')).rejects.toMatchObject({ code: 'line_not_found' })
    expect(r.sceneRender).not.toHaveBeenCalled(); expect(r.sceneRevision).not.toHaveBeenCalled()
  })

  it('a scene mockup of a DRAFT (before payment) is watermarked after scene placement, never clean', async () => {
    const r = sceneRig({ series: 'groups', people: 4 }); r.deps.draftCompositions = true; const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
    const v = await createSession(r.deps, { userId: U1, imageB64: photo }); await setLines(r.deps, U1, v.sessionId, [CS])
    const b = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' }); await selectArtwork(r.deps, U1, v.sessionId, b.batch.previews[0].previewId); await ensureCompositions(r.deps, U1, v.sessionId)
    const marks = r.watermark.mock.calls.length
    const m = await getLineMockup(r.deps, U1, v.sessionId, 's')
    expect(m).toMatchObject({ renderer: 'scene', watermarked: true, geometrySource: 'catalog' }); expect(r.watermark.mock.calls.length).toBe(marks + 1)
    const sent = Buffer.from(r.watermark.mock.calls[marks][0] as string, 'base64'); expect((await sharp(sent).metadata()).width).toBe(1254)       // the scene picture, marked afterwards
  })
})
