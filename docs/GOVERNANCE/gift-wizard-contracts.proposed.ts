// docs/GOVERNANCE/gift-wizard-contracts.proposed.ts
//
// PROPOSED, NOT IMPLEMENTED. Types only: nothing here is imported by the app, and no route exists for them yet.
// For review before any backend work. Companion to GIFT-WIZARD-PRINT-INTEGRATION-2026-10-15.md.
//
// Flow: Your Photo -> Choose Your Gift -> Create Art -> Checkout.
// Names that Codex already owns in public/gift-wizard/contracts.next.ts are kept (Series, Geometry, GiftLine, Composition,
// BatchRequest, effectIds, sourceRef, lineId). This file adds only the SERVER side: ids, entitlements, approvals, totals.
// Every price, count and geometry below is SERVER-OWNED. The browser sends ids and choices; it never sends proof of
// payment, a clean image URL, a price, a pixel size or a free-batch count.

// ───────────────────────── 1. Canonical product geometry (one table, shared by Print Shop and Gift Wizard) ─────────────────────────

/** How a product wants its artwork. Each kind has one artwork profile (lib/v1/print/upscale/profiles.ts). */
export type ProductKind = 'flat_print' | 'canvas' | 'framed_print' | 'matted_frame' | 'framed_canvas' | 'mug' | 'greeting_card'

/** What a product is today. Only 'launch' may enter a cart. */
export type ProductStatus =
  | 'launch'               // sellable now: in LAUNCH_FAMILIES, has a profile and a retail price
  | 'verified_no_retail'   // SKU exists in the Prodigi sandbox, not yet sold: needs a retail price and a profile
  | 'verified_no_profile'  // exists, but how the artwork should be placed is an undecided product question
  | 'unavailable'

export type Orientation = 'square' | 'portrait' | 'landscape' | 'wrap' | 'spread'

export interface Px { w: number; h: number }

/** One purchasable shape. Pixel values are what Prodigi's sandbox returned (printAreaSizes), not computed. */
export interface CanonicalProduct {
  /** Stable id used by the wizard and orders, e.g. 'fine_art:12x18'. Never a Prodigi SKU. */
  productId: string
  kind: ProductKind
  status: ProductStatus
  /** Family shelf: 'fine_art' | 'premium' | 'canvas' | 'framed_canvas' | 'framed' | 'matted' | 'mug' | 'card'. */
  family: string
  size: string                                  // '12x18' for prints, '11oz' for the mug, '7x5' for the card
  label: string
  sku: string
  /** Fixed attributes sent to quotes and orders, e.g. { wrap: 'MirrorWrap' } or { color: 'black' }. */
  attributes: Record<string, string>
  /** Options Prodigi offers that we do NOT expose (colours, wraps, mounts). Informational. */
  unexposedOptions: Record<string, string[]>
  geometry: {
    /** The whole file the lab receives, in the orientation Prodigi's SKU defines (see orientationNote). */
    finalPx: Px
    /** The picture area inside the file: equal to finalPx except canvas wrap and mounted frames. */
    picturePx: Px
    /** Extension on each side beyond the picture (canvas wrap). Zero for flat prints. */
    wrapPx: { left: number; right: number; top: number; bottom: number }
    /** Orientation of finalPx as Prodigi defines it. A landscape file for a portrait SKU is an UNVERIFIED rotation. */
    skuOrientation: Orientation
    /** Aspect ratio (w/h) of picturePx: the shape the customer's artwork must be composed to. */
    pictureAspect: number
    /** Which artwork orientations this product accepts WITHOUT extension; others need a composition (section 3). */
    nativeFor: Orientation[]
    orientationNote?: string
  }
  retailCents: number | null                    // null when no retail price has been set
  /** Internal only; NEVER send to the browser. Sandbox wholesale for one copy to the US. */
  internal?: { wholesaleCents: number; budgetShippingCents: number; extraCopyShippingCents: number }
  /** Artwork profile id ('flat_print' exists; 'mug' and 'greeting_card' do not). */
  profileId: 'flat_print' | 'mug' | 'greeting_card' | null
}

/** GET /api/v1/gift/catalog?artworkAspect=1.0 -> what the wizard may show. Availability is computed server-side. */
export interface CatalogResponse {
  catalogVersion: string                         // changes when SKUs, prices or geometry change; carried on every order line
  products: Array<Omit<CanonicalProduct, 'internal'> & { compatibility: CompositionKind; selectable: boolean; reason?: string }>
}

// ───────────────────────── 2. Preview sessions and the free/paid batch policy ─────────────────────────

export const GIFT_POLICY = {
  freeBatches: 2,                  // first six free, second six free
  batchSize: 6,
  paidBatchCents: 299,             // $2.99 per additional six, after VERIFIED payment (Stripe webhook), never a browser flag
  unlocksPerPhysicalArtwork: 1,    // one digital unlock per artwork bought physically, regardless of quantity or product count
} as const

export type Series = 'portraits' | 'groups' | 'pets'
/** Same shape as Codex's Geometry. requiredPx is the whole lab file; image inches the picture. */
export interface Geometry { key: string; widthIn: number; heightIn: number; requiredPx: Px }

