// lib/v1/gift/types.ts
//
// THE GIFT WIZARD API CONTRACT. Types only, dependency-free apart from the catalog contract: Codex can copy this file.
// Names follow Codex's contracts.next.ts where one exists (Series, sourceRef, lineId, effectIds, BatchRequest).
//
// EVERYTHING HERE IS SERVER-OWNED. The browser sends: a photo, product choices, optional effect picks and an idempotency
// key. It never sends proof of payment, a price, a batch count, a free-batch flag or a clean-image URL, and none of those
// is accepted if sent. Clean masters never appear in any shape below.
//
// Auth: every endpoint requires a signed-in account (401 { error: 'sign_in_required' }) and only ever sees that
// account's sessions (404 { error: 'session_not_found' } for anyone else's, indistinguishable from a missing one).

import type { Orientation } from '../print/catalog-types'

export const GIFT_CONTRACT_VERSION = 1

export type Series = 'portraits' | 'pets' | 'groups'
export type PreviewStatus = 'pending' | 'generating' | 'ready' | 'failed'
export type BatchKind = 'free' | 'paid'

/** What the source photo was identified as. Never a customer question. */
export interface SourceView {
  sourceRef: string                   // opaque id for this session's photo; not a path or URL
  width: number
  height: number
  series: Series
  /** Groups only: how many people were counted. */
  peopleCount: number | null
}

/** A product the customer chose BEFORE art exists. productId and size come from the canonical catalog (/api/v1/print/catalog). */
export interface GiftLine { lineId: string; productId: string; size: string; copies: number }

/** The geometry a line will eventually print at, from the catalog. Informational: the server derives it. */
/**
 * The authoritative geometry a purchased line needs, from the canonical catalog, plus how the server will make it. Available as soon as
 * the products are chosen (before checkout), so the page can say what will happen and render the right mockup shape.
 */
export interface LineGeometry {
  lineId: string
  productId: string
  pictureAspect: number               // width / height of the picture area
  orientation: Orientation
  requiredPx: { w: number; h: number }   // the whole lab file, in the orientation Prodigi defines
  picturePx: { w: number; h: number }    // the picture inside it (canvas wrap excluded)
  wrapPx: { left: number; right: number; top: number; bottom: number }
  /** Lines with the same key share ONE composition (and its files); each keeps its own approval, correction and print job. */
  geometryKey: string
  sharedWithLineIds: string[]            // the OTHER lines with this key
  /** 'deterministic': the selected artwork is adapted (never cropped or distorted). 'generated': a separate NB2.1 generation of the same effect at generationAspect, then bounded extension. */
  method: 'deterministic' | 'generated'
  fit: 'exact' | 'resample' | 'extend'
  extensionFraction: number
  generationAspect: string | null        // NB2.1 ratio requested for 'generated', else null
  /** The Prodigi SKU this line sells (frozen once purchased). */
  sku: string | null
  /** 'catalog': not purchased yet, today's catalog. 'frozen': the snapshot taken at checkout. 'legacy_catalog': an order that predates snapshots, resolved from today's catalog ONLY because the SKU still matches. */
  geometrySource: 'catalog' | 'frozen' | 'legacy_catalog'
  /** The catalog version the snapshot was taken at; null when not purchased or legacy. */
  frozenCatalogVersion: string | null
  /** 'unvalidated' for Groups photo regeneration (see policy.ts). Treat it as unverified until it is cleared. */
  adaptationValidation: 'not_applicable' | 'provisional' | 'unvalidated'
}

export interface PreviewView {
  previewId: string
  slot: number                        // 1..6 within its batch
  effectId: string
  status: PreviewStatus
  /** Signed, short-lived URL of the BAKED-WATERMARK preview. Present only when status is 'ready'. */
  url: string | null
  width: number | null
  height: number | null
  retryable: boolean                  // failed and attempts remain
}

export interface BatchView {
  batchIndex: number                  // 1-based within the session
  kind: BatchKind
  complete: boolean                   // all six previews ready
  previews: PreviewView[]             // always six, in slot order
}

/** What the customer's next batch would cost, decided by the server from verified records. */
export type NextBatch =
  | { kind: 'free' }
  | { kind: 'paid'; packAvailable: true }
  | { kind: 'payment_required'; amountCents: 299; currency: 'USD' }
  | { kind: 'blocked'; reason: 'order_payment_required' | 'order_not_awaiting_artwork' | 'order_refunded' | 'refund_pending' | 'previous_batch_incomplete' | 'no_effects_remaining' | 'session_expired' }

