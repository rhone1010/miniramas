// The MY COLLECTION entrance (POST /api/v1/gift/sessions/from-collection): a Gift session whose favorite is an artwork the customer already owns. Real service and handlers; the memory store
// mirrors migration 057 (which migration-057.test.ts runs against Postgres). The owned artwork is only read; everything after the session exists is the photo entrance's code.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomUUID, createHash } from 'node:crypto'
import { purchasedItems, purchasedLines } from './test-order'
import { createCollectionSessionH } from './handlers'
import { createSessionFromCollection, setLines, startBatch, retryBatch, getSessionView, restoreSession, deleteSessionNow, GiftError, type GiftDeps, type CollectionArtwork } from './service'
import { memoryGiftStore } from './store'
import { ensureCompositions, approveComposition, correctLine, finalizeOrder } from './compose'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const OWNED = '30000000-0000-4000-8000-000000000001', PORTFOLIO = '40000000-0000-4000-8000-000000000001'
const read = async (r: Response) => ({ status: r.status, body: await r.json() })
const req = (body: unknown) => new Request('https://x.test/api', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })

async function rig(over: { analysis?: any; port?: (u: string, id: string) => Promise<CollectionArtwork> } = {}) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const art = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#4a7' } }).png().toBuffer()
  const photo = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()
  files.set('portraits/owned.png', art)                                              // the owned original, as My Collection stores it: must survive everything below
  store.ownedArtwork.set(OWNED, { userId: U1, portfolioId: PORTFOLIO, series: 'portraits', preset: 'bronze', unlocked: true, done: true })
  const generate = vi.fn(async () => ({ imageB64: (await sharp({ create: { width: 512, height: 512, channels: 3, background: '#a47' } }).png().toBuffer()).toString('base64') }))
  const port = vi.fn(over.port ?? (async (u: string, id: string): Promise<CollectionArtwork> => {
    const o = store.ownedArtwork.get(id); if (!o || o.userId !== u) throw new Error('owned_artwork_required')
    return { previewId: id, portfolioId: o.portfolioId, series: o.series as any, preset: o.preset, bytes: art, width: 1024, height: 1024, sourcePhoto: photo }
  }))
  const deps: GiftDeps = {
    store, collection: { resolve: port }, draftCompositions: false,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: vi.fn(async () => over.analysis ?? { status: 'supported', series: 'portraits', peopleCount: null }) as any, generate,
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    compose: async (i: { size: string }) => { const m = i.size.split('x').map(Number), h = m[0] === m[1] ? 256 : Math.round(256 * m[1] / m[0]); return { image: await sharp({ create: { width: 256, height: h, channels: 3, background: '#036' } }).png().toBuffer(), width: 256, height: h, fit: 'exact' as const, outpainted: false } },
    kick: vi.fn(async () => ({})),
  }
  const ownedSnapshot = () => JSON.stringify([[...store.ownedArtwork.entries()], createHash('sha256').update(files.get('portraits/owned.png')!).digest('hex'), store.portfolios.length])
  return { deps, store, files, generate, port, art, photo, ownedSnapshot }
}

