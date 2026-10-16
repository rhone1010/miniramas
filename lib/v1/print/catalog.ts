// lib/v1/print/catalog.ts
//
// THE CANONICAL PRODUCT CATALOG: one table of every verified Prodigi SKU, with its print requirements, shared by the
// Print Shop and the Gift Wizard. READ-ONLY and additive: it derives from sku-map.ts (the sellable products, their
// prices and attributes stay exactly as they are) and adds the products sku-map.ts does not carry, as DISABLED entries
// with the geometry Prodigi's sandbox returned on 2026-10-15 (docs/GOVERNANCE/prodigi-catalog-verified-2026-10-15.json).
//
// Nothing here enables a product. Only the four launch families in LAUNCH_FAMILIES are 'launch'. Framed-canvas and
// matted rectangles wait for approved retail prices; the mug and the 7x5 Mohawk card wait for approved prices and
// composition behavior. getLaunchSku() and the checkout route are untouched.

import { createHash } from 'node:crypto'
import { SKU_MAP, LAUNCH_FAMILIES, type PrintFinish, type PrintSize, type SkuEntry } from './sku-map'
import { aspectCompatibility } from './geometry'
import {
  CATALOG_CONTRACT_VERSION,
  type ArtworkFit, type CanonicalProduct, type CatalogProduct, type CatalogResponse, type DisabledReason,
  type Orientation, type ProductFamily, type ProductFit, type ProductKind, type Px, type Sides,
} from './catalog-types'

export * from './catalog-types'

const PPI = 300
const NO_SIDES: Sides = { left: 0, right: 0, top: 0, bottom: 0 }
/** The same limits geometry.ts applies (aspectCompatibility): 2% resample, 20% extension. */
export const FIT_RULES = { resampleMaxFraction: 0.02, extendMaxFraction: 0.20 } as const

const KIND: Record<ProductFamily, ProductKind> = {
  fine_art: 'flat_print', premium: 'flat_print', canvas: 'canvas', framed: 'framed_print', matted: 'matted_frame',
  framed_canvas: 'framed_canvas', mug: 'mug', card: 'greeting_card',
}
const FAMILY_LABEL: Record<ProductFamily, string> = {
  fine_art: 'Fine Art Print', premium: 'Premium Fine Art', canvas: 'Gallery Canvas', framed: 'Classic Frame', matted: 'Matted Frame',
  framed_canvas: 'Framed Canvas', mug: 'Photo Mug', card: 'Greeting Card',
}
const FAMILY_NOTE: Record<ProductFamily, string> = {
  fine_art: 'Enhanced matte art paper, 200gsm', premium: 'Heavyweight fine art paper, museum grade', canvas: 'Stretched canvas, ready to hang',
  framed: 'Framed behind glaze, ready to hang', matted: 'Framed with a mount, behind glaze', framed_canvas: 'Stretched canvas in a solid frame',
  mug: '11 oz white ceramic mug with a full image wrap', card: '7 x 5 inch card on Mohawk 324gsm stock',
}
const UNEXPOSED: Record<ProductFamily, Record<string, string[]>> = {
  fine_art: {}, premium: {},
  canvas: { wrap: ['Black', 'ImageWrap', 'MirrorWrap', 'White'] },
  framed: { color: ['black', 'brown', 'dark grey', 'gold', 'light grey', 'natural', 'silver', 'white'] },
  matted: { color: ['black', 'brown', 'dark grey', 'gold', 'light grey', 'natural', 'silver', 'white'], mountColor: ['Snow white'] },
  framed_canvas: { color: ['black', 'brown', 'gold', 'natural', 'silver', 'white'], wrap: ['Black', 'ImageWrap', 'MirrorWrap', 'White'] },
  mug: {}, card: {},
}

const orientationOf = (p: Px): Orientation => p.w === p.h ? 'square' : p.w < p.h ? 'portrait' : 'landscape'
const sizeLabel = (size: string) => size.replace('x', ' × ') + '″'

