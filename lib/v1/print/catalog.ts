// lib/v1/print/catalog.ts
//
// THE CANONICAL PRODUCT CATALOG: one table of every verified Prodigi SKU, with its print requirements, shared by the
// Print Shop and the Gift Wizard. READ-ONLY and additive: it derives from sku-map.ts (the sellable products, their
// prices and attributes stay exactly as they are) and adds the products sku-map.ts does not carry, as DISABLED entries
// with the geometry Prodigi's sandbox returned on 2026-10-15 (docs/GOVERNANCE/prodigi-catalog-verified-2026-10-15.json).
//
// Only the four launch families in LAUNCH_FAMILIES are 'launch' for the Print Shop. The four Gift Shop products (matted frame, framed canvas, photo mug,
// 7 x 5 card) are fully built and stay visible; gift-enablement.ts says when each may be sold, and the catalog reports the first open item as its
// disabledReason. getLaunchSku() and the checkout route are untouched.

import { createHash } from 'node:crypto'
import { SKU_MAP, LAUNCH_FAMILIES, GIFT_PRODUCT_FAMILIES, type PrintFinish, type PrintSize, type SkuEntry } from './sku-map'
import { GIFT_ENABLED_FAMILIES, GIFT_PRODUCT_HOLDS } from './gift-enablement'
import { CARD, MUG, PRODUCTION_SPECS } from './production-profiles'
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

/** A file made of a PICTURE panel inside a larger layout (the mug wrap, the card spread): no canvas wrap, the panel is a rectangle in the file. */
function layoutRequirements(final: Px, picture: Px, orientation: Orientation): CanonicalProduct['requirements'] {
  return { ppi: PPI, finalPx: { ...final }, picturePx: { ...picture }, wrapPx: { ...NO_SIDES }, pictureAspect: Math.round((picture.w / picture.h) * 1e6) / 1e6, skuOrientation: orientation, rotatedFile: null, safeArea: null }
}

const GIFT_PROFILE: Record<string, CanonicalProduct['artworkProfile']> = { matted: 'flat_print', framed_canvas: 'flat_print', mug: 'mug_wrap', card: 'card_spread' }

/** Whether a Gift Shop product may be sold, and if not, the first thing still open (gift-enablement.ts). */
function giftState(family: ProductFamily, productId: string, e: SkuEntry): Disabled | typeof LAUNCH {
  const hold = GIFT_PRODUCT_HOLDS[productId]
  if (hold) return { status: 'disabled', reason: hold }
  if (e.retailApproved === false) return { status: 'disabled', reason: 'retail_price_pending' }
  if (!GIFT_ENABLED_FAMILIES.includes(family)) return { status: 'disabled', reason: 'not_launched' }
  return LAUNCH
}

/** Products sku-map.ts sells or lists: derived from it, so prices, attributes and SKUs cannot drift. */
function fromSkuMap(finish: PrintFinish, size: PrintSize, e: SkuEntry): CanonicalProduct {
  const family = (finish === 'framed' ? 'framed' : finish) as ProductFamily
  const launch = LAUNCH_FAMILIES.includes(finish)
  const gift = GIFT_PRODUCT_FAMILIES.includes(finish)
  const productId = `${family}:${size}`
  const picture: Px = { w: Math.round(e.imageWidthIn * PPI), h: Math.round(e.imageHeightIn * PPI) }
  const state: Disabled | typeof LAUNCH = launch ? LAUNCH : gift ? giftState(family, productId, e) : { status: 'disabled', reason: 'not_launched' }
  const final = { ...e.requiredPx }
  const reqs = finish === 'mug' ? layoutRequirements(final, { ...MUG.panel }, 'wrap')
    : finish === 'card' ? layoutRequirements(final, { w: CARD.frontTrim.w, h: CARD.frontTrim.h }, 'spread')
    : requirements(final, picture, orientationOf(e.requiredPx), launch)
  return {
    productId, kind: KIND[family], family, familyLabel: e.familyLabel, size, label: e.label, note: e.familyNote, sku: e.sku,
    attributes: { ...(e.attributes ?? {}) }, unexposedOptions: UNEXPOSED[family], retailCents: e.retailApproved === false ? null : e.retailCents,
    status: state.status, disabledReason: state.reason, artworkProfile: launch ? 'flat_print' : gift ? GIFT_PROFILE[family] : null,
    requirements: reqs, production: gift ? structuredClone(PRODUCTION_SPECS[family as 'matted' | 'framed_canvas' | 'mug' | 'card']) : null,
  }
}

