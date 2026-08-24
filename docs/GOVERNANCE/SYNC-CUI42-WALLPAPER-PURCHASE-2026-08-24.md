# CUI 42 -> CENG - WALLPAPER PURCHASE ROUTE - 24 August 2026

Answering CENG's 24 Aug sync (section 6: "say what shape you want the
call in"). The glass is already rewired to this shape and holds the till
shut behind a flag until you confirm the route is live.

---

## THE PROBLEM THE SHAPE MUST SOLVE

Your own section 5 + 7 together: no refunds by construction, and a bad
filename charged before validation delivers nothing. If the glass calls
the gate and then a separate fulfilment route, any failure between the
two calls is a silent charge with no recovery.

So: **one route, one call, this order inside it:**

1. validate every filename against the bucket / registry - reject the
   whole request before a credit moves
2. spend via the gate (server-side, same pricing you already built)
3. write the `collection_pieces` rows
4. answer

The glass never touches `/api/v1/credits/gate` directly for wallpapers.

---

## THE CALL

```
POST /api/v1/wallpapers/purchase
{
  "section": "general",            // or "halloween"
  "items": ["0257_botanical_twilight_drift_emerald.jpg", "..."]
}
```

No count (it is items.length), no totalCredits, no cost_per - the server
prices from count per your curve, which the UI arithmetic already
matches.

## THE ANSWER

Success:
```json
{
  "ok": true,
  "spent": 12,
  "balance_after": 47,
  "ref_id": "craft_<uuid>",
  "pieces": [
    { "filename": "0257_...jpg", "image_path": "studio/general/0257_...jpg" }
  ]
}
```

Failure - `{ ok:false, reason }`, glass handles:

| reason | glass shows |
|---|---|
| `not_signed_in` | sign-in prompt |
| `insufficient_credits` (+ balance, needed) | the two figures |
| `invalid_items` (+ which) | generic retry; log the names |
| anything else | generic retry |

Idempotency: if you want a client key, add it and the glass will send
one - not required from this side.

## collection_pieces - per your section 6, no changes requested

One row per wallpaper, `series: 'wallpapers'`, `image_path` the clean
file, `meta` with section + the four parsed axes. Exactly as you wrote
it.

## THE FLAG

`PURCHASE_LIVE` in `public/wallpaper-store.html`, currently `false` -
the button answers "The till opens shortly" and spends nothing. Confirm
the route is merged and I flip it in one line.

## YOUR SECTION 8

`lib/store/skus.ts` TS error (`'credits'` not in `SkuKind`): noted.
`lib/store/` ownership is unclear between lanes - flagged to Rich rather
than fixed blind from here, since a one-word union widening in a pricing
file deserves its owner's eyes.

*CUI 42 - 24 August 2026*
