// The artwork profiles for the four Gift Shop products, through the same interface the job processor uses: prepare, (upscale), finish, qaRegion.
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { NoProfileError, profileFor } from './profiles'
import { CARD, MUG } from '../production-profiles'
import { getSku } from '../sku-map'
import { printPlan } from '../geometry'

async function gradient(w: number, h: number): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; raw[i] = Math.round(x / (w - 1) * 255); raw[i + 1] = Math.round(y / (h - 1) * 255); raw[i + 2] = 80 }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}
const meanAbsDiff = async (a: Buffer, b: Buffer) => { const [x, y] = await Promise.all([sharp(a).removeAlpha().raw().toBuffer(), sharp(b).removeAlpha().raw().toBuffer()]); let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length }
const jobFor = (finish: string, size: string): any => ({ id: 'job', finish, size, sku: getSku(size as any, finish as any).sku })
/** What the processor stores on the job after prepare(): the prepared size and the picture size that was required. */
const withPrepared = (job: any, p: { width: number; height: number; requiredFront: { w: number; h: number } }) => ({ ...job, input_w: p.width, input_h: p.height, required_front_w: p.requiredFront.w, required_front_h: p.requiredFront.h })

describe('which profile makes which file', () => {
  it('the mug and the 7 x 5 card have their own; matted frame and framed canvas use the flat-print profile; nothing else is guessed', () => {
    expect(profileFor(jobFor('mug', '11oz')).id).toBe('mug_wrap'); expect(profileFor(jobFor('card', '7x5')).id).toBe('card_spread')
    expect(profileFor(jobFor('matted', '12x18')).id).toBe('flat_print'); expect(profileFor(jobFor('framed_canvas', '12x18')).id).toBe('flat_print')
    expect(() => profileFor({ id: 'j', finish: 'card', size: '6x4', sku: 'GLOBAL-GRE-GLOS-6X4-BLA' } as any)).toThrow(NoProfileError)       // an unlaunched card variant never reaches a lab
    expect(() => profileFor({ id: 'j', finish: 'mug', size: '15oz', sku: 'x' } as any)).toThrow(NoProfileError)
  })
})

describe('mug wrap profile', () => {
  const profile = profileFor(jobFor('mug', '11oz'))
  it('upscales only the PANEL, then builds the full 2670 x 1110 wrap around it', async () => {
    const source = await gradient(600, 600)
    const p = await profile.prepare({ job: jobFor('mug', '11oz'), source, ppi: 300 })
    expect(p).toMatchObject({ width: 600, height: 600, requiredFront: { w: 910, h: 910 }, outpainted: false, targetPlan: { front: { w: 910, h: 910 }, final: { w: 910, h: 910 } } }); expect(p.scale).toBeGreaterThan(1)
    const job = withPrepared(jobFor('mug', '11oz'), p)
    const provider = await sharp(source).resize(912, 912, { kernel: 'lanczos3' }).png().toBuffer()                  // what an upscaler returns: a little over the requirement
    const f = await profile.finish({ job, image: provider, upscaled: true, targetMp: 2 })
    expect(f.expected).toEqual({ w: 2670, h: 1110 }); expect(await sharp(f.jpeg).metadata()).toMatchObject({ format: 'jpeg', width: 2670, height: 1110 })
    const qa = await profile.qaRegion({ job, final: f.jpeg }); expect(await sharp(qa).metadata()).toMatchObject({ width: 910, height: 910 })
    expect(await meanAbsDiff(qa, await sharp(source).resize(910, 910, { fit: 'fill' }).jpeg({ quality: 95 }).toBuffer())).toBeLessThan(6)   // the picture is on the file, whole
  })
  it('an artwork that is already large enough is not upscaled (no paid call) and still yields the exact file', async () => {
    const source = await gradient(1000, 1000), p = await profile.prepare({ job: jobFor('mug', '11oz'), source, ppi: 300 })
    expect(p.scale).toBe(0)
    const f = await profile.finish({ job: withPrepared(jobFor('mug', '11oz'), p), image: p.working, upscaled: false })
    expect(await sharp(f.jpeg).metadata()).toMatchObject({ width: 2670, height: 1110 })
  })
  it('a shortfall from the provider is refused, never papered over', async () => {
    const source = await gradient(600, 600), p = await profile.prepare({ job: jobFor('mug', '11oz'), source, ppi: 300 })
    await expect(profile.finish({ job: withPrepared(jobFor('mug', '11oz'), p), image: await sharp(source).resize(700, 700).png().toBuffer(), upscaled: true, targetMp: 2 })).rejects.toThrow('print_upscale_resolution_shortfall')
  })
  it('a source that is not the panel shape within the bound is refused (a 2:3 picture is far from square)', async () => {
    await expect(profile.prepare({ job: jobFor('mug', '11oz'), source: await gradient(400, 900), ppi: 300 })).rejects.toThrow('incompatible_print_aspect')
  })
  it('a slightly different shape is reflected, not cropped or stretched: the original pixels stay', async () => {
    const source = await gradient(600, 610), p = await profile.prepare({ job: jobFor('mug', '11oz'), source, ppi: 300 })     // 1.7% off square: inside the resample bound
    expect(p.width).toBe(p.height); expect(p.width).toBeGreaterThanOrEqual(610)
  })
})

