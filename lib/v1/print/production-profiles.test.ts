// The production layouts for the mug and the card: geometry invariants, and agreement with what Prodigi's sandbox returned (the committed verification record).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { CARD, MUG, MUG_PANEL_ASPECT, CARD_FRONT_ASPECT, cardLayout, mugPanelRects, PRODUCTION_SPECS } from './production-profiles'

const record = JSON.parse(fs.readFileSync('docs/GOVERNANCE/prodigi-four-products-verified-2026-10-18.json', 'utf8'))

describe('mug wrap layout (GLOBAL-MUG-W)', () => {
  it('uses the file Prodigi returns and its template: 2670 x 1110, faces symmetric about the line opposite the handle', () => {
    expect(record.products['GLOBAL-MUG-W'].printAreaForChosenAttributes).toEqual(MUG.wrap)
    const [a, b] = MUG.faceCentersX
    expect(Math.abs((MUG.oppositeHandleX - a) - (b - MUG.oppositeHandleX))).toBeLessThanOrEqual(3)   // 736.5 and 734.5: Prodigi's own guide lines differ by 2 px
    expect(MUG.oppositeHandleX).toBe(MUG.wrap.w / 2 - 0.5)
    expect(MUG.seamX).toEqual([0, MUG.wrap.w])
  })
  it('puts a whole square panel on each face, centred on the face, clear of the seam and of each other, with a margin above and below', () => {
    const [p1, p2] = mugPanelRects()
    for (const [p, c] of [[p1, MUG.faceCentersX[0]], [p2, MUG.faceCentersX[1]]] as const) {
      expect(p.x + p.w / 2).toBeCloseTo(c, 0); expect(p.w).toBe(p.h); expect(p.x).toBeGreaterThan(100); expect(p.x + p.w).toBeLessThan(MUG.wrap.w - 100)
      expect(p.y).toBe(MUG.panelTop); expect(p.y + p.h).toBeLessThanOrEqual(MUG.wrap.h - MUG.panelTop)
    }
    expect(p2.x - (p1.x + p1.w)).toBeGreaterThan(300)                                              // the back of the mug stays wash
    expect(MUG_PANEL_ASPECT).toBe(1)
  })
  it('scales exactly: at 1/2 the wrap keeps the 2670:1110 ratio to the pixel', () => {
    expect(MUG.wrap.w * MUG.mockupScale / (MUG.wrap.h * MUG.mockupScale)).toBe(MUG.wrap.w / MUG.wrap.h)
    expect(Number.isInteger(MUG.wrap.w * MUG.mockupScale) && Number.isInteger(MUG.wrap.h * MUG.mockupScale)).toBe(true)
  })
})

describe('greeting card layout (GLOBAL-GRE-MOH-7X5-BLA)', () => {
  it('uses the file Prodigi returns; the template is one pixel narrower', () => {
    expect(record.products['GLOBAL-GRE-MOH-7X5-BLA'].printAreaForChosenAttributes).toEqual(CARD.spread)
    expect(CARD.spread).toEqual({ w: 6118, h: 2161 })
  })
  it('two 10 x 7 in sheets (outer, inner) fit the file, each a pair of 5 x 7 in panels either side of a centred fold', () => {
    for (const s of [CARD.outerSheetTrim, CARD.innerSheetTrim]) { expect(s.w).toBe(3000); expect(s.h).toBe(2100); expect(s.x + s.w).toBeLessThanOrEqual(CARD.spread.w); expect(s.y + s.h).toBeLessThanOrEqual(CARD.spread.h) }
    expect(CARD.outerSheetTrim.x + CARD.outerSheetTrim.w).toBeLessThan(CARD.innerSheetTrim.x)
    expect(CARD.foldX.outer).toBe(CARD.outerSheetTrim.x + 1500); expect(CARD.foldX.inner).toBe(CARD.innerSheetTrim.x + 1500)
  })
  it('the front is the right half of the outer sheet, exactly 5:7, with the bleed Prodigi\'s template shows: right, top and bottom add up to the file height', () => {
    expect(CARD.frontTrim).toEqual({ x: CARD.foldX.outer, y: 30, w: 1500, h: 2100 }); expect(CARD_FRONT_ASPECT).toBe(5 / 7)
    expect(CARD.frontTrim.x + CARD.frontTrim.w).toBe(CARD.outerSheetTrim.x + CARD.outerSheetTrim.w)
    expect(CARD.bleed.top + CARD.frontTrim.h + CARD.bleed.bottom).toBe(CARD.spread.h)
    const L = cardLayout(); expect(L.frontWithBleed).toEqual({ x: 1529, y: 0, w: 1529, h: 2161 })
    expect(L.frontWithBleed.x + L.frontWithBleed.w).toBeLessThan(CARD.innerSheetTrim.x)         // the bleed does not reach the inner sheet
  })
  it('the safe area is the trim less 36 px on every side, beside the fold too', () => {
    const { front, safe } = cardLayout()
    expect(safe).toEqual({ x: front.x + 36, y: front.y + 36, w: front.w - 72, h: front.h - 72 })
  })
  it('scales to half size without leaving the file', () => {
    const h = cardLayout(0.5); expect(h.front.w).toBe(750); expect(h.front.h).toBe(1050); expect(h.frontWithBleed.y + h.frontWithBleed.h).toBeLessThanOrEqual(Math.round(CARD.spread.h * 0.5))
  })
})

describe('the specification that travels with the catalog never invents a number', () => {
  it('every family lists what is unverified, and says where each fact came from', () => {
    for (const f of ['matted', 'framed_canvas', 'mug', 'card'] as const) {
      const s = PRODUCTION_SPECS[f]; expect(s.unverified.length).toBeGreaterThan(0); expect(JSON.stringify(s.verified)).toMatch(/prodigi/)
    }
    expect(PRODUCTION_SPECS.mug.unverified.join(' ')).toMatch(/top and bottom/); expect(PRODUCTION_SPECS.framed_canvas.unverified.join(' ')).toMatch(/8x12/)
  })
})
