// The single-panel mug: one picture on one face, the reverse white, and the placement the backend reports is where the pixels really are (print file and the rolled preview view).
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { buildMugSinglePanel, mockupInputFor } from './product-layout'
import { MUG_PANEL_SHAPES, MUG_COMPOSITIONS, mugSinglePanelPlacement } from './production-profiles'

async function bbox(png: Buffer) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const o = (y * info.width + x) * 3; if (data[o] < 250 || data[o + 1] < 250 || data[o + 2] < 250) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) } }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
describe('mug single panel', () => {
  for (const c of MUG_COMPOSITIONS) {
    it(`${c}: reported placement equals the drawn pixels in the print file and in the preview view`, async () => {
      const s = MUG_PANEL_SHAPES[c], pl = mugSinglePanelPlacement(c)
      const picture = await sharp({ create: { width: s.w, height: s.h, channels: 3, background: '#a22' } }).png().toBuffer()
      expect(await bbox(await buildMugSinglePanel(picture, 1))).toEqual(pl.rectPx)
      expect(await bbox(await mockupInputFor('mug', picture, { mugLayout: 'mug_single_panel' }))).toEqual(pl.viewRectPx)
      expect(pl.rectPx.x + pl.rectPx.w / 2).toBe(2069)
    })
  }
  it('a picture that is not a panel shape is refused, never squeezed', async () => {
    const wrong = await sharp({ create: { width: 700, height: 900, channels: 3, background: '#a22' } }).png().toBuffer()
    await expect(buildMugSinglePanel(wrong, 1)).rejects.toThrow('mug_picture_shape_mismatch')
  })
})
