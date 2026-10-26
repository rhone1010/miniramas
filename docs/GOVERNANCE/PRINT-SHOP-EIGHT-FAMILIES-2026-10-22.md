# Print Shop x Gift Shop product engine: eight families from owned artwork (backend) - 2026-10-22

Branch `cc/printshop-eight-family`, based on `59d1ca9d`. Backend only: no frontend layout, no deploy, no manufacturing order, no migration.

## What the Print Shop is now
One catalog (`lib/v1/print/catalog.ts`), eight families: Fine Art Print, Premium Fine Art Print, Classic Framed Print, Gallery Canvas, Matted Frame, Framed Canvas, Ceramic Mug, Greeting Card.
`GIFT_ENABLED_FAMILIES` now lists the four Gift families (owner decision of this assignment). A product is still sold ONLY with an approved retail price:
every product whose price is a placeholder stays `disabled` / `retail_price_pending` (see blockers). Nothing was priced, invented or bypassed.

## The journey (Codex 1: use these, nothing new to build on the server)
Collection -> `POST /api/v1/gift/sessions/from-collection {previewId}` -> `GET .../availability` -> `PUT .../lines` -> `GET .../product-preview?productId=` -> `POST .../compositions`
-> `POST .../compositions/{ref}/approve` -> `POST .../checkout` (Stripe embedded) -> `POST /api/v1/gift/orders/confirm` -> `POST .../finalize`. Release to manufacturing remains the separate operator step.
Verified end to end through the real handlers: `lib/v1/gift/print-shop-owned-artwork.test.ts`.

Changed server contracts:
- `from-collection` no longer needs the original photograph. With no photograph the session is the owned artwork alone: `source.photoUrl` is null, no analysis runs, nothing is stored as a source photo. With a photograph it behaves as before.
- `availability`: a product the owned artwork cannot become without the missing photograph has `purchasable: false`, `disabledReason: 'source_photograph_not_kept'`.
- `PUT lines` for such a product: 409 `product_not_available_for_artwork`. `product-preview` for it: `status: 'not_available', reason: 'product_not_available_for_artwork'`.
- `finalize` no longer needs the photograph for a Collection session (the owned piece already exists; no second My Collection piece is created).
- Legacy `{size, finish}` routes (`/api/v1/print/source|quote|checkout`) read the same catalog (`sellableSku`, `printShopCatalog`); the mug and the card are never turned; the file rules are the ones the print file is made with (`productPlan` in geometry.ts).

Plan context is one function, `planContextFor(rec)` (composition-plan.ts), used by availability, selection, composition, checkout, preview and the session view.

## Artwork rules, as built
- The owned artwork is read, copied once as the session's master, and never written. Square owned art is used as is on square products and on the mug panel (pixel-identical composition). 
- Other shapes use only the existing bounded adaptation: mirror/outpaint extension up to 20% (matted 12x18 and the card from a 2:3 piece), shown to the customer as `adaptation_required` until the real composition exists and is approved. The whole owned artwork is inside the composition, unchanged.
- A shape that needs the existing generated adaptation (square -> card or rectangles) is available only while the customer's photograph still exists. Never cropped, never stretched, never generated without the customer asking for that composition.
- No Gift preview allowance is read or consumed by a Collection session (`startBatch` stays 409 `collection_session_no_generation`).

## Genuine remaining blockers
1. PRICES (Rich). No approved price: matted 8x12, 12x18, 16x24, 20x30; framed canvas 12x18, 16x24, 20x30; mug; card. Proposals are in GIFT-FOUR-PRODUCTS-2026-10-18.md section 5. To open a product: remove `retailApproved: false` and set `retailCents` in sku-map.ts. `framed_canvas:8x12` also needs Prodigi's answer on its orientation (hold). Until then only the squares of matted frame and framed canvas are new on sale, so today six families sell on a square piece and the mug and card are visible but disabled.
2. CHECKOUT DISCLOSURE COPY (Rich). `DISCLOSURE` (orders.ts) talks about free previews and sets of six; it is wrong for a Collection purchase. The server still requires the customer to accept the current version and shows it to Stripe. A Collection-appropriate text is customer-facing copy only Rich can supply; nothing was written.
3. DECISION (Rich). After the 60-day photograph deletion a square piece cannot become a rectangle or a card, and a 2:3 piece cannot become a square product or the mug. If these should be possible, an owned-artwork-only adaptation contract has to be approved first; today they are unavailable, not approximated.
4. NOT EXERCISED: card entry and payment completion in a browser, the Stripe webhook against a deployed Preview, and a Prodigi sandbox order (not permitted here). Verified instead: a real Stripe TEST-mode embedded session (opt-in test, expired after the check), payment confirmation and final approval through the fakes, and the print file for all eight families.
5. MIGRATIONS. None added. Collection sessions rely on 055, 056 and 057 already being applied where this runs.
