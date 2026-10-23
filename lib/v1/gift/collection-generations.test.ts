// Entrance B (My Collection) in the product-first journey: the owned artwork fixes the effect, a generation for a product receives the owned artwork as the reference (Portraits, Pets), the flow
// stays 'previews' so nothing about existing collection sessions changes, and the owned original is never touched.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { createSessionFromCollection, getSessionView, type GiftDeps, type CollectionArtwork } from './service'
import { memoryGiftStore } from './store'
import { chooseEffect, startGeneration, acceptGeneration } from './generations'

const U1 = '10000000-0000-4000-8000-000000000001'
const OWNED = '30000000-0000-4000-8000-000000000001', PORTFOLIO = '40000000-0000-4000-8000-000000000001'
const key = (n: number) => `gen-key-${String(n).padStart(4, '0')}`

async function rig(series: 'portraits' | 'pets' | 'groups' = 'portraits') {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const art = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#4a7' } }).png().toBuffer()
  const photo = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()
  files.set('owned/original.png', art)
  store.ownedArtwork.set(OWNED, { userId: U1, portfolioId: PORTFOLIO, series, preset: 'bronze', unlocked: true, done: true })
  const generate = vi.fn(async (i: { aspect: string }) => {
    const [a, b] = i.aspect.split(':').map(Number), h = 1000
    return { imageB64: (await sharp({ create: { width: Math.round(h * a / b * 1.004), height: h, channels: 3, background: '#a47' } }).png().toBuffer()).toString('base64') }
  })
  const deps: GiftDeps = {
    store, collection: { resolve: async (u: string, id: string): Promise<CollectionArtwork> => ({ previewId: id, portfolioId: PORTFOLIO, series, preset: 'bronze', bytes: art, width: 1024, height: 1024, sourcePhoto: photo }) },
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: vi.fn(async () => ({ status: 'supported', series, peopleCount: series === 'groups' ? 4 : null })) as any, generate: generate as any,
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(), compose: vi.fn() as any, kick: vi.fn(async () => ({})),
  }
  return { deps, store, files, generate, art, ownedHash: () => createHash('sha256').update(files.get('owned/original.png')!).digest('hex') }
}

describe('a My Collection session generating for a product', () => {
  it('keeps flow previews, fixes the effect to the owned artwork, passes the owned artwork as the reference, and leaves the original alone', async () => {
    const r = await rig(); const before = r.ownedHash()
    const { view } = await createSessionFromCollection(r.deps, { userId: U1, previewId: OWNED })
    expect(view).toMatchObject({ flow: 'previews', entrance: 'collection' })
    expect(view.generations).toMatchObject({ effectId: 'bronze', items: [], allowance: { freeRemaining: 6, next: 'free' } })
    await expect(chooseEffect(r.deps, U1, view.sessionId, 'clockwork')).rejects.toMatchObject({ code: 'effect_fixed' })
    expect((await chooseEffect(r.deps, U1, view.sessionId, 'bronze')).generations!.effectId).toBe('bronze')
    const out = await startGeneration(r.deps, U1, view.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    expect(out.status).toBe('ok'); expect(out.generation).toMatchObject({ geometryKey: 'a667', kind: 'free', status: 'ready' })
    const call = r.generate.mock.calls[0][0] as any
    expect(call).toMatchObject({ series: 'portraits', effectId: 'bronze', aspect: '2:3', exactAspect: true }); expect(Buffer.from(call.referenceB64, 'base64').equals(r.art)).toBe(true)     // the owned artwork rides along
    expect(out.generation.conform).toMatchObject({ method: 'trim' })
    await acceptGeneration(r.deps, U1, view.sessionId, out.generation.generationId)
    expect(r.ownedHash()).toBe(before)
    expect((await getSessionView(r.deps, U1, view.sessionId)).nextBatch).toEqual({ kind: 'blocked', reason: 'collection_session' })      // the six-preview path stays closed, as before
  })
  it('Groups regenerate from the photograph alone (no reference), as before', async () => {
    const r = await rig('groups'); const { view } = await createSessionFromCollection(r.deps, { userId: U1, previewId: OWNED })
    await startGeneration(r.deps, U1, view.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) })
    expect((r.generate.mock.calls[0][0] as any).referenceB64).toBeUndefined()
  })
})
