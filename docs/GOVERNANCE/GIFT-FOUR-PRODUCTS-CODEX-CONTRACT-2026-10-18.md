# Codex contract: the four Gift Shop products (mockup and catalog)

One page. The backend, composition, approval, correction, repair and checkout paths already work for all four products (see GIFT-FOUR-PRODUCTS-2026-10-18.md). What is
left on the frontend and visualization side is below. Nothing here changes your compositors or calibration; the backend only hands them the right picture.

## 1. Catalog (public/gift-wizard/catalog.next.json is yours)

Keep all eight product cards visible. Server product ids are `<family>:<size>`:

| id | sizes (server productId) | disabledReason now |
|---|---|---|
| matted | `matted:8x8 12x12 16x16 20x20 8x12 12x18 16x24 20x30` | `retail_price_pending` |
| framed_canvas | `framed_canvas:8x8 12x12 16x16 20x20 8x12 12x18 16x24 20x30` | `retail_price_pending` (`framed_canvas:8x12`: `orientation_unverified`) |
| mug | `mug:11oz` (sku `GLOBAL-MUG-W`, requiredPx 2670 x 1110) | `retail_price_pending` |
| card | `card:7x5` (sku `GLOBAL-GRE-MOH-7X5-BLA`, requiredPx 6118 x 2161) | `retail_price_pending` |

Your snapshot has no `options` for mug and card and no rectangles for matted and framed canvas: add them (labels: mug `11 oz White Mug`, card `Greeting Card 7 × 5″ (Mohawk)`; matted labels carry both numbers, e.g.
`12 × 18″ frame · 8 × 14″ picture`). GET /api/v1/print/catalog (the server catalog) is authoritative: new `disabledReason` values `mockup_template_pending` and `orientation_unverified`. The public catalog does not carry the internal production spec.
A disabled product can never be put on a line (`product_not_available`), so the page needs no new error handling.

## 2. What the backend gives your renderer (already wired: `templateFor`, `mockupArtwork`, `mockup-real.ts`)

| Product | templateId | artwork you receive | how it is called |
|---|---|---|---|
| Mug | `ceramic-mug` (handle on the RIGHT) | the **full wrap**, 1335 x 555 (exactly 2670:1110), **already rolled** so the face the viewer sees is in the middle of the file (x = 667.5), picture whole on both faces, soft wash elsewhere | `composeTemplateVisualTest({templateId, artwork, artworkId})`; the adapter supplies `wrapGeometry {2670,1110}`; **rotationTurns stays 0** (do not rotate again) |
| Card | `greeting-card` (the existing front-facing portrait template) | the **front picture**, 750 x 1050 (exactly 5:7) | `targetGeometry {widthIn:5, heightIn:7}`, fit cover, allowCrop false |
| Matted, Framed Canvas | none yet | n/a (`product_not_available` from the mockup route) | see section 3 |

Both mug and card templates currently say `awaiting-visual-approval`: they render correctly with real artwork (validation images in `calibration/four-products/`). **Please approve them (or tell me what to change) and commit the template folders
`public/gift-wizard/mockup-templates/ceramic-mug` and `greeting-card`: they are not on the integration branch yet, so a deployed mockup for these two would 503 until they are.** Then I add the family to `GIFT_MOCKUP_READY`.

### Mug facts for your cylindrical mapping (VERIFIED from Prodigi's template)
2670 px wrap = 360 degrees. Seam and handle at the two file edges (x = 0 and 2670). Opposite the handle x = 1334.5. Middle of each face x = 598 and x = 2069, i.e. about 99 degrees either side of the back. Your mapping's assumption note
("physical handle gap and seam placement unverified") can now be updated. The picture panel is 910 px square (about 123 degrees of arc) on each face. Prodigi publishes nothing on the unprinted rim at top and bottom for GLOBAL-MUG-W.

### Card facts (VERIFIED from Prodigi's template)
Only the front is shown (5 x 7 in portrait, 1500 x 2100 px of the file). Safe area for anything important: 36 px inside the trim at 300 dpi (0.12 in), i.e. 2.4% of the width.

## 3. Templates you need to build for the two framed products (specs, all VERIFIED unless marked)

Both print the picture flat; the compositor can reuse the perspective path of the Classic Frame. What the picture is on each:

* **Matted Frame** (Classic frame, Snow white mount, acrylic glaze; frame colour black, fixed): the print area IS the picture inside the mount.

  | size | frame (in) | picture (px) | picture (in) | border each side |
  |---|---|---|---|---|
  | 8x8 | 8 x 8 | 1800 x 1800 | 6 x 6 | 1.00 |
  | 12x12 | 12 x 12 | 2700 x 2700 | 9 x 9 | 1.50 |
  | 16x16 | 16 x 16 | 3600 x 3600 | 12 x 12 | 2.00 |
  | 20x20 | 20 x 20 | 4800 x 4800 | 16 x 16 | 2.00 |
  | 8x12 | 8 x 12 | 1800 x 3000 | 6 x 10 | 1.00 |
  | 12x18 | 12 x 18 | 2418 x 4218 | 8.06 x 14.06 | 1.97 |
  | 16x24 | 16 x 24 | 3618 x 6018 | 12.06 x 20.06 | 1.97 |
  | 20x30 | 20 x 30 | 4800 x 7800 | 16 x 26 | 2.00 |

  UNVERIFIED: the visible opening is not published; the print edge may tuck under the mount. Draw the mount as the border above and show the picture filling the rest, and keep the mount edge a soft, easily changed layer until we confirm. Mount thickness 2.4 mm, glaze acrylic.
* **Framed Canvas** (float frame, 38 mm stretcher bar; frame colour black, fixed): the picture is the front face of the canvas, **file minus 27 px each side** (8x8: 2400 x 2400 = 8 x 8 in; 12x18: 3600 x 5400 = 12 x 18 in). The 27 px is wrap, not visible on the front.
  Rectangles are portrait (12x18, 16x24, 20x30); **8x12 is on hold** (Prodigi's data contradicts itself on its orientation: do not build its template until the hold clears). UNVERIFIED: the gap of the float frame around the canvas and whether it overlaps the face; the sides are MirrorWrap (derived by Prodigi).
  **Do not assume the Gallery Canvas template is sufficient**: a float frame shows the canvas edge and a gap, so the frame mask, the shadow and the side are different.

Please name the new templates and tell me their ids (suggested: `matted-frame`, `matted-frame-square`, `framed-canvas`, `framed-canvas-square`); I map them in `templateFor` and add the families to `GIFT_MOCKUP_READY` in the same commit that adds your template folders.

## 4. Flow, states and errors: unchanged

Same endpoints, same composition, clean paid mockup (`watermarked: false`), approval, one correction per product, repairs without consuming it, disclosure and checkout. Nothing for the wizard to special-case except:
* after checkout, a line for one of these products produces the same `compositions[]` entry as any other; the `geometries[]` entry gains nothing new (`orientation: 'wrap'` for the mug, `'spread'` for the card, `picturePx` is the PANEL: 910 x 910 and 1500 x 2100);
* `requiredPx` in `geometries[]` is the whole lab file (the wrap or the spread): do not use it to size the on-screen picture, use `picturePx`.

## 5. When you can show the products as buyable

Not before: (1) the owner approves prices, (2) your templates are approved and committed, (3) the family appears in `GIFT_ENABLED_FAMILIES` (backend). The server catalog flips each product to `launch`; the page needs no other change.