export interface SessionView {
  contractVersion: typeof GIFT_CONTRACT_VERSION
  sessionId: string
  source: SourceView
  lines: GiftLine[]
  geometries: LineGeometry[]
  /** The aspect every preview master is generated at, decided by the server from the series (and people count). */
  masterAspect: string
  batches: BatchView[]
  usedEffectIds: string[]
  /** freeBatchesTotal is 0 until the product order is paid, then 2 (two free six-image batches per paid order). */
  entitlement: { freeBatchesTotal: number; freeBatchesUsed: number; paidPacksAvailable: number }
  nextBatch: NextBatch
  expiresAt: string
  catalogVersion: string
  order: OrderView
  /** The one selected artwork (a preview id), or null. */
  artworkPreviewId: string | null
  /** One entry per purchased line, once the order is paid. */
  compositions: CompositionView[]
}

export type OrderState = 'none' | 'checkout_open' | 'awaiting_artwork' | 'approved' | 'with_lab' | 'refund_requested' | 'refunded' | 'cancelled'
export interface OrderView {
  orderId: string | null
  state: OrderState
  freeBatchesGranted: number
  approvedAt: string | null
  /** The My Collection piece created at approval (the one digital unlock), or null. */
  unlockPortfolioId: string | null
  totalCents: number | null
  disclosureVersion: string | null
}
/** Product-specific composition of the selected artwork for one purchased line. Nothing is manufactured until every line is approved. */
export interface CompositionView {
  lineId: string
  productId: string
  /** Same as LineGeometry.geometryKey/method/generationAspect/sharedWithLineIds, so one object per line is enough to render a mockup. */
  geometryKey: string | null
  method: 'deterministic' | 'generated' | null
  generationAspect: string | null
  sharedWithLineIds: string[]
  picturePx: { w: number; h: number } | null
  sku: string | null
  geometrySource: 'catalog' | 'frozen' | 'legacy_catalog'
  adaptationValidation: 'not_applicable' | 'provisional' | 'unvalidated'
  /** 'none': adapted from the selected artwork. 'favorite_reference': a new NB2.1 generation that was given the selected artwork as a reference.
   *  'photo_regeneration': a new generation from the customer's photograph (Groups). A new generation is NOT identical to the selected artwork: the customer approves what they see. */
  generationMode: 'none' | 'favorite_reference' | 'photo_regeneration' | null
  /** The artwork this composition is made from: the selected favorite. */
  sourceArtworkId: string | null
  status: 'none' | 'ready' | 'approved'
  compositionId: string | null
  attempt: number                      // 1, or 2 after the free correction
  correctionsRemaining: number         // 1 until the free correction is used; further changes go to Concierge
  previewUrl: string | null            // signed, watermarked, product-shaped
  width: number | null
  height: number | null
  fit: 'exact' | 'resample' | 'extend' | null
}

// ── requests and responses ─────────────────────────────────────────────

/** POST /api/v1/gift/sessions  { image_b64 }  -> 201 SessionView */
export interface CreateSessionRequest { image_b64: string }
export type CreateSessionError =
  | 'image_b64_required' | 'image_too_large' | 'image_not_base64' | 'image_unreadable'   // 400, source validation (shared with the Foyer)
  | 'sign_in_required'                                                                     // 401
  | 'age_restricted'                                                                       // 403, nothing is stored
  | 'unsupported_subject'                                                                  // 422, not a person, group or pet
  | 'analysis_unavailable'                                                                 // 503, retry

/** PUT /api/v1/gift/sessions/{id}/lines  { lines }  -> 200 SessionView. Replaces the selection. Launch products only. */
export interface SetLinesRequest { lines: Array<{ lineId: string; productId: string; copies: number }> }
export type SetLinesError = 'invalid_lines' | 'product_not_available' | 'invalid_quantity' | 'duplicate_line' | 'catalog_unavailable'

/** POST /api/v1/gift/sessions/{id}/batches. Reserves the next batch (free or paid) and generates it. */
export interface BatchRequest {
  /** 8..80 characters, unique per intended batch. Repeating it returns the SAME batch and never charges or generates twice. */
  idempotencyKey: string
  /** 0..6 effects the customer picked (hybrid selection). The server fills the rest, never repeating an effect used in this session. */
  effectIds?: string[]
}
export type BatchResponse =
  | { status: 'ok'; batch: BatchView; session: SessionView }
  | { status: 'partial'; batch: BatchView; session: SessionView; retryAfterSeconds: number }   // some previews failed or are still rendering: POST .../retry
export type BatchError =
  | 'invalid_idempotency_key' | 'invalid_effect_selection' | 'effect_already_used' | 'not_enough_effects'   // 400
  | 'session_not_found'                                                                                       // 404
  | 'payment_required'                                                                                        // 402 { error, amountCents: 299, currency: 'USD' }
  | 'previous_batch_incomplete' | 'session_expired'                                                           // 409
  | 'generation_unavailable'                                                                                  // 503

/** GET /api/v1/gift/sessions/{id}/batches/{n} -> BatchView.   POST .../{n}/retry -> BatchResponse (only failed or unfinished previews run). */

/** POST /api/v1/gift/preview-pack/checkout { returnPath } -> embedded Stripe Checkout for ONE six-preview pack ($2.99).
 *  returnPath must be one of GIFT_RETURN_PATHS; the server builds the full return URL on its own origin. */
