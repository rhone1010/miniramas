// The mug as ONE genuine full wrap (no panel, no repetition, no mirror, no wash): the specification and its sources, the lab file, the beauty input, and the profile that prints it.
// Compositions made before this layout (the square face panel) keep their own profile; the picture's shape decides.

import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { MUG } from './production-profiles'
import { buildMugFullWrap, buildMugWrap, isMugFullWrapShape, mockupInputFor, mugFullWrapQaRegion } from './product-layout'
import { profileFor } from './upscale/profiles'
import { getSku } from './sku-map'

/** A picture that cannot be mistaken for anything else: column x is colour-coded by x, so where each column lands is checkable; the left and right edges and the middle carry markers. */
async function wrapPicture(w: number, h: number): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 3, edge = x < 6 ? 'L' : x >= w - 6 ? 'R' : Math.abs(x - w / 2) < 3 ? 'C' : ''
    raw[o] = edge === 'L' ? 255 : edge === 'R' ? 0 : edge === 'C' ? 255 : 40 + Math.floor((x / w) * 150); raw[o + 1] = edge === 'L' ? 0 : edge === 'R' ? 255 : edge === 'C' ? 255 : 90; raw[o + 2] = edge === 'L' ? 0 : edge === 'R' ? 0 : edge === 'C' ? 0 : 60 + (y % 50)
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}
/** Decode once, then read pixels synchronously. */
async function pixels(img: Buffer) { const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return (x: number, y: number) => { const o = (y * info.width + x) * 3; return [data[o], data[o + 1], data[o + 2]] } }
const near = (a: number[], b: number[], t = 16) => a.every((v, i) => Math.abs(v - b[i]) <= t)

describe('the full-wrap specification', () => {
  it('about 1/8 inch unprinted at rim and base, inside Prodigi\'s printable 2670 x 1110, and the subject on the right-handed face', () => {
    const f = MUG.fullWrap
    expect(f.marginPx).toBe(Math.round(0.125 * 300)); expect(f.unprintedMarginIn).toBe(0.125)                         // 37.5 px, rounded to 38
    expect(f.printable).toEqual({ x: 0, y: 38, w: 2670, h: 1034 }); expect(f.printable.y + f.printable.h + f.marginPx).toBe(MUG.wrap.h)    // the band is symmetric inside the 1110 high file
    expect(f.printable.x + f.printable.w).toBeLessThanOrEqual(MUG.wrap.w)                                             // never asks for more than the lab prints
    expect(f.subjectX).toBe(MUG.faceCentersX[1]); expect(f.rollPx).toBe(Math.round(f.subjectX - MUG.wrap.w / 2))
    expect(MUG.seamX).toEqual([0, 2670])                                                                              // the handle seam is still the file's edges
  })
})

describe('buildMugFullWrap: the lab file', () => {
  it('is 2670 x 1110 with an unprinted white band at rim and base, ONE picture across the full width, its centre (the subjects) on the face at x = 2069, nothing repeated or mirrored', async () => {
    const picture = await wrapPicture(1335, 517)                                                                        // exactly the shape generation delivers (2 x 1335:517)
    const file = await buildMugFullWrap(picture, 1), meta = await sharp(file).metadata(), px = await pixels(file)
    expect([meta.width, meta.height]).toEqual([2670, 1110])
    for (const y of [0, 10, 36]) for (const x of [5, 700, 1335, 2069, 2664]) expect(near(px(x, y), [255, 255, 255], 3), `top band ${x},${y}`).toBe(true)
    for (const y of [1073, 1090, 1109]) for (const x of [5, 1335, 2664]) expect(near(px(x, y), [255, 255, 255], 3), `bottom band ${x},${y}`).toBe(true)
    expect(near(px(1335, 600), [255, 255, 255], 3)).toBe(false)                                           // the picture fills the band
    // the picture's centre marker (yellow) lands on the right-handed face; its edges (red = left edge, green = right edge) meet at the roll line, behind the mug
    const row = 600, yellowX = [] as number[]; for (let x = 0; x < 2670; x += 1) { const p = px(x, row); if (near(p, [255, 255, 0], 40)) yellowX.push(x) }
    expect(Math.abs(yellowX.reduce((a, b) => a + b, 0) / yellowX.length - MUG.fullWrap.subjectX)).toBeLessThanOrEqual(3)
    const red = [] as number[], green = [] as number[]; for (let x = 0; x < 2670; x++) { const p = px(x, row); if (near(p, [255, 0, 0], 40)) red.push(x); if (near(p, [0, 255, 0], 40)) green.push(x) }
    expect(Math.min(...red)).toBeGreaterThanOrEqual(MUG.fullWrap.rollPx - 2); expect(Math.max(...green)).toBeLessThanOrEqual(MUG.fullWrap.rollPx + 2)       // left edge starts at the roll line, right edge ends just before it
    // no mirror: the left half of the file is NOT the flipped right half
    expect(near(px(300, row), px(2669 - 300, row), 8)).toBe(false)
  })
  it('refuses a picture of another shape: the old square panel, a stretched or cropped one', async () => {
    for (const [w, h] of [[910, 910], [1335, 555], [1000, 2000]]) await expect(buildMugFullWrap(await wrapPicture(w, h), 1)).rejects.toThrow('mug_picture_shape_mismatch')
    expect(isMugFullWrapShape(1335, 517)).toBe(true); expect(isMugFullWrapShape(2670, 1034)).toBe(true); expect(isMugFullWrapShape(910, 910)).toBe(false); expect(isMugFullWrapShape(2670, 1110)).toBe(false)
  })
  it('the legacy panel layout is untouched', async () => {
    const f = await buildMugWrap(await wrapPicture(910, 910), 1); expect(await sharp(f).metadata()).toMatchObject({ width: 2670, height: 1110 })
  })
})

