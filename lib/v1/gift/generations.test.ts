// The product-first generation journey end to end over the real service, the real series-route request builder (generateMaster over a scripted fetch) and the in-memory store:
// one effect, a generation at the product's exact aspect, the stored picture and its identity, the allowance (six free, then packs), failure and retry, idempotency, reuse,
// acceptance, the in-flight cap, cancel, refresh and restoration. No model, provider or database is called.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { createSession, getSessionView, restoreSession, startBatch, deleteSessionNow, GiftError, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { generateMaster } from './real'
import { liveEffectIds } from './effects'
import { chooseEffect, startGeneration, acceptGeneration, getGeneration, listGenerations, conformTo, generationTargetFor } from './generations'
import { allProducts } from '../print/catalog'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const photo = async (c = '#a33') => (await sharp({ create: { width: 600, height: 600, channels: 3, background: c } }).jpeg().toBuffer()).toString('base64')
const key = (n: number | string) => `gen-key-${String(n).padStart(4, '0')}`

type Call = { url: string; body: Record<string, any> }
/** What a model returns for a requested ratio: the ratio within about 1% (as real models do), so the exact-aspect step has something to do. */
async function imageFor(aspect: string, off = 1.0075) {
  const [a, b] = aspect.split(':').map(Number)
  const h = 700, w = Math.round(h * (a / b) * off)
  return (await sharp({ create: { width: w, height: h, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64')
}
function rig(series: 'portraits' | 'pets' | 'groups' = 'portraits', people: number | null = null) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>(), calls: Call[] = []
  const state = { gate: null as Promise<void> | null, respond: null as null | ((c: Call) => Promise<{ status: number; json: unknown }>), off: 1.0075 }
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const call: Call = { url, body: JSON.parse(String(init.body)) }; calls.push(call)
    if (state.gate) await state.gate
    const asp = call.body.output_aspect_ratio ?? call.body.aspect_ratio ?? call.body.format ?? '1:1'
    const r = state.respond ? await state.respond(call) : { status: 200, json: { result: { ok: true, image_b64: await imageFor(asp, state.off), passed: true, attempts: [{ attempt: 1, passed: true, pass_reason: 'pass', per_figure_scores: [{ score: 9 }] }], outpainted: false } } }
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json } as Response
  })
  const deps: GiftDeps = {
    store, generate: generateMaster, compose: vi.fn() as any, watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null), list: async d => [...files.keys()].filter(k => k.startsWith(d)) },
    analyze: async () => ({ status: 'supported', series, peopleCount: people }), kick: vi.fn(async () => ({})),
  } as GiftDeps
  return { deps, store, files, calls, state, fetchMock }
}
const effectOf = (series: 'portraits' | 'pets' | 'groups' = 'portraits') => liveEffectIds(series)[0]
async function ready(series: 'portraits' | 'pets' | 'groups' = 'portraits', people: number | null = null, user = U1) {
  const r = rig(series, people); vi.stubGlobal('fetch', r.fetchMock)
  const v = await createSession(r.deps, { userId: user, imageB64: await photo() })
  await chooseEffect(r.deps, user, v.sessionId, effectOf(series))
  return { ...r, sessionId: v.sessionId, view: v }
}
let saved: Record<string, string | undefined>
beforeEach(() => { saved = { APP_URL: process.env.APP_URL, CRON_SECRET: process.env.CRON_SECRET, VERCEL_ENV: process.env.VERCEL_ENV, GIFT_NEW_SESSION_FLOW: process.env.GIFT_NEW_SESSION_FLOW }; process.env.APP_URL = 'https://app.test'; process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL_ENV; process.env.GIFT_NEW_SESSION_FLOW = 'generations' })
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }; vi.unstubAllGlobals() })

