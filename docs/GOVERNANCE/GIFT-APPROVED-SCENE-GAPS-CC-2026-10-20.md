# CC: approved customer-scene gaps and actual customer wall — 2026-10-20

Frontend commit: f5a6fec (local only). Retired calibrated images are rejected, not substituted. No pricing, availability, geometry, approval, or backend changes.

## Required integration work

Authoritative decision: lib/v1/gift/scenes.ts SCENE_FACTS / resolveScene / prepareSceneArtwork. Descriptor: tools/product-scenes/adapter.next.cjs describeScene. Consumers: lib/v1/gift/product-preview.ts and lib/v1/gift/mockup.ts / mockup-real.ts.

Return renderer=scene and the exact approved scene identity only for a truthful supported configuration. Product preview uses sceneId; paid mockup uses scene.sceneId. Frontend accepts all ten approved scene IDs with family validation, not only the three currently eligible mappings. Do not relabel calibrated output as scene.

The catalog below is recomputed from allProducts() and resolveScene(), not guessed from product names. Existing approved scene IDs: fine-art-square, premium-fine-art, classic-framed, matted-frame-square, gallery-canvas-square, gallery-canvas-landscape, matted-frame-landscape (actually canvas), framed-canvas, ceramic-mug, greeting-card.

Most gaps are NOT missing dictionary entries. Frame finish, orientation, or shape prevents routing. Before requesting new photography, verify that describeScene's maskBounds bounding-box aspect is truly the intended artwork-plane aspect: projected image extents are not automatically physical print proportions. Correct a demonstrated descriptor/calibration error only with approved measurements; do not weaken the 2% tolerance, rotate approved scenes, crop subjects, stretch, alter masks, or substitute finishes. Preserve production composition identity and physical geometry separately from scene projection.

- Fine Art square: fine-art-square rejected for shape_needs_extension; portrait: no portrait scene.
- Premium square: no square scene; portrait: premium-fine-art rejected for shape_needs_extension.
- Classic Frame: classic-framed is landscape and finish unverified; black square/portrait need verified compatible representation.
- Matted Frame: matted-frame-square finish unverified; portrait openings also absent. Verify finish before mapping, not by assumption.
- Canvas: square MirrorWrap -> gallery-canvas-square already works. Portrait lacks a portrait scene. gallery-canvas-landscape cannot truthfully substitute for portrait; matted-frame-landscape is a canvas with unverified wrap.
- Framed Canvas: framed-canvas photographed natural brown wood, catalog black. Not a safe mapping substitution.
- White 11 oz Mug -> ceramic-mug, GLOBAL-MUG-W, works by resolver.
- Mohawk 7x5 Card -> greeting-card, GLOBAL-GRE-MOH-7X5-BLA, works by resolver. Other card variants have no compatible mapping.

Prepayment provisional previews must preserve the whole favorite and mark the neutral surround honestly. That solves favorite-versus-product aspect mismatch, not a wrong product photograph. Both provisional and final outputs must retain fixed insets and protected photography. A missing final scene remains a real integration blocker; a static sample is not a personalized replacement.

## Real browser reproduction, not a fixture

Protected branch Preview, authenticated existing session 7c63738b-ccfa-4d55-ba79-a4e1f3a27295. Opened paid session, clicked Review Your Gifts, Next Gift, View Order Review, and read-only Check Again. No generation/purchase/approval requests intentionally initiated.

Fine Art Print 12x18 remains at the approved technical-repair message; correction and approval disabled. Existing reproduction identity: order 25fb739f-ab72-4b4c-b7b1-698b7ff81e87, line b63b4e57-c3b7-4710-bcee-5e198a4c42b5, invalid composition 7834b6ad-6c7e-41b2-8573-803233755b64. Backend technical repair must resolve geometry mismatch without charging/consuming a customer correction or altering approved Canvas. No repair mutation was attempted.

Gallery Canvas 8x8 MirrorWrap visibly displays the actual Art Deco customer scene with fixed inset and existing approved status. Navigation reaches combined review. Final approval remains disabled because Fine Art is unresolved. This is the next actual customer wall, separate from the missing portrait scene.

## Exact product and SKU mappings

