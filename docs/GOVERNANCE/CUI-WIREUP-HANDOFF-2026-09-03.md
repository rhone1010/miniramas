# CUI → CENG wire-up handoff — Discovery / Review / My Collection
Date: 2026-09-03 · Lane: cui42 · Files: `public/litenco-discovery-checkpoint-04.html` (desktop ≥1024), `public/mobile-discovery-mock.html` (≤767), `public/tablet-discovery-mock.html` (768–1023)

The glass is built and behaves. Every place it fakes data or a result is listed below with the contract it expects. Order is the order to debug: each step unblocks the next.

## 0. Auth / identity
- `GET /api/v1/auth/me` → `{ displayName, firstName }` — needed for the id-system title (`Series - Effect - <First> - NNN`) and the masthead pill. Currently `CUSTOMER = 'Rich'` hardcoded. Known: 401 after magic-link — this is the blocker for everything below that is per-user.

## 1. Photograph
- Upload: `POST /api/v1/photo` (multipart) → `{ photoId, previewUrl }`. Glass holds `uploadedPhotoDataUrl`; swap for `previewUrl`. Gate rule is client-side and stays: no select, no Pick without a photo.
- Mobile: same endpoint from the file/camera inputs (`#srcFile`, `#srcCamera`).

## 2. Catalog
- `GET /api/v1/catalog?series=portraits` → rooms `[ { id, name, effects:[ { key, name, plateUrl } ] } ]`. Glass uses `SILOS` (hardcoded) and `ART[name]` (embedded plates). Replace both. Effect `key` must match `effectKey(siloId, i)` or the glass switches to server keys everywhere (minimap cells, selection, slots).
- Series switch (mobile sheet / desktop masthead): same endpoint, different `series`.

## 3. Curator
- Pick for me: `POST /api/v1/curator/pick` `{ photoId, size, have:[keys] }` → `{ picks:[keys] }`. Glass `fillTo(v)` currently random. Size step + confirmation copy stays client-side; picks come from here.
- Help me choose: `POST /api/v1/curator/recommend` `{ photoId, size, intent, have:[keys] }` → `{ recommended:[keys] }`. Glass `INTENTS[].picks` is a placeholder table; `applyIntent` lights `is-recommended` from the response.
- Tell me what you like: `POST /api/v1/curator/describe` `{ photoId, text }` → `{ recommended:[keys], reply }`. Send button closes the box today; `reply` is the Curator's line to show in the collection card's next-line slot (7s, no layout shift).
- Intent labels and every Curator sentence in the glass are placeholder copy — Rich authors.

## 4. Collection / checkout
- Create: `POST /api/v1/collections` `{ photoId, effects:[keys], size }` → `{ collectionId, checkoutUrl | clientSecret }`. `btn-create` / `revCreate` are no-ops. Size is always one of 1/4/8/16 (glass enforces via tier/slots; server should too).
- Pricing: glass has `1:2.99 4:4.99 8:7.99 16:12.99` and included unlocks `1:0 4:1 8:1 16:2` in `sizeInfo` / `INCLUDED_UNLOCKS_BY_SIZE`. Single source should be `GET /api/v1/pricing`.

## 5. My Collection
- `GET /api/v1/pieces` → `[ { key, name, room, series, num, locked, craftedAt, plateUrl, crafting } ]`. Glass seeds 28 demo pieces; `num` is the customer's running count (id system); `craftedAt` fills "Crafted Aug 28" (placeholder).
- Unlock: `POST /api/v1/pieces/unlock` `{ keys:[...] }` → `{ unlocked:[keys], includedRemaining, charged }`. Glass handles single (tile quick action, lightbox, rail frame) and basket (multi). `INCLUDED_UNLOCKS_REMAINING` should come from the server.
- Download: `GET /api/v1/pieces/:key/download` → signed URL. Stub.
- Send to Print Shop / Post to Community / Craft this again: stubs; routes TBD with the Print Shop and Community owners.

## 6. Persistence (client, no API)
- First-visit pulses (desktop CTA, mobile Actions), tour seen, coach dismissed → `localStorage` flags. Not wired; every load pulses today.

## Known gaps, not bugs
- 1330×700 / 1280×660 laptops: rail scrolls ~100px; collection card stays pinned. Accepted.
- Preview treatment on real plates is weak (stripes at 15%). Needs a watermark decision.
- "Persian Court" plate maps to Baroque Masterpiece as a stand-in.
- Type: Manrope for controls below 1660; not yet applied at 1660+ — decision pending.

## Test order once wired
1. auth/me → name in title and pill · 2. upload → gate lifts, stamp shows photo · 3. catalog → rooms/plates/minimap · 4. pick → fills to size · 5. recommend → lights picks, tier held · 6. create → checkout · 7. pieces → My Collection real · 8. unlock (single, basket, lightbox, rail) · 9. download URL.