describe('the flow', () => {
  it('a new session in the generations flow reports it, closes the six-preview batches and exposes its allowance', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    expect(v.flow).toBe('generations'); expect(v.nextBatch).toEqual({ kind: 'blocked', reason: 'generations_flow' }); expect(v.batches).toEqual([])
    expect(v.generations).toMatchObject({ effectId: null, anchorPreviewId: null, items: [], inFlight: 0, maxInFlight: 2, allowance: { freeTotal: 6, freeUsed: 0, freeRemaining: 6, freeAvailable: true, paidUnits: 0, next: 'blocked', blockedReason: 'effect_not_chosen', packPriceCents: 299, generationsPerPack: 6 } })
    await expect(startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })).rejects.toMatchObject({ code: 'legacy_batches_closed' })
    expect(r.calls).toHaveLength(0)
  })
  it('the default flow is unchanged: previews, no generations block, batches work', async () => {
    delete process.env.GIFT_NEW_SESSION_FLOW
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    expect(v.flow).toBe('previews'); expect(v.generations).toBeNull(); expect(v.nextBatch).toEqual({ kind: 'free' })
    await expect(chooseEffect(r.deps, U1, v.sessionId, effectOf())).rejects.toMatchObject({ code: 'flow_not_generations' })
    await expect(startGeneration(r.deps, U1, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })).rejects.toMatchObject({ code: 'flow_not_generations' })
  })
  it('one effect: it must be a live effect of the series; choosing again is idempotent and the anchor is exposed', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    await expect(chooseEffect(r.deps, U1, v.sessionId, 'not_an_effect')).rejects.toMatchObject({ code: 'invalid_effect_selection' })
    await expect(chooseEffect(r.deps, U1, v.sessionId, undefined)).rejects.toMatchObject({ code: 'invalid_effect_selection' })
    await expect(chooseEffect(r.deps, U2, v.sessionId, effectOf())).rejects.toMatchObject({ code: 'session_not_found' })
    const a = await chooseEffect(r.deps, U1, v.sessionId, effectOf()), b = await chooseEffect(r.deps, U1, v.sessionId, effectOf())
    expect(a.generations!.anchorPreviewId).toBe(b.generations!.anchorPreviewId); expect(a.generations!.effectId).toBe(effectOf()); expect(a.artworkPreviewId).toBe(a.generations!.anchorPreviewId)
    expect(a.generations!.allowance).toMatchObject({ next: 'free', blockedReason: null }); expect(a.batches).toEqual([])
  })
  it('a generation needs an effect first', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    await expect(startGeneration(r.deps, U1, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })).rejects.toMatchObject({ code: 'effect_not_chosen' })
  })
})

