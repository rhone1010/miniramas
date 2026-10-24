# Product-first generation: backend contract for Codex 1, 2026-10-23

Backend only, committed locally on `fix/gift-pipeline-verify`. NOT deployed. **Requires migration 059 (not applied to any database yet)**; until it is applied, `POST /sessions` with the generations flow returns `503 generations_unavailable` and every existing flow is unaffected.

Journey: Upload -> choose ONE effect -> choose product -> size/options -> **generate** (NB2.1 at the product's exact aspect) -> large preview -> **accept** or **try again** -> cart -> checkout -> Final Approval -> upscale -> release.

## Which flow a session is in
`SessionView.flow`: `'generations'` (this contract) or `'previews'` (the six-preview journey, unchanged). New sessions start in the flow of the environment variable `GIFT_NEW_SESSION_FLOW` (`generations` or unset = previews; **default previews**). A session never changes flow. In a `generations` session `POST .../batches` answers `409 legacy_batches_closed`, `nextBatch = {kind:'blocked', reason:'generations_flow'}` and `batches = []`. Collection sessions (`entrance:'collection'`) stay `previews` but may call the endpoints below with the owned artwork's effect fixed.

## SessionView additions
```
flow: 'previews' | 'generations'
generations: null | {                                  // null for previews sessions
  effectId: string | null, anchorPreviewId: string | null,   // the ONE chosen effect (anchorPreviewId === artworkPreviewId)
  items: GenerationView[],                              // every generation of this session, oldest first, incl. failed
  allowance: {
    freeTotal: 6, freeUsed, freeRemaining, freeAvailable, freeBlockedReason: 'session_limit'|'photo_limit'|'daily_limit'|'lifetime_limit'|null,
    paidUnits,                                          // generations left in purchased packs
    next: 'free' | 'paid' | 'payment_required' | 'blocked',
    blockedReason: 'effect_not_chosen'|'generation_in_progress'|'session_expired'|'order_refunded'|'refund_pending'|'order_not_awaiting_artwork'|null,
    packPriceCents: 299, generationsPerPack: 6, currency: 'USD' },
  inFlight, maxInFlight: 2 }
source.subjectGender (see GIFT-SUBJECT-GENDER-CONTRACT-2026-10-22.md)
```
```
GenerationView = {
  generationId, status: 'pending'|'generating'|'ready'|'failed',
  productId, geometryKey,                  // product it was made for; every product with the same geometryKey ('a1000' square, 'a667' 2:3) can use it
  width, height, url, sha256,              // null until ready. url = large WATERMARKED preview (signed, 1 h). width/height = EXACTLY the product's aspect.
  kind: 'free'|'paid', accepted: boolean, acceptedAt,
  quality: {status:'passed'|'below_bar'|'unscored', attempts} | null,
  conform: {method:'native'|'trim', trimFraction} | null,   // 'trim' = at most 10% (0 to 1% for today's launch shapes, up to about 8% for mount openings and the card front) shaved from the edges to hit the exact aspect. Never an extension.
  retryable: boolean,                      // failed and the same idempotency key may be sent again
  createdAt }
```
`status:'generating'` with a lapsed lease is reported as `'pending'`: just repeat the POST with the same key.

## Endpoints (all owner-only, signed in, `Cache-Control: no-store`)
1. `POST /api/v1/gift/sessions/{id}/effect` `{ effectId }` -> `200 SessionView`. Chooses or changes the effect (idempotent). Errors: `400 invalid_effect_selection` (not a live effect of this series), `409 flow_not_generations`, `409 effect_fixed` (collection session: the effect is the owned artwork's), `409 order_not_awaiting_artwork` (order already paid).
2. `POST /api/v1/gift/sessions/{id}/generations` `{ productId, idempotencyKey (8-80 chars [\w.:-]), mode?: 'reuse_or_generate' (default) | 'new' }`
   - `200 {status:'ok', generation, reused, session}` delivered. `202 {status:'partial', generation, reused, session, retryAfterSeconds:5}` in progress (another request holds it, or it just failed and is `retryable`): poll `GET .../generations/{gid}` or repeat the same key (idempotent, never charges twice).
   - `reuse_or_generate`: if this session already has a non-failed generation of the SAME effect at the SAME picture shape (`geometryKey`), it is returned with `reused:true` and nothing is spent (e.g. 12x18 then 16x24). `new` = **"Try again"**: always a new generation (counts against the allowance) and needs a NEW idempotencyKey.
   - The request takes about 20-60 s (one NB2.1 render); `maxDuration` 300.
   - Errors: `400 invalid_idempotency_key`, `409 product_not_available` (not purchasable), `409 product_aspect_unsupported` (the series cannot make that shape without extension; none of today's launch products), `409 effect_not_chosen`, `402 payment_required` `{amountCents:299,currency:'USD'}` (six free used, no pack units), `429 generation_in_progress` (2 already in flight), `409 order_not_awaiting_artwork`, `409 flow_not_generations`, `503 generations_unavailable` (059 not applied), `404 session_not_found`.
3. `GET /api/v1/gift/sessions/{id}/generations` -> `{ generations: GenerationView[], session }`. `GET .../generations/{gid}` -> `GenerationView`.
4. `POST /api/v1/gift/sessions/{id}/generations/{gid}/accept` -> `{ generation, session }`. Idempotent. `409 generation_not_ready` unless delivered. Accepting is the customer approving that exact picture before checkout.

## Rules the UI can rely on
- Six free generations per session, then a verified $2.99 pack = six more (`POST /api/v1/gift/pack-checkout` + `/pack-confirm`, unchanged; existing paid packs are worth six). A generation that fails costs nothing and frees its slot. Account abuse limits (6 per photo, 18 per 24 h, 60 lifetime) outlive deleting the project.
- What the customer sees large (`url`) is the exact picture that will be printed (same pixels, watermark only). After acceptance nothing is extended, mirrored or reframed; Final Approval compares the same sha256. A canvas wrap is a manufacturing attribute of the print, not a change to the picture.
- Pixel size is whatever NB2.1 returns at its default resolution; upscaling happens after Final Approval.
- Missing product photography never blocks a generation: previews are the generated picture itself. (Scene mockups, where they exist, still come from `product-preview`.)
- Refresh and restoration: `GET /sessions/{id}` and `GET /sessions/restore` return `flow`, `generations` and every item; resume an unfinished one by repeating the POST with its key.

## Part 2: cart, checkout, correction, Final Approval (committed e00006d6)
**Cart.** `PUT /api/v1/gift/sessions/{id}/lines` accepts `generationId` on each line: `{ lineId, productId, copies, generationId }`. The generation must be this session's, `ready`, **accepted** (`409 generation_not_accepted`), of the CURRENT effect (`409 stale_composition` after the effect changed) and of the product's picture shape (`409 composition_geometry_mismatch`; every product with the same `geometryKey` can use it). `404 generation_not_found`, `409 generation_not_ready`, `400 invalid_lines` (malformed id). Binding makes the accepted picture that line's **approved composition** (`compositions[].status === 'approved'`, `sourceArtworkId` = the anchor); nothing is generated or copied. A line keeps its generation when only quantity changes; sending another `generationId` replaces it; changing the effect unbinds every line. `SessionView.lines[].generationId` echoes the binding.
**Checkout.** `POST .../checkout` is unchanged in shape. In a generations session it refuses (`409 compositions_not_approved`) any line without an accepted, still-valid generation, and records on the order, per line, `frozen.composition = { compositionId, generationId, artworkSha256 (= the generation's sha256), width, height, sku, approvedAt }`.
**After payment** nothing is composed: `POST .../compositions` just returns the session (`409 compositions_not_approved` if a line somehow has none). Lines are locked (`409 lines_locked`).
**One free correction per line** (`POST .../lines/{lineId}/correct`, unchanged route): in a generations session it is a NEW generation of the same shape and effect, outside the allowance (never a free/paid unit), shown as `compositions[]` with `attempt: 2`, `status: 'ready'`; the customer approves it (`POST .../compositions/{id}/approve`) and `correctionsRemaining` is 0 (`409 correction_limit` on a second ask). A failed correction costs nothing and does not spend it; repeating the call resumes the same generation. Only after payment and before Final Approval.
**Final Approval** (`POST .../finalize`): additionally re-verifies each generation line: delivered, accepted, sha256 equal to the composition's, to the checkout pin, and to the hash of the stored file (`409 generation_changed` otherwise; nothing is recorded). The My Collection piece is the first line's accepted picture. Release to manufacturing stays operator-only.
**Print source.** The printer's source file for a generation line is the accepted picture byte for byte (re-hashed before use: `gift_generation_changed`). Its pixel size is a whole multiple of the product's reduced ratio (2:3 -> 2 x 3), so the existing print preparation adds no padding, mirror or outpaint (tested with the real `prepareComposition`: pixels identical), and only the upscale to print resolution follows. A canvas wrap (the mirrored margin around the canvas edge) is a manufacturing attribute of the print, applied outside the approved picture, as it always was.

## Prodigi shapes (sandbox census 2026-10-23, `scripts/probe-prodigi-aspects.ts`, GET only; data in `prodigi-aspect-sku-probe-2026-10-23.json`)
| family | 1:1 sizes (in) | 2:3 portrait sizes (in) | 3:2 landscape |
|---|---|---|---|
| Fine Art (GLOBAL-FAP) | 4..60 (19 found) | 4x6 6x9 8x12 12x18 16x24 20x30 24x36 30x45 32x48 40x60 | only 6x4 (15x10 cm, a print-size card) |
| Premium (GLOBAL-HPR) | 15 found | 4x6 8x12 12x18 16x24 20x30 24x36 30x45 32x48 40x60 | only 6x4 |
| Canvas (GLOBAL-CAN) | 19 found | 4x6 8x12 12x18 16x24 20x30 24x36 28x42 30x45 32x48 40x60 | none |
| Classic Frame (GLOBAL-CFP) | 12 found (8x8 ... 40x40) | 8x12 12x18 16x24 20x30 24x36 30x45 | none |
| Framed Canvas (GLOBAL-FRA-CAN) | 15 found | 4x6 8x12 12x18 16x24 20x30 24x36 28x42 30x45 32x48 40x60 | none |
Launch catalog today = the 8 square and portrait sizes (8x8 12x12 16x16 20x20, 8x12 12x18 16x24 20x30) of the first four families. Larger 1:1 and 2:3 sizes exist at Prodigi and would be catalog data additions (price approval needed). **3:2 landscape wall products do not exist at Prodigi** (no SKU for any family at any wall size); the only 3:2 SKU is the 6x4 card size. Prodigi has no landscape SKU to order, so 3:2 stays unsupported until Prodigi confirms (or a sandbox order proves) that a turned file on a portrait SKU prints correctly. The generation architecture needs no change for it: the target shape comes from the product's own `requirements.pictureAspect`, and a test shows a hypothetical 3:2 product resolves to exactly `3:2` for Portraits, Pets and Groups (the model supports 3:2 natively). Missing product photography is never a limitation: previews are the generated picture itself.

## Rollout and what is not live
Migration 059 is NOT applied anywhere. Preflight/verify SQL: `docs/GOVERNANCE/gift-059-preflight-and-verify.sql` (run before and after; verified against a faithful local database both ways). With 059 absent and `GIFT_NEW_SESSION_FLOW` unset, every existing flow is unchanged (the full gift suite passes). To switch on: apply 059 (owner, after the preflight), then set `GIFT_NEW_SESSION_FLOW=generations` for new sessions; existing sessions and paid orders keep their flow.
