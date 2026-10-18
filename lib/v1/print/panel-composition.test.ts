// preparePanelComposition: the picture becomes the panel's exact shape by extension (outpaint inside the bound, or reflection), never by cropping or distortion.
import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'

const outpaint = vi.hoisted(() => vi.fn())
vi.mock('../shared/outpaint', () => ({ outpaint }))
import { preparePanelComposition } from './asset-pipeline'
import { composeWithPrintShop } from '../gift/compose'

async function solid(w: number, h: number, color: string) { return sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer() }

describe('preparePanelComposition', () => {
  it('a picture inside 2% is reflected to the exact shape: no paid call, original pixels untouched', async () => {
    outpaint.mockReset()
    const c = await preparePanelComposition({ imageB64: (await solid(600, 610, '#c33')).toString('base64'), panel: { w: 910, h: 910 } })
    expect(outpaint).not.toHaveBeenCalled(); expect(c.width).toBe(c.height); expect(c.fit).toBe('resample'); expect(c.outpainted).toBe(false)
  })
  it('a 2:3 portrait for the card front (about 7% off) goes through the outpaint with only the missing sides, and the original is composited back untouched', async () => {
    outpaint.mockReset()
    outpaint.mockImplementation(async (i: any) => ({ outpainted: true, image: await sharp({ create: { width: i.width + i.padding.left + i.padding.right, height: i.height + i.padding.up + i.padding.down, channels: 3, background: '#3a3' } }).jpeg().toBuffer() }))
    const src = await solid(800, 1200, '#c33'), c = await preparePanelComposition({ imageB64: src.toString('base64'), panel: { w: 1500, h: 2100 } })
    expect(outpaint).toHaveBeenCalledTimes(1); const call = outpaint.mock.calls[0][0]
    expect(call.padding.up + call.padding.down).toBeLessThanOrEqual(4); expect(call.padding.left + call.padding.right).toBeGreaterThan(50)       // 800 x 1200 is too NARROW for 5:7: the width is added (the 4 px of height is the whole-unit rounding of the 5:7 grid)
    expect(c.outpainted).toBe(true); expect(c.fit).toBe('extend'); expect(c.width / c.height).toBeCloseTo(5 / 7, 3)
    const mid = await sharp(c.working).extract({ left: Math.floor(c.width / 2), top: 600, width: 1, height: 1 }).removeAlpha().raw().toBuffer(); expect([...mid]).toEqual([0xcc, 0x33, 0x33])      // the picture itself is in the middle
  })
  it('a picture too far from the panel (a 2:3 portrait for the square mug panel) is refused, not squeezed or cropped', async () => {
    await expect(preparePanelComposition({ imageB64: (await solid(400, 900, '#333')).toString('base64'), panel: { w: 910, h: 910 } })).rejects.toThrow('incompatible_print_aspect')
  })
  it('reports the upscale still needed against the PANEL at the requested ppi', async () => {
    const c = await preparePanelComposition({ imageB64: (await solid(750, 1050, '#333')).toString('base64'), panel: { w: 1500, h: 2100 } })
    expect(c.requiredFront).toEqual({ w: 1500, h: 2100 }); expect(c.scale).toBeGreaterThan(1)
    expect((await preparePanelComposition({ imageB64: (await solid(1500, 2100, '#333')).toString('base64'), panel: { w: 1500, h: 2100 } })).scale).toBe(0)
  })
})

describe('the Gift composition step for the two panel products', () => {
  it('composes the mug to the 1:1 panel and the card to the 5:7 front; flat products still go to the Print Shop step', async () => {
    outpaint.mockReset()
    const sq = (await solid(1024, 1024, '#369')).toString('base64')
    const mug = await composeWithPrintShop({ masterB64: sq, size: '11oz', finish: 'mug' })
    expect(mug).toMatchObject({ width: 1024, height: 1024, fit: 'exact', outpainted: false })
    const card = await composeWithPrintShop({ masterB64: (await solid(1050, 1470, '#369')).toString('base64'), size: '7x5', finish: 'card' })
    expect(card.width / card.height).toBeCloseTo(5 / 7, 4); expect(card.fit).toBe('exact')
    const flat = await composeWithPrintShop({ masterB64: (await solid(1200, 1800, '#369')).toString('base64'), size: '12x18', finish: 'framed_canvas' })
    expect(flat).toMatchObject({ width: 1200, height: 1800 })
  })
})
