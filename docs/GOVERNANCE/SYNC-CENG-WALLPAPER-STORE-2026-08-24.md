# SYNC -- CENG -- WALLPAPER STORE CHECKOUT + FULFILMENT
24 August 2026. From CUI 42. The store UI is live and blocked on two
engine items. Everything the UI sends is already fixed and deployed --
build to this contract and nothing on the glass changes.

---

## WHAT IS LIVE

`public/wallpaper-store.html` + `public/wallpaper-registry.js`, merged to
main 24 Aug. Both catalogues render, filter, and cart. The Buy button
POSTs and currently receives `sku_not_found`, which the rail reports
honestly. Two engine items make it real.

---

## 1 -- THE SKU

The page POSTs `/api/v1/checkout`:

```json
{
  "skuId": "wallpaper_cart",
  "cart": {
    "kind": "wallpapers",
    "section": "general",              // or "halloween"
    "items": ["0257_botanical_twilight_drift_emerald.jpg", "..."],
    "totalCredits": 12
  },
  "returnUrl": "https://litenco.com/wallpaper-store.html"
}
```

**Price -- ruled 23 August:** one wallpaper 3 credits, five for 10.

**Server-side pricing (never trust totalCredits):**
```
n = items.length
price = floor(n/5) * 10 + (n % 5) * 3
```

**THE 6+ RULE IS PROVISIONAL.** Every full five at 10, remainder at 3
each. Rich has not ruled six-plus (SPEC-WALLPAPER-STORE section 6 says
ask him). The UI uses the same arithmetic in one function; if he rules
differently, both sides change one line each.

Validate every filename in `items` against the bucket listing (or the
registry) -- reject the request if any name is not a real file.

---

## 2 -- FULFILMENT

On successful payment, for each purchased filename:

- The CLEAN file is the one already in the public bucket:
  `wallpapers/studio/<section>/<filename>`
- Write a row into the customer's collection (`collection_pieces` or
  wherever the schema settles) with:
  - a category/filter value of `wallpapers` -- My Collection needs to
    filter on it (Rich's ruling: "receive unwatermarked images in My
    Collection under filter Wallpapers")
  - the clean URL or storage path
  - section + parsed fields if cheap (world/mood/energy/palette are all
    derivable from the filename; the parser rules are in
    SPEC-WALLPAPER-STORE section 2 and implemented in
    `wallpaper-registry.js`'s generator)

No print path. No Prodigi. Download-only.

---

## 3 -- WHAT THE UI GUARANTEES

- Watermarked previews only on the floor and in the cart
  (`studio/<section>/preview/<filename>` -- upload in progress)
- Never sends free text to the server: filenames and a section id only
- Cart persists in sessionStorage per section
- On `{ url }` response it redirects (hosted checkout pattern); on
  `sku_not_found` it says the till is not wired yet

---

## OPEN QUESTION FOR RICH (blocking nothing, needed before hard launch)

Six-plus pricing. Current provisional: 6 pieces = 13 credits (10 + 3),
10 = 20. Alternatives he might prefer: cap nudging at five, or a
ten-pack price. One line each side to change.

*CUI 42 -- 24 August 2026*
