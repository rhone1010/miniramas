// The INITIAL six-preview path: what is sent to each series' route (no margin outpaint, a bounded attempt cap), that six render concurrently, that a failed quality score is kept as information
// and never turns a delivered preview into an error, what is stored (the model's output, untouched, with its generation record), and what Cancel (deleting the project) does to work in flight.
// Real generateMaster over a scripted fetch, the real service, the in-memory store. No model, provider or database is called.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { createSession, startBatch, retryBatch, getSessionView, restoreSession, deleteSessionNow, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { generateMaster, generationRecordFrom, generateBody } from './real'
import { liveEffectIds } from './effects'

const U1 = '10000000-0000-4000-8000-000000000001'
const art = async (w = 96, h = 64) => (await sharp({ create: { width: w, height: h, channels: 3, background: '#3a6' } }).jpeg().toBuffer()).toString('base64')
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')

type Call = { url: string; body: Record<string, any> }
function rig(series: 'portraits' | 'pets' | 'groups' = 'portraits', people: number | null = null) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>(), calls: Call[] = []
  const state = { inflight: 0, peak: 0, gate: null as Promise<void> | null, delayMs: 0, respond: null as null | ((c: Call) => Promise<{ status: number; json: unknown }>) }
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const call: Call = { url, body: JSON.parse(String(init.body)) }; calls.push(call)
    state.inflight++; state.peak = Math.max(state.peak, state.inflight)
    try {
      if (state.gate) await state.gate
      if (state.delayMs) await new Promise(r => setTimeout(r, state.delayMs))
      const r = state.respond ? await state.respond(call) : { status: 200, json: { result: { ok: true, image_b64: await art(), passed: true, attempts: [{ attempt: 1, passed: true, pass_reason: 'pass', per_figure_scores: [{ score: 9 }] }], outpainted: false } } }
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json } as Response
    } finally { state.inflight-- }
  })
  const deps: GiftDeps = {
    store, generate: generateMaster, compose: vi.fn() as any, watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null), list: async d => [...files.keys()].filter(k => k.startsWith(d)) },
    analyze: async () => ({ status: 'supported', series, peopleCount: people }), kick: vi.fn(async () => ({})),
  } as GiftDeps
  return { deps, store, files, calls, state, fetchMock }
}
let saved: Record<string, string | undefined>
beforeEach(() => { saved = { APP_URL: process.env.APP_URL, CRON_SECRET: process.env.CRON_SECRET, VERCEL_ENV: process.env.VERCEL_ENV }; process.env.APP_URL = 'https://app.test'; process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL_ENV })
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }; vi.unstubAllGlobals() })

describe('what is asked of each series route for an INITIAL preview', () => {
  const base = { sourceB64: 'PHOTO', effectId: 'e', aspect: '3:2', userId: 'u', peopleCount: 5 }
  it('Groups: no margin outpaint and at most 2 attempts; the effect, source and aspect are exactly what they were', () => {
    expect(generateBody({ ...base, series: 'groups' })).toEqual({ source_image_b64: 'PHOTO', effect_id: 'e', format: '3:2', subject_count: 5, skip_outpaint: true, max_attempts: 2 })
  })
  it('Pets: no Stability outpaint; the prompt inputs (style, preset, action, aspect, scale) are untouched', () => {
    expect(generateBody({ ...base, series: 'pets', aspect: '1:1' })).toEqual({ source_image_b64: 'PHOTO', style_id: 'realistic', preset_id: 'e', action_id: 'as_photographed', aspect_ratio: '1:1', scale: 'close_up', skip_outpaint: true })
  })
  it('Portraits: nothing added (its route has no Stability stage and already stops at 2 attempts)', () => {
    const b = generateBody({ ...base, series: 'portraits', aspect: '1:1' }); expect(b).not.toHaveProperty('skip_outpaint'); expect(b).not.toHaveProperty('max_attempts'); expect(b.output_aspect_ratio).toBeUndefined()
  })
  it('a product composition is NOT an initial preview: its body carries neither flag', () => {
    expect(generateBody({ ...base, series: 'groups', productComposition: true })).not.toHaveProperty('skip_outpaint')
    expect(generateBody({ ...base, series: 'pets', aspect: '1:1', productComposition: true })).not.toHaveProperty('skip_outpaint')
  })
  it('a real batch sends the body above for every one of the six, with the stored photograph', async () => {
    const r = rig('groups', 5); vi.stubGlobal('fetch', r.fetchMock)
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() }); await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
    expect(r.calls).toHaveLength(6); expect(r.calls.every(c => c.url === 'https://app.test/api/v1/groups/generate' && c.body.skip_outpaint === true && c.body.max_attempts === 2 && c.body.format === '3:2')).toBe(true)
  })
})

