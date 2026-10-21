// When purchased artwork needs a different aspect ratio: is NB2.1 invoked (and only then), is the adapted result what the customer approves and what is printed, and are the
// original artwork and the correction entitlement preserved? Real composition pipeline (composeWithPrintShop); the generator and the paid outpaint are counting stand-ins.
// Nothing here calls a model, spends money or writes to a database.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { createHash } from 'node:crypto'

const outpaintCalls = vi.hoisted(() => ({ n: 0 }))
vi.mock('../shared/outpaint', () => ({
  outpaint: async (i: any) => { outpaintCalls.n++; const s = (await import('sharp')).default; return { outpainted: true, image: await s(i.image).extend({ left: i.padding.left, right: i.padding.right, top: i.padding.up, bottom: i.padding.down, extendWith: 'mirror' }).jpeg().toBuffer() } },
}))

import { createSession, startBatch, setLines, getSessionView, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { selectArtwork, ensureCompositions, composeWithPrintShop } from './compose'
import { planFor } from './composition-plan'
import { getProduct } from '../print/catalog'

const U1 = '10000000-0000-4000-8000-000000000001'
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

function rig() {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const generate = vi.fn(async (i: { aspect: string }) => { const [w, h] = i.aspect.split(':').map(Number); return { imageB64: (await sharp({ create: { width: 512 * w, height: 512 * h, channels: 3, background: { r: 40 + w * 9, g: 90, b: 60 + h * 7 } } }).png().toBuffer()).toString('base64') } })
  const deps = {
    store, generate, compose: composeWithPrintShop, watermark: async (b64: string) => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(), draftCompositions: true,
    storage: { put: async (p: string, b: Buffer) => { files.set(p, b) }, get: async (p: string) => files.get(p) ?? null, remove: async (ps: string[]) => { for (const p of ps) files.delete(p) }, signedUrl: async (p: string) => (files.has(p) ? 'https://signed.test/' + p : null) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), kick: vi.fn(async () => ({})),
  } as unknown as GiftDeps
  return { deps, store, files, generate }
}
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')

const PRODUCTS = ['fine_art:8x8', 'canvas:8x8', 'framed:8x8', 'premium:8x8', 'fine_art:8x12', 'fine_art:12x18', 'canvas:12x18', 'framed:16x24', 'premium:20x30']

describe('aspect adaptation: NB2.1 only when the shape needs it, the original is never touched', () => {
  it('per product: a matching shape costs nothing; a 2-20% shape is a paid outpaint (not NB2.1); a far shape is ONE NB2.1 generation at the nearest supported ratio', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const b = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' }); const fav = b.batch.previews[0].previewId
    await selectArtwork(r.deps, U1, v.sessionId, fav)
    const master = (await r.deps.storage.get(r.store.previews.find(p => p.id === fav)!.master_path!))!, masterSha = sha(master), favRow = JSON.stringify(r.store.previews.find(p => p.id === fav))
    const rows: Array<Record<string, unknown>> = []
    for (const id of PRODUCTS) {
      const lineId = id.replace(/\W/g, '_'); await setLines(r.deps, U1, v.sessionId, [{ lineId, productId: id, copies: 1 }])
      const gen0 = r.generate.mock.calls.length, out0 = outpaintCalls.n
      await ensureCompositions(r.deps, U1, v.sessionId)
      const comp = r.store.compositions.filter(c => c.line_id === lineId && c.status !== 'superseded').at(-1)!
      const product = getProduct(id)!, plan = planFor(product, { series: 'portraits', peopleCount: null, masterAspect: '1:1' })!
      const gens = r.generate.mock.calls.length - gen0, outs = outpaintCalls.n - out0
      rows.push({ product: id, method: comp.method, fit: plan.fit, extension: plan.extensionFraction, genAspect: comp.generation_aspect, nb21: gens, outpaint: outs, mode: comp.generation_mode })
      // the adapted picture is what is stored for approval and printing: the product's shape, a different file than the master
      expect(comp.composed_path).not.toBe(r.store.previews.find(p => p.id === fav)!.master_path)
      const composed = (await r.deps.storage.get(comp.composed_path!))!, m = await sharp(composed).metadata()
      expect(Math.abs(m.width! / m.height! / product.requirements.pictureAspect - 1), id).toBeLessThan(0.02)
      expect((comp.plan as any).artworkSha256).toBe(sha(composed))
      // the original and the entitlement
      expect(sha((await r.deps.storage.get(r.store.previews.find(p => p.id === fav)!.master_path!))!)).toBe(masterSha)
      expect(JSON.stringify(r.store.previews.find(p => p.id === fav))).toBe(favRow)
      expect((await getSessionView(r.deps, U1, v.sessionId)).compositions.find(c => c.lineId === lineId)).toMatchObject({ attempt: 1, correctionsRemaining: 1 })
      // the rules
      if (plan.method === 'deterministic' && plan.fit !== 'extend') { expect(gens, id + ' matching shape: no generation').toBe(0); expect(outs, id + ' within 2%: mirror only, no paid call').toBe(0) }
      else if (plan.method === 'deterministic') { expect(gens, id).toBe(0); expect(outs, id + ' 2-20%: one paid outpaint').toBe(1) }
      else { expect(gens, id + ' far shape: exactly one NB2.1 generation').toBe(1); expect(r.generate.mock.calls.at(-1)![0]).toMatchObject({ aspect: plan.generationAspect, productComposition: true, effectId: expect.any(String) }) }
    }
    if (process.env.GIFT_MATRIX_OUT) (await import('node:fs')).writeFileSync(process.env.GIFT_MATRIX_OUT, JSON.stringify(rows, null, 1))
    // the square products share nothing paid; at least one far shape was generated and at least one square one cost nothing
    expect(rows.filter(x => x.nb21 === 0 && x.outpaint === 0).length).toBeGreaterThanOrEqual(1); expect(rows.filter(x => x.nb21 === 1).length).toBeGreaterThanOrEqual(1)
  })

  it('a generation for a far shape is a NEW generation of the same effect from the customer\'s photograph, and the favorite is passed as the reference', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const b = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' }); const fav = b.batch.previews[1].previewId
    await selectArtwork(r.deps, U1, v.sessionId, fav); await setLines(r.deps, U1, v.sessionId, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }])
    r.generate.mockClear(); await ensureCompositions(r.deps, U1, v.sessionId)
    const call = r.generate.mock.calls[0][0] as any
    expect(call.effectId).toBe(r.store.previews.find(p => p.id === fav)!.effect_id); expect(call.series).toBe('portraits'); expect(call.productComposition).toBe(true)
    expect(call.sourceB64).toBe((await r.deps.storage.get(`gift/${v.sessionId}/source.jpg`))!.toString('base64')); expect(typeof call.referenceB64).toBe('string')
  })

  it('two lines with the same picture shape share ONE composition: the second costs nothing', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const b = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' }); await selectArtwork(r.deps, U1, v.sessionId, b.batch.previews[0].previewId)
    await setLines(r.deps, U1, v.sessionId, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'canvas:12x18', copies: 1 }, { lineId: 'c', productId: 'framed:12x18', copies: 2 }])
    r.generate.mockClear(); await ensureCompositions(r.deps, U1, v.sessionId); expect(r.generate).toHaveBeenCalledTimes(1)
    const rows = r.store.compositions; expect(rows).toHaveLength(3); expect(rows.filter(c => c.nb21_calls > 0)).toHaveLength(1)
    r.generate.mockClear(); await ensureCompositions(r.deps, U1, v.sessionId); expect(r.generate).not.toHaveBeenCalled()          // idempotent: calling again makes nothing
  })
})

