# Gift Wizard / Print Shop integration: catalog verification, geometry and contracts

Date: 2026-10-15. Inspection and sandbox verification only. No orders, no paid generation, nothing deployed, no Production access.
Sources read: Codex's `public/gift-wizard/INTEGRATION.next.txt` and `REPORT.next.txt` (the October 15 handoff in the repo), `domain.next.ts`; the canonical Print Shop code (`sku-map.ts`, `geometry.ts`, `prodigi-client.ts`, `asset-pipeline.ts`, `upscale/*`, `owned-source.ts`, checkout route); `lib/store/preview.ts`, `collection-unlocks.ts`.
Data: `prodigi-catalog-verified-2026-10-15.json` (this folder). Contracts: `gift-wizard-contracts.proposed.ts` (types only, type-checks, imported by nothing).

The handoff used is Codex's `INTEGRATION.next.txt` (revised 17:26) and `contracts.next.ts`. No other handoff document was found on disk; if a separate one exists, reconcile this report against it.

## 1. Verified now (Prodigi sandbox, read-only)

55 SKUs queried (`GET /Products/{sku}`) and quoted (`POST /Quotes`, US, one and two copies, Budget and Standard); all 55 exist. A guessed 5x7 gloss card, `GLOBAL-GRE-GLOS-5X7-BLA`, does not exist.

- Every SKU in `sku-map.ts` exists: 24 squares (6 families x 4) and the 16 launch rectangles (fine art, premium, canvas, classic frame at 8x12, 12x18, 16x24, 20x30). **All 40 print areas match `requiredPx` in the map exactly.** All ship to the US.
- Also exist, not in the launch map: framed canvas rectangles (`GLOBAL-FRA-CAN-8X12`..`20X30`) and matted frame rectangles (`GLOBAL-CFPM-8X12`..`20X30`).
- Mug `GLOBAL-MUG-W`: print area 2670x1110, ships to 116 countries, the US lab is not used (fulfilled from GB).
- Cards: `GLOBAL-GRE-MOH-7X5-BLA` (the only card quoted with a US lab), `-MOH-7X5-DIR`, `-GLOS-6X4-BLA/-DIR`, `-GLOS-7X5-BLA`, `-GLOS-6X6-BLA`. All one default print area (a flat spread): 7x5 = 6118x2161, 6x4 = 4937x1854, 6x6 = 6732x1712.

Geometry inventory (pixels as Prodigi returns them; "wrap" is the extra beyond the picture):

| Family | Squares (picture / final) | Rectangles | Notes |
|---|---|---|---|
| Fine art, premium | 8: 2400, 12: 3600, 16: 4800, 20: 6000 | 8x12 = 2400x3600, 12x18 = 3600x5400, 16x24 = 4800x7200, 20x30 = 6000x9000 | flat, no bleed, 300 PPI |
| Gallery canvas | final = picture + 54 (27 px each side) | final 2454x3654, 3654x5454, 4854x7254, 6054x9054 | MirrorWrap used; Prodigi also offers Black, White, ImageWrap |
| Classic frame | = fine art | = fine art | black used; 8 colours exist |
| Framed canvas | final = picture + 54 (2454..6054) | **landscape-defined**: 8x12 = 3654x2454 (not portrait) | not launched; float frame, 6 colours, 4 wraps |
| Matted frame | **picture is smaller than the frame**: 8: 1800, 12: 2700, 16: 3600, 20: 4800 | 8x12 = 1800x3000, 12x18 = 2418x4218, 16x24 = 3618x6018, 20x30 = 4800x7800 | not launched; mount 2.4 mm, Snow white; rectangle mount widths are not uniform |
| Mug | 2670x1110 wrap | | single white 11 oz |
| Cards | 7x5 spread 6118x2161 (about 431 PPI on a 14.2 in spread, not 300) | | which part is the front panel is unverified |

Sandbox wholesale and shipping (US, one copy): fine art $8 to $20, premium $9 to $32, canvas $20 to $50 (8x8 $20, 12x12 $24, 16x16 $32, 20x20 $42), classic frame $35 to $65, matted $38 to $70, framed canvas $30 to $87, mug $5.63 (+$6.55 shipping, GB lab), card $0.79 to $2.25. Paper ships Budget $6.85 to $7.10 (20x30 $12.65) with **$0 per extra print**; canvas and framed items ship $24.80 to $32.35 with **about $11 to $16 per extra copy** (8x8 canvas $14 by USPS). These match the wholesale comments in `sku-map.ts`. Tax was not queried. Sandbox figures are not a live availability or price promise.

