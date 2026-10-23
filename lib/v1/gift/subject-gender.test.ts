// SessionView.source.subjectGender: where it comes from (the existing photo-analysis pass, no extra AI call), what it can be, and that it survives
// create, refresh (GET) and restoration. Also: old sessions without the field, and the unknown cases (no gender, mixed subjects, check unavailable).

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { createSession, getSessionView, restoreSession, genderFor, type GiftDeps } from './service'
import { memoryGiftStore } from './store'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
function rig(analysis: any) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const deps = {
    store, generate: vi.fn() as any, compose: vi.fn() as any, watermark: async (b64: string) => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    storage: { put: async (p: string, b: Buffer) => { files.set(p, b) }, get: async (p: string) => files.get(p) ?? null, remove: async () => {}, signedUrl: async (p: string) => 'https://signed.test/' + p },
    analyze: vi.fn(async () => analysis), kick: vi.fn(async () => ({})),
  } as unknown as GiftDeps
  return { deps, store }
}

describe('subjectGender in the session response', () => {
  for (const [label, analysis, want] of [
    ['a woman', { status: 'supported', series: 'portraits', peopleCount: null, subjectGender: 'female' }, 'female'],
    ['a man', { status: 'supported', series: 'portraits', peopleCount: null, subjectGender: 'male' }, 'male'],
    ['no gender reported', { status: 'supported', series: 'portraits', peopleCount: null, subjectGender: 'unknown' }, 'unknown'],
    ['an analyzer that does not know the field', { status: 'supported', series: 'portraits', peopleCount: null }, 'unknown'],
    ['a pet', { status: 'supported', series: 'pets', peopleCount: null, subjectGender: 'female' }, null],
    ['a group', { status: 'supported', series: 'groups', peopleCount: 4 }, null],
  ] as const) {
    it(`${label}: ${want}, the same on create, refresh and restoration`, async () => {
      const r = rig(analysis)
      const created = await createSession(r.deps, { userId: U1, imageB64: await photo() })
      expect(created.source.subjectGender).toBe(want)
      expect((await getSessionView(r.deps, U1, created.sessionId)).source.subjectGender).toBe(want)
      expect((await restoreSession(r.deps, U1)).current?.source.subjectGender).toBe(want)
      expect(r.deps.analyze).toHaveBeenCalledTimes(1)                                    // never a second analysis for the preview choice
      for (const again of [await getSessionView(r.deps, U1, created.sessionId), (await restoreSession(r.deps, U1)).current!]) expect(again.source.series).toBe(created.source.series)   // other fields untouched
    })
  }

  it('a session stored before the field existed reads as unknown (portraits) or null (others), never a guess', async () => {
    const r = rig({ status: 'supported', series: 'portraits', peopleCount: null, subjectGender: 'female' })
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const rec = (await r.store.getSession(v.sessionId, U1))!
    await r.store.patchSession(v.sessionId, U1, { analysis: { peopleCount: null } } as any)                          // as an old row: no subjectGender key
    expect((await getSessionView(r.deps, U1, v.sessionId)).source.subjectGender).toBe('unknown')
    expect(rec.series).toBe('portraits')
  })

  it('another account cannot read it (owner checks are unchanged)', async () => {
    const r = rig({ status: 'supported', series: 'portraits', peopleCount: null, subjectGender: 'male' })
    const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    await expect(getSessionView(r.deps, U2, v.sessionId)).rejects.toThrow()
  })

  it('genderFor: only female/male pass; anything else is unknown for portraits and null elsewhere', () => {
    expect(genderFor('portraits', 'female')).toBe('female'); expect(genderFor('portraits', 'male')).toBe('male')
    for (const bad of [undefined, null, 'f', 'm', 'Female', '', 3, {}]) expect(genderFor('portraits', bad)).toBe('unknown')
    expect(genderFor('pets', 'male')).toBeNull(); expect(genderFor('groups', 'female')).toBeNull(); expect(genderFor(null, 'male')).toBeNull()
  })
})

describe('analyzeSource derives it from the existing age-check pass (no extra call)', () => {
  async function run(det: any, opts: { throws?: boolean } = {}) {
    vi.resetModules()
    const detect = vi.fn(async () => { if (opts.throws) throw new Error('openai down'); return det })
    vi.doMock('@/lib/shared/upload-routing', () => ({ analyzeUploadRouting: async () => ({ classification: { subjectType: 'person_single' } }) }))
    vi.doMock('@/lib/v1/portraits/portraits-refine', () => ({ detectFaceVisibility: detect }))
    const { analyzeSource } = await import('./real')
    const out = await analyzeSource({ b64: 'x', bytes: Buffer.from('x') })
    vi.doUnmock('@/lib/shared/upload-routing'); vi.doUnmock('@/lib/v1/portraits/portraits-refine')
    return { out, detect }
  }
  const base = { face_visible: true, subject_count_estimate: 1, age_group: 'adult', reason: '' }
  it('f -> female, m -> male, with exactly one detection call', async () => {
    const f = await run({ ...base, gender: 'f' }); expect(f.out).toMatchObject({ status: 'supported', series: 'portraits', subjectGender: 'female' }); expect(f.detect).toHaveBeenCalledTimes(1)
    expect((await run({ ...base, gender: 'm' })).out).toMatchObject({ subjectGender: 'male' })
  })
  it('no gender, mixed subjects (count > 1) and an unavailable check are all unknown; the age policy is unchanged', async () => {
    expect((await run({ ...base, gender: null })).out).toMatchObject({ subjectGender: 'unknown' })
    expect((await run({ ...base, gender: 'f', subject_count_estimate: 2 })).out).toMatchObject({ subjectGender: 'unknown' })
    expect((await run(null, { throws: true })).out).toMatchObject({ status: 'supported', subjectGender: 'unknown' })      // fails open as before
    expect((await run({ ...base, gender: 'f', age_group: 'teen' })).out).toEqual({ status: 'age_restricted' })
  })
})
