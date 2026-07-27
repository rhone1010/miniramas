# Print Shop — Hook Contract v3 (consolidated)

Source of truth: `litenco-printshop-2026-07-24-r28.html`
Authored by CUI V21 · 2026-07-24 · **for CLAW to issue**
Consumer: CC. Supersedes v1 and the v2 addendum — issue this one, not three.

**Boundary law.** CUI owns every byte of HTML and CSS. CC writes
`printshop.ui.js` against the hooks below and never edits markup. A hook that
isn't listed is requested, not invented. Verified by HTML diff.

**Read this first.** r22 ships working JavaScript for cart removal, recount and
strip scrolling. That script is a *demonstration of the contract, not an
implementation of it.* Read it to understand intended behaviour, then delete it
and write against this document.

---

## 1 · Gallery

| Hook | CC responsibility |
|---|---|
| `#psGallery` | Container only. |
| `#psFilters` → `.f[data-series]` | `all\|portraits\|pets\|groups\|action`. One `.on`. Re-render the minimap. Delegate; do not bind per button. |
| `#psSort[data-order]` | Toggle `newest` ⇄ `oldest`, write back to the attribute, re-render. |
| `#psMinimap` → `.mini[data-piece-id]` | Selection. One `.sel` only. Drives `#feat` and `#psStudio`. |
| `.mini .mini-incart` | Present ⇔ that piece has ≥1 cart line. |

**Mobile Wallpapers must not appear here.** Filter at the source query. The
Download-vs-Print intent gate belongs to My Collection; arriving here already
means print.

## 2 · Featured piece

`#feat` · `#featImg` (src + alt) · `#featNm` · `#featEff` · `#featAr` (e.g. `4:5`)
· `#featBadge` (`hidden` unless the piece has a cart line).

The frame is locked on both axes and the image is `contain`. CC sets sources,
never dimensions.

## 3 · Print Studio

Per-piece configuration. Switching pieces **saves** the outgoing draft and
**restores** the incoming one if it exists.

State shape CC owns: `{ pieceId, finish, size, style, qty }`

| Hook | CC responsibility |
|---|---|
| `#psStudio` / `#stClose` | Container / collapse and clear selection. |
| `#stPrev` `#stNm` `#stEff` | Mirror the featured piece. |
| `#finGrid` → `.fin[data-f]` | `fineart \| canvas \| framed`. Sets `.on`, re-renders sizes, shows/hides `#styleSec`. |
| `#sizeGrid` → `.sz[data-size][data-sku]` | Sets `.on`, triggers the quote. |
| `#arNotice` | See §4. |
| `#styleSec` `#styleStep` `#styleTitle` `#styleNote` `#styleGrid` → `.sty[data-style]` | `hidden` unless the finish has style options. |
| `#qMinus` `#qVal` `#qPlus` | Floor 1. |
| `#qtyStep` | `3` when styles hidden, `4` when shown. |
| `#stPrice` | Retail line total. |
| `#stPriceNote` | Unhide while quoting; unhide with the error on 400/502/500. |
| `#addToCart` | Native `disabled` until finish **and** size are chosen. On success push a line, re-render §5, update the masthead badge. |
| `#addCfg` | Same piece, config reset to defaults, so a second variant can be added. |

**Read the SKU off `data-sku`. Do not reconstruct it** from finish + size — the
framed prefix (`CFPM`) does not follow the unframed pattern (`FAP`).

## 4 · Aspect ratio

Prodigi is called with `sizing:fit`. Every size shows for the chosen finish,
ratio-matched or not.

When the selected sheet's ratio ≠ `#featAr`, unhide `#arNotice` and state that
the image is fitted with the difference falling in the border. No client-side
crop UI. **The cart line stores the size, never a crop box.**

## 5 · Cart strip