| Family | Picture aspect | Attributes | Scene / rejection | Product IDs and SKUs |
|---|---:|---|---|---|
| fine_art | 1.000000 | {} | shape_needs_extension | fine_art:8x8 = GLOBAL-FAP-8X8; fine_art:12x12 = GLOBAL-FAP-12X12; fine_art:16x16 = GLOBAL-FAP-16X16; fine_art:20x20 = GLOBAL-FAP-20X20 |
| fine_art | 0.666667 | {"paperType": "EMA", "substrateWeight": "200gsm"} | orientation_not_photographed | fine_art:8x12 = GLOBAL-FAP-8X12; fine_art:12x18 = GLOBAL-FAP-12X18; fine_art:16x24 = GLOBAL-FAP-16X24; fine_art:20x30 = GLOBAL-FAP-20X30 |
| premium | 1.000000 | {} | orientation_not_photographed | premium:8x8 = GLOBAL-HPR-8X8; premium:12x12 = GLOBAL-HPR-12X12; premium:16x16 = GLOBAL-HPR-16X16; premium:20x20 = GLOBAL-HPR-20X20 |
| premium | 0.666667 | {"paperType": "HPR", "substrateWeight": "308gsm"} | shape_needs_extension | premium:8x12 = GLOBAL-HPR-8X12; premium:12x18 = GLOBAL-HPR-12X18; premium:16x24 = GLOBAL-HPR-16X24; premium:20x30 = GLOBAL-HPR-20X30 |
| canvas | 1.000000 | {"wrap": "MirrorWrap"} | gallery-canvas-square | canvas:8x8 = GLOBAL-CAN-8X8; canvas:12x12 = GLOBAL-CAN-12X12; canvas:16x16 = GLOBAL-CAN-16X16; canvas:20x20 = GLOBAL-CAN-20X20 |
| canvas | 0.666667 | {"wrap": "MirrorWrap"} | orientation_not_photographed | canvas:8x12 = GLOBAL-CAN-8X12; canvas:12x18 = GLOBAL-CAN-12X18; canvas:16x24 = GLOBAL-CAN-16X24; canvas:20x30 = GLOBAL-CAN-20X30 |
| framed | 1.000000 | {"color": "black"} | configuration_not_photographed | framed:8x8 = GLOBAL-CFP-8X8; framed:12x12 = GLOBAL-CFP-12X12; framed:16x16 = GLOBAL-CFP-16X16; framed:20x20 = GLOBAL-CFP-20X20 |
| framed | 0.666667 | {"color": "black"} | configuration_not_photographed | framed:8x12 = GLOBAL-CFP-8X12; framed:12x18 = GLOBAL-CFP-12X18; framed:16x24 = GLOBAL-CFP-16X24; framed:20x30 = GLOBAL-CFP-20X30 |
| matted | 1.000000 | {"color": "black"} | configuration_not_photographed | matted:8x8 = GLOBAL-CFPM-8X8; matted:12x12 = GLOBAL-CFPM-12X12; matted:16x16 = GLOBAL-CFPM-16X16; matted:20x20 = GLOBAL-CFPM-20X20 |
| matted | 0.600000 | {"color": "black"} | configuration_not_photographed | matted:8x12 = GLOBAL-CFPM-8X12 |
| matted | 0.573257 | {"color": "black"} | configuration_not_photographed | matted:12x18 = GLOBAL-CFPM-12X18 |
| matted | 0.601196 | {"color": "black"} | configuration_not_photographed | matted:16x24 = GLOBAL-CFPM-16X24 |
| matted | 0.615385 | {"color": "black"} | configuration_not_photographed | matted:20x30 = GLOBAL-CFPM-20X30 |
| framed_canvas | 1.000000 | {"color": "black", "wrap": "MirrorWrap"} | configuration_not_photographed | framed_canvas:8x8 = GLOBAL-FRA-CAN-8X8; framed_canvas:12x12 = GLOBAL-FRA-CAN-12X12; framed_canvas:16x16 = GLOBAL-FRA-CAN-16X16; framed_canvas:20x20 = GLOBAL-FRA-CAN-20X20 |
| framed_canvas | 1.500000 | {"color": "black", "wrap": "MirrorWrap"} | configuration_not_photographed | framed_canvas:8x12 = GLOBAL-FRA-CAN-8X12 |
| framed_canvas | 0.666667 | {"color": "black", "wrap": "MirrorWrap"} | configuration_not_photographed | framed_canvas:12x18 = GLOBAL-FRA-CAN-12X18; framed_canvas:16x24 = GLOBAL-FRA-CAN-16X24; framed_canvas:20x30 = GLOBAL-FRA-CAN-20X30 |
| mug | 1.000000 | {"color": "white", "size": "313ml / 11oz"} | ceramic-mug | mug:11oz = GLOBAL-MUG-W |
| card | 0.714286 | {} | greeting-card | card:7x5 = GLOBAL-GRE-MOH-7X5-BLA |
| card | 2.831097 | {} | configuration_not_photographed | card:7x5-gloss = GLOBAL-GRE-GLOS-7X5-BLA; card:7x5-mohawk-direct = GLOBAL-GRE-MOH-7X5-DIR |
| card | 2.662891 | {} | configuration_not_photographed | card:6x4-gloss = GLOBAL-GRE-GLOS-6X4-BLA; card:6x4-gloss-direct = GLOBAL-GRE-GLOS-6X4-DIR |
| card | 3.932243 | {} | configuration_not_photographed | card:6x6-gloss = GLOBAL-GRE-GLOS-6X6-BLA |
