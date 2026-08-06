// lib/v1/print/sku-map.ts
//
// Maps Liten & Co print options to Prodigi SKUs.
//
// CUI V25 · 2026-08-03 · squares, six families, every SKU verified.
//
//   WHY THIS WAS REWRITTEN
//     The old map sold 8×10, 12×16 and 18×24. Portraits renders 1:1, so
//     every one of those would have letterboxed or cropped the customer's
//     face to fit a rectangle. Ruled: squares only for V1.
//
//   EVERY SKU HERE WAS CONFIRMED AGAINST PRODIGI
//     scripts/validate-prodigi-skus.js asked GET /v4.0/Products/{sku} for
//     all twenty-four on 2026-08-03. All twenty-four exist. The dimensions
//     and requiredPx below are what Prodigi returned, not what we assumed.
//     Re-run it if a family is added; a SKU that does not exist fails at
//     the quote, which a customer sees as a shipping error on the screen
//     where they were about to pay.
//
//   WHOLESALE, FOR CONTEXT — from Prodigi's own US price sheets, same date:
//     Fine Art      $8  $13  $14  $16
//     Premium       $9  $12  $18  $23
//     Canvas       $20  $24  $32  $42
//     Framed Canvas $30  $40  $52  $70
//     Classic Frame $35  $38  $46  $52
//     Matted Frame  $38  $44  $50  $60
//
//   TWO THINGS THAT SHAPE THE PRICES
//     Paper ships Budget at $6.85 with $0.00 for every additional print.
//     Anything stretched or framed ships at $24.80 with $11 per extra
//     piece. A second paper print costs us nothing to send; a second
//     canvas costs eleven dollars.
//
//     Premium costs LESS than Fine Art at 12×12 and more everywhere else.
//     It is still priced above Fine Art throughout, because the customer is
//     buying the better paper and not our cost sheet.
//
//   THE MATTED FRAME, READ THIS BEFORE CHANGING IT
//     Prodigi names CFPM by the FRAME, and the picture inside is smaller.
//     Confirmed by the print area each one wants:
//       CFPM-8X8   wants 1800px → a  6″ image in an  8″ frame
//       CFPM-12X12 wants 2700px → a  9″ image in a 12″ frame
//       CFPM-16X16 wants 3600px → a 12″ image in a 16″ frame
//       CFPM-20X20 wants 4800px → a 16″ image in a 20″ frame
//     So `label` says both numbers. A customer choosing "12 × 12″" must not
//     receive a nine-inch picture without having been told.
//
//   NOTHING HERE IS BIG ENOUGH FROM A 2K RENDER
//     The smallest print wants 1800px and a craft is 2048². Every other
//     size wants more. The upscaler in the print webhook is not an
//     optimisation — no order can be fulfilled at the stated quality
//     without it.

export type PrintSize = '8x8' | '12x12' | '16x16' | '20x20'

export type PrintFinish =
  | 'fine_art'
  | 'premium'
  | 'canvas'
  | 'framed_canvas'
  | 'framed'
  | 'matted'

export interface SkuEntry {
  sku:         string
  description: string

  /** Which shelf this sits on in the Print Shop, and how it is introduced. */
  family:      PrintFinish
  familyLabel: string
  familyNote:  string

  /** What the customer sees for this size. */
  label:       string

  /** The printed picture, in inches. NOT the frame — see the note above. */
  imageWidthIn:  number
  imageHeightIn: number

  /** What Prodigi's print area asks for, at their recommended DPI. */
  requiredPx:  { w: number; h: number }

  /**
   * Sizing for /Orders.
   *   fitPrintArea  — preserves the whole image, letterboxing if it must
   *   fillPrintArea — fills the area, cropping the edges
   * Both behave identically here: a 1:1 craft into a 1:1 print has nothing
   * to letterbox and nothing to crop. fit is kept because it is the safe
   * one if a non-square source ever reaches this path.
   */
  defaultSizing: 'fillPrintArea' | 'fitPrintArea'

  /** Locked retail, USD cents. */
  retailCents: number
}

const FAMILY_LABEL: Record<PrintFinish, string> = {
  fine_art:      'Fine Art Print',
  premium:       'Premium Fine Art',
  canvas:        'Gallery Canvas',
  framed_canvas: 'Framed Canvas',
  framed:        'Classic Frame',
  matted:        'Matted Frame',
}

const FAMILY_NOTE: Record<PrintFinish, string> = {
  fine_art:      'Enhanced matte art paper, 200gsm',
  premium:       'Heavyweight fine art paper, museum grade',
  canvas:        'Stretched canvas, ready to hang',
  framed_canvas: 'Stretched canvas in a solid frame',
  framed:        'Framed behind glaze, ready to hang',
  matted:        'Framed with a mount, behind glaze',
}