function requirements(final: Px, picture: Px, orientation: Orientation, rotatable: boolean): CanonicalProduct['requirements'] {
  const dx = final.w - picture.w, dy = final.h - picture.h
  const side = (d: number) => ({ a: Math.floor(d / 2), b: d - Math.floor(d / 2) })
  const wrapPx: Sides = dx || dy ? { left: side(dx).a, right: side(dx).b, top: side(dy).a, bottom: side(dy).b } : { ...NO_SIDES }
  return {
    ppi: PPI, finalPx: { ...final }, picturePx: { ...picture }, wrapPx, pictureAspect: Math.round((picture.w / picture.h) * 1e6) / 1e6,
    skuOrientation: orientation,
    rotatedFile: rotatable && final.w !== final.h ? { finalPx: { w: final.h, h: final.w }, verifiedWithProdigi: false } : null,
    safeArea: null,
  }
}

type Disabled = { status: 'disabled'; reason: DisabledReason }
const LAUNCH = { status: 'launch' as const, reason: null }

/** Products sku-map.ts sells or lists: derived from it, so prices, attributes and SKUs cannot drift. */
function fromSkuMap(finish: PrintFinish, size: PrintSize, e: SkuEntry): CanonicalProduct {
  const family = (finish === 'framed' ? 'framed' : finish) as ProductFamily
  const launch = LAUNCH_FAMILIES.includes(finish)
  const picture: Px = { w: Math.round(e.imageWidthIn * PPI), h: Math.round(e.imageHeightIn * PPI) }
  const state: Disabled | typeof LAUNCH = launch ? LAUNCH : { status: 'disabled', reason: 'not_launched' }
  return {
    productId: `${family}:${size}`, kind: KIND[family], family, familyLabel: e.familyLabel, size, label: e.label, note: e.familyNote, sku: e.sku,
    attributes: { ...(e.attributes ?? {}) }, unexposedOptions: UNEXPOSED[family], retailCents: e.retailCents,
    status: state.status, disabledReason: state.reason, artworkProfile: launch ? 'flat_print' : null,
    requirements: requirements({ ...e.requiredPx }, picture, orientationOf(e.requiredPx), true),
  }
}

/**
 * Verified products that sku-map.ts does not carry. Pixel sizes are Prodigi's printAreaSizes (sandbox, 2026-10-15).
 * FRA-CAN-8X12 is landscape-DEFINED (3654 x 2454); the other framed-canvas rectangles are portrait. The canvas wrap
 * is 27 px per side, so the picture is the area minus 54.
 */
const FRAMED_CANVAS_RECT: Array<[PrintSize, string, Px]> = [
  ['8x12', 'GLOBAL-FRA-CAN-8X12', { w: 3654, h: 2454 }],
  ['12x18', 'GLOBAL-FRA-CAN-12X18', { w: 3654, h: 5454 }],
  ['16x24', 'GLOBAL-FRA-CAN-16X24', { w: 4854, h: 7254 }],
  ['20x30', 'GLOBAL-FRA-CAN-20X30', { w: 6054, h: 9054 }],
]
/** Mounted frames: Prodigi's print area is the picture inside the mount (the mount widths are not uniform). */
const MATTED_RECT: Array<[PrintSize, string, Px]> = [
  ['8x12', 'GLOBAL-CFPM-8X12', { w: 1800, h: 3000 }],
  ['12x18', 'GLOBAL-CFPM-12X18', { w: 2418, h: 4218 }],
  ['16x24', 'GLOBAL-CFPM-16X24', { w: 3618, h: 6018 }],
  ['20x30', 'GLOBAL-CFPM-20X30', { w: 4800, h: 7800 }],
]