export const GIFT_RETURN_PATHS = ['/gift-wizard', '/gift-wizard.next.html'] as const
export interface PackCheckoutRequest { returnPath: typeof GIFT_RETURN_PATHS[number] }
export interface PackCheckoutResponse { clientSecret: string; stripeSessionId: string; amountCents: 299; publishableKey: string }
/** Payment is only ever recorded by the signed Stripe webhook (or POST /preview-pack/confirm re-verifying with Stripe). */
export interface PackConfirmRequest { stripeSessionId: string }
export interface PackConfirmResponse { confirmed: boolean; paidPacksAvailable: number }

/** DELETE /api/v1/gift/sessions/{id} -> 204. Removes the source photo, masters, previews and rows now. */

// ── purchase before generation (migration 048) ──────────────────────────

/** The disclosure the customer must see and accept before paying. The server records the version and refuses without it. */
export interface Disclosure { version: string; text: string }

/** POST /api/v1/gift/sessions/{id}/checkout -> embedded Stripe Checkout for the selected products (catalog prices, a Prodigi shipping quote). */
export interface GiftCheckoutRequest {
  email: string
  shippingAddress: { name: string; line1: string; line2?: string; city: string; state?: string; postcode: string; countryCode: string }
  shippingMethod?: 'Budget' | 'Standard' | 'Express' | 'Overnight'
  /** Must be literally true: the customer saw the Disclosure. */
  disclosureAccepted: true
  returnPath: '/gift-wizard' | '/gift-wizard.next.html'
}
export interface GiftCheckoutResponse {
  clientSecret: string
  stripeSessionId: string
  publishableKey: string
  totals: { itemsCents: number; shippingCents: number; totalCents: number }
  disclosure: Disclosure
}
export type GiftCheckoutError =
  | 'disclosure_required' | 'no_lines' | 'invalid_email' | 'invalid_address' | 'product_not_available' | 'product_not_available_for_artwork'
  | 'fulfilment_unavailable' | 'shipping_quote_failed' | 'order_already_paid' | 'checkout_unavailable' | 'session_not_found'

/** POST /api/v1/gift/orders/confirm { stripeSessionId } -> re-verifies with Stripe (the webhook runs the same code). Idempotent. */
export interface OrderConfirmRequest { stripeSessionId: string }
export interface OrderConfirmResponse { confirmed: boolean; session?: SessionView }

/** POST /api/v1/gift/sessions/{id}/artwork { previewId } -> SessionView. Picks THE artwork; may be changed until approval. */
export interface SelectArtworkRequest { previewId: string }
/** POST /api/v1/gift/sessions/{id}/compositions -> SessionView. Prepares one composition per purchased line from the selected artwork. */
/** POST /api/v1/gift/sessions/{id}/compositions/{lineId}/correct -> SessionView. The ONE free correction per line; 409 correction_limit afterwards (contact Concierge). */
/** POST /api/v1/gift/sessions/{id}/compositions/{compositionId}/approve -> SessionView. */
/** POST /api/v1/gift/sessions/{id}/approve -> SessionView. Every line approved: creates the unlocked My Collection piece and releases the order to production. */
/** POST /api/v1/gift/sessions/{id}/refund-request { reason } -> Concierge request for a full refund; blocks generation and approval until resolved. */
export interface RefundRequestBody { reason?: string }
export interface RefundRequestResponse { requestId: string; state: 'requested'; message: string }

/**
 * GET /api/v1/gift/sessions/{id}/lines/{lineId}/mockup[?compositionId=...] : the watermarked product mockup of a purchased line's CURRENT
 * composition, rendered server-side by the existing Node/Sharp compositor. A visualization only: it authorizes no purchase, approval or fulfilment.
 * `compositionId`, if sent, is the composition the page is showing; a different current one answers 409 stale_composition.
 * identityKey is the stable rendering identity (never a URL): the page may cache by it, and it changes whenever the artwork, composition,
 * attempt, template revision or frozen product configuration changes. `url` is signed and expires at urlExpiresAt; call again to refresh it.
 */
export interface MockupView {
  contractVersion: 1
  sessionId: string
  lineId: string
  productId: string
  sku: string
  compositionId: string
  attempt: number
  compositionStatus: 'ready' | 'approved'
  sourceArtworkId: string
  templateId: string
  templateRevision: string
  identityKey: string
  geometrySource: 'frozen' | 'legacy_catalog'
  frozenCatalogVersion: string | null
  url: string
  urlExpiresAt: string
  width: number
  height: number
  /** true when an existing mockup with the same identity was re-signed and nothing was rendered. */
  cached: boolean
  watermarked: true
  productionPrintFile: false
  purchaseAuthorization: false
  /** Crop and calibration metadata from the compositor (never a browser crop control). */
  crop: Record<string, unknown> | null
}
