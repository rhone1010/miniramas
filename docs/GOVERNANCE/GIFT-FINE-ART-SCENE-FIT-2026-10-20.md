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
