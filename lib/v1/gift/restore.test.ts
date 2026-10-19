// Restoring a Gift session after navigation, refresh or Back/Forward: what the SERVER keeps (photo, batch, previews, generation state), that returning never starts or
// repeats generation, never reserves another batch, and never touches finished artwork. Everything runs on the in-memory store with a counting fake generator:
// no model, no payment, no database.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { createSession, startBatch, retryBatch, getSessionView, restoreSession, deleteSessionNow, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { liveEffectIds } from './effects'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '20000000-0000-4000-8000-000000000002'
const DAY = 86_400_000

function rig(opts: { hang?: boolean } = {}) {
  const clock = { t: Date.parse('2026-10-19T12:00:00Z') }
  const store = memoryGiftStore(() => clock.t), files = new Map<string, Buffer>()
  const state = { failEffects: new Set<string>(), die: false }
  const generate = vi.fn(async (i: { effectId: string }) => {
    if (state.die) throw new Error('request_killed')
    if (state.failEffects.has(i.effectId)) throw new Error('generation_failed')
    return { imageB64: (await sharp({ create: { width: 64, height: 96, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64') }
  })
  const watermark = vi.fn(async (b64: string) => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer())
  const deps: GiftDeps = {
    store, generate, watermark, compose: vi.fn() as any, clock: () => clock.t,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async (p, s) => (files.has(p) ? `https://signed.test/${p}?ttl=${s}` : null) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), kick: vi.fn(async () => ({})),
  } as GiftDeps
  return { deps, store, files, generate, clock, state }
}
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
const sixEffects = () => liveEffectIds('portraits').slice(0, 6)
async function started(r: ReturnType<typeof rig>, user = U1) {
  const v = await createSession(r.deps, { userId: user, imageB64: await photo() })
  const b = await startBatch(r.deps, user, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: sixEffects() })
  return { sid: v.sessionId, batch: b }
}

describe('finding the customer\'s session again', () => {
  it('a customer with no session starts at the photo: current is null', async () => {
    const r = rig()
    expect(await restoreSession(r.deps, U1)).toEqual({ contractVersion: 1, current: null, resume: null, recent: [] })
  })

  it('returns the same session with the photo, the batch and all six finished previews, and generates nothing', async () => {
    const r = rig(); const { sid, batch } = await started(r)
    expect(batch.complete).toBe(true); expect(r.generate).toHaveBeenCalledTimes(6)
    const calls = r.generate.mock.calls.length, stored = new Map(r.files)
    const out = await restoreSession(r.deps, U1)
    expect(out.current!.sessionId).toBe(sid)
    expect(out.current!.source.photoUrl).toMatch(/^https:\/\/signed\.test\//)
    expect(out.current!.batches).toHaveLength(1); expect(out.current!.batches[0]).toMatchObject({ batchIndex: 1, complete: true, generation: 'complete' })
    expect(out.current!.batches[0].previews.map(p => p.status)).toEqual(Array(6).fill('ready')); expect(out.current!.batches[0].previews.every(p => !!p.url)).toBe(true)
    expect(out.resume).toEqual({ sessionId: sid, suggestedStep: 'previews', resumeBatches: [], runningBatches: [] })
    expect(r.generate.mock.calls.length).toBe(calls)                                              // returning generated nothing
    expect([...r.files.keys()].sort()).toEqual([...stored.keys()].sort())                         // and changed no file
    const again = await restoreSession(r.deps, U1); expect(again.current!.batches[0].previews.map(p => p.previewId)).toEqual(out.current!.batches[0].previews.map(p => p.previewId))
    expect(r.generate.mock.calls.length).toBe(calls)
  })

  it('the restored view is the same one GET /sessions/{id} returns, so the Wizard needs no second reader', async () => {
    const r = rig(); const { sid } = await started(r)
    const a = (await restoreSession(r.deps, U1)).current!, b = await getSessionView(r.deps, U1, sid)
    expect({ ...a, batches: a.batches.map(x => x.batchIndex) }).toEqual({ ...b, batches: b.batches.map(x => x.batchIndex) })
  })

  it('a session with a photo only suggests the effects step; chosen favorite, products and orders map to their steps', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    expect((await restoreSession(r.deps, U1)).resume).toMatchObject({ sessionId: v.sessionId, suggestedStep: 'effects' })
  })

  it('never returns another customer\'s session, a deleted one or an expired one; the newest active one wins', async () => {
    const r = rig()
    const other = await createSession(r.deps, { userId: U2, imageB64: await photo() })
    expect((await restoreSession(r.deps, U1)).current).toBeNull()                                  // U2's session is invisible to U1
    const old = await createSession(r.deps, { userId: U1, imageB64: await photo() }); r.clock.t += 60_000
    const fresh = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const out = await restoreSession(r.deps, U1)
    expect(out.current!.sessionId).toBe(fresh.sessionId); expect(out.recent.map(x => x.sessionId)).toEqual([fresh.sessionId, old.sessionId]); expect(out.recent.some(x => x.sessionId === other.sessionId)).toBe(false)
    await deleteSessionNow(r.deps, U1, fresh.sessionId)
    expect((await restoreSession(r.deps, U1)).current!.sessionId).toBe(old.sessionId)
    r.clock.t += 8 * DAY                                                                          // past the 7-day idle expiry
    expect((await restoreSession(r.deps, U1)).current).toBeNull()
  })

  it('returning extends the idle expiry (at most one write an hour) so work in progress is not cleaned up', async () => {
    const r = rig(); const { sid } = await started(r); const before = r.store.sessions.get(sid)!.expires_at
    await restoreSession(r.deps, U1); expect(r.store.sessions.get(sid)!.expires_at).toBe(before)          // within the hour: no write
    r.clock.t += 3 * DAY; const out = await restoreSession(r.deps, U1)
    expect(Date.parse(r.store.sessions.get(sid)!.expires_at)).toBeGreaterThan(Date.parse(before)); expect(out.current!.sessionId).toBe(sid)
  })
})

describe('generation that was interrupted', () => {
  it('a batch whose request died is reported as stalled; restoring starts nothing; the existing retry route finishes only what is unfinished', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    r.state.die = true                                                                            // the request is killed: previews were reserved but none finished
    await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: sixEffects() })
    r.state.die = false; r.generate.mockClear()
    // two of the six fail permanently-ish (attempts left), the rest were never completed
    const out = await restoreSession(r.deps, U1)
    expect(out.current!.batches[0].generation).toBe('stalled'); expect(out.resume).toMatchObject({ suggestedStep: 'previews', resumeBatches: [1], runningBatches: [] })
    expect(r.generate).not.toHaveBeenCalled()                                                     // reconnecting did not generate
    const done = await retryBatch(r.deps, U1, v.sessionId, 1)
    expect(done.complete).toBe(true); expect(r.generate).toHaveBeenCalledTimes(6)                  // one generation per preview, once
    const calls = r.generate.mock.calls.length
    await retryBatch(r.deps, U1, v.sessionId, 1); await retryBatch(r.deps, U1, v.sessionId, 1)    // returning again, even repeatedly: nothing regenerates
    expect(r.generate.mock.calls.length).toBe(calls)
    expect((await restoreSession(r.deps, U1)).current!.batches[0].generation).toBe('complete')
  })

  it('finished previews are never regenerated or lost when the rest of the batch is resumed', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const effects = sixEffects(); r.state.failEffects = new Set(effects.slice(4))                 // the last two fail this time
    const first = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: effects })
    expect(first.complete).toBe(false)
    const readyBefore = first.batch.previews.filter(p => p.status === 'ready').map(p => [p.previewId, p.url])
    expect(readyBefore).toHaveLength(4); r.generate.mockClear(); r.state.failEffects.clear()
    const out = await restoreSession(r.deps, U1); expect(out.current!.batches[0].generation).toBe('stalled')
    const done = await retryBatch(r.deps, U1, v.sessionId, 1)
    expect(r.generate).toHaveBeenCalledTimes(2); expect(done.complete).toBe(true)                 // only the two unfinished ones
    for (const [id] of readyBefore) expect(done.batch.previews.find(p => p.previewId === id)!.status).toBe('ready')
  })

  it('a preview being generated right now (a live lease) is reported as running and is not claimed again', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    r.state.die = true; await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: sixEffects() }); r.state.die = false; r.generate.mockClear()
    for (const p of r.store.previews) Object.assign(p, { status: 'generating', attempts: 1, lease_until: new Date(r.clock.t + 120_000).toISOString() })      // another request is working on all six
    const out = await restoreSession(r.deps, U1)
    expect(out.current!.batches[0].generation).toBe('running'); expect(out.resume).toMatchObject({ resumeBatches: [], runningBatches: [1] })
    await retryBatch(r.deps, U1, v.sessionId, 1)
    expect(r.generate).not.toHaveBeenCalled()                                                     // the live lease is respected: no duplicate generation
  })

  it('a lapsed lease (the worker died) becomes stalled and is resumed exactly once', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    r.state.die = true; await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: sixEffects() }); r.state.die = false; r.generate.mockClear()
    for (const p of r.store.previews) Object.assign(p, { status: 'generating', attempts: 1, lease_until: new Date(r.clock.t + 60_000).toISOString() })
    expect((await restoreSession(r.deps, U1)).current!.batches[0].generation).toBe('running')
    r.clock.t += 10 * 60_000                                                                      // the 5-minute lease lapses
    expect((await restoreSession(r.deps, U1)).current!.batches[0].generation).toBe('stalled')
    await retryBatch(r.deps, U1, v.sessionId, 1); expect(r.generate).toHaveBeenCalledTimes(6)
    await retryBatch(r.deps, U1, v.sessionId, 1); expect(r.generate).toHaveBeenCalledTimes(6)
  })

  it('a batch whose unfinished previews have used all their attempts is failed, not endlessly resumable', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    r.state.die = true; await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: sixEffects() }); r.state.die = false
    for (const p of r.store.previews) Object.assign(p, { status: 'failed', attempts: 3, lease_until: null })
    const out = await restoreSession(r.deps, U1)
    expect(out.current!.batches[0].generation).toBe('failed'); expect(out.resume!.resumeBatches).toEqual([])
  })
})

