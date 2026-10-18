// The lab files for the mug and the card are built from the ONE reviewed picture: whole, never cropped or stretched, and identical in the mockup and the print.
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { buildCardSpread, buildMugWrap, cardQaRegion, mockupInputFor, mugQaRegion, SHAPE_TOLERANCE } from './product-layout'
import { CARD, MUG, cardLayout, mugPanelRects } from './production-profiles'

/** A picture whose every pixel says where it came from: red grows to the right, green downward. A crop or a stretch changes it. */
async function picture(w: number, h: number): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; raw[i] = Math.round(x / (w - 1) * 255); raw[i + 1] = Math.round(y / (h - 1) * 255); raw[i + 2] = 90 }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}
const px = async (img: Buffer, x: number, y: number) => { const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]] }
const meanAbsDiff = async (a: Buffer, b: Buffer) => { const [x, y] = await Promise.all([sharp(a).removeAlpha().raw().toBuffer(), sharp(b).removeAlpha().raw().toBuffer()]); let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length }

describe('mug wrap', () => {
  it('is exactly 2670 x 1110, with the whole picture on BOTH faces and nowhere else', async () => {
    const pic = await picture(600, 600), wrap = await buildMugWrap(pic, 1)
    expect(await sharp(wrap).metadata()).toMatchObject({ width: 2670, height: 1110 })
    const [r1, r2] = mugPanelRects(); const resized = await sharp(pic).resize(910, 910, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
    for (const r of [r1, r2]) expect(await meanAbsDiff(await sharp(wrap).extract({ left: r.x, top: r.y, width: r.w, height: r.h }).png().toBuffer(), resized)).toBeLessThan(0.5)   // the same pixels, not a crop and not a stretch
    // corners of the picture land on the corners of the panel (nothing cropped)
    expect((await px(wrap, r2.x + 1, r2.y + 1))[0]).toBeLessThan(10); expect((await px(wrap, r2.x + r2.w - 2, r2.y + r2.h - 2))[1]).toBeGreaterThan(245)
  })
  it('has no seam at the handle: the two ends of the file are the same colour', async () => {
    const wrap = await buildMugWrap(await picture(600, 600), 1), W = 2670
    for (const y of [100, 555, 1000]) { const a = await px(wrap, 0, y), b = await px(wrap, W - 1, y); for (let c = 0; c < 3; c++) expect(Math.abs(a[c] - b[c])).toBeLessThan(8) }
  })
  it('refuses a picture that is not the panel\'s shape instead of squeezing it', async () => {
    await expect(buildMugWrap(await picture(600, 900), 1)).rejects.toThrow('mug_picture_shape_mismatch')
    await expect(buildMugWrap(await picture(600, 600 + Math.ceil(600 * SHAPE_TOLERANCE * 2)), 1)).rejects.toThrow('mug_picture_shape_mismatch')
    await expect(buildMugWrap(await picture(600, 600 + 1), 1)).resolves.toBeTruthy()             // rounding of a composed file is tolerated
  })
  it('the mockup input is half size with the exact wrap ratio, rolled so the right-handed face is in the middle', async () => {
    const pic = await picture(600, 600), input = await mockupInputFor('mug', pic), m = await sharp(input).metadata()
    expect([m.width, m.height]).toEqual([1335, 555]); expect(m.width! / m.height!).toBe(MUG.wrap.w / MUG.wrap.h)
    const centre = await sharp(input).extract({ left: 667 - 40, top: 277 - 40, width: 80, height: 80 }).png().toBuffer()
    const expected = await sharp(pic).resize(455, 455, { fit: 'fill' }).extract({ left: 227 - 40, top: 227 - 40, width: 80, height: 80 }).png().toBuffer()   // the middle of the panel (455 px at this scale, 50 px below the top)
    expect(await meanAbsDiff(centre, expected)).toBeLessThan(2)
    const unrolled = await sharp(await buildMugWrap(pic, 0.5)).extract({ left: 667 - 40, top: 277 - 40, width: 80, height: 80 }).png().toBuffer()
    expect(await meanAbsDiff(unrolled, expected)).toBeGreaterThan(5)                              // without the roll the middle is the soft back of the mug, not the face
  })
})

describe('card spread', () => {
  it('is exactly 6118 x 2161: white paper everywhere except the front, which carries the whole 5:7 picture', async () => {
    const pic = await picture(750, 1050), spread = await buildCardSpread(pic, 1)
    expect(await sharp(spread).metadata()).toMatchObject({ width: 6118, height: 2161 })
    const f = cardLayout().front, resized = await sharp(pic).resize(1500, 2100, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
    expect(await meanAbsDiff(await sharp(spread).extract({ left: f.x, top: f.y, width: f.w, height: f.h }).png().toBuffer(), resized)).toBeLessThan(0.5)
    for (const [x, y] of [[10, 10], [800, 1000], [1400, 2100], [3500, 1000], [4600, 1000], [6000, 2000]]) expect(await px(spread, x, y)).toEqual([255, 255, 255])       // rear, inner sheet, gutter
  })
  it('extends the front into the bleed with a mirror of its own edge, on the right, top and bottom only, never on the fold side', async () => {
    const pic = await picture(750, 1050), spread = await buildCardSpread(pic, 1), f = cardLayout().front
    expect((await px(spread, f.x + f.w + 5, 1000))[0]).toBeGreaterThan(245)                      // right bleed continues the picture's right edge (red high)
    expect((await px(spread, f.x + f.w + 28, 1000))[0]).toBeGreaterThan(240)
    expect(await px(spread, f.x + f.w + 30, 1000)).toEqual([255, 255, 255])                      // and stops at the bleed
    expect((await px(spread, f.x + 700, 5))[1]).toBeLessThan(40); expect((await px(spread, f.x + 700, 2150))[1]).toBeGreaterThan(215)       // top and bottom bleed mirror the top and bottom rows
    expect(await px(spread, f.x - 3, 1000)).toEqual([255, 255, 255])                             // the fold side is not extended
  })
  it('refuses a picture that is not 5:7 instead of squeezing it', async () => {
    await expect(buildCardSpread(await picture(900, 900), 1)).rejects.toThrow('card_picture_shape_mismatch')
    await expect(buildCardSpread(await picture(750, 1050 + 1), 1)).resolves.toBeTruthy()
  })
  it('the mockup input is the front picture at exactly 5:7', async () => {
    const m = await sharp(await mockupInputFor('card', await picture(843, 1180))).metadata()
    expect([m.width, m.height]).toEqual([750, 1050]); expect(m.width! / m.height!).toBe(5 / 7)
  })
})

describe('inspection regions are the picture only', () => {
  it('the QA region of a built mug is a panel and of a card is the trimmed front', async () => {
    const pic = await picture(600, 600)
    expect(await sharp(await mugQaRegion(await buildMugWrap(pic, 1))).metadata()).toMatchObject({ width: 910, height: 910 })
    expect(await sharp(await cardQaRegion(await buildCardSpread(await picture(750, 1050), 1))).metadata()).toMatchObject({ width: 1500, height: 2100 })
    expect(CARD.frontTrim.w / CARD.frontTrim.h).toBe(5 / 7)
  })
})
