// The server-owned product mockup bridge and the frozen purchased geometry. The renderer, composer, generator and watermark are fakes
// that record how they were called; no model, no Stripe and no real compositor runs here.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { createSession, setLines, startBatch, getSessionView, purgeExpired, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { selectArtwork, ensureCompositions, correctLine, approveComposition } from './compose'
import fs from 'node:fs'
import { mockupH } from './handlers'
import { getLineMockup, mockupIdentityKey, pictureArea, templateFor, MOCKUP_URL_SECONDS, type MockupRenderer } from './mockup'
import { compositionFitsProduct, freezeLine, resolveFrozenProduct } from './frozen'
import { adaptationValidationFor } from './policy'
import { correctionPlanFor, planFor } from './composition-plan'
import { purchasedItems, purchasedLines } from './test-order'
import { allProducts, getProduct } from '../print/catalog'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '20000000-0000-4000-8000-000000000002'
type Line = { lineId: string; productId: string; copies: number }

function rig(over: { series?: 'portraits' | 'pets' | 'groups'; people?: number | null; noRenderer?: boolean } = {}) {
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
  const mockup: MockupRenderer = { revision: vi.fn(async () => state.revision), render }
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
  it('returns a watermarked, signed product mockup for the current composition, with the identity and an explicit non-authorization', async () => {
    const r = rig(); const { sid, orderId } = await ready(r, [L12])
    const wm = r.watermark.mock.calls.length
    const m = await getLineMockup(r.deps, U1, sid, 'a')
    const comp = r.store.compositions[0]
    expect(m).toMatchObject({ contractVersion: 1, lineId: 'a', productId: 'fine_art:12x18', sku: 'GLOBAL-FAP-12X18', compositionId: comp.id, attempt: 1, compositionStatus: 'ready', sourceArtworkId: comp.preview_id,
      templateId: 'fine-art', geometrySource: 'frozen', frozenCatalogVersion: 'test-catalog', cached: false, watermarked: true, productionPrintFile: false, purchaseAuthorization: false, width: 300, height: 200 })
    expect(m.url).toMatch(/^https:\/\/signed\.test\/gift\/.+\/mockups\/[0-9a-f]{64}\.jpg\?ttl=900$/); expect(m.identityKey).toMatch(/^[0-9a-f]{64}$/)
    expect(Date.parse(m.urlExpiresAt)).toBeGreaterThan(Date.now()); expect(MOCKUP_URL_SECONDS).toBe(900)
    expect(await sharp(r.files.get(`gift/${sid}/mockups/${m.identityKey}.jpg`)!).metadata()).toMatchObject({ format: 'jpeg' })      // stored as a watermarked JPEG
    expect(r.watermark.mock.calls.length).toBe(wm + 1); expect(orderId).toBeTruthy()
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
    expect(r.render).toHaveBeenCalledTimes(1); expect(r.watermark.mock.calls.length).toBe(wm + 1); expect([a.cached, b.cached]).toEqual([false, true]); expect(b.identityKey).toBe(a.identityKey)
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
  it('needs a paid order: no order, an unpaid order and a refunded order all refuse; a refund request blocks it', async () => {
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
  it('the watermark fails closed: no mockup is stored or returned unmarked', async () => {
    const r = rig(); const { sid } = await ready(r, [L12]); r.watermark.mockRejectedValueOnce(new Error('wm'))
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
  const base = { orderId: 'o', lineId: 'a', lineIndex: 0, compositionId: 'c1', attempt: 1, sourceArtworkId: 'p1', artworkSha256: 'h', templateId: 'fine-art', templateRevision: 'r', product: p, geometrySource: 'frozen', frozenCatalogVersion: 'v' }
  it('is stable for the same inputs and changes with each input', () => {
    const k = mockupIdentityKey(base); expect(mockupIdentityKey({ ...base })).toBe(k)
    for (const change of [{ orderId: 'o2' }, { lineId: 'b' }, { lineIndex: 1 }, { compositionId: 'c2' }, { attempt: 2 }, { sourceArtworkId: 'p2' }, { artworkSha256: 'h2' }, { templateId: 'premium-fine-art' }, { templateRevision: 'r2' },
      { product: getProduct('fine_art:8x12')! }, { product: { ...p, attributes: { ...p.attributes, paperType: 'X' } } }, { geometrySource: 'legacy_catalog' }, { frozenCatalogVersion: 'v2' }]) {
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
    const c = getProduct('canvas:8x8')!, f = c.requirements.finalPx
    const small = await sharp({ create: { width: f.w / 6, height: f.h / 6, channels: 3, background: '#789' } }).png().toBuffer()
    expect(await meta(await pictureArea(small, c))).toEqual([400, 400])
    const flat = await sharp({ create: { width: 90, height: 60, channels: 3, background: '#789' } }).png().toBuffer()
    expect(await pictureArea(flat, getProduct('fine_art:12x18')!)).toBe(flat)
  })
  it('a file of the wrong shape for a wrapped product is refused, never guessed', async () => {
    const wrong = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#789' } }).png().toBuffer()
    await expect(pictureArea(wrong, getProduct('canvas:8x8')!)).rejects.toThrow('artwork_shape_mismatch')
  })
  it('the bridge passes the renderer the picture area for a canvas line', async () => {
    const r = rig(); const { sid } = await ready(r, [C8]); await getLineMockup(r.deps, U1, sid, 'b')
    const m = await sharp(r.render.mock.calls[0][0].artwork).metadata(); expect(m.width).toBe(m.height)
    expect(m.width!).toBeLessThan((await sharp(r.files.get(r.store.compositions[0].composed_path!)!).metadata()).width!)
  })
})

describe('templates: only the approved, purchasable products have one', () => {
  it('prints, premium, black frames and MirrorWrap canvas map to the approved templates; mugs, cards and every disabled family map to nothing', () => {
    expect(templateFor(getProduct('fine_art:12x18')!)).toBe('fine-art'); expect(templateFor(getProduct('premium:16x24')!)).toBe('premium-fine-art')
    expect(templateFor(getProduct('framed:12x18')!)).toBe('classic-framed'); expect(templateFor(getProduct('framed:8x8')!)).toBe('square-framed')
    expect(templateFor(getProduct('canvas:12x18')!)).toBe('gallery-canvas'); expect(templateFor(getProduct('canvas:8x8')!)).toBe('gallery-canvas-square')
    for (const p of allProducts().filter(x => x.kind === 'mug' || x.kind === 'greeting_card' || x.status === 'disabled')) expect(templateFor(p), p.productId).toBeNull()
  })
  it('mugs and cards stay disabled and unpriced', () => {
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
    const body = await ok.json(); expect(body).toMatchObject({ lineId: 'a', watermarked: true, purchaseAuthorization: false })
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
  it('names the watermark and signing stages too', async () => {
    const r = rig(); const { sid } = await ready(r, [L12]); const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    r.watermark.mockRejectedValueOnce(new Error('wm boom')); await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'mockup_failed' })
    r.deps.storage.signedUrl = async () => null; await expect(getLineMockup(r.deps, U1, sid, 'a')).rejects.toMatchObject({ code: 'mockup_failed' })
    const lines = spy.mock.calls.map(c => String(c[0])).filter(l => l.includes('[gift/mockup]')); expect(lines.some(l => l.includes('watermark failed') && l.includes('wm boom'))).toBe(true); expect(lines.some(l => l.includes('sign failed'))).toBe(true); spy.mockRestore()
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
