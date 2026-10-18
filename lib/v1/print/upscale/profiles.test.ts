import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'

const mocks = vi.hoisted(() => ({ outpaint: vi.fn() }))
vi.mock('../../shared/outpaint', () => ({ outpaint: mocks.outpaint }))

import { profileFor, registerProfile, flatPrintProfile, NoProfileError, type ArtworkProfile } from './profiles'
import { runJob } from './process'
import { memoryJobStore, memoryStorage } from './store'
import { DEFAULT_SETTINGS } from './settings'
import { prunaProvider } from './providers'

const job = (over: Record<string, unknown> = {}) => ({ id: 'j', sku: 'GLOBAL-FAP-8X8', size: '8x8', finish: 'fine_art', ...over }) as any

describe('artwork profiles', () => {
  it('the existing flat-print products resolve to the flat-print profile', () => {
    for (const finish of ['fine_art', 'premium', 'canvas', 'framed']) expect(profileFor(job({ finish })).id).toBe('flat_print')
  })
  it('the mug and the 7 x 5 Mohawk card have their own profiles; every other card or mug variant still fails closed, never guessed', () => {
    expect(profileFor(job({ sku: 'GLOBAL-MUG-W', finish: 'mug', size: '11oz' })).id).toBe('mug_wrap'); expect(profileFor(job({ sku: 'GLOBAL-GRE-MOH-7X5-BLA', finish: 'card', size: '7x5' })).id).toBe('card_spread')
    expect(() => profileFor(job({ sku: 'GLOBAL-GRE-GLOS-6X4-BLA', finish: 'card', size: '6x4' }))).toThrow('no_artwork_profile:GLOBAL-GRE-GLOS-6X4-BLA')
    expect(() => profileFor(job({ sku: 'GLOBAL-MUG-15', finish: 'mug', size: '15oz' }))).toThrow(NoProfileError)
  })
  it('a job for an unsupported product fails before any provider call or storage write', async () => {
    const store = memoryJobStore(), storage = memoryStorage(), start = vi.fn()
    const j = await store.enqueue({ order_id: 'o', item_index: 0, render_id: 'r', sku: 'GLOBAL-GRE-GLOS-6X4-BLA', size: '6x4', finish: 'card', source_kind: 'url' })
    const { job: done } = await runJob({
      store, storage, loadSource: async () => Buffer.from('x'), loadSettings: async () => ({ settings: DEFAULT_SETTINGS, version: 1, sources: ['global'] }),
      provider: () => ({ name: 'replicate', start, poll: vi.fn(), download: vi.fn() }) as any, inspect: vi.fn() as any,
    }, j.id)
    expect(done).toMatchObject({ status: 'failed', error: 'no_artwork_profile:GLOBAL-GRE-GLOS-6X4-BLA' }); expect(start).not.toHaveBeenCalled(); expect(storage.files.size).toBe(0)
  })
  it('a new product family is added by registering one profile, and the processor needs no change', async () => {
    const calls: string[] = []
    const mug: ArtworkProfile = {
      id: 'test_mug',
      async prepare() { calls.push('prepare'); const img = await sharp(randomBytes(300 * 125 * 3), { raw: { width: 300, height: 125, channels: 3 } }).png().toBuffer()
        return { working: img, width: 300, height: 125, scale: 0, requiredFront: { w: 300, h: 125 }, targetPlan: { front: { w: 300, h: 125 }, final: { w: 300, h: 125 } }, outpainted: false } },
      async finish({ image }) { calls.push('finish'); return { jpeg: await sharp(image).jpeg({ chromaSubsampling: '4:4:4', quality: 95 }).toBuffer(), expected: { w: 300, h: 125 } } },
      async qaRegion({ final }) { calls.push('qa'); return final },
    }
    registerProfile(j => j.finish === 'test_mug', mug)
    const store = memoryJobStore(), storage = memoryStorage()
    const j = await store.enqueue({ order_id: 'o', item_index: 0, render_id: 'r', sku: 'TEST-MUG', size: '11oz', finish: 'test_mug', source_kind: 'url' })
    const inspect = vi.fn(async () => ({ verdict: 'pass', confidence: 0.9, checks: {}, defects: [], summary: 'ok', meta: { model: 'm', latency_ms: 1, images: 4 } }))
    const { job: done } = await runJob({
      store, storage, loadSource: async () => Buffer.from('x'), loadSettings: async () => ({ settings: { ...DEFAULT_SETTINGS, min_source_ppi: 0 }, version: 1, sources: ['global'] }),
      provider: () => ({ name: 'replicate', start: vi.fn(), poll: vi.fn(), download: vi.fn() }) as any, inspect: inspect as any,
    }, j.id)
    // Prepared, finished, checked, inspected and approved by the shared processor, using only the registered profile.
    expect(calls).toEqual(['prepare', 'finish', 'qa']); expect(done).toMatchObject({ status: 'approved', final_w: 300, final_h: 125 }); expect(inspect).toHaveBeenCalledTimes(1)
    expect(flatPrintProfile.id).toBe('flat_print')
  })
})

describe('pruna direct file upload (used by tools)', () => {
  it('posts the picture as multipart `content` with the key and returns the file URL', async () => {
    const f = vi.fn(async (_u: any, init: any) => { expect(init.headers).toEqual({ apikey: 'k' }); expect((init.body as FormData).get('content')).toBeInstanceOf(Blob); return new Response(JSON.stringify({ id: 'f1', urls: { get: 'https://api.pruna.ai/v1/files/f1' } }), { status: 200 }) })
    const p = prunaProvider({ fetchImpl: f as any, env: { PRUNA_API_KEY: 'k' } })
    expect(await p.upload!(Buffer.from('jpegbytes'))).toBe('https://api.pruna.ai/v1/files/f1')
    expect((f.mock.calls[0] as any)[0]).toBe('https://api.pruna.ai/v1/files')
  })
  it('refuses cleanly without a key or when no URL comes back', async () => {
    await expect(prunaProvider({ fetchImpl: vi.fn() as any, env: {} }).upload!(Buffer.from('x'))).rejects.toMatchObject({ code: 'not_configured' })
    await expect(prunaProvider({ fetchImpl: (async () => new Response('{}', { status: 200 })) as any, env: { PRUNA_API_KEY: 'k' } }).upload!(Buffer.from('x'))).rejects.toMatchObject({ code: 'bad_response' })
  })
})
