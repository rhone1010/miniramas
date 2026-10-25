// lib/v1/print/production-profiles.ts
//
// PRODUCTION LAYOUTS for the Gift Shop products whose lab file is not simply "the picture": the 11 oz mug (a 360-degree wrap) and the 7 x 5 greeting
// card (a flat spread of two sheets). Pure data and rectangle arithmetic, no I/O, so Codex can copy this file and the tests need no database.
//
// Every number carries its SOURCE:
//   prodigi_api       Prodigi sandbox Products API (variant printAreaSizes) and Quotes, 2026-10-18
//   prodigi_template  Prodigi's own downloadable artwork templates, measured pixel-for-pixel (prodigi-11oz-mug.png, prodigi-greetings-card-portrait-7x5.psd)
//   liten_policy      a LITEN composition decision. NOT a Prodigi specification; changing one changes the artwork, never the Prodigi contract.
// Anything Prodigi does not publish is listed under `unverified` and is never turned into a number here.
//
// THE RULE THAT RESOLVES "CROP OR EXTEND": Prodigi's default sizing crops the picture to the print area (fillPrintArea). We never crop and never
// distort. The customer's reviewed picture is placed whole, at its own proportions, inside a PANEL; everything outside the panel is deterministic
// background (a blurred wash of the picture for the mug, white paper for the card) or bleed extension (a mirror of the picture's own edge, outside the trim).

export type SpecSource = 'prodigi_api' | 'prodigi_template' | 'liten_policy'
export interface Rect { x: number; y: number; w: number; h: number }

// ─────────────────────────────────────────────── 11 oz MUG (GLOBAL-MUG-W) ───────────────────────────────────────────────
export const MUG = {
  sku: 'GLOBAL-MUG-W',
  /** The whole lab file: a full wrap, 22.86 x 9.483 cm at 300 dpi. (prodigi_api, prodigi_template) */
  wrap: { w: 2670, h: 1110 },
  /** The file's left and right EDGES meet at the handle: x = 0 and x = 2670 are the seam. (prodigi_template: "Opposite handle" is the centre line) */
  seamX: [0, 2670] as const,
  /** The line opposite the handle, in the middle of the file. (prodigi_template, measured 1334-1335) */
  oppositeHandleX: 1334.5,
  /**
   * The middle of each of the two faces. (prodigi_template, measured 597-599 and 2068-2070.) With the handle on the RIGHT the face a viewer sees is the
   * one at x = 2069; with the handle on the LEFT it is the one at x = 598. The artwork is placed on BOTH, so it faces out for either hand.
   */
  faceCentersX: [598, 2069] as const,
  /** The panel the reviewed picture occupies on each face: square, whole, never cropped. (liten_policy) */
  panel: { w: 910, h: 910 },
  /** Distance from the top of the file to the top of the panel. (liten_policy: a conservative margin, because top/bottom coverage is unverified for this SKU) */
  panelTop: 100,
  /**
   * THE FULL-WRAP COMPOSITION (2026-10-24, the product-first mug): ONE picture across the whole wrap, no panel, no repetition, no mirror, no wash.
   *   printable     the part of the lab file that carries picture: the full width, inside an unprinted band of about 1/8 inch (0.125 in x 300 dpi = 37.5 px, 38 px) at the rim and at the base.
   *                 (liten_policy: the owner's request. It sits INSIDE Prodigi's printable area, 2670 x 1110 (prodigi_api), so it never asks for more than the lab prints; the mug is white
   *                 ceramic, so a white band is "unprinted". Prodigi guarantees top-to-bottom coverage only for H-MUG-W; the band is the margin that makes that question not matter.)
   *   subjectX      where the picture's centre (its subjects) lands in the FILE: the middle of the face a right-handed mug shows (prodigi_template, 2069). The picture is rolled by `rollPx`
   *                 (a circle: the part that would pass the right edge continues at the left edge), so nothing is cut, mirrored or invented.
   *   The picture's own two edges meet at x = rollPx (behind the mug for a right-handed viewer, 180 degrees from the visible face). The handle seam stays at the file's edges, as Prodigi's template requires.
   */
  fullWrap: { unprintedMarginIn: 0.125, marginPx: 38, printable: { x: 0, y: 38, w: 2670, h: 1034 }, subjectX: 2069, rollPx: 734 },
  /** The scale a mockup wrap is built at. 1/2 keeps 2670:1110 exact (1335 x 555). */
  mockupScale: 0.5,
  /** The mockup template shows the mug with the handle on the RIGHT, so the face it shows is the one at x = 2069. The wrap is rolled so that face is in the middle of the file (where the cylindrical mapping looks). */
  mockupFaceCenterX: 2069,
  unverified: [
    'Whether the lab leaves an unprinted band at the top and bottom of GLOBAL-MUG-W: Prodigi\'s product page says top-to-bottom coverage is guaranteed only for H-MUG-W (UK lab); GLOBAL-MUG-W can ship from the UK, EU, US or SE lab depending on destination and shipping method.',
    'The distance from the handle at which the print stops (published for other Prodigi mugs, not for this one).',
    'Whether Prodigi\'s lab applies any bleed loss at the top or bottom edge.',
  ],
} as const

