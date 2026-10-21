// Durable post-purchase composition status and recovery (migration 055): what a polling client sees while a gift's artwork is prepared, after a refresh, after a request dies,
// after a failure, and that a second request can never pay for the same generation twice. Real composition pipeline; generator and the paid outpaint are counting stand-ins.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('../shared/outpaint', () => ({
  outpaint: async (i: any) => { const s = (await import('sharp')).default; return { outpainted: true, image: await s(i.image).extend({ left: i.padding.left, right: i.padding.right, top: i.padding.up, bottom: i.padding.down, extendWith: 'mirror' }).jpeg().toBuffer() } },
}))

import { createSession, startBatch, setLines, getSessionView, restoreSession, type GiftDeps } from './service'
import { memoryGiftStore, supabaseGiftStore } from './store'
import { selectArtwork, ensureCompositions, composeWithPrintShop } from './compose'
import { COMPOSITION_LEASE_MS } from './policy'
process.env.GIFT_REQUIRE_APPROVED_SCENE = '0'   // these tests cover behaviour independent of the sale gate (default ON); the gate has its own tests in orders.test.ts

const U1 = '10000000-0000-4000-8000-000000000001'

function rig() {
  const clock = { t: Date.parse('2026-10-20T10:00:00Z') }
  const store = memoryGiftStore(() => clock.t), files = new Map<string, Buffer>()
  const gate: { wait: Promise<void> | null } = { wait: null }, fail = { n: 0 }
  const generate = vi.fn(async (i: { aspect: string }) => {
    if (gate.wait) await gate.wait
    if (fail.n > 0) { fail.n--; throw new Error('nb2_failed') }
    const [w, h] = i.aspect.split(':').map(Number)
    return { imageB64: (await sharp({ create: { width: 512 * w, height: 512 * h, channels: 3, background: { r: 60 + w * 9, g: 90, b: 70 + h * 7 } } }).png().toBuffer()).toString('base64') }
  })
  const deps = {
    store, generate, compose: composeWithPrintShop, clock: () => clock.t, draftCompositions: true, watermark: async (b64: string) => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    storage: { put: async (p: string, b: Buffer) => { files.set(p, b) }, get: async (p: string) => files.get(p) ?? null, remove: async () => {}, signedUrl: async (p: string) => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), kick: vi.fn(async () => ({})),
  } as unknown as GiftDeps
  return { deps, store, files, generate, clock, gate, fail }
}
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
async function ready(r: ReturnType<typeof rig>, lines: Array<{ lineId: string; productId: string }>) {
  const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
  const b = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' }); await selectArtwork(r.deps, U1, v.sessionId, b.batch.previews[0].previewId)
  await setLines(r.deps, U1, v.sessionId, lines.map(l => ({ ...l, copies: 1 }))); r.generate.mockClear(); return v.sessionId       // count only the composition's own generations
}
const states = async (r: ReturnType<typeof rig>, sid: string) => (await getSessionView(r.deps, U1, sid)).compositions.map(c => [c.lineId, c.state] as const)
const PORTRAIT = [{ lineId: 'p', productId: 'fine_art:12x18' }]

describe('what the screen can see, from the database', () => {
  it('not_started -> preparing (with since) -> ready, and the job is gone when it succeeds', async () => {
    const r = rig(); const sid = await ready(r, PORTRAIT)
    expect(await states(r, sid)).toEqual([['p', 'not_started']])
    const a = (await restoreSession(r.deps, U1)).resume!.compositions; expect(a).toMatchObject({ state: 'not_started', resumeNeeded: true })
    let release!: () => void; r.gate.wait = new Promise<void>(res => { release = res })
    const run = ensureCompositions(r.deps, U1, sid)
    await vi.waitFor(async () => expect((await states(r, sid))[0][1]).toBe('preparing'))
    const mid = (await getSessionView(r.deps, U1, sid)).compositions[0]
    expect(mid).toMatchObject({ state: 'preparing', status: 'none', attempts: 1, failureCode: null, previewUrl: null }); expect(mid.preparingSince).toBe(new Date(r.clock.t).toISOString())
    const resume = (await restoreSession(r.deps, U1)).resume!.compositions; expect(resume).toMatchObject({ state: 'preparing', resumeNeeded: false, preparing: ['p'] })   // a refresh now says "preparing", not "start"
    release(); await run
    expect(await states(r, sid)).toEqual([['p', 'ready']]); expect(r.store.compositionJobs.size).toBe(0)
    expect((await restoreSession(r.deps, U1)).resume!.compositions).toMatchObject({ state: 'ready', resumeNeeded: false })
  })

  it('a second request (a second tab, a retry click, a refresh) while one is preparing generates NOTHING and answers at once with the current view', async () => {
    const r = rig(); const sid = await ready(r, PORTRAIT)
    let release!: () => void; r.gate.wait = new Promise<void>(res => { release = res })
    const first = ensureCompositions(r.deps, U1, sid); await vi.waitFor(() => expect(r.generate).toHaveBeenCalledTimes(1))
    const second = await ensureCompositions(r.deps, U1, sid); const third = await ensureCompositions(r.deps, U1, sid)
    expect(second.compositions[0].state).toBe('preparing'); expect(third.compositions[0].state).toBe('preparing')
    expect(r.generate).toHaveBeenCalledTimes(1)                                                    // the paid generation ran once
    release(); await first
    expect(await states(r, sid)).toEqual([['p', 'ready']]); expect(r.generate).toHaveBeenCalledTimes(1); expect(r.store.compositions).toHaveLength(1)
  })

  it('two gifts of one shape share one job; two shapes are two jobs, and each line shows its own state', async () => {
    const r = rig(); const sid = await ready(r, [{ lineId: 'c', productId: 'fine_art:8x8' }, { lineId: 'a', productId: 'fine_art:12x18' }, { lineId: 'b', productId: 'canvas:12x18' }])
    let release!: () => void; r.gate.wait = new Promise<void>(res => { release = res })
    const run = ensureCompositions(r.deps, U1, sid)
    await vi.waitFor(async () => expect((await states(r, sid)).find(s => s[0] === 'c')![1]).toBe('ready'))                  // the square one (no generation) finished first
    const mid = await states(r, sid); expect(mid).toEqual([['c', 'ready'], ['a', 'preparing'], ['b', 'preparing']]); expect(r.store.compositionJobs.size).toBe(1)
    release(); await run; expect((await states(r, sid)).every(s => s[1] === 'ready')).toBe(true); expect(r.generate).toHaveBeenCalledTimes(1)
  })
})

