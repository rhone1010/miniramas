// The six-preview pipeline from "Craft my previews" to the stored result, with the REAL generateMaster (the call the backend makes to the series' generate route, which is
// what reaches Replicate's google/nano-banana-2.1) over a scripted fetch, the real service and the in-memory store. Nothing here calls a model or a database.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { createSession, startBatch, retryBatch, getSessionView, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { generateMaster, failureReason } from './real'
import { liveEffectIds } from './effects'

const U1 = '10000000-0000-4000-8000-000000000001'
const png = async () => (await sharp({ create: { width: 64, height: 96, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64')

type Call = { url: string; auth: string | null; body: Record<string, unknown> }
function rig() {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const calls: Call[] = []
  const script = { respond: async (_c: Call): Promise<{ status: number; json: unknown }> => ({ status: 200, json: { result: { ok: true, image_b64: await png() } } }) }
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const call: Call = { url, auth: (init.headers as Record<string, string>)?.Authorization ?? null, body: JSON.parse(String(init.body)) }
    calls.push(call)
    const r = await script.respond(call)
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json } as Response
  })
  const deps: GiftDeps = {
    store, generate: generateMaster, compose: vi.fn() as any, watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async (p, s) => (files.has(p) ? `https://signed.test/${p}?ttl=${s}` : null) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), kick: vi.fn(async () => ({})),
  } as GiftDeps
  return { deps, store, files, calls, script, fetchMock }
}
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')

let saved: Record<string, string | undefined>
beforeEach(() => { saved = { APP_URL: process.env.APP_URL, CRON_SECRET: process.env.CRON_SECRET, VERCEL_ENV: process.env.VERCEL_ENV }; process.env.APP_URL = 'https://app.test'; process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL_ENV })
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }; vi.unstubAllGlobals() })

describe('Craft my previews: each requested effect is submitted once and its result is stored against the right session and batch', () => {
  it('submits one render per requested effect to the series route (the nano-banana-2.1 generator), authenticated internally, with the customer\'s stored photo', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const effects = liveEffectIds('portraits').slice(3, 9)                                  // six the customer picked
    const out = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: effects })
    expect(r.calls).toHaveLength(6)
    expect(r.calls.map(c => c.body.preset_id).sort()).toEqual([...effects].sort())           // every requested effect, exactly once
    expect(new Set(r.calls.map(c => c.url))).toEqual(new Set(['https://app.test/api/v1/portraits/generate']))
    expect(r.calls.every(c => c.auth === 'Bearer cron-test-secret')).toBe(true)              // internal call: no customer cookie or token is forwarded
    const photoB64 = (await r.deps.storage.get(`gift/${v.sessionId}/source.jpg`))!.toString('base64')
    expect(r.calls.every(c => c.body.source_image_b64 === photoB64)).toBe(true)              // the stored source, not browser input
    expect(out.complete).toBe(true)
    // stored and associated: six rows in THIS session and THIS batch, with a master and a watermarked preview each, and signed urls in the view
    const rows = r.store.previews.filter(p => p.session_id === v.sessionId)
    const batch = r.store.batches.find(b => b.session_id === v.sessionId)!
    expect(rows).toHaveLength(6); expect(rows.every(p => p.batch_id === batch.id && p.status === 'ready' && p.master_path && p.preview_path)).toBe(true)
    expect(rows.map(p => p.effect_id).sort()).toEqual([...effects].sort())
    for (const p of rows) { expect(p.master_path).toContain(`gift/${v.sessionId}/masters/${p.id}`); expect(p.preview_path).toBe(`gift/${v.sessionId}/previews/${p.id}.jpg`); expect(r.files.has(p.master_path!)).toBe(true); expect(r.files.has(p.preview_path!)).toBe(true) }
    expect(out.batch.previews.every(p => p.status === 'ready' && !!p.url)).toBe(true)
    expect(out.batch.progress).toEqual({ ready: 6, generating: 0, pending: 0, failed: 0 })
  })

  it('the stored preview is the watermarked one; the clean master is stored privately and never in a view', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() }); const out = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
    expect(JSON.stringify(out)).not.toMatch(/masters/)
  })

  it('a render that fails is recorded as failed WITH the series route\'s reason, the other five are kept, and a retry renders only the failed one', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    const effects = liveEffectIds('portraits').slice(0, 6), bad = effects[2]
    r.script.respond = async c => c.body.preset_id === bad
      ? { status: 500, json: { result: { ok: false, image_b64: null, fatal_error: 'Replicate prediction failed: timeout', error_code: 'nb2_failed' } } }
      : { status: 200, json: { result: { ok: true, image_b64: await png() } } }
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const out = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: effects })
    expect(out.complete).toBe(false)
    const failed = r.store.previews.find(p => p.effect_id === bad)!
    expect(failed.status).toBe('failed'); expect(failed.error).toBe('generate_failed:http_500:nb2_failed')            // the cause is no longer discarded
    expect(out.batch.progress).toEqual({ ready: 5, generating: 0, pending: 0, failed: 1 }); expect(out.batch.generation).toBe('stalled')
    expect(out.batch.previews.find(p => p.effectId === bad)).toMatchObject({ status: 'failed', retryable: true, url: null })
    r.calls.length = 0; r.script.respond = async () => ({ status: 200, json: { result: { ok: true, image_b64: await png() } } })
    const done = await retryBatch(r.deps, U1, v.sessionId, 1)
    expect(r.calls.map(c => c.body.preset_id)).toEqual([bad]); expect(done.complete).toBe(true)                       // only the failed one was submitted again
  })

  it('a refused render (redirected or intake-rejected by the series route) fails with that status, never stored as a result', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    r.script.respond = async () => ({ status: 200, json: { status: 'intake_rejected', result: { ok: true, image_b64: await png() } } })
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() }); const out = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
    expect(out.batch.progress.ready).toBe(0); expect(r.store.previews.every(p => p.status === 'failed' && p.error === 'intake_rejected' && !p.master_path)).toBe(true)
  })
})

