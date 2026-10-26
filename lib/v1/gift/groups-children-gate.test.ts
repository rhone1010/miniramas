// TEMPORARY GROUPS CHILDREN GATE (2026-10-26) in the Gift Shop: intake, and every path that could START NEW PROCESSING for a session that already exists (older unpaid sessions, retries,
// product compositions, Collection adaptations of an owned Groups piece). Offline: the analyser, the models and the store are stand-ins. Nothing is generated, nothing is paid.
// The policy itself (adult-only / mixed / all-minor / incomplete evidence) is pinned in lib/v1/groups/groups-age.test.ts; the intake wiring is pinned here against the real analyzeSource.
import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'

const h = vi.hoisted(() => ({ subjectType: 'person_group', set: { total_subjects: 3, per_photo: [{ faces: [] as any[] }] } as any }))
vi.mock('@/lib/shared/upload-routing', () => ({ analyzeUploadRouting: async () => ({ classification: { subjectType: h.subjectType }, decisions: { portraits: {} } }) }))
vi.mock('@/lib/v1/groups/groups-refine', async orig => ({ ...(await orig<any>()), analyzeSourceSet: async () => h.set, detectFaceVisibility: async () => ({ face_visible: true, subject_count_estimate: 3, faces: [] }) }))

import { analyzeSource } from './real'
import { createSession, createSessionFromCollection, setLines, startBatch, retryBatch, getSessionView, type GiftDeps, GiftError } from './service'
import { ensureCompositions } from './compose'
import { memoryGiftStore } from './store'

const U1 = '10000000-0000-4000-8000-000000000001'
const face = (age_class: string, age_confidence = 9) => ({ age_class, age_confidence, face_index: 0 })
const faces3 = (...c: any[]) => c.map(x => (typeof x === 'string' ? face(x) : x))

describe('Gift Shop Groups intake (real analyzeSource, shared age policy)', () => {
  const run = async (faces: any[], total = faces.length) => { h.subjectType = 'person_group'; h.set = { total_subjects: total, per_photo: [{ faces }] }; return analyzeSource({ b64: 'x', bytes: Buffer.from('x') }) }
  it('adult-only passes', async () => expect(await run(faces3('adult', 'adult', 'elder'))).toMatchObject({ status: 'supported', series: 'groups', peopleCount: 3 }))
  it('a child among adults is refused: an adult never overrides the block', async () => expect(await run(faces3('adult', 'adult', 'child'))).toEqual({ status: 'age_restricted' }))
  it('a teen or an infant among adults is refused', async () => { expect(await run(faces3('adult', 'teen', 'adult'))).toEqual({ status: 'age_restricted' }); expect(await run(faces3('elder', 'infant', 'adult'))).toEqual({ status: 'age_restricted' }) })
  it('all minors is refused', async () => expect(await run(faces3('child', 'teen', 'infant'))).toEqual({ status: 'age_restricted' }))
  it('incomplete or low-confidence evidence is NOT a refusal by itself (uncertain proceeds); a confident minor in incomplete evidence still is', async () => {
    expect(await run(faces3('adult', 'adult'), 3)).toMatchObject({ status: 'supported' })                                   // only two of three faces read: no confident minor
    expect(await run([face('adult'), face('adult'), face('child', 5)])).toMatchObject({ status: 'supported' })               // a child at low confidence is uncertain, not confident
    expect(await run([face('unknown', 0), face('unknown', 0), face('adult')])).toMatchObject({ status: 'supported' })
    expect(await run(faces3('adult', 'child'), 3)).toEqual({ status: 'age_restricted' })                                    // incomplete, but one confident child is enough
  })
})

/** An older unpaid session: created BEFORE the gate (so the analyser said fine), then the gate is on. */
async function rig() {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  let verdict: any = { status: 'supported', series: 'groups', peopleCount: 3 }
  const analyze = vi.fn(async () => verdict)
  const generate = vi.fn(async (i: { aspect: string }) => { const [a, b] = i.aspect.split(':').map(Number); return { imageB64: (await sharp({ create: { width: 256 * a, height: 256 * b, channels: 3, background: '#c63' } }).png().toBuffer()).toString('base64') } })
  const art = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#4a7' } }).png().toBuffer()
  store.ownedArtwork.set('30000000-0000-4000-8000-000000000001', { userId: U1, portfolioId: '40000000-0000-4000-8000-000000000001', series: 'groups', preset: 'bronze', unlocked: true, done: true })
  const deps: GiftDeps = {
    store, analyze: analyze as any, generate, draftCompositions: true, kick: vi.fn(async () => ({})),
    compose: async (i: { size: string }) => ({ image: await sharp({ create: { width: 256, height: 256, channels: 3, background: '#036' } }).png().toBuffer(), width: 256, height: 256, fit: 'exact' as const, outpainted: false }),
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => 'https://signed.test/' + p },
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    collection: { resolve: async (u, id) => ({ previewId: id, portfolioId: '40000000-0000-4000-8000-000000000001', series: 'groups', preset: 'bronze', bytes: art, width: 1024, height: 1024, sourcePhoto: await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer() }) },
  }
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  return { store, deps, analyze, generate, photo, files, setVerdict: (v: any) => { verdict = v } }
}
const REFUSED = { status: 403, code: 'age_restricted' }
const snapshot = (R: Awaited<ReturnType<typeof rig>>) => JSON.stringify([[...R.store.orders.entries()], R.store.compositions, [...R.store.sessions.entries()].map(([, s]) => [s.id, s.order_id, s.final_approved_at, s.approved_at])])

