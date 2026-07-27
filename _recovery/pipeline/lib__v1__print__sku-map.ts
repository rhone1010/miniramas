// lib/v1/print/sku-map.ts
//
// Maps Liten & Co customer-facing print sizes to Prodigi SKUs.
// Unframed: Enhanced Matte Art Paper (EMA), 200gsm Giclée — SKU prefix GLOBAL-FAP
// Framed:   Classic Framed Print, Mounted (CFPM) — frame size > image size by 2" mount
//
// IMPORTANT — Framed sizing gotcha:
//   Prodigi frame SKUs are named by the GLAZE size, not the image size. A frame with
//   a 2" mount holds an image 4" smaller in each dimension. So:
//     GLOBAL-CFPM-16X20  =  16×20 frame holding a 12×16 image (mount = 2" on each side)
//   When a customer chooses "12×16 framed" they expect a 12×16 *image* inside a frame —
//   which is why we ship GLOBAL-CFPM-16X20, not GLOBAL-CFPM-12X16.

export type PrintSize   = '8x10' | '12x16' | '18x24'
export type PrintFinish = 'unframed' | 'framed'

export interface SkuEntry {
  sku:           string
  description:   string

  /** Customer-facing image dimensions in inches. */
  imageWidthIn:  number
  imageHeightIn: number

  /** 300 DPI source-file requirements. Upscaler must produce at least this. */
  requiredPx:    { w: number; h: number }

  /**
   * Default sizing parameter for /Orders.
   * - fitPrintArea:  letterboxes; preserves entire image (correct for Liten plinths)
   * - fillPrintArea: crops edges; fills frame (correct for centered subjects)
   */
  defaultSizing: 'fillPrintArea' | 'fitPrintArea'

  /** Locked retail price in USD cents. */
  retailCents:   number
}

export const SKU_MAP: Record<PrintFinish, Partial<Record<PrintSize, SkuEntry>>> = {
  unframed: {
    '8x10': {
      sku:           'GLOBAL-FAP-8X10',
      description:   'Enhanced Matte Art, 200gsm, 8×10"',
      imageWidthIn:  8,
      imageHeightIn: 10,
      requiredPx:    { w: 2400, h: 3000 },
      defaultSizing: 'fitPrintArea',
      retailCents:   2800,
    },
    '12x16': {
      sku:           'GLOBAL-FAP-12X16',
      description:   'Enhanced Matte Art, 200gsm, 12×16"',
      imageWidthIn:  12,
      imageHeightIn: 16,
      requiredPx:    { w: 3600, h: 4800 },
      defaultSizing: 'fitPrintArea',
      retailCents:   4800,
    },
    '18x24': {
      sku:           'GLOBAL-FAP-18X24',
      description:   'Enhanced Matte Art, 200gsm, 18×24"',
      imageWidthIn:  18,
      imageHeightIn: 24,
      requiredPx:    { w: 5400, h: 7200 },
      defaultSizing: 'fitPrintArea',
      retailCents:   6800,
    },
  },
  framed: {
    '12x16': {
      // 16×20 frame, 2" mount, holds 12×16 image — see header note.
      // CFPM = Classic Frame, Print, Mounted. EMA paper + perspex glaze.
      sku:           'GLOBAL-CFPM-16X20',
      description:   'Classic frame + mount, 16×20" outer / 12×16" image',
      imageWidthIn:  12,
      imageHeightIn: 16,
      requiredPx:    { w: 3600, h: 4800 },
      defaultSizing: 'fitPrintArea',
      retailCents:   11800,
    },
  },
}

/**
 * Look up an SKU entry. Throws if size + finish combo isn't mapped —
 * callers should validate input from the cart UI first.
 */
export function getSku(size: PrintSize, finish: PrintFinish): SkuEntry {
  const entry = SKU_MAP[finish]?.[size]
  if (!entry) {
    throw new Error(`No SKU mapped for size=${size} finish=${finish}`)
  }
  return entry
}

/**
 * Smallest, cheapest valid SKU — used by the smoke-test script.
 * Validate this first before trusting the others.
 */
export const TEST_SKU = SKU_MAP.unframed['8x10']!.sku
