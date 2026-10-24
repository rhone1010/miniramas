# Matted Frame, Framed Canvas, Photo Mug, Greeting Card: availability and generation contract for Codex 1, 2026-10-23

Backend only, committed locally. Source of truth for the Studio: `GET /api/v1/gift/sessions/{id}/availability`. Photography is NEVER a blocker (previews are the generated picture, or a scene where one truthfully exists).

## What is on sale now (owner decision 2026-10-23: launch all, market-competitive prices, conservative margins accepted)
**Matted Frame:** 8x8 $94, 12x12 $109, 16x16 $129, 20x20 $149, 8x12 $99, 12x18 $129, 16x24 $149, 20x30 $179. **Framed Canvas:** 8x8 $79, 12x12 $99, 16x16 $129, 20x20 $169, 12x18 $119, 16x24 $159, 20x30 $219. **Photo Mug 11oz $19.99. Greeting Card 7x5 $7.99.** (`retailCents` is authoritative; shipping is never included: Prodigi quotes it live, charged at cost.) Framed items follow the approved squares' pattern (Prodigi cost x about 2.5, to a whole dollar ending in 9); mug and card are typical market prices. All 17 returned Ok on the Prodigi sandbox (product + quote). The Print Shop is unchanged (its catalog marks Gift-only families `selectable:false`; its checkout still refuses them). The mug and the card have approved scene photography; the rest are previewed as the exact product-shaped picture with the disclosure.
**Sandbox asset check (owner-authorized, test pattern files, cancelled; `scripts/prodigi-sandbox-asset-check.ts`):** Prodigi accepted the exact print-file size for framed canvas 8x12 and 12x18, the mug, the card and matted 12x18 with no issues; assets downloaded; the card order was fully prepared and allocated to the US lab, the mug to the UK lab (Royal Mail; one sandbox mug order went into production and could not be cancelled: sandbox, no print, no charge).

## What is not on sale
Only the other card variants (gloss, direct, 6x4, 6x6): `not_a_launch_candidate`, deliberately never offered. **Framed Canvas 8x12 is released** (owner decision 2026-10-23: orientation does not matter, presentation does): it is presented as the **landscape 12 x 8** its Prodigi print area describes (label "12 × 8″ landscape", productId stays `framed_canvas:8x12`, $89, picture 3:2, file exactly 3654 x 2454, which the sandbox accepted). A portrait 8 x 12 presentation is not offered.

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

## Orientations
`orientations: { square|portrait|landscape: { supported, reason, productIds[] } }` (additive: `productIds`). Offer a product in an orientation only if it is in that list. `landscape.productIds = ['framed_canvas:8x12']`: Prodigi has one landscape-defined wall SKU and no other family has one (census in `prodigi-aspect-sku-probe-2026-10-23.json`). It generates at 3:2 natively with no trim. Other landscape products would need a Prodigi landscape SKU.
