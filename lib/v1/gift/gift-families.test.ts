// The four Gift Shop families that are not yet for sale (Matted Frame, Framed Canvas, Photo Mug, Greeting Card): what the availability contract says about each, that the product-first generation
// can already make exactly their shape, and that print preparation then adds nothing to the accepted picture. Selling them needs only an approved retail price and the family launch (data).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { createSession, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { getProductAvailability } from './availability'
import { conformTo, generationTargetFor, gridOf, startGeneration, chooseEffect } from './generations'
import { allProducts, getProduct } from '../print/catalog'
import { liveEffectIds } from './effects'
import { MUG, CARD } from '../print/production-profiles'

const U1 = '10000000-0000-4000-8000-000000000001'
const FAMILIES = ['matted', 'framed_canvas', 'mug', 'card']
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
function rig(series: 'portraits' | 'pets' | 'groups' = 'portraits', people: number | null = null) {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const deps = { store, generate: vi.fn() as any, compose: vi.fn() as any, watermark: async (b: string) => sharp(Buffer.from(b, 'base64')).jpeg().toBuffer(),
    storage: { put: async (p: string, b: Buffer) => { files.set(p, b) }, get: async (p: string) => files.get(p) ?? null, remove: async () => {}, signedUrl: async (p: string) => 'https://signed.test/' + p },
    analyze: async () => ({ status: 'supported', series, peopleCount: people }), kick: vi.fn() } as unknown as GiftDeps
  return deps
}
let saved: string | undefined
beforeEach(() => { saved = process.env.GIFT_NEW_SESSION_FLOW; process.env.GIFT_NEW_SESSION_FLOW = 'generations' })
afterEach(() => { if (saved === undefined) delete process.env.GIFT_NEW_SESSION_FLOW; else process.env.GIFT_NEW_SESSION_FLOW = saved })

describe('availability: exact blockers and configuration for the four families', () => {
  it('every product reports ALL its open blockers (never photography), its generation shape and its manufacturing configuration', async () => {
    const deps = rig(); const v = await createSession(deps, { userId: U1, imageB64: await photo() })
    const a = await getProductAvailability(deps, U1, v.sessionId); const by = (id: string) => a.products.find(p => p.productId === id)!
    for (const p of a.products.filter(x => FAMILIES.includes(x.family) && !x.productId.includes('-'))) {
      expect(p.blockers, p.productId).not.toContain('no_mockup_template'); expect(p.purchasable, p.productId).toBe(p.blockers.length === 0)
    }
    // Matted Frame and Framed Canvas squares are on sale (approved prices, launched family); everything else lists exactly what is still open
    for (const id of ['matted:8x8', 'matted:20x20', 'framed_canvas:8x8', 'framed_canvas:20x20']) expect(by(id), id).toMatchObject({ purchasable: true, blockers: [], disabledReason: null })
    for (const id of ['matted:8x12', 'matted:12x18', 'matted:16x24', 'matted:20x30', 'framed_canvas:8x12', 'framed_canvas:12x18', 'framed_canvas:16x24', 'framed_canvas:20x30', 'mug:11oz', 'card:7x5']) expect(by(id), id).toMatchObject({ purchasable: true, blockers: [] })
    expect(by('framed_canvas:8x12')).toMatchObject({ purchasable: true, blockers: [], generation: { supported: true, requestedAspect: '3:2', trimFraction: 0 } }); expect(by('mug:11oz').configuration).toMatchObject({ artworkProfile: 'mug_wrap', skuOrientation: 'wrap', picturePx: { w: 910, h: 910 }, finalPx: { w: 2670, h: 1110 } })
    expect(by('card:7x5').configuration).toMatchObject({ artworkProfile: 'card_spread', skuOrientation: 'spread', picturePx: { w: 1500, h: 2100 } })
    expect(by('matted:8x12').configuration.fixedAttributes).toEqual({ color: 'black' }); expect(by('framed_canvas:12x18').configuration.fixedAttributes).toEqual({ color: 'black', wrap: 'MirrorWrap' })
    expect(by('card:7x5-gloss')).toMatchObject({ blockers: ['not_a_launch_candidate'], generation: { supported: false, reason: 'not_a_launch_candidate' } })
    // the generation each can have (Portraits): the ratio asked of NB2.1 and the sliver trimmed to reach the exact shape
    expect(by('mug:11oz').generation).toMatchObject({ supported: true, requestedAspect: '1:1', trimFraction: 0 })
    expect(by('framed_canvas:12x18').generation).toMatchObject({ supported: true, requestedAspect: '2:3', trimFraction: 0 })
    expect(by('card:7x5').generation).toMatchObject({ supported: true, requestedAspect: '3:4' }); expect((by('card:7x5').generation as any).trimFraction).toBeLessThan(0.06)
    expect(by('matted:12x18').generation).toMatchObject({ supported: true, requestedAspect: '9:16' }); expect((by('matted:12x18').generation as any).trimFraction).toBeLessThan(0.03)
    for (const id of ['matted:8x12', 'matted:16x24', 'matted:20x30']) expect((by(id).generation as any).trimFraction, id).toBeLessThan(0.1)
    // the launch products are unaffected
    expect(by('fine_art:12x18')).toMatchObject({ purchasable: true, blockers: [], generation: { supported: true, requestedAspect: '2:3', trimFraction: 0 } })
  })
  it('Groups: head-count formats limit the ratios, so the matted and card shapes that need 9:16 or 3:4 may have no supported ratio (said plainly, not guessed)', async () => {
    const deps = rig('groups', 4); const v = await createSession(deps, { userId: U1, imageB64: await photo() })
    const a = await getProductAvailability(deps, U1, v.sessionId)
    const g = (id: string) => a.products.find(p => p.productId === id)!.generation
    expect(g('mug:11oz')).toMatchObject({ supported: true, requestedAspect: '1:1' }); expect(g('framed_canvas:12x18')).toMatchObject({ supported: true, requestedAspect: '2:3' })
    expect(['matted:12x18', 'matted:16x24'].map(id => (g(id) as any).supported)).toEqual([false, false])                       // 16% and 11% from the nearest Groups format: beyond the 10% bound
    expect(g('matted:12x18')).toMatchObject({ reason: 'no_ratio_within_bound_for_series' })
  })
  it('what is not for sale is refused with product_not_available: no generation is spent on it', async () => {
    const deps = rig(); const v = await createSession(deps, { userId: U1, imageB64: await photo() }); await chooseEffect(deps, U1, v.sessionId, liveEffectIds('portraits')[0])
    for (const id of ['card:7x5-gloss', 'card:6x6-gloss', 'nope:1x1']) await expect(startGeneration(deps, U1, v.sessionId, { productId: id, idempotencyKey: 'key-' + id.replace(/\W/g, '') + '-1' })).rejects.toMatchObject({ code: 'product_not_available' })
    expect(deps.generate).not.toHaveBeenCalled()
  })
})

