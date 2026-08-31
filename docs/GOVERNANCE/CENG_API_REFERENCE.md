# CENG Discovery + Portfolio API Reference

Live base: `https://litenco.com`

All endpoints under `/api/v1/`. Auth = Supabase Auth cookies (logged-in user).
Guest browsing (no auth) is supported for catalog + session endpoints only.

---

## 1. Catalog

### GET /api/v1/discovery/catalog?series=portraits

No auth required.

**Response 200:**
```json
{
  "series": "portraits",
  "map": [
    { "mapIndex": 0,  "seriesId": "portraits", "siloId": "another_age",  "effectId": "elizabethan" },
    { "mapIndex": 1,  "seriesId": "portraits", "siloId": "another_age",  "effectId": "renaissance" },
    ...
    { "mapIndex": 31, "seriesId": "portraits", "siloId": "made_by_hand", "effectId": null },
    ...
    { "mapIndex": 55, "seriesId": "portraits", "siloId": "fantasy_future", "effectId": "crystallized" }
  ],
  "silos": [
    { "siloId": "another_age",      "label": "Another Age",      "startIndex": 0,  "endIndex": 6 },
    { "siloId": "earth_ore",        "label": "Earth & Ore",      "startIndex": 7,  "endIndex": 13 },
    { "siloId": "light_glass",      "label": "Light & Glass",    "startIndex": 14, "endIndex": 20 },
    { "siloId": "living_world",     "label": "Living World",     "startIndex": 21, "endIndex": 27 },
    { "siloId": "made_by_hand",     "label": "Made by Hand",     "startIndex": 28, "endIndex": 34 },
    { "siloId": "artists_gallery",  "label": "Artist's Gallery", "startIndex": 35, "endIndex": 41 },
    { "siloId": "ink_paper",        "label": "Ink & Paper",      "startIndex": 42, "endIndex": 48 },
    { "siloId": "fantasy_future",   "label": "Fantasy & Future", "startIndex": 49, "endIndex": 55 }
  ]
}
```

Notes:
- 56 positions total (8 silos x 7 effects each)
- `effectId: null` = known gap (made_by_hand slot 6, formerly beaded). Render as empty/disabled cell.
- `?series=` only supports `portraits` today; other values return 400.

---

## 2. Discovery Sessions

### POST /api/v1/discovery/sessions

Creates a new browsing session. No auth required (guest browsing supported).

**Request:**
```json
{
  "sourceAssetId": "asset_abc123",
  "seriesId": "portraits"
}
```

**Response 200:**
```json
{
  "session": {
    "sessionId": "uuid",
    "userId": "uuid-or-null",
    "sourceAssetId": "asset_abc123",
    "currentSeriesId": "portraits",
    "currentSiloId": null,
    "selectedEffectIds": [],
    "visitedEffectIds": [],
    "curatorRecommendedEffectIds": [],
    "createdAt": "2026-08-30T...",
    "updatedAt": "2026-08-30T..."
  },
  "offer": {
    "count": 0,
    "tier": null,
    "skuId": null,
    "priceUsd": 0,
    "includedUnlocks": 0
  }
}
```

### GET /api/v1/discovery/sessions/{sessionId}

Read current session state. No auth required.

**Response 200:** Same shape as POST response (`{ session, offer }`).

### POST /api/v1/discovery/sessions/{sessionId}/select

Toggle/select/remove an effect. No auth required.

**Request:**
```json
{
  "effectId": "bronze",
  "action": "toggle"
}
```

`action` is optional, defaults to `"toggle"`. Valid values: `"select"`, `"remove"`, `"toggle"`.

**Response 200:**
```json
{
  "session": { "...same shape as above, with updated selectedEffectIds..." },
  "offer": {
    "count": 3,
    "tier": "tier_2",
    "skuId": "basket_discover_5",
    "priceUsd": 4.99,
    "includedUnlocks": 1
  },
  "tierChange": {
    "previousTier": "tier_2",
    "currentTier": "tier_2",
    "direction": "none"
  }
}
```

Notes on `offer` during browsing:
- For counts between fixed sizes (4, 8, 16), `tier`/`skuId`/`priceUsd` show the **next tier up** the user is working toward.
- For count 1-3: shows tier_2 (4-pack at $4.99).
- For count 5-7: shows tier_3 (8-pack at $7.99).
- For count 9-15: shows tier_4 (16-pack at $12.99).
- Exact match at 4, 8, or 16: shows that tier's own values.

Notes on `tierChange`:
- `direction`: `"up"` | `"down"` | `"none"`
- Fires on every select/remove — CUI can use this to trigger tier-change animations.

---

## 3. Portfolio Checkout

