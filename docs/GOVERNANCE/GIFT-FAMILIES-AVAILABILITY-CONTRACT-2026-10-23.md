# Matted Frame, Framed Canvas, Photo Mug, Greeting Card: availability and generation contract for Codex 1, 2026-10-23

Backend only, committed locally. Source of truth for the Studio: `GET /api/v1/gift/sessions/{id}/availability`. Photography is NEVER a blocker (previews are the generated picture, or a scene where one truthfully exists).

## What is on sale now
8 products added: **Matted Frame 8x8, 12x12, 16x16, 20x20** and **Framed Canvas 8x8, 12x12, 16x16, 20x20** (GLOBAL-CFPM-* and GLOBAL-FRA-CAN-*). Prices are the retail prices already in the SKU map for those squares (matted $94 at 8x8 etc.; read `retailCents`). Verified against the Prodigi sandbox today (product + quote, read-only): all 8 Ok. `GIFT_ENABLED_FAMILIES = ['matted','framed_canvas']`. The Print Shop is unchanged: its catalog marks them `selectable:false` and its checkout still refuses them.

## What is not, and exactly why (`products[].blockers`, every open item, in clearing order)
| Product | Blockers | Meaning |
|---|---|---|
| matted:8x12, 12x18, 16x24, 20x30 | `retail_price_pending` | no approved retail price (placeholder 0): owner decision |
| framed_canvas:12x18, 16x24, 20x30 | `retail_price_pending` | same |
| framed_canvas:8x12 | `orientation_unverified`, `retail_price_pending` | Prodigi lists the SKU 8 wide x 12 tall but its print area is 3654 x 2454 (landscape; the 12x18 is 3654 x 5454). Only Prodigi can say which is right; no sandbox order is permitted here |
| mug:11oz | `retail_price_pending`, `family_not_launched` | price ($5.63 wholesale + $6.55 UK shipping) and launch decision; top/bottom coverage of GLOBAL-MUG-W is unverified |
| card:7x5 | `retail_price_pending`, `family_not_launched` | price and launch decision (shipping $6.45 exceeds the card) |
| card:7x5-gloss, 6x4-gloss(+direct), 6x6-gloss, 7x5-mohawk-direct | `not_a_launch_candidate` | other card variants, deliberately never offered |
To sell any of them: approve the price (`retailCents`, remove `retailApproved:false` in `sku-map.ts`) and, for the mug and card, add the family to `GIFT_ENABLED_FAMILIES`. No other code change is needed: generation, preview, composition and print preparation are done and tested for all of them.

## Contract additions per product in `AvailabilityView.products[]` (additive)
```
blockers: string[]                       // [] when purchasable
generation: { supported: true, requestedAspect, trimFraction, geometryKey }      // what POST .../generations will ask NB2.1 for, and how much (fraction per axis) is trimmed to the exact shape
          | { supported: false, reason: 'no_ratio_within_bound_for_series' | 'not_a_launch_candidate' }
configuration: { artworkProfile: 'flat_print'|'mug_wrap'|'card_spread'|null, skuOrientation: 'portrait'|'square'|'landscape'|'wrap'|'spread',
                 fixedAttributes: {...}, unexposed: {...}, picturePx, finalPx, pictureAspect }     // fixed by LITEN (e.g. matted {color:'black'}, framed canvas {color:'black', wrap:'MirrorWrap'}); not customer options
```
Generation shapes (Portraits and Pets): mug panel 1:1 (the wrap layout, seam and handle are built around the finished panel at print time), matted 12x18 -> 9:16 (1.9% trim), matted 8x12/16x24 -> 9:16 (about 7%), matted 20x30 -> 2:3 (8.3%), card front 5:7 -> 3:4 (5%), framed canvas 2:3 and squares exact. **Groups** are limited to their head-count formats: mug and the squares and framed canvas 2:3 work; matted 12x18/16x24 report `generation.supported:false` (11 to 16% from the nearest format, beyond the 10% bound): offer a different product for Groups or say so.
Trim happens when the picture is generated, BEFORE the customer sees and accepts it; nothing is extended or changed afterwards. `GenerationView.conform.trimFraction` reports it. Coarse mount-opening shapes (e.g. 403:703) are also resampled as a whole to the nearest exact print grid (under 1% shape change, nothing added or removed) so print preparation adds nothing; tested with the real print preparation for every one of these shapes.

## Orientations (unchanged)
`orientations.landscape.supported:false`: Prodigi has no landscape wall SKU in any family (census in `prodigi-aspect-sku-probe-2026-10-23.json`); the only 3:2 SKUs are 6x4 cards. framed_canvas:8x12's landscape print area is the one open Prodigi question above, not an approved landscape product.