## 2. Implemented versus missing

| Capability | State |
|---|---|
| Stripe checkout, webhook, order rows, Prodigi order placement | Implemented (Preview: Stripe test, Prodigi sandbox only) |
| Per-line print jobs, Pruna upscale, OpenAI QA, review queue, order gate | Implemented, flag-gated, off until activated; separate job and approved file per order line, so several products from one artwork already produce separate print files |
| Canonical shared geometry for the four launch families | Implemented (`sku-map.ts` + `geometry.ts`), verified against Prodigi today |
| Matted frame and framed canvas squares | In `SKU_MAP` with prices, deliberately not launched; rectangles have no map entries or prices |
| Mugs and greeting cards | Not implemented: no SKUs in the map, no profile (the `profiles.ts` seam is ready), no retail price |
| Free preview policy | Existing ledger is one preview per email or IP (`checkPreviewAllowed`). The new policy (two free sixes, then $2.99 per six) does not exist |
| Gift session, source reference, six-preview batch endpoint, idempotent retry | Missing |
| Paid six-pack Stripe product, verified-payment entitlement, restore | Missing (do not reuse `discovery_unlock_1`, also $2.99, which is a digital unlock) |
| One digital unlock per physically purchased artwork | Missing. Printing currently requires the preview to be already unlocked (`owned-source.ts` demands `unlocked_at`); a physical purchase grants nothing |
| Product-specific composition shown to the customer before checkout | Missing (see conflict 3) |
| Gift Wizard UI and its typed seams (`contracts.next.ts`, three document events) | Codex, fixture-only, no network adapters, intentionally disconnected |

## 3. Conflicts and dependencies

Codex rewrote its handoff while this report was being prepared (17:26 to 17:27, after my first read). The revised `INTEGRATION.next.txt` and the new `public/gift-wizard/contracts.next.ts` now follow your flow and rules, so three conflicts from my first pass no longer apply: flow order (now Photo, Choose Gift, Create Art, Checkout), two free fixture batches with the paid $2.99 offer only after the second, and per-line "contain" compositions with no crop. This report and the proposed contracts reconcile against the revised version.

1. **Compositions happen after payment, unapproved.** `prepareComposition` extends artwork with Stability outpaint (or mirror for canvas wrap) during fulfilment. Your rule requires customer approval of product-specific compositions before checkout. Composition must move earlier, be stored, and be the file fulfilment uses. This is the largest change. Codex's `Composition` (approval flag, `productionAssetId: null`) is the UI half of that.
2. **Geometry assumptions.** `printPlan` assumes every SKU is portrait-defined and swaps width and height for landscape art. That is **unverified against Prodigi** (no sandbox order has placed a landscape file on a portrait SKU) and wrong for the landscape-defined framed-canvas rectangles. It also rejects any non-canvas SKU whose final size differs from its picture (matted frames). The canonical table must carry the orientation Prodigi defines per SKU, and one sandbox order should prove rotation.
3. **Extension limits.** Rules allow up to 20% extension and a 9.4 MP outpaint input. A square artwork on a 2:3 print is 50%, so it is **unavailable** today; the mug (2.4:1) and card spread (2.8:1) are further out. Codex shows a square sample fully visible with space around it ("not a synthesized portrait composition"), which the backend cannot yet produce. Offering rectangles from a square master needs a decision (section 6), not just code.
4. **Generation geometry.** `BatchRequest.geometries` lists every chosen product's geometry, but a batch is six artworks, each generated at one aspect. Which aspect is generated when products differ must be decided; the proposal is one master artwork per effect with per-product compositions derived from it.
5. **Source analysis.** Codex's `SourceAnalysis` (series supported or not) is a fixture, not computer vision. A real server-side analysis step is needed; the existing Foyer intake runs vision analysis but is not a standalone upload endpoint, and retention of the original photo is unverified (Codex lists the findings).
6. **Registry counts.** Codex reads `/effect-registry.js`, `/groups-registry.js`, `/pets-registry.js` and reports 55/42/36. Groups will show 44 once the pending Toys silo (pushed to Preview as `1ec5d29`) is live; nothing in the wizard hardcodes the count.
7. **Free-preview ledger.** The existing ledger allows one preview per email or IP; the two-free-sixes policy needs a new session and batch ledger. Do not bypass the existing intake and safety rules.
8. **Paid six-pack versus digital unlock.** Both cost $2.99. The existing Stripe offer `discovery_unlock_1` is a digital unlock; the six-pack needs its own product and verified-payment entitlement.
9. **Ownership and clean masters.** Checkout needs a signed-in owner and an owned, unlocked preview (`owned-source.ts` requires `unlocked_at`). A guest wizard conflicts with that, and a physical purchase must be able to print a not-yet-unlocked artwork and then grant its one unlock. Clean masters stay server-only.
10. **Unlock accounting.** One unlock per artwork per paid physical order, regardless of quantity or product count, and it must not consume existing unlock credits.
11. **Prodigi API limit.** 30 calls per 30 seconds; catalog checks must be throttled and cached.
12. **Mug and cards ship internationally** from GB labs (the mug to 116 countries), so shipping, delivery time and tax need a product decision.

