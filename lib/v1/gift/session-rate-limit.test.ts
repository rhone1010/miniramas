// Photo analysis (session creation) is paid work: every attempt is counted BEFORE the analysis runs, in a ledger that session deletion cannot reset.
// The analyzer, generator and watermark are fakes.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { createSession, deleteSessionNow, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { SESSION_ATTEMPTS } from './policy'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '20000000-0000-4000-8000-000000000002'
function rig(analyze?: GiftDeps['analyze']) {
  const clock = { now: Date.parse('2026-10-18T10:00:00Z') }
  const store = memoryGiftStore(() => clock.now), files = new Map<string, Buffer>()
  const analyzeFn = vi.fn(analyze ?? (async () => ({ status: 'supported' as const, series: 'portraits' as const, peopleCount: null })))
  const deps: GiftDeps = {
    store, clock: () => clock.now, analyze: analyzeFn, generate: async () => ({ imageB64: '' }), watermark: async () => Buffer.alloc(1),
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async () => null },
  }
  return { deps, store, clock, analyze: analyzeFn }
}
let n = 0
const photo = async (k = ++n) => (await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: (k * 37) % 256, g: (k * 91) % 256, b: (k * 53) % 256 } } }).jpeg().toBuffer()).toString('base64')
const make = (r: ReturnType<typeof rig>, user = U1, img?: Promise<string> | string) => Promise.resolve(img ?? photo()).then(b64 => createSession(r.deps, { userId: user, imageB64: b64 }))

describe('session creation rate limit', () => {
  it(`allows ${SESSION_ATTEMPTS.perAccountHour} attempts an hour per account, then answers 429 rate_limited BEFORE any analysis runs`, async () => {
    const r = rig()
    for (let i = 0; i < SESSION_ATTEMPTS.perAccountHour; i++) await make(r)
    const calls = r.analyze.mock.calls.length
    await expect(make(r)).rejects.toMatchObject({ code: 'rate_limited', status: 429 })
    expect(r.analyze.mock.calls.length).toBe(calls)                                   // the paid analysis did not run
    r.clock.now += 61 * 60_000; await make(r)                                          // the hour passed
  })
  it(`is capped at ${SESSION_ATTEMPTS.perAccountDay} per 24 hours across the hours`, async () => {
    const r = rig()
    for (let i = 0; i < SESSION_ATTEMPTS.perAccountDay; i++) { await make(r); if ((i + 1) % SESSION_ATTEMPTS.perAccountHour === 0) r.clock.now += 61 * 60_000 }
    await expect(make(r)).rejects.toMatchObject({ code: 'rate_limited' })
    r.clock.now += 25 * 3600_000; await make(r)
  })
  it(`stops the same photograph after ${SESSION_ATTEMPTS.perPhotoDay} attempts a day, and deleting the sessions does not reset any of it`, async () => {
    const r = rig(); const img = await photo(5000); const ids: string[] = []
    for (let i = 0; i < SESSION_ATTEMPTS.perPhotoDay; i++) { const v = await make(r, U1, img); ids.push(v.sessionId); await deleteSessionNow(r.deps, U1, v.sessionId) }
    expect(r.store.sessions.size).toBe(0)                                              // every session was deleted
    await expect(make(r, U1, img)).rejects.toMatchObject({ code: 'rate_limited' })
    await make(r)                                                                      // another photograph is fine
  })
  it('counts failed analyses too: unsupported subjects and outages cannot be retried without limit', async () => {
    const r = rig(async () => ({ status: 'unsupported' as const })); const img = await photo(6000)
    for (let i = 0; i < SESSION_ATTEMPTS.perPhotoDay; i++) await expect(make(r, U1, img)).rejects.toMatchObject({ code: 'unsupported_subject' })
    await expect(make(r, U1, img)).rejects.toMatchObject({ code: 'rate_limited' })
    const down = rig(async () => { throw new Error('openai down') })
    for (let i = 0; i < SESSION_ATTEMPTS.perAccountHour; i++) await expect(make(down)).rejects.toMatchObject({ code: 'analysis_unavailable' })
    await expect(make(down)).rejects.toMatchObject({ code: 'rate_limited' })
  })
  it('is per account: another account is unaffected, and an invalid image is refused before it counts', async () => {
    const r = rig(); for (let i = 0; i < SESSION_ATTEMPTS.perAccountHour; i++) await make(r)
    await expect(make(r)).rejects.toMatchObject({ code: 'rate_limited' }); await make(r, U2)
    const fresh = rig(); await expect(createSession(fresh.deps, { userId: U1, imageB64: 'not-base64!' })).rejects.toMatchObject({ code: 'image_not_base64' })
    for (let i = 0; i < SESSION_ATTEMPTS.perAccountHour; i++) await make(fresh)                  // the refused upload used none of the allowance
  })
  it('concurrent requests cannot slip past the limit', async () => {
    const r = rig(); const imgs = await Promise.all(Array.from({ length: SESSION_ATTEMPTS.perAccountHour + 5 }, () => photo()))
    const out = await Promise.allSettled(imgs.map(i => make(r, U1, i)))
    expect(out.filter(o => o.status === 'fulfilled').length).toBe(SESSION_ATTEMPTS.perAccountHour)
  })
})