describe('one generation, at the product\'s exact aspect', () => {
  it('Portraits 12x18 (2:3): the route is asked for exactly 2:3, the stored picture IS 2:3, trimmed by under 1%, never extended; its sha256 is of the stored bytes', async () => {
    const t = await ready()
    const out = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    expect(t.calls).toHaveLength(1); expect(t.calls[0].url).toBe('https://app.test/api/v1/portraits/generate')
    expect(t.calls[0].body).toMatchObject({ output_aspect_ratio: '2:3', product_composition: true, preset_id: effectOf() }); expect(t.calls[0].body.additional_images_b64).toBeUndefined()
    expect(out.status).toBe('ok'); expect(out.reused).toBe(false)
    const g = out.generation; expect(g).toMatchObject({ status: 'ready', productId: 'fine_art:12x18', geometryKey: 'a667', kind: 'free', accepted: false, retryable: false })
    expect(g.conform).toMatchObject({ method: 'trim' }); expect(g.conform!.trimFraction).toBeGreaterThan(0); expect(g.conform!.trimFraction).toBeLessThan(0.01)
    expect(Math.abs(g.width! / g.height! - 2 / 3)).toBeLessThan(1 / g.height!)
    const stored = t.files.get(`gift/${t.sessionId}/masters/${g.generationId}.png`)!; const md = await sharp(stored).metadata()
    expect([md.width, md.height, md.format]).toEqual([g.width, g.height, 'png']); expect(g.sha256).toBe(createHash('sha256').update(stored).digest('hex'))
    expect(g.url).toBe(`https://signed.test/gift/${t.sessionId}/previews/${g.generationId}.jpg`); expect(g.quality).toEqual({ status: 'passed', attempts: 1 })
    expect(out.session.generations!.allowance).toMatchObject({ freeUsed: 1, freeRemaining: 5, next: 'free' })
  })
  it('a model that returns exactly the ratio is stored untouched (native)', async () => {
    const t = await ready(); t.state.off = 1
    const g = (await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:8x8', idempotencyKey: key(1) })).generation
    expect(t.calls[0].body.output_aspect_ratio).toBe('1:1'); expect(g).toMatchObject({ geometryKey: 'a1000', width: 700, height: 700, conform: { method: 'native', trimFraction: 0 } })
  })
  it('a picture the model returns more than 10% off its shape is refused, not extended or stretched, and counts for nothing', async () => {
    const t = await ready(); t.state.off = 1.25
    const out = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    expect(out.generation).toMatchObject({ status: 'failed', retryable: true }); expect([...t.files.keys()].filter(k => k.includes('/masters/'))).toEqual([])
    expect(out.session.generations!.allowance).toMatchObject({ freeUsed: 0, freeRemaining: 6 })
  })
  it('Pets and Groups ask for the exact ratio too, with no outpaint and at most 2 attempts for Groups', async () => {
    const p = await ready('pets'); await startGeneration(p.deps, U1, p.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    expect(p.calls[0].url).toBe('https://app.test/api/v1/pets/generate'); expect(p.calls[0].body).toMatchObject({ aspect_ratio: '2:3', skip_outpaint: true })
    const g = await ready('groups', 3); await startGeneration(g.deps, U1, g.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    expect(g.calls[0].url).toBe('https://app.test/api/v1/groups/generate'); expect(g.calls[0].body).toMatchObject({ format: '2:3', subject_count: 3, skip_outpaint: true, max_attempts: 2 })
  })
  it('conformTo trims a sliver and nothing else; generationTargetFor knows the exact ratio for 1:1 and 2:3 and would for 3:2', () => {
    expect(conformTo(700, 700, 1)).toMatchObject({ method: 'native', trimFraction: 0 })
    expect(conformTo(705, 700, 1)).toMatchObject({ method: 'trim', crop: { left: 2, top: 0, width: 700, height: 700 } })
    expect(conformTo(680, 1000, 2 / 3)?.crop).toMatchObject({ width: 667, height: 1000 }); expect(conformTo(500, 1000, 2 / 3)).toBeNull(); expect(conformTo(700, 1000, 0.5)).toBeNull(); expect(conformTo(1000, 700, 1)).toBeNull()
    const fine = (id: string) => allProducts().find(p => p.productId === id)!
    for (const s of ['portraits', 'pets', 'groups'] as const) {
      expect(generationTargetFor(fine('fine_art:12x18'), s, 3)).toMatchObject({ aspect: '2:3', geometryKey: 'a667' }); expect(generationTargetFor(fine('fine_art:8x8'), s, 3)).toMatchObject({ aspect: '1:1', geometryKey: 'a1000' })
    }
    // 3:2 landscape: the architecture resolves the exact ratio from the product's own picture aspect (data only, once a Prodigi SKU is verified).
    const landscape = { ...fine('fine_art:12x18'), requirements: { ...fine('fine_art:12x18').requirements, pictureAspect: 1.5 } } as any
    for (const s of ['portraits', 'pets'] as const) expect(generationTargetFor(landscape, s, null)).toMatchObject({ aspect: '3:2', geometryKey: 'a1500' })
    expect(generationTargetFor(landscape, 'groups', 4)).toMatchObject({ aspect: '3:2' })
  })
})

describe('idempotency, reuse and retry', () => {
  it('the same key never generates twice; the same effect and shape is reused across sizes at no cost; a new key is a new generation', async () => {
    const t = await ready()
    const a = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    const again = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    expect(again.generation.generationId).toBe(a.generation.generationId); expect(again.reused).toBe(true); expect(t.calls).toHaveLength(1)
    const bigger = await startGeneration(t.deps, U1, t.sessionId, { productId: 'canvas:16x24', idempotencyKey: key(2) })        // another 2:3 product
    expect(bigger.generation.generationId).toBe(a.generation.generationId); expect(bigger.reused).toBe(true); expect(t.calls).toHaveLength(1)
    const sq = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:8x8', idempotencyKey: key(3) })              // a different shape needs its own
    expect(sq.generation.geometryKey).toBe('a1000'); expect(t.calls).toHaveLength(2)
    const retry = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(4), mode: 'new' })      // "Try again"
    expect(retry.generation.generationId).not.toBe(a.generation.generationId); expect(retry.reused).toBe(false); expect(t.calls).toHaveLength(3)
    expect((await listGenerations(t.deps, U1, t.sessionId)).generations).toHaveLength(3)
  })
  it('a failed generation is not counted and the same key tries again', async () => {
    const t = await ready(); let n = 0
    t.state.respond = async c => (++n === 1 ? { status: 200, json: { result: { ok: false, fatal_error: 'nb2_failed', error_code: 'nb2_failed' } } } : { status: 200, json: { result: { ok: true, image_b64: await imageFor('2:3'), passed: true, attempts: [{ passed: true, pass_reason: 'ok' }] } } })
    const f = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    expect(f.status).toBe('partial'); expect(f.generation).toMatchObject({ status: 'failed', retryable: true }); expect(f.session.generations!.allowance).toMatchObject({ freeUsed: 0, freeRemaining: 6 })
    const ok = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    expect(ok.generation).toMatchObject({ status: 'ready', generationId: f.generation.generationId }); expect(ok.session.generations!.allowance.freeUsed).toBe(1)
  })
  it('validation: key, product and mode', async () => {
    const t = await ready()
    await expect(startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: 'short' })).rejects.toMatchObject({ code: 'invalid_idempotency_key' })
    await expect(startGeneration(t.deps, U1, t.sessionId, { productId: 'nope', idempotencyKey: key(1) })).rejects.toMatchObject({ code: 'product_not_available' })
    await expect(startGeneration(t.deps, U1, t.sessionId, { productId: 'framed_canvas:8x12', idempotencyKey: key(1) })).rejects.toMatchObject({ code: 'product_not_available' })
    await expect(startGeneration(t.deps, U2, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })).rejects.toMatchObject({ code: 'session_not_found' })
    await expect(startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1), mode: 'x' })).rejects.toBeInstanceOf(GiftError)
    expect(t.calls).toHaveLength(0)
  })
})