export interface GiftSession {
  sessionId: string
  /** Server-owned reference to the uploaded photo; the wizard never sees a storage path or clean URL. */
  sourceRef: string | null
  series: Series | null            // from server-side source analysis, not a customer question
  /** Product lines chosen BEFORE generation (the revised flow); lineId is the wizard's GiftLine.id. */
  lines: Array<{ lineId: string; productId: string; size: string; copies: number }>
  batchesUsed: number
  freeBatchesRemaining: number     // GIFT_POLICY.freeBatches - free batches used
  paidBatchesAvailable: number     // verified purchases not yet consumed
  expiresAt: string
}

export interface PreviewRef {
  previewId: string                // server id; watermarked raster only
  url: string                      // baked-watermark preview URL (signed), never a clean master
  width: number
  height: number
  artworkAspect: number            // geometry this artwork was generated in
}

/** Superset of Codex's BatchRequest. The server re-derives geometries from lines and ignores any client-sent geometry. */
export interface BatchRequest {
  sessionId: string; sourceRef: string; series: Series
  effectIds: string[]              // exactly six, validated against the live registry for that series
  geometries: Geometry[]           // informational from the client; the server derives them
  batchIndex: number
  idempotencyKey: string           // a retry returns the same batch and fills only what is missing
}
export type BatchResponse =
  | { status: 'ok'; batchIndex: number; kind: 'free' | 'paid'; previews: PreviewRef[]; freeBatchesRemaining: number; paidBatchesAvailable: number }
  | { status: 'partial'; batchIndex: number; previews: PreviewRef[]; missing: number; retryable: true }   // retry fills only the missing ones, charges nothing, duplicates nothing
  | { status: 'payment_required'; amountCents: 299; currency: 'USD'; purchaseUrl: string }
  | { status: 'refused'; reason: 'intake_failed' | 'safety' | 'rate_limited' | 'session_expired' }

/** POST /api/v1/gift/preview-pack/checkout -> Stripe Checkout; entitlement is created ONLY by the signed webhook. */
export interface PreviewPackCheckoutRequest { sessionId: string; returnUrl: string }
export interface PreviewPackCheckoutResponse { checkoutUrl: string; stripeSessionId: string }

// ───────────────────────── 3. One artwork, several products: compositions and approval ─────────────────────────

/** How a selected artwork becomes one product's picture. There is NO 'crop': important subjects are never cut off. */
export type CompositionKind =
  | 'exact'        // same aspect: resize only
  | 'resize'       // within 2% of the product's aspect: resample, no new content
  | 'extend'       // up to 20% beyond: AI outpaint, or mirror for canvas wrap
  | 'recompose'    // beyond 20% (mug wrap, card spread): needs a profile-defined layout; customer approval always required
  | 'unavailable'

export interface CompositionPlan {
  productId: string
  kind: CompositionKind
  /** Fractions of the picture added on each side, 0 for 'exact'/'resize'. Never negative: nothing is removed. */
  addedFraction: { left: number; right: number; top: number; bottom: number }
  requiresApproval: boolean        // true for 'extend' and 'recompose'
  paidServiceUsed: 'none' | 'outpaint'
}

/** POST /api/v1/gift/compositions: one request prepares every chosen product from the ONE selected artwork. */
export interface CompositionRequest { sessionId: string; previewId: string; lineIds: string[] }
export interface ProductComposition {
  compositionId: string            // per (previewId, lineId); the approved file is derived from this, never regenerated at fulfilment
  lineId: string
  productId: string
  productionAssetId: string | null // null until the print job for the approved composition exists
  plan: CompositionPlan
  previewUrl: string | null        // watermarked, product-shaped preview of the composition for the customer to approve
  status: 'ready' | 'needs_approval' | 'approved' | 'failed'
}
export interface CompositionResponse { compositions: ProductComposition[] }
/** POST /api/v1/gift/compositions/approve. Approval is per composition and required before checkout accepts the line. */
export interface ApproveCompositionRequest { sessionId: string; compositionId: string }

// ───────────────────────── 4. Checkout (extends the existing /api/v1/print/checkout) ─────────────────────────

export interface GiftCheckoutLine {
  lineId: string
  productId: string                // server resolves sku, attributes, price from the canonical table; client values ignored
  size: string
  compositionId: string            // must be 'approved' for this previewId + productId
  copies: number                   // 1..20
}
export interface GiftCheckoutRequest {
  sessionId: string
  previewId: string                // ONE selected artwork for the whole order
  lines: GiftCheckoutLine[]
  email: string
  shippingAddress: { name: string; line1: string; line2?: string; city: string; state?: string; postcode: string; countryCode: string }
  shippingMethod?: 'Budget' | 'Standard' | 'Express' | 'Overnight'
  catalogVersion: string           // rejected if stale
  successUrl: string
  cancelUrl: string
}
export interface GiftCheckoutResponse {
  checkoutUrl: string
  sessionId: string
  totals: { currency: 'USD'; itemsCents: number; shippingCents: number; taxCents: number | null; totalCents: number }
}

/** Written by the paid-order webhook, once per (user, previewId), never per line or copy; does not consume purchased credits. */
export interface ArtworkUnlockGrant {
  previewId: string
  orderId: string
  reason: 'physical_purchase'
  grantedAt: string
}

/** Line status after payment, from the existing job queue (one job per line, separate approved print file per line). */
export interface GiftOrderLineStatus {
  lineIndex: number
  productId: string
  printFile: 'pending' | 'processing' | 'approved' | 'review' | 'failed'
  reviewReason?: string
}
