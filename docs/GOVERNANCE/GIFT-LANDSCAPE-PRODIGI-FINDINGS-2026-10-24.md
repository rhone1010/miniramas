# Landscape at Prodigi: what exists, and what the hanging hardware means (2026-10-24)

Evidence: sandbox GET /Products only (no orders), Prodigi's pages (poster hanger, classic frames, "how to hang a picture"), and a public developer issue that tested the same question. Data: `prodigi-poster-hanger-census-2026-10-24.json`, `prodigi-landscape-named-census-2026-10-24.json`, `prodigi-aspect-sku-probe-2026-10-23.json`.

## Hanging hardware (the only physical difference between 12x18 and 18x12)
- **Canvas (stretched and framed) and unframed prints: no hanging hardware.** Prodigi: stretched/framed canvas "no hanging hardware is included, hang with a nail or screw"; unframed prints have none. So a 12x18 canvas or print IS an 18x12 one turned 90 degrees; the only question is the file's orientation (a rotated file on the portrait SKU). Nothing physical is lost.
- **Classic Frame and Matted Frame (framed prints): hardware is fitted.** Prodigi: a Cobra hook (sizes up to 70x100 cm) or a sawtooth hanger (larger), "measured from the top of the frame"; "fixed sawtooth hangers run along the top edge". Prodigi's pages never say which edge it is fitted to or that the frame hangs either way. If it sits on the short edge, a landscape hang puts the hook on a side. **Unverified**; needs Prodigi support (or a physical sample).
- Prodigi publishes no orientation rule for any of these.

## Landscape SKUs that actually exist
- **Poster hanger (a print with magnetic wooden hanger bars, not a frame): real PORT / LAND / SQUARE SKUs.** Landscape ones found (print area is landscape, e.g. 24x32 LAND = 9600 x 7200): 6x8, 8x10, 11x14, 12x16, 16x20, 18x24, 20x28, 20x30 (2:3 shape), 24x32, A4, A3, A2, A1. Colours black, white, natural oak. **Not offered as hangers: 12x18, 16x24 (the 2:3 sizes we sell) in any orientation; 24x36 only portrait; 30x40/28x40 only portrait.**
- **Framed canvas 16x12 (GLOBAL-FRA-CAN-16X12, 4:3)** is the only landscape-NAMED wall SKU in Fine Art, Premium, Canvas, Classic Frame, Matted Frame or Framed Canvas (21 landscape sizes x 6 families probed). Framed Canvas 8x12 is listed 8x12 with a landscape print area (what we sell as 12 x 8).
- Everything else (Fine Art, Premium, Canvas, Classic Frame, Matted Frame, Framed Canvas) is portrait/square-defined. The 6x4 Fine Art/Premium SKUs are 15x10 cm cards.

## What this means for our prints (nothing changed in code)
| Product | Landscape possible? |
|---|---|
| Fine Art, Premium (unframed, no hardware) | Physically yes: same print turned. Needs a rotated file on the portrait SKU: the sandbox accepts any file, Prodigi does not rotate (a landscape file on a portrait area is centre-cropped), so we would send the picture rotated 90 degrees. Not verified visually by Prodigi; low risk because nothing is attached. |
| Canvas (no hardware), Framed Canvas | Same: rotated file on the portrait SKU; Framed Canvas 12x8 already works this way via its landscape print area; 16x12 (4:3) exists as its own SKU. |
| Classic Frame, Matted Frame | Only if Prodigi confirms where the hook/sawtooth is fitted (or fits it for landscape). Until then, do not offer. |
| Poster hanger (new product line) | Has real landscape SKUs, but not at 12x18 or 16x24; a different product from our prints. |
