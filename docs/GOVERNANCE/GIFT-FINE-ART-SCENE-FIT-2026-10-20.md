# Fine Art Print: why Final Approval cannot show or approve it (2026-10-20)

Walked in a real browser against the real handlers (Stripe and generation simulated), `tools/gift-walk/w22.cjs "Fine Art Print" "8 × 8"` and `"12 × 18"`; both reach a paid order with the composition `ready` on the server and Approve disabled, "Not currently available".

## Measured cause (not tolerance, mapping, composition output or validation logic)
| Size | Composition (existing, reused) | Scene considered | Opening vs product | Verdict |
|---|---|---|---|---|
| 8x8 to 20x20 (1:1) | exact 1:1, deterministic, zero generation | `fine-art-square`: 734x786 = **0.9338** (the mask bounding box is 735x787: the declaration is not stale) | product picture is 2400x2400 = 1.0000, so the opening is **7.08% off** (free band 2%) | refused: `shape_needs_extension` |
| 8x12 to 20x30 (2:3) | one NB2.1 generation at 2:3, no extension | none: the only fine art photograph is square | orientation not photographed | refused: `orientation_not_photographed` |

* The product is printed full-bleed and square (`GLOBAL-FAP-8X8`, 2400x2400 px = 8x8 in at 300 PPI, final = picture). The photograph shows a deckle-edge sheet with a cream border and an opening of 0.9338. Filling that opening with the 1:1 composition would stretch it 7.08% (forbidden) or need 3.5% of NEW outpainted picture above and below that the print does not contain (a mockup showing more than the print, and a paid call). Relaxing the 2% rule would do exactly one of those, so it was not relaxed.
* The composition is correct and complete: exact shape, original untouched, one correction still available. Nothing needs regenerating and nothing was changed for the existing paid order.
* Both refusals are now visible in data, not inferred: `MockupView.sceneRefusal` and `ProductPreviewView.sceneRefusal` carry `{ reason, sceneId, openingAspect, productAspect, extension }` and the server log line for the fallback carries the same numbers.

## What would make it work (not backend code)
1. Fine Art square: a photograph or re-cut mask whose opening is within 2% of square (0.98 to 1.02), i.e. the PRINT area of a borderless square print.
2. Fine Art portrait: a 2:3 photograph (opening 0.653 to 0.680).
3. Or the owner decides a configuration without a scene may be approved from the exact product-shaped composition preview the server already supplies (`CompositionView.previewUrl`); that is the Wizard's rule (Codex), and `GIFT_REQUIRE_APPROVED_SCENE=1` is the matching server gate if the owner prefers not to sell what cannot be shown.
Proven by test (`mockup.test.ts`): if the opening WERE square, the existing 1:1 composition is used as it is through the scene path (no generation, no new composition, correction and approval untouched). That is a simulated opening, not a photograph.

## Update: the revised 1:1 Fine Art files (checked before Codex integrates them; the repository's assets are untouched)

Files supplied in chat (art mask, background mask, scene photograph), measured and run through the real backend in a scratch copy (`E:\Dev\_recovery-staging\scene-verify-fa1`, assets swapped there only):
* Art mask bounding box **735x735 = 1.0000** (was 735x787); background mask is its inverse (0.03% edge pixels differ); all three are 1254x1254.
* For `scene.next.json` use `cornersPixels [[260,203],[994,203],[994,937],[260,937]]` and `maskBounds {x0:260, y0:203, x1:994, y1:937}` (opening 734x734).
* Backend verdict with those files: `fine_art:8x8, 12x12, 16x16, 20x20` route to `fine-art-square` with fit `exact`, extension 0, **zero added pixels**; the 2:3 sizes remain `orientation_not_photographed` (still no portrait photograph).
* Real render of a 2400x2400 1:1 composition: 1254x1254, **0 of 1,069,658 pixels outside the art mask differ from the approved photograph** (fixed detail inset preserved). Image: `walk-20261019/80-fine-art-square-revised-1to1.png`.
* Real browser, paid Fine Art Print 8x8 with the scratch assets (Stripe and generation simulated): the composition is `ready` (deterministic, reused), Final Approval shows the scene mockup and **Approve is enabled** (`renderer: scene`, `scene:fine-art-square`).
Repeat for any revised scene before committing: `node --import tsx tools/gift-walk/check-scene.mts <toolsRoot> <sceneId> <artwork.png>`.

To land it (Codex-owned, not done here): replace the three files under `public/gift-wizard/mockup-scenes/fine-art-square/`, set the two geometry fields above in its `scene.next.json`, refresh the sizes and hashes in `tools/product-scenes/bundle.next.json`, `tools/product-mockup/renderer-manifest.json` and `public/gift-wizard/catalog.next.json` entries if they list them (the file names are unchanged, so `next.config.js` tracing needs no edit), and re-run the build trace check. The backend tests in this branch are state-driven and pass against both the current assets and the revised ones.
