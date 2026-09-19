# Mobile — outstanding runtime verification

One list, kept current, so BrowserStack acceptance is a single session rather
than a rediscovery. Opened 2026-09-18, branch `feat/discovery-curator-pass2`.

**Nothing below has been seen on a device.** CC has no browser. Everything
here is either fixed at the mechanism and unconfirmed, or known-unverifiable
without a person. Two of the five defects Rich found on 2026-09-18 were CC
regressions that shipped with a green suite and a compliance table reading
DONE — so "fixed at source" is a claim about cause, not about behaviour.

Test widths: **360, 390/393, 400/401, 767/768, 1024/1025, 1279/1280,
1329/1330**. Devices: iPhone 15 Pro Safari (393), Galaxy S23 Chrome (360),
iPad portrait (768, 1024), Win11 Chrome 1366x768.

---

## A · Fixed at the mechanism, unconfirmed on a device

| # | What to look at | What was wrong, and what should now be true |
|---|---|---|
| A1 | **Any room, 360/390/393** | Cards overlapped. The silo grid sized cards from the CONTAINER's height (`container-type:size`, two fixed rows, width from `50cqh`) — right for a desktop stage that cannot scroll, wrong where the stage scrolls and a room is 3+ rows. Below 1024 rows are now content-sized. **Every effect should own its rectangle; no image or title inside another.** Check a room with mixed source aspects, not one. |
| A2 | **Review with 8 and 16** | A tiny thumbnail stranded in a large empty card. `.card` has ONE child (`.card__art`); the name and remove are nested inside it, so a 3-column grid on `.card` had one item to place. Now a flex row with the nested children positioned against the row. **Expect: thumb / name / remove, ~72px tall, no empty interior.** |
| A3 | **Curator sheet, opened from the rail** | Was the desktop rail squeezed into a sheet. Effect Map now pages two panels of four silos, each silo standing as its swatches over its icon, with dots. **Swipe should land square on a page (scroll-snap); dots should follow.** Snap under a thumb is the part most likely to behave differently from the CSS. |
| A4 | **Discovery rail at 0 / 1 / 4 / 8 / 16** | Review was `display:none` without `.on`, and nothing adds `.on` on Discovery — the rail had a Curator, a count and nothing to press. **Expect Review present in all five states, greyed at 0.** |
| A5 | **Format stage** | Showed count + "Review Collection" + "Craft My Collection" at once. **Expect one forward action.** Also check the tiles do not sit under the docked rail at 360/390 — the stage now reserves its height. |
| A6 | **Back paths** | Format had no back control at all (its handler existed; the button never did), and an earlier pass hid Review's. **Expect a way back from Review, Format, both detail views — and the selection intact on return.** |
| A7 | **Tap an effect with no photo uploaded** | The message named a control inside a sheet that starts shut. **Expect the Curator sheet to open at the source area, with the nudge.** |
| A8 | **My Collection opened from Format (after paying) and from Review** | `is-review` / `is-format` outlived their stages and the docked rail reads both. **Expect the collection's own rail, and Review's rail back when you close it from Review.** |
| A9 | **Piece detail, Preview and Owned** | New. **Preview: badge, collection date, prev/next, "Use Included Unlock (N available)" only when the portfolio has one, "Unlock for $2.99". Owned: badge, View Full Size, Download.** Owned must offer no unlock; Preview must offer no download. |

## B · Needs a purchase — do once, together

| # | What to look at |
|---|---|
| B1 | **A crafting run, 4 or 8.** Oxblood gear cards should be replaced IN PLACE by the artwork as each lands. The band above should move Payment received -> Creating N of M -> A new portrait is ready -> Your collection is ready, and the last should show once, not on every visit. |
| B2 | **The 2026-09-18 looping defect.** `crafting` was defined as not-done, which is also true of a FAILED render, and the poll gives up silently after 3 minutes — so the animation was the only thing still moving. Failed is now its own state. **If tiles stop again, read the tile: "Didn't finish" means the render failed and the client is now honest about it; a still-turning gear means something else and the poll is the place to look.** CC could not determine whether Rich's 8 failed or stalled — the Vercel log window had rolled. |
| B3 | **Mobile 9:16 end to end.** Migration 033 is applied. Buy one Mobile-format piece and confirm the delivered image is a native tall render, not a crop, and that the subject sits low with a quiet upper third (PHONE_COMPOSITION). |
| B4 | **$2.99 unlock from the piece detail**, both entry points (included first, then paid). |

## C · Known deviations — not defects, no action pending

- **Format tile artwork.** Abstract shapes, not the board's sample images.
  Three of four formats have deterministic owned assets (Square
  `homepage/hero/set-01-after.jpg` 1024x1024; Mobile
  `previews/wallpapers/portraits/man_bronze.jpeg` 768x1376; Portrait any
  curated plate). **Landscape has none** — the only landscape assets are
  gallery-room backgrounds, and a room illustrating a portrait format would
  misrepresent the product. Needs one 4:3 landscape-oriented portrait render
  in `public/`. Structural treatment takes them without change.
- **Make a Print** omitted — no existing Printshop route accepts a Discovery
  piece without new architecture (Rich's ruling).
- **Bottom nav** (Discover / My Collection / Printshop) not built — would
  require routes that do not exist (Rich's ruling).
- **Effect description** in the Review detail is blank where the registry
  carries none (Rich's ruling: do not invent).

## D · Noted, out of scope, not touched

- `progLine` is read once (`paintProgressLine`) and never created anywhere;
  a scroll listener calls it on every scroll and it returns immediately. Dead
  since before this work. Left alone as unrelated cleanup.
- Pre-existing COPY LAW breaches in customer-visible strings: "Create your
  collection" and "renders directly" in the coach marks, "before anything is
  created", "Creating your collection...", and the effect label **"Petal
  Sculpture"** live in The Living World. Customer copy is Rich's lane.
- M2 duplicate unlock sessions — parked payment hardening.
- A5 bypass removal and A6 remain untouched and unstarted.