describe('the record kept with a preview', () => {
  const ctx = { series: 'groups' as const, effectId: 'e', aspect: '3:2', durationMs: 1234 }
  it('a Groups result that missed the likeness bar is below_bar with the scores, the attempts and no post-processing', () => {
    const g = generationRecordFrom({ ok: true, passed: false, failure: { kind: 'some_figures' }, outpainted: false, outpaint_skip: 'initial_preview', attempts: [{ passed: false, pass_reason: '2 top-tier below 9/10', per_figure_scores: [{ score: 9 }, { score: 8 }] }, { passed: false, pass_reason: '3 top-tier below 9/10', per_figure_scores: [{ score: 8 }, { score: 7 }, { score: 9 }] }] }, ctx)
    expect(g).toMatchObject({ v: 1, quality: 'below_bar', passed: false, attempts: 2, scores: [8, 7, 9], reason: '3 top-tier below 9/10', postProcessing: { outpaint: false, skipped: 'initial_preview' }, durationMs: 1234 })
  })
  it('Pets and Portraits report final_pass; a pass is passed; a result with nothing to read is unscored, never passed', () => {
    expect(generationRecordFrom({ ok: true, final_pass: true, final_reason: 'ok', expanded: false, expand_skip: 'initial_preview', attempts: [{ passed: true, pass_reason: 'ok' }] }, { ...ctx, series: 'pets' })).toMatchObject({ quality: 'passed', attempts: 1, postProcessing: { outpaint: false, skipped: 'initial_preview' } })
    expect(generationRecordFrom({ ok: true, expanded: true, attempts: [] }, ctx)).toMatchObject({ quality: 'unscored', passed: null, attempts: 1, postProcessing: { outpaint: true } })
    expect(generationRecordFrom({ ok: true, attempts: [{ passed: true, pass_reason: 'scoring skipped' }] }, ctx)).toMatchObject({ quality: 'unscored', passed: null })
    expect(generationRecordFrom(null, ctx)).toMatchObject({ quality: 'unscored' })
  })
})