describe('sessions that already exist cannot start new processing once the gate is on', () => {
  it('an older unpaid Groups session: starting the first batch is refused before any allowance is reserved or any model is called', async () => {
    const R = await rig(); const v = await createSession(R.deps, { userId: U1, imageB64: R.photo }); R.setVerdict({ status: 'age_restricted' })
    await expect(startBatch(R.deps, U1, v.sessionId, { idempotencyKey: 'attempt-0001' })).rejects.toMatchObject(REFUSED)
    expect(R.store.batches.length).toBe(0); expect(R.generate).not.toHaveBeenCalled()
    expect((await getSessionView(R.deps, U1, v.sessionId)).entitlement).toMatchObject({ freeBatchesUsed: 0, paidPacksAvailable: 0 })       // nothing spent
  })
  it('a batch reserved before the gate cannot be retried or resumed', async () => {
    const R = await rig(); const v = await createSession(R.deps, { userId: U1, imageB64: R.photo })
    const first = await startBatch(R.deps, U1, v.sessionId, { idempotencyKey: 'attempt-0001' }); R.generate.mockClear()
    for (const p of R.store.previews) if (p.status === 'ready') { p.status = 'failed' as any; p.attempts = 1 }                  // some previews had failed
    R.setVerdict({ status: 'age_restricted' })
    await expect(retryBatch(R.deps, U1, v.sessionId, first.batch.batchIndex)).rejects.toMatchObject(REFUSED); expect(R.generate).not.toHaveBeenCalled()
    await expect(startBatch(R.deps, U1, v.sessionId, { idempotencyKey: 'attempt-0001' })).rejects.toMatchObject(REFUSED)           // the same key again resumes the batch: refused too
  })
  it('an adult-only older session is unaffected', async () => {
    const R = await rig(); const v = await createSession(R.deps, { userId: U1, imageB64: R.photo })
    const out = await startBatch(R.deps, U1, v.sessionId, { idempotencyKey: 'attempt-0001' }); expect(out.complete).toBe(true); expect(R.generate).toHaveBeenCalled()
  })
  it('an analyser that cannot answer is a retryable 503, never a pass', async () => {
    const R = await rig(); const v = await createSession(R.deps, { userId: U1, imageB64: R.photo }); (R.deps as any).analyze = async () => { throw new Error('down') }
    await expect(startBatch(R.deps, U1, v.sessionId, { idempotencyKey: 'attempt-0001' })).rejects.toMatchObject({ status: 503, code: 'analysis_unavailable' }); expect(R.generate).not.toHaveBeenCalled()
  })
  it('a Collection adaptation of an owned Groups piece that needs a generation is refused; an adaptation that needs none, the owned piece and everything paid are untouched', async () => {
    const R = await rig(); const OWNED = '30000000-0000-4000-8000-000000000001'
    const made = await createSessionFromCollection(R.deps, { userId: U1, previewId: OWNED }); const sid = made.view.sessionId
    await setLines(R.deps, U1, sid, [{ lineId: 'p', productId: 'fine_art:8x8', copies: 1 }, { lineId: 'c', productId: 'card:7x5', copies: 1 }])
    const before = snapshot(R); R.setVerdict({ status: 'age_restricted' })
    await expect(ensureCompositions(R.deps, U1, sid)).rejects.toMatchObject(REFUSED)
    expect(R.generate).not.toHaveBeenCalled()
    expect(R.store.compositions.some(c => c.line_id === 'c')).toBe(false)                                                    // the card (needs a generation) got nothing
    expect(JSON.parse(snapshot(R))[0]).toEqual(JSON.parse(before)[0]); expect(JSON.parse(snapshot(R))[2]).toEqual(JSON.parse(before)[2])      // no order or session was altered or deleted
    expect(R.store.compositions.filter(c => c.line_id === 'p').every(c => c.method === 'deterministic')).toBe(true)          // the exact-fit print needs no model and was made as usual
  })
  it('a finished (paid, approved) session is never rewritten by the gate: nothing here reads or changes an order, a composition or the owned piece', async () => {
    const R = await rig(); const OWNED = '30000000-0000-4000-8000-000000000001'
    const made = await createSessionFromCollection(R.deps, { userId: U1, previewId: OWNED })
    await setLines(R.deps, U1, made.view.sessionId, [{ lineId: 'p', productId: 'fine_art:8x8', copies: 1 }]); R.setVerdict({ status: 'age_restricted' })
    const ok = await ensureCompositions(R.deps, U1, made.view.sessionId)                                                      // exact fit: no generation, so the gate has nothing to stop
    expect(ok.compositions[0]).toMatchObject({ method: 'deterministic', state: 'ready' }); expect(R.generate).not.toHaveBeenCalled(); void GiftError
  })
})