describe('card spread profile', () => {
  const profile = profileFor(jobFor('card', '7x5'))
  it('upscales only the 1500 x 2100 front, then builds the 6118 x 2161 spread; a provider that rounds a few pixels is reflected, not stretched', async () => {
    const source = await gradient(750, 1050)
    const p = await profile.prepare({ job: jobFor('card', '7x5'), source, ppi: 300 })
    expect(p).toMatchObject({ width: 750, height: 1050, requiredFront: { w: 1500, h: 2100 }, targetPlan: { front: { w: 1500, h: 2100 }, final: { w: 1500, h: 2100 } } })
    const job = withPrepared(jobFor('card', '7x5'), p)
    const provider = await sharp(source).resize(1503, 2104, { kernel: 'lanczos3' }).png().toBuffer()
    const f = await profile.finish({ job, image: provider, upscaled: true, targetMp: 4 })
    expect(f.expected).toEqual({ w: 6118, h: 2161 }); expect(await sharp(f.jpeg).metadata()).toMatchObject({ width: 6118, height: 2161 })
    const qa = await profile.qaRegion({ job, final: f.jpeg }); expect(await sharp(qa).metadata()).toMatchObject({ width: 1500, height: 2100 })
    expect(await meanAbsDiff(qa, await sharp(source).resize(1500, 2100, { fit: 'fill' }).jpeg({ quality: 95 }).toBuffer())).toBeLessThan(6)
    // the inner sheet and the rear are paper
    const spread = await sharp(f.jpeg).extract({ left: 3200, top: 200, width: 100, height: 100 }).removeAlpha().raw().toBuffer(); expect(Math.min(...spread)).toBeGreaterThan(250)
  })
  it('a 2:3 portrait is within the bound for the 5:7 front (about 7% extension) but needs the paid outpaint, exactly as flat prints do: it is never cropped to fit', async () => {
    await expect(profile.prepare({ job: jobFor('card', '7x5'), source: await gradient(800, 1200), ppi: 300 })).rejects.toThrow('print_outpaint_failed')      // no Stability key in tests: the point is that it asks to EXTEND
  })
  it('a square picture is not forced onto the front: it is refused, so the plan generates a card-shaped one', async () => {
    await expect(profile.prepare({ job: jobFor('card', '7x5'), source: await gradient(900, 900), ppi: 300 })).rejects.toThrow()
  })
})

describe('matted frame and framed canvas through the flat-print profile (geometry.ts)', () => {
  it('matted 12x18: the file is exactly the 2418 x 4218 picture inside the mount; QA sees all of it', async () => {
    const profile = profileFor(jobFor('matted', '12x18')), job0 = jobFor('matted', '12x18')
    const source = await gradient(806, 1406), p = await profile.prepare({ job: job0, source, ppi: 300 })           // 806:1406 = 2418:4218
    const job = withPrepared(job0, p)
    const f = await profile.finish({ job, image: await sharp(source).resize(2420, 4222, { kernel: 'lanczos3' }).png().toBuffer(), upscaled: true, targetMp: 11 })
    expect(f.expected).toEqual({ w: 2418, h: 4218 }); expect(await sharp(f.jpeg).metadata()).toMatchObject({ width: 2418, height: 4218 })
    expect(await sharp(await profile.qaRegion({ job, final: f.jpeg })).metadata()).toMatchObject({ width: 2418, height: 4218 })
  })
  it('framed canvas 12x18: the picture is 3600 x 5400 inside a 3654 x 5454 file with a 27 px mirrored margin, exactly as the Gallery Canvas', async () => {
    const profile = profileFor(jobFor('framed_canvas', '12x18')), job0 = jobFor('framed_canvas', '12x18')
    const source = await gradient(800, 1200), p = await profile.prepare({ job: job0, source, ppi: 300 })
    expect(p.targetPlan).toEqual({ front: { w: 3600, h: 5400 }, final: { w: 3654, h: 5454 } })
    const job = withPrepared(job0, p)
    const f = await profile.finish({ job, image: await sharp(source).resize(3602, 5404, { kernel: 'lanczos3' }).png().toBuffer(), upscaled: true, targetMp: 20 })
    expect(await sharp(f.jpeg).metadata()).toMatchObject({ width: 3654, height: 5454 })
    expect(await sharp(await profile.qaRegion({ job, final: f.jpeg })).metadata()).toMatchObject({ width: 3600, height: 5400 })
    const col = async (x: number) => (await sharp(f.jpeg).extract({ left: x, top: 2700, width: 1, height: 1 }).raw().toBuffer())[0]
    expect(Math.abs((await col(26)) - (await col(27)))).toBeLessThan(6); expect(Math.abs((await col(25)) - (await col(28)))).toBeLessThan(6)       // reflected about the picture's left edge
  })
  it('framed canvas 8x12 is landscape-defined: a landscape picture is not turned, a portrait one is', () => {
    const e = getSku('8x12', 'framed_canvas')
    expect(printPlan(1200, 800, e)).toMatchObject({ front: { w: 3600, h: 2400 }, final: { w: 3654, h: 2454 } })
    expect(printPlan(800, 1200, e)).toMatchObject({ front: { w: 2400, h: 3600 }, final: { w: 2454, h: 3654 } })
    // the launch canvas 8x12 (portrait-defined) behaves exactly as before
    const c = getSku('8x12', 'canvas')
    expect(printPlan(800, 1200, c)).toMatchObject({ final: { w: 2454, h: 3654 } }); expect(printPlan(1200, 800, c)).toMatchObject({ final: { w: 3654, h: 2454 } })
  })
})
