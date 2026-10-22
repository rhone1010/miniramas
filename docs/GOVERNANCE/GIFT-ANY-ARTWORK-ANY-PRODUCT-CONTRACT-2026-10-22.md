# Any artwork -> any supported product: backend contract for Codex 1 (Giftshop / Product Studio), 2026-10-22

Backend only, committed locally. Supersedes the earlier "sell only products with an approved scene" rule (GIFT-PRODUCTION-READINESS-2026-10-21 and GIFT-LAUNCH-ENV-AND-STRIPE-2026-10-21 describe that rule; where they differ, this document is current).

## The three questions are now answered separately
1. **Purchasable?** A verified Prodigi product, launched, with an approved price (catalog `status: 'launch'`). Shape and photography have no say. 32 products: Fine Art, Premium, Canvas and Classic Frame in 8x8, 12x12, 16x16, 20x20 (square) and 8x12, 12x18, 16x24, 20x30 (portrait). All 32 are known to the Prodigi sandbox and quote (`scripts/check-prodigi-sandbox.ts`, read-only).
2. **What must be done to the artwork?** Nothing, a bounded extension, or an NB2.1 adaptation. Every launch product has a plan for every series (checked for Portraits, Pets and Groups of 2 to 9 people). The selected artwork is never modified.
3. **How will the customer see it before approving?** A photograph of the product with their artwork in it (an approved scene) where one truthfully shows that exact configuration; otherwise their artwork exactly as it will be printed, in the product's shape ("artwork-only"), with a disclosure. A missing photograph never makes a product unpurchasable and never produces an invented picture of a product.

The sale gate no longer asks about scenes: `setLines` and checkout refuse only products that cannot be bought (not launched, no approved price, unknown). Optional strict mode: `GIFT_REQUIRE_APPROVED_SCENE=1` (off by default) restores "no scene, no sale".

## 1. Availability: `GET /api/v1/gift/sessions/{id}/availability` -> `AvailabilityView`
Per product, for THIS session's artwork (owner only; no favorite is required for the adaptation numbers, which come from the series' master shape):
```
{ contractVersion: 1, sessionId, favoriteId | null, masterAspect,
  orientations: { square: {supported:true}, portrait: {supported:true}, landscape: {supported:false, reason:'no_landscape_sku_verified_with_prodigi'} },
  products: [{
    productId, sku, family, familyLabel, size, label, orientation, retailCents,
    purchasable, disabledReason | null,                     // the ONLY purchase decision
    adaptation: null | { required, method: 'none'|'deterministic'|'generated', fit: 'exact'|'resample'|'extend',
                         extensionFraction, generationAspect | null, paidCalls: { nb21, outpaint }, originalPreserved: true },
    preview: { representation: 'scene'|'artwork_only', sceneId | null, previewBasis: 'in_situ_mockup'|'product_shaped_artwork',
               physicalProductShown, disclosureCode: 'artwork_only_preview' | null, disclosure | null },
    approval: { possible, basis }
  }] }
```
`adaptation.paidCalls` are estimates of what the composition makes AFTER purchase (nothing is generated before payment). `method: 'none'` = the artwork already has the product's shape; `'deterministic'` = bounded extension (<= 2% free mirror, 2-20% one paid outpaint); `'generated'` = one NB2.1 adaptation of the same effect at the nearest ratio the series supports, then bounded extension to the exact shape. Non-launch products appear with `purchasable: false`, a `disabledReason` and `adaptation: null`. Use this endpoint, not `GET /api/v1/print/catalog`, for the Studio (the Print Shop catalog's `selectable`/`artworkFit` keep the Print Shop's own 20% rule).