function framedCanvasRect(size: PrintSize, sku: string, area: Px): CanonicalProduct {
  const picture = { w: area.w - 54, h: area.h - 54 }
  return {
    productId: `framed_canvas:${size}`, kind: 'framed_canvas', family: 'framed_canvas', familyLabel: FAMILY_LABEL.framed_canvas, size, label: sizeLabel(size),
    note: FAMILY_NOTE.framed_canvas, sku, attributes: { color: 'black', wrap: 'MirrorWrap' }, unexposedOptions: UNEXPOSED.framed_canvas, retailCents: null,
    status: 'disabled', disabledReason: 'retail_price_pending', artworkProfile: null,
    requirements: requirements(area, picture, orientationOf(area), false),
  }
}
function mattedRect(size: PrintSize, sku: string, area: Px): CanonicalProduct {
  return {
    productId: `matted:${size}`, kind: 'matted_frame', family: 'matted', familyLabel: FAMILY_LABEL.matted, size, label: sizeLabel(size),
    note: FAMILY_NOTE.matted, sku, attributes: { color: 'black' }, unexposedOptions: UNEXPOSED.matted, retailCents: null,
    status: 'disabled', disabledReason: 'retail_price_pending', artworkProfile: null,
    requirements: requirements(area, area, orientationOf(area), false),
  }
}

function mugAndCards(): CanonicalProduct[] {
  const spread = (productId: string, sku: string, size: string, label: string, note: string, px: Px, reason: DisabledReason, finish: string): CanonicalProduct => ({
    productId, kind: 'greeting_card', family: 'card', familyLabel: FAMILY_LABEL.card, size, label, note, sku, attributes: {}, unexposedOptions: { finish: [finish] },
    retailCents: null, status: 'disabled', disabledReason: reason, artworkProfile: null,
    // A card file is a flat SPREAD; which part is the front panel is an unapproved composition decision.
    requirements: requirements(px, px, 'spread', false),
  })
  const mug: CanonicalProduct = {
    productId: 'mug:11oz-white', kind: 'mug', family: 'mug', familyLabel: FAMILY_LABEL.mug, size: '11oz', label: '11 oz White Mug', note: FAMILY_NOTE.mug,
    sku: 'GLOBAL-MUG-W', attributes: { color: 'white', size: '313ml / 11oz' }, unexposedOptions: {}, retailCents: null, status: 'disabled',
    disabledReason: 'composition_behavior_pending', artworkProfile: null, requirements: requirements({ w: 2670, h: 1110 }, { w: 2670, h: 1110 }, 'wrap', false),
  }
  return [
    mug,
    spread('card:7x5-mohawk', 'GLOBAL-GRE-MOH-7X5-BLA', '7x5', 'Greeting Card 7 × 5″ (Mohawk)', FAMILY_NOTE.card, { w: 6118, h: 2161 }, 'composition_behavior_pending', 'matte'),
    spread('card:7x5-mohawk-direct', 'GLOBAL-GRE-MOH-7X5-DIR', '7x5', 'Greeting Card 7 × 5″ (Mohawk, sent direct)', FAMILY_NOTE.card, { w: 6118, h: 2161 }, 'not_a_launch_candidate', 'matte'),
    spread('card:6x4-gloss', 'GLOBAL-GRE-GLOS-6X4-BLA', '6x4', 'Greeting Card 6 × 4″ (Gloss)', 'Gloss coated card', { w: 4937, h: 1854 }, 'not_a_launch_candidate', 'gloss'),
    spread('card:6x4-gloss-direct', 'GLOBAL-GRE-GLOS-6X4-DIR', '6x4', 'Greeting Card 6 × 4″ (Gloss, sent direct)', 'Gloss coated card', { w: 4937, h: 1854 }, 'not_a_launch_candidate', 'gloss'),
    spread('card:7x5-gloss', 'GLOBAL-GRE-GLOS-7X5-BLA', '7x5', 'Greeting Card 7 × 5″ (Gloss)', 'Gloss coated card', { w: 6118, h: 2161 }, 'not_a_launch_candidate', 'gloss'),
    spread('card:6x6-gloss', 'GLOBAL-GRE-GLOS-6X6-BLA', '6x6', 'Greeting Card 6 × 6″ (Gloss)', 'Gloss coated card', { w: 6732, h: 1712 }, 'not_a_launch_candidate', 'gloss'),
  ]
}