describe('starting a session from an owned artwork', () => {
  it('creates a session whose favorite is the owned piece: its own files and records, nothing to generate, the owned piece untouched', async () => {
    const r = await rig(); const before = r.ownedSnapshot()
    const res = await read(await createCollectionSessionH(req({ previewId: OWNED }), { id: U1 }, r.deps)); expect(res.status).toBe(201)
    const v = res.body
    expect(v).toMatchObject({ entrance: 'collection', collection: { previewId: OWNED, portfolioId: PORTFOLIO }, masterAspect: '1:1', source: { series: 'portraits' } })
    expect(v.batches).toHaveLength(1); expect(v.batches[0]).toMatchObject({ kind: 'collection', complete: true }); expect(v.batches[0].previews).toHaveLength(1)
    expect(v.batches[0].previews[0]).toMatchObject({ status: 'ready', effectId: 'bronze' }); expect(v.artworkPreviewId).toBe(v.batches[0].previews[0].previewId)
    expect(v.nextBatch).toEqual({ kind: 'blocked', reason: 'collection_session' }); expect(v.entitlement).toMatchObject({ freeAvailable: false, freeBlockedReason: 'session_limit' }); expect(v.order.unlockPortfolioId).toBe(PORTFOLIO)
    // the session's own copies: the master is the owned original, byte for byte; the view is watermarked; the owned file is untouched and a different path
    const rec = [...r.store.sessions.values()][0]; const prev = r.store.previews[0]
    expect(prev.master_path).toBe(`gift/${rec.id}/masters/${prev.id}.png`); expect(r.files.get(prev.master_path!)!.equals(r.art)).toBe(true); expect((await sharp(r.files.get(prev.preview_path!)!).metadata()).format).toBe('jpeg')
    expect(r.ownedSnapshot()).toBe(before); expect(r.generate).not.toHaveBeenCalled()
  })
  it('the same piece again is the same live session (200), writes nothing new and does not analyze again', async () => {
    const r = await rig(); const a = await read(await createCollectionSessionH(req({ previewId: OWNED }), { id: U1 }, r.deps)); const filesN = r.files.size, analyses = (r.deps.analyze as any).mock.calls.length
    const b = await read(await createCollectionSessionH(req({ previewId: OWNED.toUpperCase() }), { id: U1 }, r.deps)); expect(b.status).toBe(200); expect(b.body.sessionId).toBe(a.body.sessionId)
    expect(r.files.size).toBe(filesN); expect((r.deps.analyze as any).mock.calls.length).toBe(analyses); expect(r.store.sessions.size).toBe(1); expect(r.store.batches.length).toBe(1)
    const rs = await restoreSession(r.deps, U1); expect(rs.current!.sessionId).toBe(a.body.sessionId); expect(rs.current!.entrance).toBe('collection')                  // a refresh finds it
  })
  it('refuses what is not the customer\'s, finished and compatible, without saying which: 404 artwork_not_found, and stores nothing', async () => {
    const r = await rig()
    for (const [who, id] of [[U2, OWNED], [U1, '30000000-0000-4000-8000-0000000000ff'], [U1, 'not-a-uuid'], [U1, 12345 as any], [U1, undefined as any]] as const) {
      expect(await read(await createCollectionSessionH(req({ previewId: id }), { id: who }, r.deps)), String(id)).toMatchObject({ status: 404, body: { error: 'artwork_not_found' } })
    }
    expect(await read(await createCollectionSessionH(req('{'), { id: U1 }, r.deps))).toMatchObject({ status: 400, body: { error: 'invalid_json' } })
    expect(r.store.sessions.size).toBe(0); expect([...r.files.keys()]).toEqual(['portraits/owned.png'])
    // the database's answer is final even if the port said yes: another customer's piece in the store is refused there too
    r.store.ownedArtwork.set(OWNED, { userId: U2, portfolioId: PORTFOLIO, series: 'portraits', preset: 'bronze', unlocked: true, done: true })
    const loose = await rig({ port: async (_u, id) => ({ previewId: id, portfolioId: PORTFOLIO, series: 'portraits', preset: 'bronze', bytes: r.art, width: 1024, height: 1024, sourcePhoto: r.photo }) })
    loose.store.ownedArtwork.set(OWNED, { userId: U2, portfolioId: PORTFOLIO, series: 'portraits', preset: 'bronze', unlocked: true, done: true })
    expect(await read(await createCollectionSessionH(req({ previewId: OWNED }), { id: U1 }, loose.deps))).toMatchObject({ status: 404, body: { error: 'artwork_not_found' } }); expect(loose.store.sessions.size).toBe(0); expect([...loose.files.keys()]).toEqual(['portraits/owned.png'])
  })
  it('maps unusable pieces and missing pieces of the system to stable codes; nothing is stored on any failure', async () => {
    for (const [msg, status, code] of [['compatible_artwork_required', 409, 'artwork_not_compatible'], ['square_artwork_required', 409, 'artwork_not_compatible'], ['clean_original_unavailable', 503, 'artwork_unavailable'], ['socket hang up', 503, 'artwork_unavailable']] as const) {
      const r = await rig({ port: async () => { throw new Error(msg) } }); expect(await read(await createCollectionSessionH(req({ previewId: OWNED }), { id: U1 }, r.deps)), msg).toMatchObject({ status, body: { error: code } }); expect(r.store.sessions.size).toBe(0)
    }
    const age = await rig({ analysis: { status: 'age_restricted' } }); expect(await read(await createCollectionSessionH(req({ previewId: OWNED }), { id: U1 }, age.deps))).toMatchObject({ status: 403 }); expect(age.store.sessions.size).toBe(0)
    const none = await rig(); delete (none.deps as any).collection; expect(await read(await createCollectionSessionH(req({ previewId: OWNED }), { id: U1 }, none.deps))).toMatchObject({ status: 503, body: { error: 'collection_unavailable' } })
  })
  it('the same limits as photo sessions apply (a hammered endpoint answers rate_limited)', async () => {
    const r = await rig(); r.store.recordSessionAttempt = vi.fn(async () => { const { StoreError } = await import('./store'); throw new StoreError('rate_limited') })
    expect(await read(await createCollectionSessionH(req({ previewId: OWNED }), { id: U1 }, r.deps))).toMatchObject({ status: 429 })
    expect(r.store.sessions.size).toBe(0)
  })
})

