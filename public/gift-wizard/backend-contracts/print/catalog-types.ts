// lib/v1/print/catalog-types.ts
//
// The stable, dependency-free contract for the canonical product catalog, shared by the Print Shop and the Gift Wizard.
// Types only: Codex can copy this file verbatim. Bump CATALOG_CONTRACT_VERSION on any breaking change to a shape here.
//
// Everything is SERVER-OWNED. Pixel sizes are what Prodigi's sandbox returned for the SKU, not computed. No wholesale
// cost, margin or supplier data appears in any shape: this is customer-facing.

export const CATALOG_CONTRACT_VERSION = 1

export type ProductKind = 'flat_print' | 'canvas' | 'framed_print' | 'matted_frame' | 'framed_canvas' | 'mug' | 'greeting_card'
export type ProductFamily = 'fine_art' | 'premium' | 'canvas' | 'framed' | 'matted' | 'framed_canvas' | 'mug' | 'card'

/** The shape of the lab file as Prodigi defines it for the SKU. */
export type Orientation = 'square' | 'portrait' | 'landscape' | 'wrap' | 'spread'

export interface Px { w: number; h: number }
export interface Sides { left: number; right: number; top: number; bottom: number }

/** Why a product cannot be bought yet. A product with status 'launch' has no reason. */
export type DisabledReason =
  | 'not_launched'                    // a verified family that is not part of the launch catalog
  | 'retail_price_pending'            // verified SKU, no approved retail price
  | 'composition_behavior_pending'    // launch candidate whose artwork placement is not approved
  | 'not_a_launch_candidate'          // verified SKU that is not planned for sale

export type ProductStatus = 'launch' | 'disabled'

export interface PrintRequirements {
  /** Pixels per inch the finished file is built for (the upscale target). */
  ppi: number
  /** The whole file the lab receives, in the orientation the SKU defines. */
  finalPx: Px
  /** The picture area inside the file. Equals finalPx except canvas wrap. (Mounted frames: Prodigi's area IS the picture.) */
  picturePx: Px
  /** Mirrored or extended margin around the picture (canvas). Zero for flat prints. */
  wrapPx: Sides
  /** Width / height of the picture area: the shape an artwork must be composed to. */
  pictureAspect: number
  skuOrientation: Orientation
  /**
   * The file for LANDSCAPE artwork on a portrait-defined SKU (width and height swapped, as geometry.ts does). Whether
   * Prodigi accepts the rotated file is NOT yet verified by a sandbox order. null for squares, mugs and cards.
   */
  rotatedFile: { finalPx: Px; verifiedWithProdigi: false } | null
  /** Prodigi publishes no safe-area specification for these products; null means "not available", never "zero". */
  safeArea: null
}

export interface CanonicalProduct {
  /** Stable id, e.g. 'fine_art:12x18'. Never a Prodigi SKU; the wizard and orders use this. */
  productId: string
  kind: ProductKind
  family: ProductFamily
  familyLabel: string
  size: string                       // '12x18', '11oz', '7x5'
  label: string
  note: string
  sku: string
  /** Fixed attributes sent to quotes and orders (e.g. { wrap: 'MirrorWrap' }). Not customer-selectable. */
  attributes: Record<string, string>
  /** Options Prodigi offers that we deliberately do not expose. Informational only. */
  unexposedOptions: Record<string, string[]>
  /** Locked retail price in USD cents, or null when none is approved. Shipping is never part of this: use a Prodigi quote. */
  retailCents: number | null
  status: ProductStatus
  disabledReason: DisabledReason | null
  /** 'flat_print' has an artwork profile today. Mugs and cards have none until their composition behavior is approved. */
  artworkProfile: 'flat_print' | null
  requirements: PrintRequirements
}

/** How a given artwork relates to a product's picture area. Nothing here removes content. */
export type ArtworkFit =
  | 'exact'          // same aspect: resample only
  | 'resample'       // within 2%: a tiny resample, no new content
  | 'extend'         // up to 20%: background extension (outpaint, or mirror for canvas wrap)
  | 'unavailable'    // beyond what the current rules allow. Larger controlled extensions need approved composition behavior.

export interface ProductFit { fit: ArtworkFit; extensionFraction: number }

export interface CatalogProduct extends CanonicalProduct {
  /** Present only when the request supplied artwork dimensions. */
  artworkFit?: ProductFit
  /** True when the product can be added to a cart: status launch AND (when artwork was supplied) its fit is not 'unavailable'. */
  selectable: boolean
}

export interface CatalogResponse {
  contractVersion: typeof CATALOG_CONTRACT_VERSION
  /** Changes whenever any product, price, status or geometry changes. Carry it on checkout lines; reject stale values. */
  catalogVersion: string
  /** Rules used to compute artworkFit, so a UI can explain unavailable products. */
  fitRules: { resampleMaxFraction: number; extendMaxFraction: number }
  artwork: { width: number; height: number } | null
  products: CatalogProduct[]
}