const FAMILY_ORDER: ProductFamily[] = ['fine_art', 'premium', 'canvas', 'framed', 'matted', 'framed_canvas', 'mug', 'card']
const SIZE_ORDER = ['8x8', '12x12', '16x16', '20x20', '8x12', '12x18', '16x24', '20x30', '11oz', '7x5', '6x4', '6x6']

function build(): CanonicalProduct[] {
  const list: CanonicalProduct[] = []
  for (const finish of Object.keys(SKU_MAP) as PrintFinish[]) {
    for (const [size, e] of Object.entries(SKU_MAP[finish]) as Array<[PrintSize, SkuEntry]>) list.push(fromSkuMap(finish, size, e))
  }
  // Rectangles that sku-map.ts does not carry (it carries rectangles only for the four launch families).
  for (const [size, sku, area] of FRAMED_CANVAS_RECT) if (!list.some(p => p.sku === sku)) list.push(framedCanvasRect(size, sku, area))
  for (const [size, sku, area] of MATTED_RECT) if (!list.some(p => p.sku === sku)) list.push(mattedRect(size, sku, area))
  for (const p of mugAndCards()) if (!list.some(x => x.sku === p.sku)) list.push(p)
  return list.sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) || SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size) || a.productId.localeCompare(b.productId))
}

let cached: CanonicalProduct[] | null = null
/** Every verified product, enabled or not. A copy, so callers cannot change the table. */
export function allProducts(): CanonicalProduct[] { return structuredClone(cached ??= build()) }
export function getProduct(productId: string): CanonicalProduct | undefined { return allProducts().find(p => p.productId === productId) }
export function getProductBySku(sku: string): CanonicalProduct | undefined { return allProducts().find(p => p.sku === sku) }

/** Changes whenever a product, its price, status or geometry changes. */
export function catalogVersion(products: CanonicalProduct[] = allProducts()): string {
  return createHash('sha256').update(JSON.stringify(products)).digest('hex').slice(0, 12)
}

/** Fit of an artwork to a product's picture area. Orientation-agnostic for rectangles: a landscape artwork fits the same product turned. */
export function fitFor(artwork: { width: number; height: number }, product: CanonicalProduct): ProductFit {
  const { picturePx } = product.requirements
  const turned = artwork.width > artwork.height !== picturePx.w > picturePx.h && picturePx.w !== picturePx.h && artwork.width !== artwork.height
  const target = turned ? { w: picturePx.h, h: picturePx.w } : picturePx
  const { extension } = aspectCompatibility(artwork.width, artwork.height, target.w, target.h)
  const fit: ArtworkFit = extension <= 1e-6 ? 'exact' : extension <= FIT_RULES.resampleMaxFraction + 1e-10 ? 'resample' : extension <= FIT_RULES.extendMaxFraction + 1e-10 ? 'extend' : 'unavailable'
  return { fit, extensionFraction: Math.round(extension * 1e4) / 1e4 }
}

export function catalogResponse(artwork?: { width: number; height: number } | null): CatalogResponse {
  const base = allProducts()
  const valid = !!artwork && Number.isFinite(artwork.width) && Number.isFinite(artwork.height) && artwork.width > 0 && artwork.height > 0
  const products: CatalogProduct[] = base.map(p => {
    const artworkFit = valid ? fitFor(artwork!, p) : undefined
    return { ...p, ...(artworkFit ? { artworkFit } : {}), selectable: p.status === 'launch' && (!artworkFit || artworkFit.fit !== 'unavailable') }
  })
  return {
    contractVersion: CATALOG_CONTRACT_VERSION, catalogVersion: catalogVersion(base), fitRules: { ...FIT_RULES },
    artwork: valid ? { width: artwork!.width, height: artwork!.height } : null, products,
  }
}