export const SKU_MAP: Record<PrintFinish, Partial<Record<PrintSize, SkuEntry>>> = {
  fine_art: {
    '8x8': {
      sku: 'GLOBAL-FAP-8X8',
      description: 'Enhanced Matte Art, 200gsm, 8×8"',
      family: 'fine_art', familyLabel: FAMILY_LABEL.fine_art, familyNote: FAMILY_NOTE.fine_art,
      label: '8 × 8″',
      imageWidthIn: 8, imageHeightIn: 8,
      requiredPx: { w: 2400, h: 2400 },
      defaultSizing: 'fitPrintArea',
      retailCents: 2900,
    },
    '12x12': {
      sku: 'GLOBAL-FAP-12X12',
      description: 'Enhanced Matte Art, 200gsm, 12×12"',
      family: 'fine_art', familyLabel: FAMILY_LABEL.fine_art, familyNote: FAMILY_NOTE.fine_art,
      label: '12 × 12″',
      imageWidthIn: 12, imageHeightIn: 12,
      requiredPx: { w: 3600, h: 3600 },
      defaultSizing: 'fitPrintArea',
      retailCents: 4400,
    },
    '16x16': {
      sku: 'GLOBAL-FAP-16X16',
      description: 'Enhanced Matte Art, 200gsm, 16×16"',
      family: 'fine_art', familyLabel: FAMILY_LABEL.fine_art, familyNote: FAMILY_NOTE.fine_art,
      label: '16 × 16″',
      imageWidthIn: 16, imageHeightIn: 16,
      requiredPx: { w: 4800, h: 4800 },
      defaultSizing: 'fitPrintArea',
      retailCents: 5400,
    },
    '20x20': {
      sku: 'GLOBAL-FAP-20X20',
      description: 'Enhanced Matte Art, 200gsm, 20×20"',
      family: 'fine_art', familyLabel: FAMILY_LABEL.fine_art, familyNote: FAMILY_NOTE.fine_art,
      label: '20 × 20″',
      imageWidthIn: 20, imageHeightIn: 20,
      requiredPx: { w: 6000, h: 6000 },
      defaultSizing: 'fitPrintArea',
      retailCents: 6400,
    },
  },

  premium: {
    '8x8': {
      sku: 'GLOBAL-HPR-8X8',
      description: 'Heavyweight fine art paper, 8×8"',
      family: 'premium', familyLabel: FAMILY_LABEL.premium, familyNote: FAMILY_NOTE.premium,
      label: '8 × 8″',
      imageWidthIn: 8, imageHeightIn: 8,
      requiredPx: { w: 2400, h: 2400 },
      defaultSizing: 'fitPrintArea',
      retailCents: 3900,
    },
    '12x12': {
      sku: 'GLOBAL-HPR-12X12',
      description: 'Heavyweight fine art paper, 12×12"',
      family: 'premium', familyLabel: FAMILY_LABEL.premium, familyNote: FAMILY_NOTE.premium,
      label: '12 × 12″',
      imageWidthIn: 12, imageHeightIn: 12,
      requiredPx: { w: 3600, h: 3600 },
      defaultSizing: 'fitPrintArea',
      retailCents: 5400,
    },
    '16x16': {
      sku: 'GLOBAL-HPR-16X16',
      description: 'Heavyweight fine art paper, 16×16"',
      family: 'premium', familyLabel: FAMILY_LABEL.premium, familyNote: FAMILY_NOTE.premium,
      label: '16 × 16″',
      imageWidthIn: 16, imageHeightIn: 16,
      requiredPx: { w: 4800, h: 4800 },
      defaultSizing: 'fitPrintArea',
      retailCents: 6900,
    },
    '20x20': {
      sku: 'GLOBAL-HPR-20X20',
      description: 'Heavyweight fine art paper, 20×20"',
      family: 'premium', familyLabel: FAMILY_LABEL.premium, familyNote: FAMILY_NOTE.premium,
      label: '20 × 20″',
      imageWidthIn: 20, imageHeightIn: 20,
      requiredPx: { w: 6000, h: 6000 },
      defaultSizing: 'fitPrintArea',
      retailCents: 8400,
    },
  },

  canvas: {
    '8x8': {
      sku: 'GLOBAL-CAN-8X8',
      description: 'Stretched canvas, 8×8"',
      family: 'canvas', familyLabel: FAMILY_LABEL.canvas, familyNote: FAMILY_NOTE.canvas,
      label: '8 × 8″',
      imageWidthIn: 8, imageHeightIn: 8,
      requiredPx: { w: 2454, h: 2454 },
      defaultSizing: 'fitPrintArea',
      retailCents: 5900,
    },
    '12x12': {
      sku: 'GLOBAL-CAN-12X12',
      description: 'Stretched canvas, 12×12"',
      family: 'canvas', familyLabel: FAMILY_LABEL.canvas, familyNote: FAMILY_NOTE.canvas,
      label: '12 × 12″',
      imageWidthIn: 12, imageHeightIn: 12,
      requiredPx: { w: 3654, h: 3654 },
      defaultSizing: 'fitPrintArea',
      retailCents: 6900,
    },
    '16x16': {
      sku: 'GLOBAL-CAN-16X16',
      description: 'Stretched canvas, 16×16"',
      family: 'canvas', familyLabel: FAMILY_LABEL.canvas, familyNote: FAMILY_NOTE.canvas,
      label: '16 × 16″',
      imageWidthIn: 16, imageHeightIn: 16,
      requiredPx: { w: 4854, h: 4854 },
      defaultSizing: 'fitPrintArea',
      retailCents: 8900,
    },
    '20x20': {
      sku: 'GLOBAL-CAN-20X20',
      description: 'Stretched canvas, 20×20"',
      family: 'canvas', familyLabel: FAMILY_LABEL.canvas, familyNote: FAMILY_NOTE.canvas,
      label: '20 × 20″',
      imageWidthIn: 20, imageHeightIn: 20,
      requiredPx: { w: 6054, h: 6054 },
      defaultSizing: 'fitPrintArea',
      retailCents: 11900,
    },
  },

  framed_canvas: {
    '8x8': {
      sku: 'GLOBAL-FRA-CAN-8X8',
      description: 'Framed stretched canvas, 8×8"',
      family: 'framed_canvas', familyLabel: FAMILY_LABEL.framed_canvas, familyNote: FAMILY_NOTE.framed_canvas,
      label: '8 × 8″',
      imageWidthIn: 8, imageHeightIn: 8,
      requiredPx: { w: 2454, h: 2454 },
      defaultSizing: 'fitPrintArea',
      retailCents: 7900,
    },
    '12x12': {
      sku: 'GLOBAL-FRA-CAN-12X12',
      description: 'Framed stretched canvas, 12×12"',
      family: 'framed_canvas', familyLabel: FAMILY_LABEL.framed_canvas, familyNote: FAMILY_NOTE.framed_canvas,
      label: '12 × 12″',
      imageWidthIn: 12, imageHeightIn: 12,
      requiredPx: { w: 3654, h: 3654 },
      defaultSizing: 'fitPrintArea',
      retailCents: 9900,
    },
    '16x16': {
      sku: 'GLOBAL-FRA-CAN-16X16',
      description: 'Framed stretched canvas, 16×16"',
      family: 'framed_canvas', familyLabel: FAMILY_LABEL.framed_canvas, familyNote: FAMILY_NOTE.framed_canvas,
      label: '16 × 16″',
      imageWidthIn: 16, imageHeightIn: 16,
      requiredPx: { w: 4854, h: 4854 },
      defaultSizing: 'fitPrintArea',
      retailCents: 12900,
    },
    '20x20': {
      sku: 'GLOBAL-FRA-CAN-20X20',
      description: 'Framed stretched canvas, 20×20"',
      family: 'framed_canvas', familyLabel: FAMILY_LABEL.framed_canvas, familyNote: FAMILY_NOTE.framed_canvas,
      label: '20 × 20″',
      imageWidthIn: 20, imageHeightIn: 20,
      requiredPx: { w: 6054, h: 6054 },
      defaultSizing: 'fitPrintArea',
      retailCents: 16900,
    },
  },

  framed: {
    '8x8': {
      sku: 'GLOBAL-CFP-8X8',
      description: 'Classic frame, EMA 200gsm, perspex glaze, 8×8"',
      family: 'framed', familyLabel: FAMILY_LABEL.framed, familyNote: FAMILY_NOTE.framed,
      label: '8 × 8″',
      imageWidthIn: 8, imageHeightIn: 8,
      requiredPx: { w: 2400, h: 2400 },
      defaultSizing: 'fitPrintArea',
      retailCents: 8900,
    },
    '12x12': {
      sku: 'GLOBAL-CFP-12X12',
      description: 'Classic frame, EMA 200gsm, perspex glaze, 12×12"',
      family: 'framed', familyLabel: FAMILY_LABEL.framed, familyNote: FAMILY_NOTE.framed,
      label: '12 × 12″',
      imageWidthIn: 12, imageHeightIn: 12,
      requiredPx: { w: 3600, h: 3600 },
      defaultSizing: 'fitPrintArea',
      retailCents: 9900,
    },
    '16x16': {
      sku: 'GLOBAL-CFP-16X16',
      description: 'Classic frame, EMA 200gsm, perspex glaze, 16×16"',
      family: 'framed', familyLabel: FAMILY_LABEL.framed, familyNote: FAMILY_NOTE.framed,
      label: '16 × 16″',
      imageWidthIn: 16, imageHeightIn: 16,
      requiredPx: { w: 4800, h: 4800 },
      defaultSizing: 'fitPrintArea',
      retailCents: 11900,
    },
    '20x20': {
      sku: 'GLOBAL-CFP-20X20',
      description: 'Classic frame, EMA 200gsm, perspex glaze, 20×20"',
      family: 'framed', familyLabel: FAMILY_LABEL.framed, familyNote: FAMILY_NOTE.framed,
      label: '20 × 20″',
      imageWidthIn: 20, imageHeightIn: 20,
      requiredPx: { w: 6000, h: 6000 },
      defaultSizing: 'fitPrintArea',
      retailCents: 13900,
    },
  },

  // The frame size is the SKU size; the picture inside is smaller. Both
  // numbers are in the label because a customer choosing "12 × 12″" would
  // otherwise receive a nine-inch picture and be right to complain.
  matted: {
    '8x8': {
      sku: 'GLOBAL-CFPM-8X8',
      description: 'Classic frame with mount, perspex glaze, 8×8" frame',
      family: 'matted', familyLabel: FAMILY_LABEL.matted, familyNote: FAMILY_NOTE.matted,
      label: '8 × 8″ frame · 6 × 6″ picture',
      imageWidthIn: 6, imageHeightIn: 6,
      requiredPx: { w: 1800, h: 1800 },
      defaultSizing: 'fitPrintArea',
      retailCents: 9400,
    },
    '12x12': {
      sku: 'GLOBAL-CFPM-12X12',
      description: 'Classic frame with mount, perspex glaze, 12×12" frame',
      family: 'matted', familyLabel: FAMILY_LABEL.matted, familyNote: FAMILY_NOTE.matted,
      label: '12 × 12″ frame · 9 × 9″ picture',
      imageWidthIn: 9, imageHeightIn: 9,
      requiredPx: { w: 2700, h: 2700 },
      defaultSizing: 'fitPrintArea',
      retailCents: 10900,
    },
    '16x16': {
      sku: 'GLOBAL-CFPM-16X16',
      description: 'Classic frame with mount, perspex glaze, 16×16" frame',
      family: 'matted', familyLabel: FAMILY_LABEL.matted, familyNote: FAMILY_NOTE.matted,
      label: '16 × 16″ frame · 12 × 12″ picture',
      imageWidthIn: 12, imageHeightIn: 12,
      requiredPx: { w: 3600, h: 3600 },
      defaultSizing: 'fitPrintArea',
      retailCents: 12900,
    },
    '20x20': {
      sku: 'GLOBAL-CFPM-20X20',
      description: 'Classic frame with mount, perspex glaze, 20×20" frame',
      family: 'matted', familyLabel: FAMILY_LABEL.matted, familyNote: FAMILY_NOTE.matted,
      label: '20 × 20″ frame · 16 × 16″ picture',
      imageWidthIn: 16, imageHeightIn: 16,
      requiredPx: { w: 4800, h: 4800 },
      defaultSizing: 'fitPrintArea',
      retailCents: 14900,
    },
  },
}

/**
 * Look up an entry. Throws when the combination is not sold — callers
 * validate against the map before offering anything, so reaching this is a
 * bug rather than a customer error.
 */
export function getSku(size: PrintSize, finish: PrintFinish): SkuEntry {
  const entry = SKU_MAP[finish]?.[size]
  if (!entry) {
    throw new Error(`No SKU mapped for size=${size} finish=${finish}`)
  }
  return entry
}

/** Every entry, flat. For the Print Shop build and the smoke tests. */
export function allSkus(): SkuEntry[] {
  return (Object.keys(SKU_MAP) as PrintFinish[])
    .flatMap((f) => Object.values(SKU_MAP[f]) as SkuEntry[])
}

/** The largest print area any size in a family needs — what the upscaler
 *  has to reach before Prodigi will accept the asset at stated quality. */
export function maxRequiredPx(): number {
  return allSkus().reduce((m, s) => Math.max(m, s.requiredPx.w, s.requiredPx.h), 0)
}

/** Smallest, cheapest valid SKU — used by the smoke-test script. */
export const TEST_SKU = SKU_MAP.fine_art['8x8']!.sku