/**
 * THE MUG PICTURE PANELS (2026-10-24: the full wrap is NOT used; the customer chooses a SQUARE or LANDSCAPE panel shown whole on the face; there is no portrait mug). Sizes in lab-file pixels at 300 dpi (liten_policy):
 * the square panel is the existing 910 x 910 (kept exactly, existing orders are unchanged); landscape is 3:2 (900 x 600, 3 x 2 in). All sit inside the
 * face window of our preview renderer (about 930 px) and inside the 38 px design margins; the picture is placed on BOTH template faces, vertically centred.
 */
export const MUG_PANEL_SHAPES = { square: { w: 910, h: 910 }, landscape: { w: 900, h: 600 } } as const
export type MugComposition = keyof typeof MUG_PANEL_SHAPES
export const MUG_COMPOSITIONS = ['square', 'landscape'] as const
/** Which panel a picture is, by its shape (within 0.3%), or null. */
export function mugPanelShapeOf(w: number, h: number): MugComposition | null {
  if (!(w > 0 && h > 0)) return null
  return MUG_COMPOSITIONS.find(k => Math.abs(w / h / (MUG_PANEL_SHAPES[k].w / MUG_PANEL_SHAPES[k].h) - 1) <= 0.003) ?? null
}
/** The two face rectangles (lab-file pixels, scaled) of a panel shape: centred on the template faces, vertically centred (the square keeps its legacy top of 100). */
export function mugPanelRectsFor(shape: MugComposition, scale = 1): Rect[] {
  const r = (v: number) => Math.round(v * scale), s = MUG_PANEL_SHAPES[shape], top = shape === 'square' ? MUG.panelTop : Math.round((MUG.wrap.h - s.h) / 2)
  return MUG.faceCentersX.map(cx => ({ x: r(cx - s.w / 2), y: r(top), w: r(s.w), h: r(s.h) }))
}

/**
 * THE SINGLE-PANEL MUG LAYOUT (2026-10-25, 'mug_single_panel'): ONE picture panel on ONE face (the face a right-handed mug shows, handle on the right); the reverse and everything else in the lab file stay WHITE.
 * Nothing is duplicated, mirrored or washed. Every product-first (generation) mug uses it. Mugs made before it keep their layout: the square on BOTH faces with the soft wash ('mug_two_face'), decided by the layout
 * frozen with the order, never by the picture's shape.
 */
export const MUG_SINGLE_PANEL = 'mug_single_panel' as const
export const MUG_TWO_FACE = 'mug_two_face' as const
export type MugLayout = typeof MUG_SINGLE_PANEL | typeof MUG_TWO_FACE
/** Where the single panel sits in the 2670 x 1110 print file (and, rolled so the front face is in the middle, in the 1335 x 555 view the preview and the browser beauty shot use). */
export function mugSinglePanelPlacement(shape: MugComposition) {
  const rect = mugPanelRectsFor(shape, 1)[1], s = MUG.mockupScale, vw = Math.round(MUG.wrap.w * s), vh = Math.round(MUG.wrap.h * s), vr = { w: Math.round(rect.w * s), h: Math.round(rect.h * s) }
  return {
    layout: MUG_SINGLE_PANEL, composition: shape, orientation: shape, face: 'front' as const, handle: 'right' as const, reverse: 'white' as const,
    panelPx: { w: rect.w, h: rect.h }, filePx: { w: MUG.wrap.w, h: MUG.wrap.h }, rectPx: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    viewPx: { w: vw, h: vh }, viewRectPx: { x: Math.round(vw / 2 - vr.w / 2), y: Math.round(rect.y * s), ...vr },
  }
}
export type MugSinglePanelPlacement = ReturnType<typeof mugSinglePanelPlacement>

/** The panel rectangles (in lab-file pixels) on the two faces. */
export function mugPanelRects(scale = 1): Rect[] {
  const r = (v: number) => Math.round(v * scale)
  return MUG.faceCentersX.map(cx => ({ x: r(cx - MUG.panel.w / 2), y: r(MUG.panelTop), w: r(MUG.panel.w), h: r(MUG.panel.h) }))
}