describe('generation to print: the accepted picture is what the lab preparation receives, untouched', () => {
  it('for every Matted Frame, Framed Canvas, Mug and Card shape: a model picture conforms to the exact shape, and the real print preparation adds nothing', async () => {
    const { prepareComposition, preparePanelComposition } = await import('../print/asset-pipeline')
    const checked: string[] = []
    for (const p of allProducts().filter(x => FAMILIES.includes(x.family) && x.disabledReason !== 'not_a_launch_candidate')) {
      const t = generationTargetFor(p, 'portraits', null); expect(t, p.productId).not.toBeNull()
      const [a, b] = t!.aspect.split(':').map(Number), h = 1500, w = Math.round(h * a / b * 1.003)                    // what a model returns for the requested ratio: about 0.3% off
      const model = await sharp({ create: { width: w, height: h, channels: 3, background: '#2a6' } }).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#fa0"/></svg>`) }]).png().toBuffer()
      const fit = conformTo(w, h, p.requirements.pictureAspect, gridOf(p)); expect(fit, p.productId).not.toBeNull()
      let img = sharp(model).extract(fit!.crop); if (fit!.resize) img = sharp(await img.png().toBuffer()).resize(fit!.resize.width, fit!.resize.height, { fit: 'fill', kernel: 'lanczos3' })
      const png = await img.png().toBuffer(); const md = await sharp(png).metadata()
      const g = gridOf(p); expect(md.width! % g.w === 0 && md.height! % g.h === 0 && md.width! / g.w === md.height! / g.h, `${p.productId} on grid ${g.w}:${g.h}`).toBe(true)
      expect(fit!.trimFraction, p.productId).toBeLessThan(0.1)
      const raw = await sharp(png).raw().toBuffer()
      if (p.family === 'mug' || p.family === 'card') {
        const panel = p.family === 'mug' ? MUG.panel : { w: CARD.frontTrim.w, h: CARD.frontTrim.h }
        const c = await preparePanelComposition({ imageB64: png.toString('base64'), panel }); expect(c.outpainted, p.productId).toBe(false); expect([c.width, c.height], p.productId).toEqual([md.width, md.height]); expect(c.fit).not.toBe('extend')
        expect((await sharp(c.working).raw().toBuffer()).equals(raw), p.productId).toBe(true)
      } else {
        const c = await prepareComposition({ imageB64: png.toString('base64'), size: p.size as any, finish: p.family as any }); expect(c.outpainted, p.productId).toBe(false); expect([c.width, c.height], p.productId).toEqual([md.width, md.height])
        expect((await sharp(c.working).raw().toBuffer()).equals(raw), p.productId).toBe(true)
      }
      checked.push(p.productId)
    }
    expect(checked.length).toBeGreaterThanOrEqual(18); expect(getProduct('mug:11oz')).toBeTruthy()
  })
})
