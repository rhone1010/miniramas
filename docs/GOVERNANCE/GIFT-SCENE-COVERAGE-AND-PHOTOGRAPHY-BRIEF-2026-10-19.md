# Scene coverage and the photography still needed (2026-10-19)

Generated from the real catalog and the real scene manifests (`resolveScene`). A scene serves a configuration only when ALL hold: same family, same verified finish/wrap/SKU, same orientation, and the photographed opening within 2% of the product's PICTURE shape (the 2% band is the only shaping that needs no generation). One scene serves every size of the same shape and finish. Nothing is rotated, recoloured, stretched or substituted; calibrated renderers remain the accurate fallback.

## Launched products (what Final Approval and the cart can show)

| Family | Shape (picture aspect) | Sizes | Finish | Scene today | Why not / what is needed |
|---|---|---|---|---|---|
| Canvas | square 1.000 | 8x8 to 20x20 | MirrorWrap | **gallery-canvas-square** | covered |
| Canvas | portrait 2:3 (0.667) | 8x12 to 20x30 | MirrorWrap | none | **new photograph**: stretched canvas, portrait, opening 0.65 to 0.68 |
| Fine Art Print | square | 8x8 to 20x20 | none | none | the existing square print photograph has an opening of 0.934 (7% off): **re-shoot or re-cut the opening to 1:1 (0.98 to 1.02)** |
| Fine Art Print | portrait 2:3 | 8x12 to 20x30 | none | none | **new photograph**: unframed portrait print |
| Premium Fine Art | square | 8x8 to 20x20 | none | none | **new photograph** (the existing one is portrait) |
| Premium Fine Art | portrait 2:3 | 8x12 to 20x30 | none | none | the existing premium photograph has an opening of 0.795 (19% off 2:3): **re-shoot or re-cut to 0.65 to 0.68** |
| Classic Framed Print (black) | square | 8x8 to 20x20 | black | none | **new photograph**, black frame verified |
| Classic Framed Print (black) | portrait 2:3 | 8x12 to 20x30 | black | none | **new photograph**, black frame verified. The existing classic-framed photograph is LANDSCAPE (1.493) with an unverified frame colour, so it cannot show the 16x24 black framed print (or any portrait or square framed print). |

So for launched products the gap is **seven photographs** (canvas portrait; fine art square and portrait; premium square and portrait; black framed square and portrait), of which two may be reachable by re-cutting an existing photograph's opening (fine art square, premium portrait) if the photography allows it. Each new photograph needs: the unaltered scene, the artwork mask, the frame/background masks where framed, and the fixed detail inset (never personalized).

## Not launched yet (needed when they launch)
Matted frame (black): square plus FOUR portrait shapes (0.573, 0.600, 0.601, 0.615: the sizes differ by more than 2%, so two openings, about 0.58 and 0.61). Framed canvas (black): square, 2:3 portrait, 3:2 landscape (8x12); the existing framed-canvas photograph is a natural brown wood frame, so it cannot show the black product. Mug: covered (white 11 oz). Card: only the Mohawk 7x5 front is covered; the gloss and 6x4/6x6 spreads have no photograph.

## Rule while coverage grows
Calibrated renderer for everything uncovered; a scene is added to `SCENE_FACTS` (lib/v1/gift/scenes.ts) only after its finish is looked at and recorded. The framed finish must match the frozen attribute (black), never an approximation.

## Verification of adaptation (aspect-adaptation.test.ts)
* Matching shape (square favorite on a square product): zero generation, zero paid calls.
* Within 2%: mirror extension only. 2 to 20%: ONE paid outpaint, no NB2.1.
* Far shape (portrait product from a square favorite): ONE NB2.1 generation of the same effect from the customer's photograph at the nearest supported ratio (2:3 for portraits), with the favorite passed as the reference where the series takes one; no further extension needed.
* Products with the same picture shape share one composition (the second costs nothing); calling again generates nothing.
* The adapted picture (`composed_path`) is what the customer sees at Final Approval and what is printed (`print-source.ts`); the favorite's master and preview row are byte-identical afterwards, and every line still has its one free correction (`correctionsRemaining` 1, attempt 1).
* While compositions are prepared, the session view reports each line independently: `none` (with the planned `method`) then `ready` with its `previewUrl`, so a "preparing" screen can show real per-gift state.
