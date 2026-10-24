# Beauty scenes, the mug full wrap and purchase consistency: backend contract for Codex 1, 2026-10-24

Backend only, committed locally. No paid generation, no deployment, no order or Prodigi action. Codex 1 owns the photography, masks, browser compositing and UI; nothing of theirs was edited.

## 1. Scene mappings (what the backend routes to which photograph)
`resolveScene` (lib/v1/gift/scenes.ts) routes a configuration to a scene only when the family (or a declared shared family), the photographed finish/attributes, the orientation AND an opening within 2% of the product's shape all match. Output of the real resolver today:

| Product | Scene | Notes |
|---|---|---|
| Fine Art 8x8-20x20 | `fine-art-square` | exact |
| Fine Art 8x12-20x30 | `fine-art-portrait` | opening 0.6681, 0.22% from 2:3 |
| **Premium 8x8-20x20** | `fine-art-square` | SHARED photograph, scene family `fine_art`; Premium keeps its own SKU, specification and price |
| **Premium 8x12-20x30** | `fine-art-portrait` | shared (previously Premium portraits had no scene) |
| Canvas 8x8-20x20 | `gallery-canvas-square` | opening 1.0178, 1.8% (resample) |
| Canvas 8x12-20x30 | none: `shape_needs_extension` | `gallery-canvas-portrait` opening 0.6994 is 4.9% from 2:3 (needs a 2:3-compatible opening, within 2%) |
| Mug 11oz | `ceramic-mug` | rolled full wrap, 2670:1110 |
| Card 7x5 | `greeting-card` | resample 0.1% |
| Classic Frame (all) | none: `configuration_not_photographed` | all three photographs (`classic-framed`, `-portrait`, `-square`) show a NATURAL WOOD frame; the catalog frame is black |
| Matted Frame (all) | none: `configuration_not_photographed` | `matted-frame-square/-portrait/-landscape` show a natural wood frame with a white mat; the catalog matted frame is black. There is no landscape matted product, and `matted-frame-landscape`'s own review says its opening is 2.9% from 3:2 |
| Framed Canvas (all) | none: `configuration_not_photographed` | `framed-canvas`, `-portrait` show a natural brown wood frame; the catalog frame is black |
Corrections made: `matted-frame-landscape` is now family `matted` (it was classified `canvas`); `gallery-canvas-portrait`, `matted-frame-portrait`, `classic-framed-portrait`, `classic-framed-square`, `framed-canvas-portrait` now have facts (they were unknown to the backend). To route the frame families, either supply black-frame photography (or tell the backend the photographed finish matches what Prodigi prints) and, for canvas portrait, a 2:3 opening within 2%. Nothing is routed on a guess.
Render calls pass the SCENE's family as `productFamily` (the renderer requires it): `SceneChoice.sceneFamily` is new. `ProductPreviewView.sceneId` is unchanged.
`display ratio` of a photograph (e.g. 4:3) is never treated as the artwork or manufacturing ratio: openings are only used to decide whether the picture fits the photographed plane within 2%; manufacturing shape always comes from the product.

## 2. The mug: one genuine full wrap
Specification (`MUG.fullWrap`, lib/v1/print/production-profiles.ts, every number sourced):
- Lab file 2670 x 1110 (Prodigi API). **Printable band 2670 x 1034 at y = 38**: about 1/8 inch (0.125 in x 300 dpi = 37.5, 38 px) unprinted at the rim and at the base; white = unprinted on white ceramic. It sits INSIDE Prodigi's 2670 x 1110 printable area, so it never asks for more than the lab prints. (Prodigi guarantees top-to-bottom coverage only for H-MUG-W; the band makes that irrelevant.) No dimension was invented; the 1/8 inch is the owner's.
- The handle seam stays at the file's two edges (Prodigi template). No published handle exclusion distance exists for GLOBAL-MUG-W (still `unverified`); none was assumed.
- ONE picture, no panel, no repetition, no mirror, no blur wash. The picture is rolled (a circle: the part passing the right edge continues at the left edge) so its **centre, the subjects, sits at x = 2069, the middle of the face a right-handed mug shows**. Nothing is cropped, mirrored or invented.
- The beauty input (`mockupInputFor('mug', picture)`) is the same wrap rolled so that face is in the middle, 1335 x 555 (the scene's 2.4054 aspect): a VIEW. The print file is the full 2670 x 1110 wrap; the beauty view is never the print file.
Generation: `mug:11oz` generates at NB2.1's 21:9 and is trimmed 9.1 to 9.6% (top and bottom, before the customer sees it) to the 2670:1034 band, then is an exact whole multiple of the 1335:517 grid (1335 x 517 or 2670 x 1034 depending on the model's output size; the print preparation upscales after approval). `geometryKey` `a2582`. Existing paid mugs (square face panel) keep their layout: the profile chooses by the picture's shape.
**Exact conflicts / limits, reported not hidden:**
1. A generated picture has two different edges and a wrap needs them to meet. Rolling puts the subjects on the right-handed face and the picture's own edges meet at x = 734, directly behind the mug for a right-handed viewer. A LEFT-handed mug turns its other face (x = 598) toward the viewer, and that face is about 18 degrees from the join: a visible discontinuity there. The alternative that avoids it (generate an extra-wide picture, crop a window with the subjects at the face, so the only mismatched edges are at the handle) needs the Portraits route to accept a 4:1 product aspect and a paid validation: not done, awaiting your decision. The roll constant is data (`fullWrap.rollPx`).
2. **Groups cannot make the mug**: the Groups formats are far from 2.58:1 (`generation.supported:false`, `no_ratio_within_bound_for_series`). Portraits and Pets can.
3. Top/bottom coverage and handle clearance of GLOBAL-MUG-W are Prodigi facts still unpublished; the 1/8 inch band is the safeguard, not a verification.

## 3. Contract changes
- `GET /api/v1/gift/sessions/{id}/product-preview?productId=&generationId=` : **`generationId` is new**. With it the preview is built from THAT delivered generation (same effect, same shape as the product: `409 composition_geometry_mismatch`, `404 generation_not_found`, `409 generation_not_ready`, `409 stale_composition`), never adapted, extended or regenerated; the scene (or the exact product-shaped picture) shows the customer's own composition for that product. The same generation id, dimensions and sha256 are what `accept`, `PUT lines`, checkout, Final Approval and the print source carry. Premium and Fine Art of the same shape share one generation.
- `AvailabilityView.products[].configuration` gains `generationPicturePx`, `generationAspect`, `layout: 'flat'|'mug_full_wrap'|'card_spread'`. For the mug `generationPicturePx` is 2670 x 1034 (not the old 910 x 910) and `generation` is `{requestedAspect:'21:9', trimFraction ~0.096}` for Portraits and Pets, `supported:false` for Groups. `picturePx`/`pictureAspect` keep the legacy panel for old orders.
- A mug composition's `plan.layout` is `'mug_full_wrap'`; `compositionFitsProduct` accepts the 2670:1034 shape for the mug.
- `geometryKey` for a generation is now derived from the generation shape (`a667`, `a1000`, `a2582`).