## 2. Previews
**Pre-checkout: `GET .../product-preview?productId=` (and `&provisional=1`)** — statuses unchanged: `ready`, `adaptation_required` (numbers, no render), `provisional` (opt-in), `not_available` (now only for non-launch or unknown products; `no_mockup_template` is gone). `ready` and `provisional` gain `renderer: 'scene' | 'artwork' | 'calibrated'` plus the representation block below. For a product with no approved scene: `renderer: 'artwork'`, a watermarked JPEG of the favorite in the product's shape (mirror extension only inside the 2% band, no crop, no stretch); `provisional` shows the whole favorite on a neutral surround.
**Purchased line: `GET .../lines/{lineId}/mockup`** — same fields. Without a scene it returns the COMPOSED artwork exactly as it will be printed, in the product's shape, reduced for display (clean for a paid line, watermarked before payment), `renderer: 'artwork'`. It is never a template picture of a product.
Representation block (also on `MockupView`, additive):
```
representation: 'scene' | 'artwork_only' | 'calibrated_template'   // calibrated_template only if the legacy GIFT_NO_SCENE_PRESENTATION=calibrated is set (do not)
physicalProductShown: boolean          // false for artwork_only
previewBasis: 'in_situ_mockup' | 'product_shaped_artwork'
disclosureCode: 'artwork_only_preview' | null
disclosure: string | null              // default English: "This shows your artwork exactly as it will be printed, in this product's shape. It is not a photograph of the product."
```
RULE for the UI: when `representation === 'artwork_only'`, show the disclosure (your own wording is fine, keyed on `disclosureCode`) next to the picture and do not draw product chrome around it that implies the physical product.

## 3. Adaptation, corrections, approval (unchanged mechanics, new clarity)
Compositions: `POST .../compositions` after payment, as before: the plan above, the customer's original artwork preserved untouched (the composition is a separate file and row), durable job state. Corrections: one free per line, spent only by the customer (`correctionsRemaining`), identical for scene and artwork-only lines. Per-line approval: `POST .../compositions/{id}/approve` needs only a composition of the right shape; it does not look at photography. Final approval: `POST .../finalize` is unchanged (approval only; release to manufacturing stays operator-only). So a customer can buy, review (scene or artwork-only), correct and approve any of the 32 products.

## 4. What the frontend must change (Codex 1)
- Stop gating Final Approval and the cart on `renderer === 'scene'` / `isApprovedScene`: that gate would block products the backend now sells. Gate on `purchasable` (availability) and on the line's composition status.
- Render `renderer: 'artwork'` pictures with the disclosure; keep scenes where `representation === 'scene'`.
- Do not offer landscape (`orientations.landscape.supported === false`); do not offer products with `purchasable: false`.
- Until the Wizard is updated the backend will still sell products whose Final Approval screen says "Not currently available". Coordinate the release: set `GIFT_REQUIRE_APPROVED_SCENE=1` in the environment as a stop-gap if the frontend lags.

## 5. What is purchasable now, and what is not
Purchasable (32): the four launch families in the 8 square and portrait sizes above, for Portraits, Pets and Groups artwork alike (group size changes only the NB2.1 ratio, see `adaptation.generationAspect`). Shown in a scene: all Fine Art sizes (square and portrait), Premium and Canvas squares (16 products). Shown artwork-only: Classic Frame (8), Premium portraits (4), Canvas portraits (4).
NOT purchasable, and why: Matted Frame, Framed Canvas, Photo Mug, Greeting Card (owner launch decision and price approval; `GIFT_ENABLED_FAMILIES` is empty; Framed Canvas 8x12 additionally has an open Prodigi orientation question); retail price pending; none of this is photography any more.
NOT supported, no verified Prodigi basis: **landscape products**. Prodigi publishes no landscape SKU (GLOBAL-FAP-18X12, -12X8, -24X16, -30X20, GLOBAL-HPR/CAN/CFP-18X12 and GLOBAL-FRA-CAN-12X8 all answer 404 in the sandbox; checked 2026-10-22), so a landscape product could only be a portrait SKU with a file turned 90 degrees, and the catalog records that as `rotatedFile.verifiedWithProdigi: false`. A landscape artwork is adapted to the portrait or square product the customer chose (NB2.1), exactly as before. To enable landscape: Prodigi confirms (or a sandbox order proves) that a turned file on the portrait SKU prints correctly and how each family hangs; then landscape product ids can be added with the turned file. That needs a Prodigi answer or a sandbox order, which this environment does not do.

## Verified
`no-scene-presentation.test.ts` (8: availability, artwork-only previews, line mockups, approval and finalize of framed, premium-portrait and canvas lines, no template renderer called), the updated gate tests in `orders.test.ts`, `collection-entrance.test.ts`, `product-selector-compat.test.ts`, the legacy template tests (run with `GIFT_NO_SCENE_PRESENTATION=calibrated`), and the Prodigi sandbox check of all 32 SKUs. Not verified: a browser walk of the artwork-only screens (the Wizard has not been updated).