### Size 1 — Single Craft (NOT a Portfolio)

A single-effect purchase uses the **original checkout endpoint**, not the portfolio pipeline. It delivers an unwatermarked render directly — no preview, no unlock step.

**POST /api/v1/checkout**

Auth required.

```json
{
  "skuId": "single",
  "style": "bronze",
  "variant": "1k",
  "sourceImageRef": "storage-path-or-ref"
}
```

**Response 200:**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "purchaseId": "uuid",
  "entitlementId": "uuid"
}
```

### Size 4, 8, 16 — Portfolio Purchase

**POST /api/v1/portfolios**

Auth required.

```json
{
  "series": "portraits",
  "selectedEffectIds": ["bronze", "iron", "stone", "jade"],
  "sourceImageRef": "storage-path-or-ref",
  "returnUrl": "https://litenco.com/collections",
  "clientPriceUsd": 4.99
}
```

`selectedEffectIds.length` must be exactly 4, 8, or 16. Other counts return 400.

`clientPriceUsd` is checked against server-resolved price — mismatches return 400.

| Count | SKU | Price | Included Unlocks |
|-------|-----|-------|-----------------|
| 4  | basket_discover_5  | $4.99  | 1 |
| 8  | basket_discover_10 | $7.99  | 1 |
| 16 | basket_discover_20 | $12.99 | 2 |

**Response 200:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "portfolioId": "uuid"
}
```

---

## 4. Portfolio Status

### GET /api/v1/portfolios/{portfolioId}/status

Auth required, owner check.

**Response 200:**
```json
{
  "portfolioId": "uuid",
  "series": "portraits",
  "size": 4,
  "status": "generating",
  "doneCount": 2,
  "freeUnlocks": 1,
  "items": [
    { "slot": 0, "preset": "bronze",  "status": "done",    "previewId": "uuid", "attempts": 1 },
    { "slot": 1, "preset": "iron",    "status": "done",    "previewId": "uuid", "attempts": 1 },
    { "slot": 2, "preset": "stone",   "status": "pending", "previewId": null,   "attempts": 0 },
    { "slot": 3, "preset": "jade",    "status": "failed",  "previewId": null,   "attempts": 3 }
  ]
}
```

`status` values: `"pending"` | `"generating"` | `"done"` | `"failed"`
Item `status` values: `"pending"` | `"generating"` | `"done"` | `"failed"`

---

## 5. Unlock Entitlements

### GET /api/v1/portfolios/{portfolioId}/unlocks

Auth required, owner check. Returns unlock budget and per-item unlock state.

**Response 200:**
```json
{
  "portfolioId": "uuid",
  "includedTotal": 1,
  "includedRemaining": 1,
  "additionalAvailable": 0,
  "items": [
    { "slot": 0, "preset": "bronze", "renderStatus": "done",    "previewId": "uuid", "unlocked": false },
    { "slot": 1, "preset": "iron",   "renderStatus": "done",    "previewId": "uuid", "unlocked": true },
    { "slot": 2, "preset": "stone",  "renderStatus": "pending", "previewId": null,   "unlocked": false },
    { "slot": 3, "preset": "jade",   "renderStatus": "done",    "previewId": "uuid", "unlocked": false }
  ]
}
```

Fields:
- `includedTotal`: free unlocks bundled with this portfolio purchase
- `includedRemaining`: how many of those are still available (not yet consumed)
- `additionalAvailable`: available entitlements from the user's other purchases (extra credits)
- `items[].unlocked`: true if `preview_ledger.unlocked_at` is set for this item's preview

### POST /api/v1/portraits/unlock

Auth required (or guest email). Consumes one entitlement and delivers the clean (unwatermarked) image.

**Request:**
```json
{
  "preview_id": "uuid"
}
```

**Response 200:**
```json
{
  "image_b64": "base64-encoded-image-data",
  "preview_id": "uuid"
}
```

**Error codes:**
- 402 `payment_pending` — entitlement exists but purchase not yet confirmed
- 403 `wrong_owner` — guest email doesn't match the preview's ledger row
- 404 `preview_not_found` / `clean_unavailable`
- 409 `no_entitlement` — no available entitlements to consume

---

## Routing Decision Tree for CUI

```
User has selected N effects:

  N == 1  →  POST /api/v1/checkout  (skuId: 'single')
             Direct render, no watermark, no unlock step.

  N == 4   →  POST /api/v1/portfolios
  N == 8   →  POST /api/v1/portfolios
  N == 16  →  POST /api/v1/portfolios
              Watermarked previews, unlock step required.

  N is 2-3, 5-7, 9-15  →  CUI/Curator must fill to next tier
                           before checkout is available.
```