describe('what a polling client can see while compositions are being prepared (for the "preparing your artwork" screen)', () => {
  it('each line flips from none to ready as ITS composition finishes; the slow (generated) one is still none while the quick one is ready; no invented progress', async () => {
    const r = rig(); const v = await createSession(r.deps, { userId: U1, imageB64: await photo() })
    const b = await startBatch(r.deps, U1, v.sessionId, { idempotencyKey: 'idem-key-1' }); await selectArtwork(r.deps, U1, v.sessionId, b.batch.previews[0].previewId)
    await setLines(r.deps, U1, v.sessionId, [{ lineId: 'quick', productId: 'fine_art:8x8', copies: 1 }, { lineId: 'slow', productId: 'fine_art:12x18', copies: 1 }])
    const before = (await getSessionView(r.deps, U1, v.sessionId)).compositions
    expect(before.map(c => [c.lineId, c.status, c.method])).toEqual([['quick', 'none', 'deterministic'], ['slow', 'none', 'generated']])      // the plan is known up front: the screen can say what is coming
    let release!: () => void; const gate = new Promise<void>(res => { release = res })
    const original = r.generate.getMockImplementation()!; r.generate.mockImplementation(async (i: any) => { await gate; return original(i) })
    const run = ensureCompositions(r.deps, U1, v.sessionId)
    await vi.waitFor(async () => expect((await getSessionView(r.deps, U1, v.sessionId)).compositions.find(c => c.lineId === 'quick')!.status).toBe('ready'))
    const mid = (await getSessionView(r.deps, U1, v.sessionId)).compositions
    expect(mid.find(c => c.lineId === 'quick')).toMatchObject({ status: 'ready', previewUrl: expect.stringContaining('signed.test') }); expect(mid.find(c => c.lineId === 'slow')).toMatchObject({ status: 'none', previewUrl: null })
    release(); await run
    expect((await getSessionView(r.deps, U1, v.sessionId)).compositions.map(c => c.status)).toEqual(['ready', 'ready'])
  })
})
