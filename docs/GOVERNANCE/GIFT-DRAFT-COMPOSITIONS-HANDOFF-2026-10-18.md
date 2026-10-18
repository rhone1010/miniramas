# Gift: compositions reviewed BEFORE payment (backend contract for Codex)

Journey: Upload -> Effects -> 6+6 free previews -> Select products -> Generate/review product-specific artwork -> Approve -> Checkout -> Submit order.
Status: implemented and tested on the in-memory store; NOT deployed. Migration 052 is still NOT applied. Checkout enforcement is OFF by default.

## What changed (minimum)
- A composition now exists for a DRAFT line: the session's chosen lines, products from the current catalog, no order needed. Same rows, same line ids, same endpoints; after payment they continue as the purchased composition (geometry from the checkout snapshot).
  - `POST .../compositions` (ensure), `POST .../compositions/:ref/approve`, `GET .../lines/:lineId/mockup` work with no order and with an unpaid order; after payment, as before (only while the order awaits artwork approval).
  - Still paid-only: `.../correct` (the included correction is tracked on the paid order line), the final order approval (`approve`), and everything that releases to the lab. Approving compositions before payment releases nothing.
- Session view: `compositions[]` is now populated for a draft (one entry per chosen line). `geometries[].geometrySource` is `catalog` before checkout, `frozen`/`legacy_catalog` after. Mockup `geometrySource` can be `catalog`, `frozen` or `legacy_catalog`; `frozenCatalogVersion` is null for a draft.
- Compositions record the SKU they were made for. Changing a line's product (`PUT lines`) or removing a line supersedes that line's composition and approval; other lines keep theirs. Switching the favorite away and back reuses the stored files (no new paid call).
- Checkout (`requireReviewedCompositions`, env `GIFT_COMPOSITIONS_BEFORE_PAYMENT=1`, default off): refuses with 409 `compositions_not_approved` unless every line has an APPROVED composition of the selected artwork that fits the product being frozen; records those exact compositions on the order (`items[i].frozen.composition`: compositionId, previewId, attempt, repairSeq, artworkSha256, width, height, sku, approvedAt). A different set of compositions replaces the open Stripe session like any other change.
- Repair (`repairLine`, operator-only): works for a draft (no order, or unpaid) and for a purchased composition awaiting approval; never after the order is approved/released. The replacement is `ready` (not approved): the customer re-approves it. The correction entitlement is never touched. Migration 052's `gift_complete_repair` was widened to the same states.

## What Codex needs
1. Call ensure/approve/mockup before checkout (no order). Show `compositions[].status` (`ready` -> approve -> `approved`) and the mockup per line.
2. Handle 409 `compositions_not_approved` at checkout (go back to review) and 409 `composition_geometry_mismatch` on mockup/approve (technical recovery; an operator repairs it, the page offers nothing).
3. After a repair the line returns to `ready` with a new `compositionId`; a page holding the old id gets 409 `stale_composition` from the mockup route. The customer approves the new one.
4. Checkout sends disclosure `2026-10-18-3` and the page shows the exact text.
5. Do not enable `GIFT_COMPOSITIONS_BEFORE_PAYMENT` until the page does steps 1-2; with it off the old order (checkout, then compose) still works.

## Corrections (final)
- ONE included correction per product (line), counted across the purchase boundary. `POST .../compositions/:ref/correct` now works on a draft and on a paid order awaiting approval. A draft correction is an attempt-2 composition row; the paid order line starts at 0 but the row keeps the entitlement spent (`correctionsRemaining` is 0 before and after payment). Changing the favorite does not give another one.
- Technical repairs (operator-only) never use it. After a repair the line is `ready` again and `correctionsRemaining` is unchanged.
- No cap is placed on product compositions: one per selected product, compatible compositions are shared and reused (same shape + artwork), including after switching the favorite away and back.

## Switch (final)
The approved customer sequence is: Photo, Effects, 6+6 free previews, Favorite, Select products, Stripe test checkout, Generate product compositions, Clean product mockup review, Individual approval; manufacturing release is a separate explicit action. Composing BEFORE payment (everything above about drafts) is therefore an optional capability that is OFF: it turns on only with `GIFT_COMPOSITIONS_BEFORE_PAYMENT=1` (both `draftCompositions` and `requireReviewedCompositions`). With it off, compose/approve/correct/mockup need a paid order exactly as before, and checkout does not look at compositions. Disclosure `2026-10-18-3` describes this sequence.

## Decisions left
- Draft mockups show the catalog product as of now; checkout then freezes it. If the catalog geometry changed in between, the composition fails the shape check and the customer is asked to review again.