describe('recovery', () => {
  it('a request that died leaves a stalled job; the lease lapses, a refresh says stalled, and the next call takes it over and finishes it once', async () => {
    const r = rig(); const sid = await ready(r, PORTRAIT)
    const rec = [...r.store.sessions.values()][0], preview = r.store.previews.find(p => p.id === rec.artwork_preview_id)!
    // another process claimed the job and then died: it never finished or failed
    const geometryKey = (await getSessionView(r.deps, U1, sid)).compositions[0].geometryKey!
    const c = await r.store.claimComposition({ sessionId: sid, previewId: preview.id, geometryKey, lineIds: ['p'], method: 'generated', ttlMs: COMPOSITION_LEASE_MS, maxAttempts: 3, nowMs: r.clock.t })
    expect(c.token).toBeTruthy(); expect(await states(r, sid)).toEqual([['p', 'preparing']])
    await ensureCompositions(r.deps, U1, sid); expect(r.generate).not.toHaveBeenCalled()          // the live lease is respected
    r.clock.t += COMPOSITION_LEASE_MS + 1000
    expect(await states(r, sid)).toEqual([['p', 'stalled']]); expect((await restoreSession(r.deps, U1)).resume!.compositions).toMatchObject({ state: 'stalled', resumeNeeded: true, stalled: ['p'] })
    await ensureCompositions(r.deps, U1, sid)
    expect(await states(r, sid)).toEqual([['p', 'ready']]); expect(r.generate).toHaveBeenCalledTimes(1); expect(r.store.compositionJobs.size).toBe(0)
  })

  it('a failure is recorded with a code and stays visible after a refresh; a retry succeeds; three failures stop retries without generating again', async () => {
    const r = rig(); const sid = await ready(r, PORTRAIT)
    r.fail.n = 1
    await expect(ensureCompositions(r.deps, U1, sid)).rejects.toMatchObject({ code: 'composition_failed' })
    let c = (await getSessionView(r.deps, U1, sid)).compositions[0]; expect(c).toMatchObject({ state: 'failed', failureCode: 'composition_error', attempts: 1, retryable: true })
    expect((await restoreSession(r.deps, U1)).resume!.compositions).toMatchObject({ state: 'failed', resumeNeeded: true, failed: ['p'] })
    await ensureCompositions(r.deps, U1, sid); expect((await states(r, sid))[0][1]).toBe('ready')            // the retry: attempt 2, done

    const q = rig(); const sid2 = await ready(q, PORTRAIT); q.fail.n = 3
    for (let i = 0; i < 3; i++) await expect(ensureCompositions(q.deps, U1, sid2)).rejects.toMatchObject({ code: 'composition_failed' })
    c = (await getSessionView(q.deps, U1, sid2)).compositions[0]; expect(c).toMatchObject({ state: 'failed', attempts: 3, retryable: false })
    const calls = q.generate.mock.calls.length
    await expect(ensureCompositions(q.deps, U1, sid2)).rejects.toMatchObject({ code: 'composition_failed' }); expect(q.generate.mock.calls.length).toBe(calls)       // no further paid attempt
    expect((await restoreSession(q.deps, U1)).resume!.compositions).toMatchObject({ state: 'failed', resumeNeeded: false })
  })

  it('preparing never touches the favorite, the correction entitlement or approval', async () => {
    const r = rig(); const sid = await ready(r, PORTRAIT)
    const before = JSON.stringify((await getSessionView(r.deps, U1, sid)).artworkPreviewId); await ensureCompositions(r.deps, U1, sid)
    const v = await getSessionView(r.deps, U1, sid); expect(JSON.stringify(v.artworkPreviewId)).toBe(before); expect(v.compositions[0]).toMatchObject({ attempt: 1, correctionsRemaining: 1, status: 'ready' })
  })
})

describe('before migration 055 is applied the server degrades to the old behavior, never an error', () => {
  it('claim answers claimed (no durable guard), finish/fail do nothing, listing is empty', async () => {
    const missing = { message: 'Could not find the function public.gift_claim_composition in the schema cache' }
    const db = { rpc: vi.fn(async () => ({ data: null, error: missing })), from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'relation "public.gift_composition_jobs" does not exist' } }) }) }) }
    const s = supabaseGiftStore(db)
    const c = await s.claimComposition({ sessionId: 's', previewId: 'p', geometryKey: 'a667', lineIds: ['x'], method: 'generated', ttlMs: 1000, maxAttempts: 3, nowMs: 0 })
    expect(c).toEqual({ token: 'volatile', reason: 'claimed' })
    await s.finishComposition({ sessionId: 's', previewId: 'p', geometryKey: 'a667', token: c.token! }); await s.failComposition({ sessionId: 's', previewId: 'p', geometryKey: 'a667', token: c.token!, code: 'x' })
    expect(await s.listCompositionJobs('s')).toEqual([]); expect(db.rpc).toHaveBeenCalledTimes(1)                    // after the first miss it stops asking
  })
})