// ─────────────────────────────────────────── 7 x 5 GREETING CARD (GLOBAL-GRE-MOH-7X5-BLA) ───────────────────────────────────────────
export const CARD = {
  sku: 'GLOBAL-GRE-MOH-7X5-BLA',
  /** The whole lab file (prodigi_api). Prodigi's template is 6117 x 2161: one pixel narrower, so the layout is anchored at the left and the last column is bleed. */
  spread: { w: 6118, h: 2161 },
  /**
   * The file holds TWO sheets side by side, each 10 x 7 in once trimmed (5 x 7 in panels either side of a vertical fold):
   * the OUTER sheet (outer rear | OUTER FRONT) on the left and the INNER sheet (inside front | inside back) on the right. (prodigi_template)
   * The portrait 5 x 7 layout is used: the artwork is upright in the file. (The landscape 7 x 5 layout of the same SKU is the same file with every panel
   * rotated 90 degrees; it is not launched.)
   */
  outerSheetTrim: { x: 29, y: 30, w: 3000, h: 2100 } as Rect,
  innerSheetTrim: { x: 3088, y: 30, w: 3000, h: 2100 } as Rect,
  /** The fold lines (prodigi_template, measured 1528-1530 and 4586-4588). */
  foldX: { outer: 1529, inner: 4588 },
  /** The FRONT panel, trimmed: the right half of the outer sheet. 1500 x 2100 = exactly 5:7. (prodigi_template, rounded 1 px inside the measured trim lines) */
  frontTrim: { x: 1529, y: 30, w: 1500, h: 2100 } as Rect,
  /** Bleed beyond the trim (prodigi_template, measured: 29 px left/right, 29-30 px top, 30-31 px bottom). The front's bleed is right, top and bottom; its left edge is the fold. */
  bleed: { right: 29, top: 30, bottom: 31 },
  /** The inset of Prodigi's red safe-area line from the trim (prodigi_template, measured 35-36 px). */
  safeInset: 36,
  /** The outer-rear panel and the whole inner sheet are left plain white paper in this version. (liten_policy) */
  rearAndInner: 'white' as const,
  unverified: [
    'Whether Prodigi expects the outer FRONT on the right half of the outer sheet: the template labels the panels (outer rear | outer front | inside front | inside back) but the product pages do not state it in words; the label order is the evidence.',
    'The safe-area line is drawn only around each sheet, not at the fold: the margin used beside the fold (the same 36 px) is a LITEN choice.',
    'Template is 6117 px wide while the Products API says 6118: the extra column is filled with bleed, not content.',
    'Mail2Me self-send prints nothing on the inside or the rear; that behaviour is the SKU description, not a file requirement.',
  ],
} as const

export interface CardLayout {
  /** The picture's panel in file pixels: the trimmed front. */
  front: Rect
  /** The front artwork INCLUDING bleed (right, top, bottom), in file pixels. */
  frontWithBleed: Rect
  /** The area that must stay free of anything important (inside trim by the safe inset, and away from the fold by the same margin). */
  safe: Rect
}
export function cardLayout(scale = 1): CardLayout {
  const r = (v: number) => Math.round(v * scale)
  const f = CARD.frontTrim, b = CARD.bleed, s = CARD.safeInset
  return {
    front: { x: r(f.x), y: r(f.y), w: r(f.w), h: r(f.h) },
    frontWithBleed: { x: r(f.x), y: 0, w: r(f.w + b.right), h: r(CARD.spread.h) },
    safe: { x: r(f.x + s), y: r(f.y + s), w: r(f.w - 2 * s), h: r(f.h - 2 * s) },
  }
}

export const MUG_PANEL_ASPECT = MUG.panel.w / MUG.panel.h            // 1
export const CARD_FRONT_ASPECT = CARD.frontTrim.w / CARD.frontTrim.h  // 5 / 7

// ─────────────────────────────────────────────── the per-product specification that travels with the catalog ───────────────────────────────────────────────
import type { ProductionSpec } from './catalog-types'

