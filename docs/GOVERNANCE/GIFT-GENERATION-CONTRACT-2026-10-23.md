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
  conform: {method:'native'|'trim', trimFraction} | null,   // 'trim' = under 3% (usually under 1%) shaved from the edges to hit the exact aspect. Never an extension.
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
