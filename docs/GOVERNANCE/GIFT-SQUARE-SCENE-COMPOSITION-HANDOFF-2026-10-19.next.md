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

## Catalog completion and featured-image update — 2026-10-19

Supersedes the catalog holds above. All 24 category/product assignments now have completed sceneArtwork and optimized desktop/mobile WebPs; the index has zero placeholders. The authoritative original artwork assignments and production prompts remain preserved. Generated scene-specific artwork and preparation history are separate manifest fields/files.

Nine NB2.1 2K generations succeeded at $0.0504 each ($0.4536). Eighteen Stability outpaint calls succeeded at $0.04 each ($0.72), including nine corrective extensions after visual QA found excessive reflected margins from integer-ratio scaling. Total this pass: $1.1736, below the authorized $4. Provider pricing was verified on Replicate's model page and platform.stability.ai/pricing. Paid scripts now require --execute; no automatic retries. Detailed ledgers are copied into tools/catalog-samples/scene-completion-results.next.json.

Catalog preparation uses minimal rounded pixel extents when invoking the existing preparePanelComposition pipeline. Input is normalized losslessly to PNG first to avoid JPEG re-encoding. Placement allows integer-pixel rounding only; incompatible artwork is still rejected. Tests verify ALL original artwork pixels survive preparation, with no cropping or distortion; protected photographic pixels and all34 original asset hashes remain unchanged. The Watercolor sample retains its original painted-paper background; the compositor does not add white padding.

Only three CSS changes: featured column 550 -> 580px; featured image aspect-ratio 1264/848 -> 1/1 with contain retained; Step4 center mobile padding 16px. Product picker, prices, availability, CTA, favorite, checkout, and backend unchanged. Browser checked 1660,1300,768,390; image widths 580,580,550,343–358px (mobile scrollbar-dependent). No horizontal overflow; product picker and unavailable-product viewing verified.

Tests: 8 scene/assets/composition tests, 35 Wizard interaction tests, 9 existing renderer-bundle tests, all passing. Contact sheets visually inspected for all24 products; screenshots saved for all four breakpoints.

Authenticated customer mockup integration remains BLOCKED pending CC's scene-composition contract. No customer orders, production print files, deployments, pushes, or Prodigi calls were made.

Evidence directory: E:/Dev/_recovery-staging/frontend-deploy-review/catalog-samples/scene-completion-2026-10-19/
Browser screenshots: C:/Users/richh/.codex/visualizations/2026/10/14/01a13b7a-543e-7191-b334-430d0970ace5/catalog-complete-{1660,1300,768,390}.png