describe('the allowance: six free, then packs of six at $2.99', () => {
  it('six free generations, then payment_required; a pack opens six more as kind paid; a failed paid one returns its unit', async () => {
    const t = await ready()
    for (let i = 1; i <= 6; i++) expect((await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(i), mode: 'new' })).generation.kind).toBe('free')
    const v = await getSessionView(t.deps, U1, t.sessionId); expect(v.generations!.allowance).toMatchObject({ freeUsed: 6, freeRemaining: 0, freeAvailable: false, freeBlockedReason: 'session_limit', next: 'payment_required', paidUnits: 0 })
    await expect(startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(7), mode: 'new' })).rejects.toMatchObject({ code: 'payment_required', status: 402 })
    expect(t.calls).toHaveLength(6)
    t.store.packs.push({ id: 'pack-1', user_id: U1, stripe_session_id: 'cs_pack_1', amount_cents: 299, status: 'paid' })
    expect((await getSessionView(t.deps, U1, t.sessionId)).generations!.allowance).toMatchObject({ next: 'paid', paidUnits: 6 })
    t.state.respond = async () => ({ status: 200, json: { result: { ok: false, fatal_error: 'nb2_failed' } } })
    const bad = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(7), mode: 'new' })
    expect(bad.generation.status).toBe('failed'); expect(bad.session.generations!.allowance.paidUnits).toBe(6)
    t.state.respond = null
    for (let i = 8; i <= 13; i++) expect((await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(i), mode: 'new' })).generation.kind).toBe('paid')
    expect(t.store.packs[0].status).toBe('consumed')
    await expect(startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(14), mode: 'new' })).rejects.toMatchObject({ code: 'payment_required' })
  })
  it('the account limits survive deleting the project: the same photograph cannot be reset', async () => {
    const t = await ready()
    for (let i = 1; i <= 6; i++) await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(i), mode: 'new' })
    await deleteSessionNow(t.deps, U1, t.sessionId)
    const v2 = await createSession(t.deps, { userId: U1, imageB64: await photo() })                    // the same photograph again
    await chooseEffect(t.deps, U1, v2.sessionId, effectOf())
    await expect(startGeneration(t.deps, U1, v2.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(20) })).rejects.toMatchObject({ code: 'payment_required' })
    expect((await getSessionView(t.deps, U1, v2.sessionId)).generations!.allowance).toMatchObject({ freeBlockedReason: 'photo_limit' })
  })
  it('at most two generations are in flight; cancelling while one runs discards its result', async () => {
    const t = await ready(); let open!: () => void; t.state.gate = new Promise<void>(r => { open = r })
    const one = startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    const two = startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:8x8', idempotencyKey: key(2) })
    await new Promise(r => setTimeout(r, 20))
    await expect(startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(3), mode: 'new' })).rejects.toMatchObject({ code: 'generation_in_progress' })
    await deleteSessionNow(t.deps, U1, t.sessionId); open(); await Promise.allSettled([one, two])
    expect([...t.files.keys()].filter(k => k.includes('/masters/') || k.includes('/previews/'))).toEqual([])
  })
})

