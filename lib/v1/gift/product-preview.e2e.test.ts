// The pre-checkout product preview with the REAL scene and calibrated renderers on a safe fixture (a synthetic painting, or the image named by GIFT_SCENE_ARTWORK). In-memory
// store and storage; nothing is generated, paid, ordered or stored remotely. GIFT_SCENE_EVIDENCE_DIR keeps the returned (watermark stand-in) JPEGs.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { createSession, startBatch, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { selectArtwork } from './compose'
import { getProductPreview } from './product-preview'
import { realMockupRenderer } from './mockup-real'

const U1 = '10000000-0000-4000-8000-000000000001'
const EVIDENCE = process.env.GIFT_SCENE_EVIDENCE_DIR
const PAINTING = process.env.GIFT_SCENE_ARTWORK ? fs.readFileSync(process.env.GIFT_SCENE_ARTWORK) : Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4c58a"/><stop offset="0.5" stop-color="#5fa3a8"/><stop offset="1" stop-color="#2b3a67"/></linearGradient></defs><rect width="1200" height="1200" fill="url(#g)"/><circle cx="380" cy="420" r="210" fill="#e4572e" opacity="0.85"/><circle cx="820" cy="760" r="260" fill="#f3e9d2" opacity="0.8"/><rect x="560" y="120" width="70" height="520" fill="#a63d40" opacity="0.8"/></svg>')

describe('pre-checkout preview, real renderers', () => {
  it('shows the selected favorite in the square canvas scene and in the calibrated fine art print; explains the portrait that needs a composition', async () => {
    const store = memoryGiftStore(), files = new Map<string, Buffer>()
    const generate = vi.fn(async (i: { aspect: string }) => { const [w, h] = i.aspect.split(':').map(Number); return { imageB64: (await sharp(PAINTING).resize(512 * w, 512 * h, { fit: 'cover' }).png().toBuffer()).toString('base64') } })
    const deps = {
      store, generate, compose: vi.fn() as any, mockup: realMockupRenderer, watermark: async (b64: string) => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
      storage: { put: async (p: string, b: Buffer) => { files.set(p, b) }, get: async (p: string) => files.get(p) ?? null, remove: async (ps: string[]) => { for (const p of ps) files.delete(p) }, signedUrl: async (p: string) => (files.has(p) ? 'https://signed.test/' + p : null), list: async (x: string) => [...files.keys()].filter(k => k.startsWith(x)) },
      analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), kick: vi.fn(async () => ({})),
    } as unknown as GiftDeps
    const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
    const v = await createSession(deps, { userId: U1, imageB64: photo }); const b = await startBatch(deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' })
    await selectArtwork(deps, U1, v.sessionId, b.batch.previews[0].previewId)
    const canvas = await getProductPreview(deps, U1, v.sessionId, 'canvas:8x8'), fine = await getProductPreview(deps, U1, v.sessionId, 'premium:12x12'), portrait = await getProductPreview(deps, U1, v.sessionId, 'fine_art:12x18')
    expect(canvas).toMatchObject({ status: 'ready', renderer: 'scene', sceneId: 'gallery-canvas-square', watermarked: true })
    expect(fine).toMatchObject({ status: 'ready', renderer: 'calibrated', watermarked: true })
    expect(portrait).toMatchObject({ status: 'adaptation_required' })
    expect(store.compositions).toHaveLength(0); expect(store.orders.size).toBe(0)
    for (const r of [canvas, fine]) { const stored = [...files.entries()].find(([k]) => (r as any).url.endsWith(k))![1]; const m = await sharp(stored).metadata(); expect(m.format).toBe('jpeg'); expect(m.width).toBeGreaterThan(200)
      if (EVIDENCE) { fs.mkdirSync(EVIDENCE, { recursive: true }); fs.writeFileSync(path.join(EVIDENCE, `preview-${(r as any).productId.replace(':', '-')}__${(r as any).renderer}.jpg`), stored) } }
  }, 120_000)
})
