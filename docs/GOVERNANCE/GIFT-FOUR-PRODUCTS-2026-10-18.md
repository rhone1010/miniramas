# Gift Shop: Matted Frame, Framed Canvas, 11 oz Mug, 7 x 5 Greeting Card

Status 2026-10-18: backend built and tested for all four; NOT deployed; none can be bought yet (see section 8). Everything below is either
**VERIFIED** (Prodigi sandbox API or Prodigi's own templates), a **LITEN POLICY** (a composition decision, changeable without touching Prodigi's contract), or
**UNVERIFIED** (Prodigi does not publish it; never turned into a number).

Evidence: `docs/GOVERNANCE/prodigi-four-products-verified-2026-10-18.json` (18 SKUs: Products API, variant print areas, quotes, negative controls, wholesale and shipping;
read-only, no order created) and Prodigi's downloadable templates, fetched 2026-10-18:
`/download/templates/prodigi-11oz-mug.png` (sha256 2c7a42a4...75fd), `/download/templates/prodigi-greetings-card-portrait-7x5.psd` (9efc7224...7fb0),
`.../prodigi-greetings-card-landscape-7x5.psd` (2d3b5a37...12ea) from prodigi.com, measured pixel for pixel.

## 1. Status by product

| Product | SKUs | Built | Sellable now | Open items |
|---|---|---|---|---|
| Matted Frame | GLOBAL-CFPM-{8X8,12X12,16X16,20X20,8X12,12X18,16X24,20X30} | SKU map (all 8), attributes, geometry, flat profile, composition, print file | No | price approval (4 rectangles); mockup template (none exists) |
| Framed Canvas | GLOBAL-FRA-CAN-{8X8,12X12,16X16,20X20,8X12,12X18,16X24,20X30} | same, with the 27 px MirrorWrap margin | No | price approval (4 rectangles); mockup template; **8x12 orientation hold** |
| 11 oz Mug | GLOBAL-MUG-W | wrap profile, panel composition, wrap builder, print file, mockup input, renderer wiring | No | price approval; approval of the visual-test mockup template; top/bottom coverage fact |
| Greeting Card 7 x 5 | GLOBAL-GRE-MOH-7X5-BLA | spread profile, front composition, spread builder, print file, mockup input, renderer wiring | No | price approval; approval of the visual-test mockup template |

All eight catalog entries stay **visible**; the catalog reports the first open item as `disabledReason` (`orientation_unverified`, `retail_price_pending`, `not_launched`,
`mockup_template_pending`). The four launch families are unchanged (32 products, test-checked).

## 2. Prodigi attribute contract (VERIFIED, sandbox quotes)

| Product | Required by Prodigi | Sent by us | Notes |
|---|---|---|---|
| Matted | `color` (black, brown, dark grey, gold, light grey, natural, silver, white) | `{color:'black'}` | `mountColor` has one value, Snow white; any other value returns `NotAvailable`. Not sent. Fixed: Classic frame, 2.4mm mount, acrylic glaze, EMA 200gsm. |
| Framed Canvas | `color` AND `wrap`; neither has a default (missing either is a 400) | `{color:'black', wrap:'MirrorWrap'}` | **`MirrorWrap` is resolved: the Quotes API accepts it for every SKU and every frame colour** (black, brown, gold, natural, silver, white). Print area with MirrorWrap = Black = White (picture + 27 px a side); ImageWrap is a larger, different file and is not used. Invented colours return 400. |
| Mug | none (quote succeeds with or without) | `{color:'white', size:'313ml / 11oz'}` | |
| Card | none | `{}` | single-card self-send ("Mail2Me": OPP bag, blank kraft envelope). Direct-delivery, gloss, 6x4 and 6x6 stay disabled. |

Frame colour for the two framed products is **black, fixed** (as for the Classic Frame): a LITEN POLICY. The other colours are valid at Prodigi and are not exposed.

## 3. Geometry and safe areas

