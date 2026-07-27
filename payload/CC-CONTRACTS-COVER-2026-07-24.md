# CLAW → CC — Contract Issue + Corrections · 2026-07-24
Issue both hook contracts to CC as authoritative. This cover note records the corrections that override any conflicting line inside them, plus the boundary law.

---

## BOUNDARY LAW — applies to both contracts, no exception
- **CUI owns every byte of HTML and CSS.** CC writes a separate JS file and never edits markup.
- **Verified by HTML diff.** The markup CC returns must be byte-identical to what CUI shipped. Any change = boundary broken.
- A hook that isn't in the contract is **requested, never invented.**
- **Fidelity law on the port:** `public/portraits.html` is the live engine (13 `fetch()` calls). r80d is a fetchless reference. Port deltas line-count-matched, deviations reported. Never drop the reference onto the engine file.
- **Boot gate:** `scripts/boot-test.js` must pass AND browser console must be clean on boot before "done." Braces + tsc do not catch TDZ/ordering/runtime faults.

---

## CORRECTIONS — these override any conflicting line in the contracts

### 1 · Credits, not dollars, drive the pay step
- **One Crafted Image = 10 credits.** Locked for wiring. (Supersedes the "5 credits" in Portraits contract §6 and the "1 credit" from the earlier spec.)
- Portraits contract §5's **dollar ladder does NOT drive `#payTotal`.** The pay step is denominated in credits. Wire the credit debit, not the `4.99 × count × PCT` dollar formula.
- Debit at craft start; refund on studio failure. Recraft costs 0.
- `#creditsCount` unhides on a signed-in balance. Single noun "credits" everywhere — never "crafts remaining."

### 2 · Stripe present, bypassed for testing
- Stripe stays wired. Comp codes bypass it for the test group. Aug 15 = config flip, not re-integration. **Do not strip commerce.**
- Print Shop `#orderConfirm[data-prodigi-submit]` — attribute-driven terminus stays. Read the attribute, never hardcode. For the test walk it reads "off" (persist record, no Prodigi/Stripe call); flips to "on" for live.

### 3 · Responsive floor = 1280, overflow released
- Both contracts flag `body{min-width:1440px; overflow:hidden}` as a defect. **Fix: floor at 1280, remove `overflow:hidden`.** The `--container` ladder already releases at 1199, so the layout reaches 1280 — only that one line fights it.
- Rationale: 1366×768 laptops are ~1/8 of US desktop users, more abroad. A 1440 floor with hidden overflow clips content unreachably for them. Rich has built to 1280 for years.
- **Mobile is a separate build** — not this file's concern. This floor covers desktop; phones are the mobile build.

### 4 · Sets stay flag-hidden, unwired
- Portraits §10: markup stays, CC does **not** wire it. Same pattern as Gallery Canvas (`CANVAS_ENABLED=false`) in Print Shop. Flag-hide, never delete.

### 5 · Gallery Canvas — display only for now
- `GLOBAL-CAN` not in `sku-map.ts`. `CANVAS_ENABLED=false` — button hidden, markup preserved. Do not map the SKU or wire canvas quoting for Aug 1. Aug 15 work.

---

## PARKING LOT — Aug 15 pricing (logged, not wired now)
Credit scaling model, to build when pricing goes live:
- Pack pricing at **non-round ratios** (e.g. ~20 credits / $9.99) so credits read as their own unit, not a dollar alias.
- Standard image 10 · premium/interpretive (gpt-image-1) 15–20 · curiosity ~8 · wallpaper export 5 · recraft-with-tweaks ~3 — everything a credit multiple of the base.
- The real dollars-per-image target is a business decision separate from the credit denomination — name it explicitly at Aug 15, don't back into it via pack size.
- Also Aug 15: real print prices, `GLOBAL-CAN`, persisted SKU→cost matrix, declining-multiplier retail formula.

---

## ROUTING
**CC — Portraits:** wire `printshop.ui.js`… (Portraits: separate JS file) against `PORTRAITS-HOOK-CONTRACT-v1`, credits driving pay step per correction 1, floor fix per 3, Sets unwired per 4. HTML diff clean, boot gate green.
**CC — Print Shop:** write `printshop.ui.js` against `PRINTSHOP-HOOK-CONTRACT-v3`, `data-sku` read never reconstructed, canvas display-only per 5, order terminus attribute-driven per 2, masthead count through the component API. Requires shared masthead landed first.
**Order:** shared masthead → Print Shop (cart badge lives in masthead).
**Separate ticket:** `focal_x`/`focal_y` on the piece payload per `CC-TICKET-FOCAL-POINT-2026-07-24` — CC delivers the two numbers, CUI applies the crop.
