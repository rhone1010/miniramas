// lib/v1/print/gift-enablement.ts
//
// WHICH GIFT SHOP PRODUCTS CAN BE BOUGHT. The four products Matted Frame, Framed Canvas, Photo Mug and Greeting Card are fully built (SKU, attributes, geometry,
// production profile, composition, print file, mockup input) and stay VISIBLE in the catalog; this file is the one place that says whether each may be SOLD.
// A product is sold only when all of these are true, and the catalog reports the first one that is not as its disabledReason:
//   1. no hold below                                   (a verified Prodigi fact is still open for that product)
//   2. an approved retail price                        (SkuEntry.retailApproved is not false)
//   3. its family is in GIFT_ENABLED_FAMILIES          (the owner's decision to launch)
// Mockup photography is NOT a condition (2026-10-22): a product without an approved in-situ scene is reviewed through the exact product-shaped artwork (presentation.ts).
// Nothing here changes the four original launch families.

import type { DisabledReason, ProductFamily } from './catalog-types'

/**
 * Owner decision (2026-10-22): the Print Shop offers all eight families, so the four Gift Shop families are launched. A family being launched does NOT price anything: a product is
 * still sold only with an approved retail price (rule 2 above), so every product whose price is still a placeholder stays disabled as 'retail_price_pending'.
 */
export const GIFT_ENABLED_FAMILIES: ProductFamily[] = ['matted', 'framed_canvas', 'mug', 'card']

/**
 * Families whose product mockup (the clean paid review image) is calibrated and approved. The mug and card templates exist as visual tests
 * ('awaiting-visual-approval'); matted frame and framed canvas have none yet. Codex adds a family here when its template is approved.
 */
/** @deprecated No longer an eligibility condition (see above). Kept only as the record of which families have a calibrated legacy template. */
export const GIFT_MOCKUP_READY: ProductFamily[] = []

/**
 * Product-level holds: a verified Prodigi fact that is still open for one product (the rest of its family is unaffected). None today.
 * framed_canvas:8x12 was held until 2026-10-23: Prodigi lists the SKU 8 wide x 12 tall but its print area is 3654 x 2454. A canvas is the same object either way, so it is now PRESENTED as the
 * landscape 12 x 8 its print area describes (picture 3:2, file exactly the print area, accepted by the Prodigi sandbox); a portrait 8 x 12 presentation is not offered.
 */
export const GIFT_PRODUCT_HOLDS: Record<string, DisabledReason> = {}