describe('six previews at once, with their quality kept and never mistaken for success or for failure', () => {
  it('all six are in flight together (concurrent), a missed likeness bar is delivered as ready with quality below_bar, and the stored original is the model output byte for byte', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); r.state.delayMs = 40
    const out = await art(120, 80)
    r.state.respond = async c => c.body.preset_id === liveEffectIds('portraits')[0]
      ? { status: 200, json: { result: { ok: true, image_b64: out, passed: false, attempts: [{ attempt: 1, passed: false, pass_reason: 'likeness 6/10', per_figure_scores: [{ score: 6 }] }] } } }
      : { status: 200, json: { result: { ok: true, image_b64: out, passed: true, attempts: [{ attempt: 1, passed: true, pass_reason: 'ok', per_figure_scores: [{ score: 9 }] }] } } }
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() }); const t0 = Date.now()
    const res = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' }); const batchMs = Date.now() - t0
    expect(r.state.peak).toBe(6); expect(batchMs).toBeLessThan(6 * 40)                                    // not six in a row
    expect(res.complete).toBe(true); const p = res.batch.previews
    expect(p.every(x => x.status === 'ready' && x.url)).toBe(true)
    expect(p.filter(x => x.quality?.status === 'below_bar')).toHaveLength(1); expect(p.filter(x => x.quality?.status === 'passed')).toHaveLength(5); expect(p.every(x => x.quality?.attempts === 1)).toBe(true)
    expect(JSON.stringify(res.session)).not.toMatch(/likeness 6\/10|"scores"/)                            // reasons and scores stay server-side
    const stored = r.store.previews[0]; expect((await r.deps.storage.get(stored.master_path!))!.equals(Buffer.from(out, 'base64'))).toBe(true)          // no re-encode, no resize, no extension
    expect(r.store.previews.every(x => x.generation?.postProcessing.outpaint === false)).toBe(true)
  })
  it('a preview whose route answered ok:false is a recoverable failure (retryable), not a below_bar success; a retry runs only that one and the cap holds', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    let n = 0; r.state.respond = async () => (++n === 1 ? { status: 200, json: { result: { ok: false, fatal_error: 'nb2_failed', error_code: 'nb2_failed' } } } : { status: 200, json: { result: { ok: true, image_b64: await art(), passed: true, attempts: [{ passed: true, pass_reason: 'ok' }] } } })
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() }); const first = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
    expect(first.complete).toBe(false); const failed = first.batch.previews.filter(x => x.status === 'failed'); expect(failed).toHaveLength(1); expect(failed[0]).toMatchObject({ retryable: true, quality: null })
    const callsBefore = r.calls.length; const again = await retryBatch(r.deps, U1, v.sessionId, 1)
    expect(r.calls.length - callsBefore).toBe(1); expect(again.complete).toBe(true)                        // only the failed one ran
    const retry3 = rig(); vi.stubGlobal('fetch', retry3.fetchMock); retry3.state.respond = async () => ({ status: 500, json: { error: 'boom' } })
    const v2 = await createSession(retry3.deps, { userId: U1, imageB64: await photo() }); await startBatch(retry3.deps, U1, v2.sessionId, { idempotencyKey: 'idem-key-9' }); await retryBatch(retry3.deps, U1, v2.sessionId, 1); await retryBatch(retry3.deps, U1, v2.sessionId, 1); await retryBatch(retry3.deps, U1, v2.sessionId, 1)
    expect(retry3.calls.length).toBe(18)                                                                    // 6 previews x 3 claims, then no more, however often the customer retries
    expect((await getSessionView(retry3.deps, U1, v2.sessionId)).batches[0].previews.every(x => x.retryable === false)).toBe(true)
  })
  it('two requests for the same batch at once (a double click, a second tab, a refresh) pay for six renders once', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); r.state.delayMs = 30
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const [a, b] = await Promise.all([startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' }), startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })])
    expect(r.calls).toHaveLength(6); expect(a.batch.batchIndex).toBe(b.batch.batchIndex)
  })
  it('refresh while rendering: the restore says running, and the work finishes into the same rows', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); let release!: () => void; r.state.gate = new Promise<void>(res => { release = res })
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() }); const run = startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
    await vi.waitFor(() => expect(r.calls).toHaveLength(6))
    const mid = await restoreSession(r.deps, U1); expect(mid.resume!.runningBatches).toEqual([1]); expect(mid.current!.batches[0].progress).toMatchObject({ generating: 6, ready: 0 })
    release(); await run; const done = await restoreSession(r.deps, U1); expect(done.current!.batches[0].complete).toBe(true); expect(r.calls).toHaveLength(6)
  })
})

describe('Cancel', () => {
  it('leaving the project (the Wizard\'s Cancel button today) changes nothing on the server: the six keep rendering into the saved project and a later restore finds them', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); let release!: () => void; r.state.gate = new Promise<void>(res => { release = res })
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() }); const run = startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
    await vi.waitFor(() => expect(r.calls).toHaveLength(6)); release(); await run
    const back = await restoreSession(r.deps, U1); expect(back.current!.batches[0].complete).toBe(true); expect(back.current!.batches[0].previews.every(p => p.url)).toBe(true)
  })
  it('deleting the project while the six are in flight: the paid calls finish, their results are DISCARDED, no row and no file survives, nothing new starts, and a retry is refused', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock); let release!: () => void; r.state.gate = new Promise<void>(res => { release = res })
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() }); const run = startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
    await vi.waitFor(() => expect(r.calls).toHaveLength(6))
    await deleteSessionNow(r.deps, U1, v.sessionId)                                                      // Cancel with discard
    release(); await run.catch(() => {})
    expect(r.calls).toHaveLength(6)                                                                      // nothing new was started
    expect(r.store.sessions.size).toBe(0); expect(r.store.previews).toHaveLength(0); expect(r.store.batches).toHaveLength(0)
    expect([...r.files.keys()]).toEqual([])                                                              // no master, no preview, no source left behind
    await expect(retryBatch(r.deps, U1, v.sessionId, 1)).rejects.toMatchObject({ code: 'session_not_found' })
  })
  it('a result that lands between the object removal and the row deletion is swept up (no orphan file)', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    // a late file for this session, as a still-running render would write it after removeObjects looked
    const realDelete = r.store.deleteSession.bind(r.store); r.store.deleteSession = async id => { await r.deps.storage.put(`gift/${id}/masters/late.png`, Buffer.from('x'), 'image/png'); await realDelete(id) }
    await deleteSessionNow(r.deps, U1, v.sessionId); expect([...r.files.keys()]).toEqual([])
  })
})