describe('the results the Wizard can poll while generation runs', () => {
  it('shows pending, generating and ready per preview as work proceeds, and the counts add up', async () => {
    const r = rig(); vi.stubGlobal('fetch', r.fetchMock)
    const gates: Array<() => void> = []
    r.script.respond = () => new Promise(resolve => { gates.push(() => void png().then(b => resolve({ status: 200, json: { result: { ok: true, image_b64: b } } }))) })
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const run = startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })          // the POST is in flight; the Wizard polls the session meanwhile
    await vi.waitFor(() => expect(gates.length).toBe(3))                                          // three workers hold the first three renders
    let b = (await getSessionView(r.deps, U1, v.sessionId)).batches[0]
    expect(b.generation).toBe('running'); expect(b.progress).toEqual({ ready: 0, generating: 3, pending: 3, failed: 0 })
    expect(b.previews.map(p => p.status).sort()).toEqual(['generating', 'generating', 'generating', 'pending', 'pending', 'pending']); expect(b.previews.every(p => p.url === null)).toBe(true)
    gates.splice(0).forEach(g => g()); await vi.waitFor(() => expect(gates.length).toBe(3))
    b = (await getSessionView(r.deps, U1, v.sessionId)).batches[0]
    expect(b.progress.ready).toBe(3); expect(b.previews.filter(p => p.status === 'ready').every(p => !!p.url)).toBe(true); expect(b.generation).toBe('running')
    gates.splice(0).forEach(g => g()); const out = await run
    expect(out.complete).toBe(true); expect((await getSessionView(r.deps, U1, v.sessionId)).batches[0].progress).toEqual({ ready: 6, generating: 0, pending: 0, failed: 0 })
  })
})

describe('failureReason', () => {
  it('keeps the series route\'s code or text, adds the http status, and stays short and safe', () => {
    expect(failureReason({ result: { ok: false, error_code: 'nb2_failed', fatal_error: 'x' } }, 502)).toBe('generate_failed:http_502:nb2_failed')
    expect(failureReason({ result: { ok: false, fatal_error: 'Replicate  said\nno' } }, 500)).toBe('generate_failed:http_500:Replicate said no')
    expect(failureReason({ error: 'rate_limited' }, 429)).toBe('rate_limited:http_429')
    expect(failureReason({}, 200)).toBe('generate_failed')
    expect(failureReason({ result: { error_code: 'bad code with spaces' } }, 500)).toBe('generate_failed:http_500')
    expect(failureReason({ result: { fatal_error: 'z'.repeat(500) } }, 500).length).toBeLessThanOrEqual(160)
  })
})
