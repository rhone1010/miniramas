// lib/v1/print/gift-enablement.ts
//
// WHICH GIFT SHOP PRODUCTS CAN BE BOUGHT. The four products Matted Frame, Framed Canvas, Photo Mug and Greeting Card are fully built (SKU, attributes, geometry,
// production profile, composition, print file, mockup input) and stay VISIBLE in the catalog; this file is the one place that says whether each may be SOLD.
// A product is sold only when all of these are true, and the catalog reports the first one that is not as its disabledReason:
//   1. no hold below                                   (a verified Prodigi fact is still open for that product)
//   2. an approved retail price                        (SkuEntry.retailApproved is not false)
//   3. its family is in GIFT_ENABLED_FAMILIES          (the owner's decision to launch)
// Mockup photography is NOT a condition (2026-10-22): a product without an approved in-situ scene is reviewed through the exact product-shaped artwork (presentation.ts).
// Nothing here changes the four launch families or the Print Shop.

import type { DisabledReason, ProductFamily } from './catalog-types'

/**
 * Owner decision: the families that may be sold. 2026-10-23: Matted Frame and Framed Canvas. Only products with an approved retail price are actually sellable (rule 2 above): their eight SQUARE sizes carry the
 * prices from the original SKU map; the rectangles are still 'retail_price_pending' and framed_canvas:8x12 also has its Prodigi hold. The Photo Mug and the Greeting Card stay out until their prices are approved.
 */
export const GIFT_ENABLED_FAMILIES: ProductFamily[] = ['matted', 'framed_canvas']

/**
 * Families whose product mockup (the clean paid review image) is calibrated and approved. The mug and card templates exist as visual tests
 * ('awaiting-visual-approval'); matted frame and framed canvas have none yet. Codex adds a family here when its template is approved.
 */
/** @deprecated No longer an eligibility condition (see above). Kept only as the record of which families have a calibrated legacy template. */
export const GIFT_MOCKUP_READY: ProductFamily[] = []

/** Product-level holds: a verified Prodigi fact that is still open for one product (the rest of its family is unaffected). */
export const GIFT_PRODUCT_HOLDS: Record<string, DisabledReason> = {
  // Prodigi's own data disagrees with itself: the SKU is listed 8 wide x 12 tall, but its print area is 3654 x 2454 (landscape). Every other framed-canvas
  // rectangle is consistent. Order geometry cannot be proven without a sandbox order, which is not permitted here: Prodigi must confirm which is right.
  'framed_canvas:8x12': 'orientation_unverified',
}
