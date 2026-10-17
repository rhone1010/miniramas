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

## 8. Implemented 2026-10-15: Gift Wizard sessions and preview batches (backend)

Contract: `lib/v1/gift/types.ts` (types only, `GIFT_CONTRACT_VERSION = 1`; copy for Codex). It supersedes the session and batch shapes in `gift-wizard-contracts.proposed.ts`; composition and checkout shapes there remain proposals. Not built, as instructed: composition approval, checkout adaptation, the artwork unlock grant.

Endpoints (all require a signed-in account; `no-store`; another user's session reads as `session_not_found`):

| Method and path | Purpose |
|---|---|
| `POST /api/v1/gift/sessions` `{ image_b64 }` | Validate the photo with the Foyer's `decodeSource`, classify the series (existing classifier), apply the existing age checks, store a re-encoded JPEG (EXIF stripped), return `SessionView` (201) |
| `GET /api/v1/gift/sessions/{id}` | `SessionView`: source, lines, geometries, batches with signed watermarked URLs, used effects, entitlement, `nextBatch` |
| `PUT /api/v1/gift/sessions/{id}/lines` | Persist product choices (launch products only; size and geometry from the canonical catalog) |
| `POST /api/v1/gift/sessions/{id}/batches` `{ idempotencyKey, effectIds? }` | Reserve the next batch (free, free, then a verified paid pack) and generate it; 200 ok, 202 partial |
| `GET /api/v1/gift/sessions/{id}/batches/{n}` | `BatchView` (always six previews) |
| `POST /api/v1/gift/sessions/{id}/batches/{n}/retry` | Run only failed or unfinished previews; no new charge |
| `DELETE /api/v1/gift/sessions/{id}` | Delete photo, masters, previews and rows now |
| `POST /api/v1/gift/preview-pack/checkout` `{ returnPath }` | Embedded Stripe Checkout, $2.99, inline price, kind `gift_preview_pack` |
| `POST /api/v1/gift/preview-pack/confirm` `{ stripeSessionId }` | Re-verify with Stripe (same fulfilment as the webhook) |
| `GET /api/v1/gift/cleanup` (internal auth) | Retention sweep |
| Stripe webhook | Additive branch: `metadata.kind === 'gift_preview_pack'` runs verified fulfilment |

Rules enforced in the database (migration `047_gift_wizard_sessions.sql`, **not applied**): batches 1 and 2 free; later batches consume one paid pack taken `for update skip locked`; a pack exists only through `gift_fulfill_preview_pack` (idempotent on the Stripe session id); six distinct effects per batch and an effect never twice per session; reservation idempotent per key; no new batch while an earlier one has unfinished previews; per-preview lease with a three-attempt cap; ready previews are never claimed again; packs belong to the user and survive sessions. `migration-047.test.ts` runs all of this against real Postgres (PGlite).

Reuse: the existing private `previews` bucket (under `gift/`), `decodeSource`, `analyzeUploadRouting`, `detectFaceVisibility`, `analyzeSourceSet`/`groupsAgeDecision`, the series `generate` routes via the same internal self-call paid portfolios use (NB2.1 prompts, gates and secrets unchanged), `bakeFoyerWatermark` (fails closed), the Stripe client and branded embedded checkout, the internal-auth cron guard. Discovery unlock pricing and entitlements are untouched. No second generation, storage or commerce stack.

Hybrid selection: the customer sends 0 to 6 effects; the server returns six: picks first in order, then unused live effects in fill order (Portraits silo order with gendered variants collapsed; Pets Discovery order intersected with the engine; Groups single-photograph effects in catalog order, since the Groups room order lives in a generated browser file).

Master aspect (server-chosen): Portraits 1:1, Pets 2:3, Groups 2:3 for up to 3 people and 3:2 otherwise (Groups only allows some formats per head count).

### Retention (PROPOSED, needs your approval)

| Data | Rule |
|---|---|
| Source photo | Stored as a re-encoded JPEG without EXIF; deleted with the session |
| Clean masters, watermarked previews, session/batch/preview rows | Session expires 7 days after the last activity, never later than 30 days from creation; the sweep deletes objects first, then rows (a storage failure leaves the rows to retry) |
| Pinned sessions | `pinned_at` is set by the future checkout phase when an artwork enters an order; the sweep never touches them and the order's own retention applies |
| Paid preview packs | Financial records: never deleted by the sweep; belong to the user, so unused packs are restored in any later session |
| Customer deletion | `DELETE` removes everything for that session immediately unless pinned |

Existing comparison: Foyer results live 2 hours; portfolio source images have no expiry; those are unchanged.

### Dependencies and gaps

- Apply migration 047 (and create the sweep schedule: `vercel.json` cron for `/api/v1/gift/cleanup`, not added).
- `CRON_SECRET`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, Stripe keys and `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` must be present (the readiness diagnostic does not cover Gift yet).
- The live path is **untested**: analysis, NB2.1 generation, watermark and Stripe are exercised only through injected fakes. Needs one approved paid run on Preview.
- A batch generates inside its request (up to 300 s, three renders at a time). A timed-out request leaves unfinished previews; the retry endpoint, or repeating the key, resumes them. There is no background poller yet.
- Sessions require sign-in. If anonymous trial is wanted, an owner-token design is needed plus per-IP limits on free previews (cost exposure).
- Groups fill order ignores the room order; Pets and Groups aspect choices are untested against live routes.
- Source analysis costs OpenAI calls at upload; the free allowance is two batches per session, so a cost cap per account is not yet enforced.

## 9. Preview preparation (2026-10-16)

- **Retention** is enforced in both layers: 7 days from the last activity, never past 30 days from creation (found and fixed: the SQL extension ignored the 30-day ceiling), paid packs untouched. Tests cover day-29 extension, idle expiry, purge, pinned sessions and pack survival.
- **Cron:** `/api/v1/gift/cleanup` daily at 03:37 UTC added to `vercel.json`. Vercel runs crons on Production deployments only, so on Preview the sweep must be triggered by hand with the `CRON_SECRET` bearer.
- **Migration 047 hardening:** it now explicitly revokes anon and authenticated (Supabase default privileges can grant them access, which `revoke ... from public` does not remove). The PGlite test simulates those defaults. It also re-applies cleanly.
- **Verification SQL:** `gift-047-preflight-and-verify.sql` (read-only; Part A before applying, Part B after). It was run against PGlite here, not the live project.
- **Free allocation across sessions:** see the report; a durable per-user ledger is the simplest guard and needs a decision on its window.

## 10. Revised sequence: pay for products first, then create art (analysis only, 2026-10-16)

Photo, Choose Gift, **Checkout**, Create Art (two free batches per paid order, then $2.99), Approve (artwork and each product composition), Fulfilment (Pruna, QA, Prodigi). Nothing here is implemented.

Minimum changes
1. **Order model.** New `print_orders.status` value `awaiting_artwork` (enum add). The existing poller, `completePrintOrder`, retry and admin paths only look at `paid`, `withheld` and `error`, so an order in the new state is invisible to every fulfilment path. An atomic conditional update `awaiting_artwork -> paid` (only after all approvals) hands the order to the existing pipeline, which keeps the account gate, refund recheck, upscale, QA, review and Prodigi idempotency unchanged.
2. **Gift checkout.** A server-built Stripe session from the session's saved lines (catalog price, Prodigi quote, no artwork URL). The existing print checkout refuses to start without owned artwork, so this is a separate route that reuses `createPrintOrder`, `getQuote` and the Stripe client. Order items keep sku, size, finish, copies, price; lines become immutable once an order exists.
3. **Payment webhook.** A `gift_order` kind in the Stripe webhook: verify with Stripe, mark paid, set `awaiting_artwork`, link `gift_sessions.order_id` (unique), grant 2 free batches, pin the session. The current print webhook would enqueue jobs immediately, which must not happen for these orders.
4. **Batches.** `gift_reserve_batch` must require a paid, unrefunded linked order and use the order's granted free batches (0 before payment) instead of a constant 2. Packs stay per user.
5. **Compositions.** Per line: derive the product-shaped artwork from the selected master (existing outpaint limits), store it, show a watermarked preview, record approval. This is the deferred composition phase and is now on the critical path.
6. **Print source.** New job `source_kind = 'gift'` (extend the 046 check constraint, `JobStore`, `enqueueOrderJobs`, `loadSource`, hold-reason helpers). The job reads the approved composition by (order, line) from a mapping table; the existing `url` kind trusts a client URL and `owned` needs a portfolio piece. Because the composition already has the product's aspect, the existing composition step adds nothing.
7. **Approval action.** One atomic function checks: order paid and not refunded, artwork selected, every line approved, unlock granted once; then moves the order to `paid`. Nothing reaches Prodigi before it.
8. **Digital unlock.** Once per paid order, without touching `entitlements`: write the unlock directly, as purchased single pieces are born unlocked (`recordPreview` with `unlockedAt`).
9. **Cannot find artwork.** An unresolved flag with a support record (the `notifyAttention` pattern) and an admin action list; the order stays `awaiting_artwork`; no automatic manufacture or refund.
10. **Retention.** Pin the session at payment instead of at selection; add a retention rule for paid-but-unresolved sessions.
11. **Small fix.** Fulfilment currently re-derives the SKU from size and finish; it should use the SKU and attributes stored on the order, so a catalog change cannot alter a purchased product.

Conflicts to resolve: the print checkout and webhook assume artwork exists at payment; the 7/30-day session retention conflicts with paid orders waiting for art; composition outpaint is a paid call made before the customer is committed to approving; the unlock currently means a portfolio piece, and a gift artwork is not one.

Decisions needed: what counts as a qualifying order; where the unlock lives (recommended: a My Collection piece born unlocked); unresolved-artwork policy and timing (reminders, who decides, refund terms, how long to hold); a cap on composition regenerations per line; checkout disclosure that the product is personalized and sold before the art is seen.

## 11. Implemented 2026-10-16: purchase before generation (backend)

Approved decisions: any paid, enabled product qualifies; one selected artwork becomes an unlocked My Collection piece without consuming credits; one free composition correction per order line (more goes to Concierge); checkout discloses that artwork is generated after payment and manufacturing starts only after approval; a dissatisfied customer may request a full refund through Concierge (nothing is manufactured, the refund is verified through Stripe and idempotent); paid, unresolved sessions are retained until resolved.

Flow and where it lives
1. **Checkout** `POST /api/v1/gift/sessions/{id}/checkout` (`lib/v1/gift/orders.ts`): requires `disclosureAccepted: true`; prices, SKUs and attributes from the saved lines and the catalog; Prodigi shipping quote; refuses a product the session's artwork shape cannot fit; Stripe embedded session carrying the disclosure (`custom_text.submit`); creates a normal print order (`status created`, renderId `gift:{session}:{line}`, no artwork URL) linked 1:1 to the session. An open unpaid checkout is reused; a paid order is never sold twice. On Preview, Stripe test mode and the Prodigi sandbox are required.
2. **Payment** (`confirmGiftOrder`): the Stripe webhook (`metadata.kind = gift_order`) and `POST /api/v1/gift/orders/confirm` both re-retrieve the session from Stripe and verify kind, owner, order and session linkage, mode, currency, paid status, the total against the stored order and every line item, then run `gift_confirm_order`: the order moves `created -> awaiting_artwork`, two free batches are granted, the session is pinned (retained until resolved), the lines are frozen. Idempotent.
3. **Generation** needs a paid, unrefunded order (`gift_reserve_batch` redefined); free batches come from the order; later batches still use $2.99 packs.
4. **Artwork and compositions** (`compose.ts`): select one preview (changeable until approval), one composition per line via the existing `prepareComposition` (background extension only, never a crop), watermarked previews, one free correction per line, approval per line.
5. **Approval** `POST .../approve`: all lines approved for the selected artwork; the artwork is copied to where My Collection reads it and adopted as an unlocked piece (`gift_approve_order`, no entitlement); the order moves `awaiting_artwork -> paid`; the existing pipeline is kicked.
6. **Fulfilment** (existing path, extended): `awaiting_artwork` is invisible to the poller, `completePrintOrder`, retry and admin paths, and `enqueueOrderJobs` refuses it. A gift order with no jobs is queued by `completePrintOrder` after: account clearance, refund/refund-request/approval gate, and payment re-verification with Stripe (`verifyGiftPayment`; test mode only on Preview). Jobs use the new `gift` source, which reads only the approved composition. After placement the session is released for cleanup. `prepareAndPlacePrint` now refuses to place a SKU different from the one sold.
7. **Refunds** (`refund.ts`): `POST .../refund-request` records one request and one Concierge message (support_messages, keyed by the request id); it blocks generation, selection, composition, approval and release until resolved; a person issues the refund in Stripe; `charge.refunded` is re-read from Stripe and applied once per refund id: a full refund of an unplaced order cancels it and releases the session; a partial refund is only recorded; a refund after placement is flagged and the lab order is untouched. Declining is `declineRefund` (no customer route).

Migration `048_gift_orders.sql` (not applied; needs 046 and 047): the enum value, the `gift` job source, My Collection origin `gift`, session columns, `gift_order_lines`, `gift_compositions`, `gift_refund_requests`, `gift_refunds`, and ten service-role-only functions. `gift-048-preflight-and-verify.sql` checks every live column it writes (portfolios, portfolio_items, preview_ledger and print_orders are defined outside this repository's migrations).

Remaining gaps
- Nothing here has run against live Supabase, Stripe, Prodigi, OpenAI, NB2.1 or Stability; all of it is tested with fakes and, for the SQL, real Postgres (PGlite with stand-ins for the four live tables).
- The `portfolios.source_image` and other live column shapes are verified only by the preflight SQL you run.
- No Concierge tooling to decline a refund request or to issue the Stripe refund; the decline is a function with no route. Refund after the lab order is placed needs a person to cancel at Prodigi.
- The retry path (`retry.ts`) still only knows sandbox print orders, so a gift order in `error` needs the admin review route, not customer retry.
- The Gift Wizard UI is Codex's: it needs the new contract (checkout disclosure, order state, compositions, refund) and is still fixture-only.
- Preview cron does not run (Vercel runs crons on Production only): approval kicks `completePrintOrder` directly, and the print poller must be triggered by hand on Preview.
- Composition outpaint is a paid Stability call made before the customer commits to approving; it is bounded by one initial composition per line per selected artwork plus one correction, but changing the artwork repeats it.
- Shipping tax and international duties are not handled.

## 12. Mixed-aspect projects and product-specific compositions (2026-10-17)

Codex's audit of Preview `6e38ba3` found that checkout validated every product against one fixed series master aspect and compositions
were one per line, extension-only. Both were true (nothing existed to resolve them) and are fixed here.

- **Checkout** (`orders.ts`): a product is validated on its OWN geometry (`composition-plan.ts planFor`), so a 12 x 18 print and an 8 x 8 canvas
  can be bought together. Refused only when no bounded way exists to make its shape (`product_not_available_for_artwork`).
- **Plans** (`composition-plan.ts`, `aspects.ts`): `deterministic` (the selected artwork already fits, or bounded extension up to 20%) or
  `generated` (a separate NB2.1 generation of the same effect at the nearest ratio the series route admits, then bounded extension to the exact
  shape if that ratio is not exact). Deterministic extension is always preferred when it can preserve the artwork. The six artistic previews per batch are unchanged and independent of what was bought.
- **Deduplication** (`compose.ts`): products with the same picture shape (`geometryKey`, e.g. `a667` for 2:3, `a1000` for square) are composed ONCE;
  each line keeps its own composition record, approval, free correction and print job. A correction gets files of its own and never changes what
  another line approved. Idempotent and resumable per requirement.
- **NB2.1 ratios** (verified read-only against the model schema, 2026-10-17): 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9;
  resolutions 1K/2K/4K. **The routes admit fewer**, and one is widened for products only: Portraits now accepts 2:3, 3:2, 4:5, 5:4, 16:9 and 21:9 IN ADDITION to
  Discovery's 1:1, 3:4, 4:3, 9:16, but only from the server's internal call that sets `product_composition: true` (Discovery's choices, defaults
  and the route's answer to everyone else are unchanged). Groups stays limited by head count; Pets passes any ratio. A 2:3 Portraits print is
  therefore generated at exactly 2:3, with no extension.
- **Favorite as reference** (`lib/v1/shared/favorite-adaptation.ts`): for Portraits and Pets a product-specific generation sends the customer's
  photograph first and the selected favorite second (`image_input`), plus a clause naming the two roles (same effect, same subject and likeness,
  extend the surroundings, never crop/stretch/distort/add/remove/restyle). The clause is appended only when the internal call asks for it and an
  image is really sent; effect prompts are untouched. **Groups cannot**: its route needs exactly one source image, so Groups regenerates from the
  photograph (`photo_regeneration`). Whether NB2.1 actually keeps the favorite faithful is UNVERIFIED (no paid call was made); that is why every
  generated composition is a new, separate picture the customer must approve, and each line keeps its one free correction.
- **Provenance** (migration 049): every composition and correction records `generation_mode` (`none` | `favorite_reference` | `photo_regeneration`),
  `generation_aspect`, exact `nb21_calls`/`outpaint_calls` (0 on rows that reuse a shared composition), `cost_usd_est` (null unless
  `GIFT_NB21_COST_USD`/`GIFT_OUTPAINT_COST_USD` are set) and the source artwork (`preview_id`, the selected favorite).
- **21:9 mug**: a 21:9 composition maps to 2670 x 1110 by scaling to height (2590 x 1110) and adding 80 px of background across the width
  (3.09% extension, no distortion, no crop). Mugs and cards remain disabled.
- **Migration 049** (not applied): `gift_compositions.geometry_key`, `method`, `source_composition_id`, `generation_mode`, `generation_aspect`,
  `nb21_calls`, `outpaint_calls`, `cost_usd_est`, three checks and an index. `gift-049-preflight-and-verify.sql`.
- **Cleanup fix**: composition files were not removed when a session was purged; they now are (each shared path once).