describe('the beauty-shot input is a view of the same wrap, never the print file', () => {
  it('is the full wrap rolled so the primary face is in the middle (a half-scale 1335 x 555), with the same unprinted bands, and is not the lab file', async () => {
    const picture = await wrapPicture(1335, 517), input = await mockupInputFor('mug', picture), m = await sharp(input).metadata(), px = await pixels(input)
    expect([m.width, m.height]).toEqual([1335, 555]); expect(Math.abs(m.width! / m.height! - 2670 / 1110)).toBeLessThan(0.01)         // the scene's 2.4054 rolled-full-wrap aspect
    expect(near(px(667, 5), [255, 255, 255], 3)).toBe(true)                                                // the 1/8 inch rim band (19 px at half scale)
    const yellow = [] as number[]; for (let x = 0; x < 1335; x++) if (near(px(x, 300), [255, 255, 0], 40)) yellow.push(x)
    expect(Math.abs(yellow.reduce((a, b) => a + b, 0) / yellow.length - 667.5)).toBeLessThanOrEqual(3)                  // the subjects are in the middle of what the beauty scene shows
    expect(input.equals(await buildMugFullWrap(picture, 1))).toBe(false)                                                // and the print file is the full 2670 x 1110 wrap, not this view
  })
})

describe('the mug profile prints the full wrap and leaves the old panel alone', () => {
  const job: any = { id: 'j', finish: 'mug', size: '11oz', sku: getSku('11oz' as any, 'mug' as any).sku }
  const profile = profileFor(job)
  it('a 1335 x 517 picture is prepared as the whole band (2670 x 1034 required, a 2x upscale), finished into the 2670 x 1110 file, and QA looks at the band', async () => {
    const source = await wrapPicture(1335, 517), p = await profile.prepare({ job, source, ppi: 300 })
    expect(p).toMatchObject({ width: 1335, height: 517, requiredFront: { w: 2670, h: 1034 }, outpainted: false, targetPlan: { front: { w: 2670, h: 1034 } } }); expect(p.scale).toBeGreaterThan(1)
    expect((await sharp(p.working).raw().toBuffer()).equals(await sharp(source).removeAlpha().raw().toBuffer())).toBe(true)      // preparation added nothing
    const j2 = { ...job, input_w: p.width, input_h: p.height, required_front_w: p.requiredFront.w, required_front_h: p.requiredFront.h }
    const provider = await sharp(source).resize(2672, 1035, { kernel: 'lanczos3' }).png().toBuffer()                  // what an upscaler returns (integer rounding)
    const f = await profile.finish({ job: j2, image: provider, upscaled: true, targetMp: 8 }); const pf = await pixels(f.jpeg)
    expect(f.expected).toEqual({ w: 2670, h: 1110 }); expect(await sharp(f.jpeg).metadata()).toMatchObject({ format: 'jpeg', width: 2670, height: 1110 })
    expect(near(pf(1000, 10), [255, 255, 255], 6)).toBe(true); expect(near(pf(1000, 1100), [255, 255, 255], 6)).toBe(true)
    expect(await sharp(await profile.qaRegion({ job: j2, final: f.jpeg })).metadata()).toMatchObject({ width: 2670, height: 1034 }); expect(await sharp(await mugFullWrapQaRegion(f.jpeg)).metadata()).toMatchObject({ width: 2670, height: 1034 })
  })
  it('a square panel composition (an existing paid mug) still prepares and prints as the panel', async () => {
    const source = await wrapPicture(600, 600), p = await profile.prepare({ job, source, ppi: 300 })
    expect(p).toMatchObject({ width: 600, height: 600, requiredFront: { w: 910, h: 910 } })
    const f = await profile.finish({ job: { ...job, input_w: p.width, input_h: p.height, required_front_w: 910, required_front_h: 910 }, image: await sharp(source).resize(912, 912).png().toBuffer(), upscaled: true, targetMp: 2 })
    expect(await sharp(f.jpeg).metadata()).toMatchObject({ width: 2670, height: 1110 })
  })
})
