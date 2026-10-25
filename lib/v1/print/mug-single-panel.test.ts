// The single-panel mug: one picture on one face, the reverse white, and the placement the backend reports is where the pixels really are (print file and the rolled preview view). Version 1 stays as it was.
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { buildMugSinglePanel, mockupInputFor } from './product-layout'
import { MUG_COMPOSITIONS, MUG_SINGLE_PANEL, MUG_SINGLE_PANEL_SHAPES, MUG_SINGLE_PANEL_V2, mugSinglePanelPlacement } from './production-profiles'

async function bbox(png: Buffer, below = 250) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const o = (y * info.width + x) * 3; if (below === 250 ? (data[o] < 250 || data[o + 1] < 250 || data[o + 2] < 250) : data[o + 1] < below) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) } }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
async function labFile(layout: string | null, w: number, h: number) {
  const { profileFor } = await import('./upscale/profiles')
  const picture = await sharp({ create: { width: w, height: h, channels: 3, background: '#a22' } }).png().toBuffer()
  const job: any = { id: 'j', finish: 'mug', size: '11oz', sku: 'GLOBAL-MUG-W', settings_snapshot: layout ? { layout } : null }, profile = profileFor(job), p = await profile.prepare({ job, source: picture, ppi: 300 })
  const f = await profile.finish({ job: { ...job, input_w: w, input_h: h, required_front_w: p.requiredFront.w, required_front_h: p.requiredFront.h }, image: picture, upscaled: false, targetMp: 8 } as any)
  return f.jpeg
}
describe('mug single panel', () => {
  it('the print job honours the layout frozen with it: v1 stays 910 / 900 x 600, v2 is the larger panel, nothing is reinterpreted', async () => {
    const box = async (b: Buffer) => bbox(b, 200)          // the picture is red: its edge is where green drops (JPEG ringing is ignored)
    const near = (a: { x: number; y: number; w: number; h: number }, e: { x: number; y: number; w: number; h: number }) => expect(a).toEqual(e)
    near(await box(await labFile(MUG_SINGLE_PANEL, 910, 910)), mugSinglePanelPlacement('square', MUG_SINGLE_PANEL).rectPx)
    near(await box(await labFile(MUG_SINGLE_PANEL, 900, 600)), mugSinglePanelPlacement('landscape', MUG_SINGLE_PANEL).rectPx)
    near(await box(await labFile(MUG_SINGLE_PANEL_V2, 1034, 1034)), mugSinglePanelPlacement('square', MUG_SINGLE_PANEL_V2).rectPx)
    near(await box(await labFile(MUG_SINGLE_PANEL_V2, 1122, 748)), mugSinglePanelPlacement('landscape', MUG_SINGLE_PANEL_V2).rectPx)
    expect((await box(await labFile(null, 910, 910))).x).toBeLessThan(700)          // no layout recorded: the original two-face file (the picture also on the back face)
  })
  it('version 2 is the approved coverage; version 1 keeps its original dimensions', () => {
    expect(mugSinglePanelPlacement('square', MUG_SINGLE_PANEL_V2).rectPx).toEqual({ x: 1552, y: 38, w: 1034, h: 1034 })
    expect(mugSinglePanelPlacement('landscape', MUG_SINGLE_PANEL_V2).rectPx).toEqual({ x: 1508, y: 181, w: 1122, h: 748 })
    expect(mugSinglePanelPlacement('square', MUG_SINGLE_PANEL).rectPx).toEqual({ x: 1614, y: 100, w: 910, h: 910 })
    expect(mugSinglePanelPlacement('landscape', MUG_SINGLE_PANEL).rectPx).toEqual({ x: 1619, y: 255, w: 900, h: 600 })
    expect(mugSinglePanelPlacement('square', MUG_SINGLE_PANEL).layoutVersion).toBe(1)
  })
  for (const layout of [MUG_SINGLE_PANEL, MUG_SINGLE_PANEL_V2]) for (const c of MUG_COMPOSITIONS) {
    it(`${layout} ${c}: reported placement equals the drawn pixels in the print file and in the preview view`, async () => {
      const s = MUG_SINGLE_PANEL_SHAPES[layout][c], pl = mugSinglePanelPlacement(c, layout)
      const picture = await sharp({ create: { width: s.w, height: s.h, channels: 3, background: '#a22' } }).png().toBuffer()
      expect(await bbox(await buildMugSinglePanel(picture, 1, layout))).toEqual(pl.rectPx)
      expect(await bbox(await mockupInputFor('mug', picture, { mugLayout: layout }))).toEqual(pl.viewRectPx)
      expect(pl.rectPx.x + pl.rectPx.w / 2).toBe(2069)
    })
  }
  it('a picture that is not a panel shape is refused, never squeezed', async () => {
    const wrong = await sharp({ create: { width: 700, height: 900, channels: 3, background: '#a22' } }).png().toBuffer()
    await expect(buildMugSinglePanel(wrong, 1)).rejects.toThrow('mug_picture_shape_mismatch')
  })
})