export const PRODUCTION_SPECS: Record<'matted' | 'framed_canvas' | 'mug' | 'card', ProductionSpec> = {
  matted: {
    profile: 'flat_print',
    verified: {
      source: 'prodigi_api',
      attributesRequiredByQuote: { color: 'frame colour: black, brown, dark grey, gold, light grey, natural, silver, white' },
      attributesFixedByProdigi: { frame: 'Classic', glaze: 'Acrylic / Perspex', mount: '2.4mm', mountColor: 'Snow white (the only option; a different value returns NotAvailable)', paperType: 'EMA', substrateWeight: '200gsm' },
      printArea: 'The picture inside the mount, one flat file; it equals finalPx. The border between the print area and the frame is uniform per size (1 in at 8x12, about 1.97 in at 12x18 and 16x24, 2 in at 20x30).',
    },
    policy: { frameColor: 'black (fixed, as for the Classic Frame)', composition: 'the picture fills the print area exactly (no wrap, no bleed handling)', keepKeyContentFromTheEdge: 'keep faces and text at least 3% of each side away from the picture edge until the mount opening is confirmed' },
    unverified: [
      'The visible mount OPENING: Prodigi publishes only the print area. A mounted print normally tucks its edge under the mount, so a thin border of the picture is hidden; the amount is not published.',
      'Whether Prodigi accepts a rotated (landscape) file for a portrait-defined SKU.',
    ],
  },
  framed_canvas: {
    profile: 'flat_print',
    verified: {
      source: 'prodigi_api',
      attributesRequiredByQuote: { color: 'black, brown, gold, natural, silver or white', wrap: 'Black, ImageWrap, MirrorWrap or White: REQUIRED, there is no default' },
      wrapQuote: 'MirrorWrap is accepted by the Quotes API for every framed-canvas SKU, in every frame colour (the 2026-10-18 sandbox run).',
      printArea: 'For wrap = MirrorWrap, Black or White the print area is the picture plus 27 px on every side (e.g. 2454 x 2454 for 8 x 8); for ImageWrap it is much larger (3345 x 3345). The catalog uses the MirrorWrap figures.',
      frame: 'Float frame, 38mm standard stretcher bar, 400gsm standard canvas',
    },
    policy: { frameColor: 'black', wrap: 'MirrorWrap (the same value and the same 27 px mirrored margin the Gallery Canvas already sells)', composition: 'the picture, then a 27 px mirror of its own edge on every side (finishPrintPixels, unchanged)' },
    unverified: [
      'What MirrorWrap paints on the 38 mm sides is not defined in Prodigi\'s documentation. The print-area evidence (the same size as Black and White, far smaller than ImageWrap) says the sides are derived by Prodigi, not supplied by the file.',
      'Whether the float frame overlaps any of the picture face. Prodigi publishes no safe area for it.',
      'framed_canvas:8x12 (hold): Prodigi lists the product 8 wide x 12 tall but returns a LANDSCAPE print area (3654 x 2454). Which is right is unproven.',
    ],
  },
  mug: {
    profile: 'mug_wrap',
    verified: {
      source: 'prodigi_api + prodigi_template',
      sku: MUG.sku, attributes: { color: 'white', size: '313ml / 11oz' }, attributesRequiredByQuote: 'none (the quote also succeeds without them)',
      wrapPx: MUG.wrap, seamX: MUG.seamX, oppositeHandleX: MUG.oppositeHandleX, faceCentersX: MUG.faceCentersX,
      handle: 'The two EDGES of the file meet at the handle. x = 1334.5 is opposite the handle. x = 598 and x = 2069 are the middle of each face.',
    },
    policy: { panel: MUG.panel, panelTop: MUG.panelTop, bothFaces: true, background: 'a soft wash of the picture itself, mirrored so the two ends of the file match at the handle', neverCropped: true, mockupScale: MUG.mockupScale },
    unverified: [...MUG.unverified],
  },
  card: {
    profile: 'card_spread',
    verified: {
      source: 'prodigi_api + prodigi_template',
      sku: CARD.sku, deliveryOption: 'Mail2Me self send (single card, OPP bag, blank kraft envelope)', attributesRequiredByQuote: 'none',
      spreadPx: CARD.spread, outerSheetTrim: CARD.outerSheetTrim, innerSheetTrim: CARD.innerSheetTrim, foldX: CARD.foldX, frontTrim: CARD.frontTrim, bleed: CARD.bleed, safeInset: CARD.safeInset,
      layout: 'portrait 5 x 7 panels, upright in the file. Outer sheet = outer rear (left) | OUTER FRONT (right); inner sheet = inside front | inside back.',
    },
    policy: { frontPicture: '1500 x 2100 (exactly 5:7), whole, never cropped or stretched', bleed: 'a mirror of the picture\'s own edge, right/top/bottom only', rearAndInner: CARD.rearAndInner, unlaunchedVariants: 'direct delivery, gloss, 6x4, 6x6 and the landscape 7x5 layout stay disabled' },
    unverified: [...CARD.unverified],
  },
}