describe('no duplicate generation or charge when the Wizard comes back', () => {
  it('repeating the batch request with the same key returns the same batch and generates nothing', async () => {
    const r = rig(); const { sid, batch } = await started(r); r.generate.mockClear()
    const again = await startBatch(r.deps, U1, sid, { idempotencyKey: 'idem-key-1', effectIds: sixEffects() })
    expect(again.batch.previews.map(p => p.previewId)).toEqual(batch.batch.previews.map(p => p.previewId)); expect(r.generate).not.toHaveBeenCalled(); expect(r.store.batches).toHaveLength(1)
  })

  it('a different key while the first batch is unfinished reserves nothing and generates nothing (a restarted page cannot spend a second free batch)', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    r.state.die = true; await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: sixEffects() }); r.state.die = false; r.generate.mockClear()
    await expect(startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-2' })).rejects.toMatchObject({ code: 'previous_batch_incomplete' })
    expect(r.store.batches).toHaveLength(1); expect(r.generate).not.toHaveBeenCalled()
  })

  it('two tabs resuming at once never generate the same preview twice', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    r.state.die = true; await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1', effectIds: sixEffects() }); r.state.die = false; r.generate.mockClear()
    await Promise.all([retryBatch(r.deps, U1, v.sessionId, 1), retryBatch(r.deps, U1, v.sessionId, 1)])
    expect(r.generate).toHaveBeenCalledTimes(6)
    expect(new Set(r.generate.mock.calls.map(c => (c[0] as { effectId: string }).effectId)).size).toBe(6)
  })

  it('the free-batch count does not change by returning', async () => {
    const r = rig(); await started(r)
    const a = (await restoreSession(r.deps, U1)).current!.entitlement, b = (await restoreSession(r.deps, U1)).current!.entitlement
    expect(b).toEqual(a); expect(a.freeBatchesUsed).toBe(1)
  })
})