### Name alignment with Codex

Codex's names are kept where they exist (`Series`, `Geometry`, `GiftLine`/`lineId`, `Composition`, `BatchRequest`, `effectIds`, `sourceRef`, `desktopCheckout`). The proposed file adds only server concerns: ids, idempotency, entitlements, approval records, authoritative totals and the stale-catalog guard.

## 4. Reuse

Stripe checkout and webhook, the Prodigi client and its Preview guards, the Pruna pipeline, OpenAI QA, the job queue and review admin, `preview_ledger` and private clean-master storage, the collection unlock entitlements table, and the shared watermark. Nothing needs rebuilding; the gaps are the session, the batch and entitlement policy, and early composition approval.

## 5. Recommended sequence

1. Review this catalog and contracts (no code).
2. Canonical product table: one module generating `CanonicalProduct` from `SKU_MAP` + verified geometry, including per-SKU orientation; keep `getLaunchSku` working on top of it. Prove landscape-on-portrait with one sandbox order.
3. Catalog endpoint and stale-catalog protection.
4. Gift session, source reference and six-preview batch endpoint, reusing existing intake and NB2.1; idempotent, partial-retry; free-batch ledger.
5. Paid six-pack: Stripe product and price, webhook-created entitlement, restore.
6. Composition service: plan, store, preview and approve per product; fulfilment uses the approved file.
7. Checkout adapter on the existing route, with server-resolved lines and the artwork unlock grant.
8. Decide and build mug and card profiles (composition layout, front panel) last.
9. One end-to-end sandbox order from the wizard.

## 6. Open decisions for you

- Confirm which aspect the preview batch is generated at when products differ (recommended: one master artwork, with product compositions derived from it and approved by the customer).
- Whether 2:3 prints from a square artwork are offered with an approved extension, or only same-shape products are offered.
- Mug and card: ship from GB internationally, composition layout, price.
- Retail prices for framed-canvas and matted rectangles if they should launch.

## 7. Implemented 2026-10-15: canonical catalog and geometry layer

Decisions approved: one master artwork per effect, multiple approved product compositions, controlled background extension, never distort, silently crop or regenerate the subject, verified Prodigi geometry, Prodigi quotes for shipping, framed-canvas and matted rectangles disabled pending retail prices, mug and 7x5 Mohawk card not activated until prices and composition behavior are approved.

Built (read-only, additive; `sku-map.ts`, `geometry.ts`, checkout and prices untouched):
- `lib/v1/print/catalog-types.ts`: dependency-free stable contract (copy verbatim for Codex). `CATALOG_CONTRACT_VERSION = 1`. It supersedes the catalog part of `gift-wizard-contracts.proposed.ts` (`CanonicalProduct`, `CatalogResponse`); the session, batch, composition and checkout shapes there remain proposals.
- `lib/v1/print/catalog.ts`: all 55 verified SKUs. Sellable products derive from `SKU_MAP` so price, SKU and attributes cannot drift; others are disabled entries with Prodigi's sandbox pixels. Corrects framed-canvas geometry (8x12 is landscape-defined 3654x2454; picture = area minus 54 px wrap).
- `GET /api/v1/print/catalog[?width=&height=]`: public, read-only, no Prodigi call, no cost data. With artwork pixels it adds `artworkFit` (exact, resample within 2%, extend within 20%, unavailable) and `selectable`.
- `lib/v1/print/catalog.test.ts`: 19 tests, including a check against the verified inventory file.

Not decided or not built: the extension rule is still the existing 20% limit, so a square master reports 2:3 products as `unavailable` until the composition phase defines larger controlled extensions; `rotatedFile` (landscape art on a portrait SKU) is marked unverified; Prodigi publishes no safe-area specification (`safeArea: null`); sessions, batches, payment, compositions and checkout adaptation are not started.