describe('after it starts, it is the shared Product Studio flow', () => {
  const LINES = [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }, { lineId: 'b', productId: 'canvas:12x12', copies: 1 }]
  async function paid(r: Awaited<ReturnType<typeof rig>>) {
    const v = (await createSessionFromCollection(r.deps, { userId: U1, previewId: OWNED })).view; const sid = v.sessionId
    await setLines(r.deps, U1, sid, LINES)
    const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
    r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: purchasedItems(LINES), prodigi_order_id: null, placed_at: null, owner_key: U1 } as any)
    await r.store.linkOrder(sid, U1, orderId, 'v1'); await r.store.confirmOrder({ sessionId: sid, orderId, userId: U1, stripeSessionId: cs, paymentIntent: 'pi_1', lines: purchasedLines(LINES) })
    return { sid, orderId }
  }
  it('product selection is by eligibility only (no photograph needed), generation is closed, and the owned artwork is the favorite for the whole journey', async () => {
    const r = await rig(); const sid = (await createSessionFromCollection(r.deps, { userId: U1, previewId: OWNED })).view.sessionId
    for (const id of ['framed:12x18', 'premium:12x18', 'canvas:12x18']) expect((await setLines(r.deps, U1, sid, [{ lineId: 'x', productId: id, copies: 1 }])).geometries[0].productId, id).toBe(id)
    await expect(setLines(r.deps, U1, sid, [{ lineId: 'x', productId: 'card:7x5-gloss', copies: 1 }])).rejects.toMatchObject({ code: 'product_not_available' })
    expect((await setLines(r.deps, U1, sid, LINES)).geometries.map(g => g.productId)).toEqual(['fine_art:8x8', 'canvas:12x12'])
    await expect(startBatch(r.deps, U1, sid, { idempotencyKey: 'idem-key-new' })).rejects.toMatchObject({ code: 'collection_session_no_generation' })
    await expect(retryBatch(r.deps, U1, sid, 1)).rejects.toMatchObject({ code: 'collection_session_no_generation' }); expect(r.generate).not.toHaveBeenCalled()
  })
  it('pay, compose, one free correction, approve every line, finalize: approval only, no second My Collection piece, the owned piece untouched, nothing released', async () => {
    const r = await rig(); const before = r.ownedSnapshot(); const { sid, orderId } = await paid(r)
    let v = await ensureCompositions(r.deps, U1, sid); expect(v.compositions.every(c => c.status === 'ready')).toBe(true); expect(v.compositions[0].correctionsRemaining).toBe(1)
    v = await correctLine(r.deps, U1, sid, 'a'); expect(v.compositions.find(c => c.lineId === 'a')).toMatchObject({ attempt: 2, correctionsRemaining: 0 }); expect(r.generate.mock.calls.length).toBeLessThanOrEqual(1)
    for (const c of r.store.compositions.filter(x => x.status === 'ready')) await approveComposition(r.deps, U1, sid, c.id)
    await expect(finalizeOrder(r.deps, U1, 'bad-id')).rejects.toBeInstanceOf(GiftError)
    const done = await finalizeOrder(r.deps, U1, sid)
    expect(done.order).toMatchObject({ state: 'approved', manufacturing: 'not_released', unlockPortfolioId: PORTFOLIO }); expect(done.entrance).toBe('collection')
    expect(r.store.portfolios.length).toBe(0)                                                                    // no second piece was created
    expect([...r.files.keys()].filter(k => /^(portraits|pets|groups)\//.test(k))).toEqual(['portraits/owned.png'])    // and nothing was copied into My Collection's storage
    expect(r.ownedSnapshot()).toBe(before); expect(r.store.orders.get(orderId)!.status).toBe('awaiting_artwork'); expect(r.deps.kick).not.toHaveBeenCalled()
    expect((await finalizeOrder(r.deps, U1, sid)).order.finalApprovedAt).toBe(done.order.finalApprovedAt)         // idempotent
  })
  it('deleting an unpaid collection session removes its own copies and records, never the owned piece', async () => {
    const r = await rig(); const before = r.ownedSnapshot(); const sid = (await createSessionFromCollection(r.deps, { userId: U1, previewId: OWNED })).view.sessionId
    await deleteSessionNow(r.deps, U1, sid); expect(r.store.sessions.size).toBe(0); expect([...r.files.keys()]).toEqual(['portraits/owned.png']); expect(r.ownedSnapshot()).toBe(before)
    expect((await createSessionFromCollection(r.deps, { userId: U1, previewId: OWNED })).created).toBe(true)         // and the piece can start a new session
  })
  it('the view of a photo session says so (entrance "photo", collection null)', async () => {
    const r = await rig(); const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
    const { createSession } = await import('./service'); const v = await createSession(r.deps, { userId: U1, imageB64: photo }); expect(v).toMatchObject({ entrance: 'photo', collection: null }); expect((await getSessionView(r.deps, U1, v.sessionId)).entrance).toBe('photo')
  })
})