describe('acceptance, refresh and restoration', () => {
  it('only a delivered generation can be accepted; acceptance is idempotent and survives refresh and restoration', async () => {
    const t = await ready()
    const out = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) }); const id = out.generation.generationId
    const acc = await acceptGeneration(t.deps, U1, t.sessionId, id); expect(acc.generation).toMatchObject({ accepted: true }); expect(acc.generation.acceptedAt).toBeTruthy()
    expect((await acceptGeneration(t.deps, U1, t.sessionId, id)).generation.acceptedAt).toBe(acc.generation.acceptedAt)
    await expect(acceptGeneration(t.deps, U1, t.sessionId, '00000000-0000-4000-8000-0000000000aa')).rejects.toMatchObject({ code: 'generation_not_found' })
    await expect(acceptGeneration(t.deps, U2, t.sessionId, id)).rejects.toMatchObject({ code: 'session_not_found' })
    const refreshed = await getSessionView(t.deps, U1, t.sessionId), restored = (await restoreSession(t.deps, U1)).current!
    for (const v of [refreshed, restored]) { expect(v.flow).toBe('generations'); expect(v.generations!.items).toHaveLength(1); expect(v.generations!.items[0]).toMatchObject({ generationId: id, accepted: true, status: 'ready', sha256: out.generation.sha256 }) }
    expect((await getGeneration(t.deps, U1, t.sessionId, id)).url).toBeTruthy()
  })
  it('a generation that is not delivered cannot be accepted', async () => {
    const t = await ready(); t.state.respond = async () => ({ status: 200, json: { result: { ok: false, fatal_error: 'nb2_failed' } } })
    const out = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    await expect(acceptGeneration(t.deps, U1, t.sessionId, out.generation.generationId)).rejects.toMatchObject({ code: 'generation_not_ready' })
  })
  it('changing the effect keeps the pool, moves the anchor, and the new effect starts its own generations', async () => {
    const t = await ready(); await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    const other = liveEffectIds('portraits')[1]; const v = await chooseEffect(t.deps, U1, t.sessionId, other)
    expect(v.generations!.effectId).toBe(other)
    const g = await startGeneration(t.deps, U1, t.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(2) })          // same shape, different effect: NOT a reuse
    expect(g.reused).toBe(false); expect(t.calls).toHaveLength(2); expect(t.calls[1].body.preset_id).toBe(other)
  })
})