/**
 * Verified products that sku-map.ts does not carry: the OTHER card variants only (direct delivery, gloss, 6x4, 6x6). They stay disabled and are not launch candidates.
 * (Matted frame, framed canvas, the mug and the 7 x 5 Mohawk self-send card are in sku-map.ts now.)
 */
function otherCards(): CanonicalProduct[] {
  const spread = (productId: string, sku: string, size: string, label: string, note: string, px: Px, finish: string): CanonicalProduct => ({
    productId, kind: 'greeting_card', family: 'card', familyLabel: FAMILY_LABEL.card, size, label, note, sku, attributes: {}, unexposedOptions: { finish: [finish] },
    retailCents: null, status: 'disabled', disabledReason: 'not_a_launch_candidate', artworkProfile: null, production: null,
    requirements: layoutRequirements(px, px, 'spread'),
  })
  return [
    spread('card:7x5-mohawk-direct', 'GLOBAL-GRE-MOH-7X5-DIR', '7x5', 'Greeting Card 7 × 5″ (Mohawk, sent direct)', FAMILY_NOTE.card, { w: 6118, h: 2161 }, 'matte'),
    spread('card:6x4-gloss', 'GLOBAL-GRE-GLOS-6X4-BLA', '6x4', 'Greeting Card 6 × 4″ (Gloss)', 'Gloss coated card', { w: 4937, h: 1854 }, 'gloss'),
    spread('card:6x4-gloss-direct', 'GLOBAL-GRE-GLOS-6X4-DIR', '6x4', 'Greeting Card 6 × 4″ (Gloss, sent direct)', 'Gloss coated card', { w: 4937, h: 1854 }, 'gloss'),
    spread('card:7x5-gloss', 'GLOBAL-GRE-GLOS-7X5-BLA', '7x5', 'Greeting Card 7 × 5″ (Gloss)', 'Gloss coated card', { w: 6118, h: 2161 }, 'gloss'),
    spread('card:6x6-gloss', 'GLOBAL-GRE-GLOS-6X6-BLA', '6x6', 'Greeting Card 6 × 6″ (Gloss)', 'Gloss coated card', { w: 6732, h: 1712 }, 'gloss'),
  ]
}

const FAMILY_ORDER: ProductFamily[] = ['fine_art', 'premium', 'canvas', 'framed', 'matted', 'framed_canvas', 'mug', 'card']
const SIZE_ORDER = ['8x8', '12x12', '16x16', '20x20', '8x12', '12x18', '16x24', '20x30', '11oz', '7x5', '6x4', '6x6']

function build(): CanonicalProduct[] {
  const list: CanonicalProduct[] = []
  for (const finish of Object.keys(SKU_MAP) as PrintFinish[]) {
    for (const [size, e] of Object.entries(SKU_MAP[finish]) as Array<[PrintSize, SkuEntry]>) list.push(fromSkuMap(finish, size, e))
  }
  for (const p of otherCards()) if (!list.some(x => x.sku === p.sku)) list.push(p)
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
    const { production: _internal, ...customerFacing } = p        // the production spec names suppliers and open questions: it is for engineering and the frozen order, never the public catalog
    return { ...customerFacing, ...(artworkFit ? { artworkFit } : {}), selectable: p.status === 'launch' && (!artworkFit || artworkFit.fit !== 'unavailable') }
  })
  return {
    contractVersion: CATALOG_CONTRACT_VERSION, catalogVersion: catalogVersion(base), fitRules: { ...FIT_RULES },
    artwork: valid ? { width: artwork!.width, height: artwork!.height } : null, products,
  }
}
