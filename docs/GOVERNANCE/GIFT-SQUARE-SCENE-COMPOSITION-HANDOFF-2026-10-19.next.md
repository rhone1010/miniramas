# Square scene composition handoff — 2026-10-19

Base: b7e6c55 on codex/four-product-mockups-isolated; fetched Preview origin/codex/canonical-2026-09-24 remains 1f9f338, already an ancestor. No backend, prices, availability, production geometry or checkout changed.

## Implemented

Placement rejects aspect mismatches (`scene_composition_required`), never adds white bands or silently crops. Artwork preparation calls the existing `preparePanelComposition` only after its existing `compositionPlan` classifies the input as recommended. This uses the existing bounded mirror-extension behavior, retaining original pixels. Extension/regeneration requiring paid work is blocked before pipeline execution. No new generation system.

Step 4 reads the existing category index. Its 48 new WebP URLs now use the supplied photography: nine assigned samples are complete (Canvas, Mug, Card in each category), fifteen retain original photographic placeholders. The original 48 catalog files remain preserved. No UI layout/copy changes.

All ten scene assets remain intact. The mislabeled matted-frame-landscape is a rectangular canvas. There is no landscape matted master in this archive.

## CC dependencies — do not silently substitute production geometry

The existing Gift composition planner targets `CanonicalProduct.requirements.pictureAspect` and freezes that geometry into the purchased line. The production mockup bridge selects old template IDs and computes cache revisions over `mockup-templates`, not `mockup-scenes`.

The new photographic openings do not all match those frozen ratios. Example: Classic Framed opening is 1002:671 (landscape), while the existing catalog assigned artwork is portrait. Fine Art opening is 734:786; Premium 811:1020; Matted square 572:585; Canvas square 856:841; Canvas landscape 962:733; alternate landscape canvas 1052:792; Framed Canvas 874:872; Card 598:838. These are measured projection extents, NOT proposed replacements for physical SKU dimensions. Backend/renderer integration must distinguish physical picture geometry from projected scene geometry and resolve any required scene-specific composition without changing the purchased production file or silently distorting subjects.

Needed before switching authenticated mockups:
- verified product/configuration-to-scene mapping, including configurations not represented by a matching photographed shape or finish;
- backend-provided compatible composition identity or explicit scene projection contract, preserving favorite, approval and correction identity;
- scene code/manifests/assets in renderer revision keys and the authenticated route's serverless trace;
- unchanged authenticated access, watermark policy and stale-composition checks.

The new scene module is intentionally NOT wired into the production mockup route yet. Existing six calibrated renderers and serverless inventory remain unchanged. No falsely successful real-session test is claimed.

## Catalog holds

Each category: Fine Art and Classic Frame require regeneration; Premium and Matted require paid extension; Framed Canvas assigned artwork is missing. Total 6 regeneration + 6 extension + 3 missing. See offline catalog-results.json for individual assignments. No paid calls permitted by this task, so these remain photographic placeholders.

## Evidence

E:/Dev/_recovery-staging/frontend-deploy-review/four-products/exact-scene-20261019/catalog-results.json
E:/Dev/_recovery-staging/frontend-deploy-review/four-products/exact-scene-20261019/review/contact-sheet.png
The ten-slot contact sheet has FIVE completed existing-artwork tests and FIVE explicitly marked HOLD photographs, not ten completed personalized samples. Some review fixtures differ from catalog assignments solely for renderer validation; catalog assignments are unchanged.

Browser: actual local Step 4 at 1660px and 390px, Groups Canvas selected, no mobile horizontal overflow (390px scrollWidth), loaded featured image. Existing remote paid session 7c63738b-ccfa-4d55-ba79-a4e1f3a27295 restored and showed two purchased products. Review action not invoked because its handler may generate missing compositions. No order, approval, generation or fulfillment writes.