### Matted Frame (flat print profile, existing geometry.ts)
VERIFIED print area = **the picture inside the mount**, one flat file, equal to `finalPx`: 8x8 1800x1800, 12x12 2700, 16x16 3600, 20x20 4800, **8x12 1800x3000,
12x18 2418x4218, 16x24 3618x6018, 20x30 4800x7800** (all rectangles portrait-defined, consistent with Prodigi's product dimensions). The border between the picture and the
frame is uniform per size (1 in at 8x12, about 1.97 in at 12x18 and 16x24, 2 in at 20x30). Composition: the picture fills the print area exactly; the existing 2% / 20% bounded extension applies.
**UNVERIFIED:** the visible mount *opening*. Prodigi publishes only the print area; a mounted print normally tucks its edge under the mount, by an amount not published.
Interim LITEN POLICY: keep faces and text at least 3% of each side away from the picture edge. Confirm with one physical sample or with Prodigi (hi@prodigi.com).

### Framed Canvas (flat print profile, canvas wrap)
VERIFIED (variant `MirrorWrap`): 8x8 2454x2454, 12x12 3654, 16x16 4854, 20x20 6054, 12x18 3654x5454, 16x24 4854x7254, 20x30 6054x9054; picture = file - 54 px, wrap 27 px every side, produced by
`finishPrintPixels` (a reflection of the picture's own edge), exactly as the Gallery Canvas. Float frame, 38 mm stretcher bar, 400gsm canvas.
**UNVERIFIED:** what MirrorWrap paints on the 38 mm sides (Prodigi does not define it; the file size says the sides are derived by Prodigi, not supplied); whether the float frame overlaps any of the face.
**HOLD, `framed_canvas:8x12`:** Prodigi lists the SKU 8 wide x 12 tall (`productDimensions` 8 x 12 in) but returns a LANDSCAPE print area 3654 x 2454 for every wrap variant. Every other rectangle is consistent.
The two cannot both be right, and an order is the only way to prove which; none was created. The catalog follows the print area (landscape-defined) and `printPlan` now orients to the SKU's own definition
(a landscape-defined SKU does not turn a landscape picture; every previously existing SKU behaves exactly as before). **Prodigi must confirm, or you approve one sandbox order.**

### 11 oz Mug (`mug_wrap`)
VERIFIED (API + Prodigi template `prodigi-11oz-mug.png`): lab file **2670 x 1110 px** (22.86 x 9.483 cm, 300 dpi), a full wrap. **The two EDGES of the file meet at the handle**
(x = 0 and x = 2670); **x = 1334.5 is opposite the handle**; **x = 598 and x = 2069 are the middle of each face**. With the handle on the right (the mockup photo) the face a viewer sees is x = 2069.
LITEN POLICY: the reviewed picture sits **whole, at its own proportions, in a 910 x 910 px square panel on BOTH faces** (centred on x = 598 and x = 2069, top at y = 100), so it faces out for either hand;
everything else is a soft wash made from the picture, mirrored so the two ends of the file match at the handle (no seam). Nothing is cropped or stretched.
**Crop versus extend, resolved:** Prodigi's default sizing crops (fillPrintArea); we never rely on it. The picture is composed to the panel's shape first (a square master is exact; a 2:3 portrait is far outside the bound, so the plan generates a square one, as for every square product); the wash is background, not subject.
**UNVERIFIED:** whether the lab leaves an unprinted band at the top and bottom of GLOBAL-MUG-W (Prodigi's page guarantees top-to-bottom coverage only for H-MUG-W, the UK lab; GLOBAL-MUG-W ships from UK, EU, US or SE depending on destination and method),
the distance at which the print stops from the handle, and any bleed loss at the edges. The 100 px top margin and the 145 px clear zone either side of the seam are a conservative policy, not a measured fact.

### 7 x 5 Greeting Card (`card_spread`)
VERIFIED (API 6118 x 2161; Prodigi portrait template, measured): the file holds **two sheets side by side**, each 10 x 7 in trimmed: the OUTER sheet (outer rear | **outer front**) then the INNER sheet (inside front | inside back).
Trim: outer sheet x 29..3029, inner sheet x 3088..6088, y 30..2130 (template lines at 29/2131: rounded 1 px inside so the front is exactly **1500 x 2100 = 5:7**). Fold lines at x = 1529 and x = 4588.
Bleed 29 px left/right, 29-30 top, 30-31 bottom. Prodigi's red safe line is 35-36 px inside the trim.
LITEN POLICY: portrait 5 x 7 layout (upright artwork; the same SKU's landscape layout is the same file with every panel rotated 90 degrees and is not launched). The reviewed picture is placed **whole in the 1500 x 2100 front trim at 5:7**,
with a mirror of its own edge as bleed on the right, top and bottom (never on the fold side); the outer rear and the whole inner sheet are plain white (the self-send card prints nothing inside). Safe area for important content: trim minus 36 px, beside the fold too.
**UNVERIFIED:** the template labels the panels but no page states in words that the outer front is the right half of the outer sheet (the label order is the evidence); the margin beside the fold is our choice; Prodigi's template is 6117 px wide against the API's 6118 (the extra column is bleed).

## 4. How the artwork becomes the lab file

`composeWithPrintShop` (Gift composition) -> the PANEL picture: flat products as before; mug 1:1 panel; card 5:7 front (`preparePanelComposition`: bounded outpaint or reflection, never a crop).
The customer reviews and approves that picture. At print time `profileFor(job)` (registry) runs `prepare` (the panel only is upscaled: a card's 13 MP spread is never sent to a provider), then `finish` builds the whole file
with the same `product-layout.ts` functions the mockup input uses, so what is shown is what is printed. `qaRegion` is the picture only. One correction per product, repairs, approval and manufacturing gates are unchanged.

## 5. Proposed retail prices (for your approval; nothing here is live)

Gross margin = (retail - Prodigi item cost) / retail. Net = after Stripe (2.9% + $0.30 on item + shipping; shipping is passed through at the Prodigi US quote, so only the Stripe fee on it is a cost). Costs are sandbox quotes (US destination, Budget).
Existing square prices (approved, in `sku-map.ts`) are shown for reference; the rectangles and the mug and card are proposed. Rule used: about 60% gross for framed and wall products (the Classic Frame family runs 58 to 64%), above the Classic Frame at the same size.

| SKU | Price | Item cost | Gross | Net after Stripe | US shipping (Budget) | Status |
|---|---|---|---|---|---|---|
| Matted 8x8 | $94 | $38.00 | 59.6% | $52.57 (55.9%) | $14.00 | existing |
| Matted 12x12 | $109 | $44.00 | 59.6% | $60.82 (55.8%) | $24.80 | existing |
| Matted 16x16 | $129 | $50.00 | 61.2% | $74.24 (57.6%) | $24.80 | existing |
| Matted 20x20 | $149 | $60.00 | 59.7% | $83.63 (56.1%) | $25.90 | existing |
| **Matted 8x12** | **$99** | $40.00 | 59.6% | $55.11 (55.7%) | $24.80 | proposed |
| **Matted 12x18** | **$129** | $50.00 | 61.2% | $74.21 (57.5%) | $25.90 | proposed |
| **Matted 16x24** | **$149** | $60.00 | 59.7% | $83.63 (56.1%) | $25.90 | proposed |
| **Matted 20x30** | **$189** | $70.00 | 63.0% | $112.28 (59.4%) | $32.35 | proposed ($179 would tie the Classic Frame at 20x30 while costing $5 more) |
| Framed Canvas 8x8 | $79 | $30.00 | 62.0% | $46.00 (58.2%) | $14.00 | existing |
| Framed Canvas 12x12 | $99 | $40.00 | 59.6% | $55.11 (55.7%) | $24.80 | existing |
| Framed Canvas 16x16 | $129 | $52.00 | 59.7% | $72.24 (56.0%) | $24.80 | existing |
| Framed Canvas 20x20 | $169 | $70.00 | 58.6% | $93.05 (55.1%) | $25.90 | existing |
| **Framed Canvas 8x12** | **$89** | $34.00 | 61.8% | $51.40 (57.8%) | $24.80 | proposed, **held** |
| **Framed Canvas 12x18** | **$119** | $48.00 | 59.7% | $66.50 (55.9%) | $25.90 | proposed |
| **Framed Canvas 16x24** | **$159** | $64.00 | 59.7% | $89.34 (56.2%) | $25.90 | proposed |
| **Framed Canvas 20x30** | **$219** | $87.00 | 60.3% | $124.41 (56.8%) | $32.35 | proposed |
| **11 oz Mug** | **$19** | $5.65 | 70.3% | $12.31 (64.8%) | $6.58 (UK lab, Royal Mail) | proposed ($22: 74%; $24: 76%) |
| **Greeting Card 7x5** | **$7** | $2.25 | 67.9% | $4.06 (58.0%) | $6.45 (USPS First Class) | proposed ($8: 71.9%; $9: 75.0%) |

Notes for the decision: a second mug adds $1.33 of shipping, a second card adds $0, a second framed item adds about $11; the card's shipping ($6.45) is larger than the card, so a $7 card is a $13.45 purchase (the shipping rule is yours: it is quoted live and charged at cost).
The mug ships from a UK lab to the US at Budget (carrier Royal Mail): delivery time and customs are a product question for you, not a file question.

## 6. Tests (all offline; no paid call, no Prodigi order)

`production-profiles.test.ts` (geometry invariants against the record), `product-layout.test.ts` (the wrap and the spread contain the whole picture, no seam, shape refusals, QA regions),
`upscale/gift-profiles.test.ts` (prepare/finish/qa for all four through the processor's interface), `panel-composition.test.ts`, `gift-products.test.ts` (18 SKUs against the record: attributes, pixels, fulfilment payload per SKU,
launch gates, hold), `gift/four-products.test.ts` (select, compose, mockup input, approve, print file for six representative products), `gift/mockup-real.gift-products.test.ts`, plus the updated catalog, profile and template tests.
`lib/v1/gift` + `lib/v1/print`: 679 pass. The 17 failures in `lib/v1/groups` and `retry-sql` (no PGlite module) are identical with and without this work.
Visual validation with real artwork and Codex's templates (read-only): `calibration/four-products/` (mug and card mockups, print-file previews for all four).

## 7. What changed in shared code

`sku-map.ts` (new types and entries, `retailApproved`), `catalog.ts` + `catalog-types.ts` (all four from the map, `artworkProfile` union, internal `production` spec, new disabled reasons), `geometry.ts` (orientation reference is the SKU's own; framed-canvas wrap allowed),
`asset-pipeline.ts` (`preparePanelComposition`), `upscale/profiles.ts` (two profiles registered), `gift/compose.ts` (panel composition), `gift/mockup.ts` and `mockup-real.ts` (mug and card). Compositors, the calibrated templates, prompts and the four launch families are untouched.

## 8. Is each product ready to enable?

Backend: **yes for all four** (framed canvas 8x12 excepted). To enable a family, in this order: (1) you approve its prices -> remove `retailApproved: false` and set `retailCents` in `sku-map.ts`;
(2) Codex's template for it is approved -> add the family to `GIFT_MOCKUP_READY` (and, for matted frame and framed canvas, `templateFor` needs the new template ids); (3) add it to `GIFT_ENABLED_FAMILIES`; (4) for framed canvas 8x12, Prodigi's answer.
A test fails if a family is marked mockup-ready while `templateFor` returns nothing for it.

| Product | Remaining before it can be sold |
|---|---|
| Matted Frame | your price approval (rectangles); Codex's mockup template; one physical sample or Prodigi's answer on the mount opening (not a blocker if the interim 3% margin is accepted) |
| Framed Canvas | your price approval (rectangles); Codex's mockup template; Prodigi's answer on 8x12 (the other seven sizes are unaffected) |
| 11 oz Mug | your price approval; Codex's approval of the visual-test mug template (it renders correctly now); confirmation of the top/bottom coverage on GLOBAL-MUG-W |
| Greeting Card | your price approval; Codex's approval of the visual-test card template (it renders correctly now) |