| Hook | CC responsibility |
|---|---|
| `#cartTray` | Container. |
| `#cartItems` → `.ti[data-line-id]` | One line per variant. The same piece may appear on several lines. |
| `.ti-st.r` / `.ti-st.n` | Ready / needs-options badge — CC swaps the class. |
| `.ti-need` | Present only on incomplete lines. |
| `.ti-x[data-line-id]` | Remove that line. Delegate from `#cartItems`. |
| `#cartNext` | Scroll the strip two cards. Set `hidden` at the end. Recompute on scroll, resize, add and remove. |
| `#cartCount` `#cartReady` `#cartNeeds` | Counts. |
| `#sumTotal` `#sumReady` `#sumNeeds` | Mirror the counts. |
| `#cartSubtotal` | **Ready lines only.** Removing an incomplete line changes counts, not the subtotal. |
| `#checkoutBtn` | Opens `#orderConfirm`. |

Removal is immediate — no confirm, no undo toast. The piece stays in the
collection; only the print configuration is discarded.

Incomplete lines recede. No error styling, no blocking.

## 6 · Order confirmation

`#orderConfirm[data-prodigi-submit]` — read the attribute, never hardcode.

- `"off"` — persist the order record, unhide `#ocDone`, stop. No Prodigi call,
  no Stripe call.
- `"on"` — payment, then submit.

`#ocLines` · `#ocSubtotal` · `#ocShipping` · `#ocTotal` (retail cents only) ·
`#ocNote` (CUI owns the copy, do not rewrite) · `#ocCancel` · `#ocPlace` ·
`#ocDone`.

Aug 1 ships `"on"` per Rich's ruling that Stripe and prices go live. The
attribute stays so the terminus is reachable for testing without a rebuild.

## 7 · Masthead

`#mhCartBtn` / `#mhCartCount` carry `data-owner="masthead-component"` and exist
in this file only so the mock renders. **Write the count through the masthead
component's API, never by querying these IDs.** Reference
`litenco-masthead-2026-07-24-r1.html`.

At zero, set `data-empty="true"` — the badge mutes, it never hides.

## 8 · Prices — locked and gated

| Finish | Size | SKU | Retail |
|---|---|---|---|
| Fine Art Print | 8×10 | `GLOBAL-FAP-8X10` | $28 |
| Fine Art Print | 12×16 | `GLOBAL-FAP-12X16` | $48 |
| Fine Art Print | 18×24 | `GLOBAL-FAP-18X24` | $68 |
| Framed Print | 16×20 | `GLOBAL-CFPM-16X20` | $118 |

The invented `FBASE`/`LADDER` pricing is gone. The CUI build fails on any price
outside this set. If a quote returns retail that disagrees with the map, that is
a bug in one of the two — raise it, do not reconcile it in the UI.

`CANVAS_ENABLED` gates Gallery Canvas. `false` today: the finish button carries
`hidden` and its styles are unreachable. **Do not delete the canvas markup.**
Flip the flag when `GLOBAL-CAN` lands.

Finish prices render from the SKU table via `renderFinishes()`. The static
`From $28` / `From $118` labels are no-JS fallbacks only.

## 9 · Tokens — do not redefine

Canonical, from the approved v2 design system: `--oxblood #7d4242`,
`--brass #75623a`, `--ink #2a241e`, `--gold #b68a53`, the vellum family, the
coffee family. r28 removed the invented `--color-*` palette that shadowed these
with near-miss values. Restyling a hook must not reintroduce it.

Type is rem against `clamp(12px, 0.38vw + 6px, 15px)`. Cormorant never bolds and
never renders below 1.333rem. The CUI build gate enforces both.

---

## Definition of done

- Every hook bound or explicitly reported as not-applicable.
- The r22 demonstration script deleted.
- No markup or CSS changed. HTML diff clean.
- Browser console clean on boot.
- Quote round-trip, AR mismatch notice, and the order terminus all exercised
  before handing to CAQ.

## Open — blocks §3 only

Gallery Canvas. `GLOBAL-CAN` exists at Prodigi and is not in `sku-map.ts`. Every
other hook is wireable now.

## Requested from CC — separate ticket

`focal_x` / `focal_y` on the piece payload, per
`CC-TICKET-FOCAL-POINT-2026-07-24`. CUI applies the crop; CC delivers the two
numbers.
