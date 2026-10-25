# Ceramic mug photographic review — 2026-10-24

Local implementation on `codex/pets-square-previews`; no deployment or live orders.

- Front/Back use the owner photograph and one backend-produced wrap. Only the ceramic photograph is mirrored. Artwork direction is retained.
- Mask removes the wall, counter and handle opening. Geometry traces this photograph; this is not a manufacturer-certified camera calibration or a physical sample match.
- New, unpaid generation-flow mug reviews use `beautyInput.kind = mug_full_wrap_view`. Existing identity validation runs before compositing. The frontend unrolls that signed view for full-print-layout inspection. Neither generated source bytes nor generation ID/dimensions/sha256 are changed.
- Review and acceptance show both faces and View Full Wrap; acceptance is labelled Accept Complete Wrap. Cart retains the front thumbnail. Paid/legacy sessions and other products retain their existing paths.
- No composition-count strategy or generation API was added.

## Local demonstration

Run `tools/product-mockup/mug-beauty.next.ts` with the existing tsx runtime. It reads only the nine supplied files from `H:/Groups Mug Wrap`, writes `.temp/mug-beauty-review`, and never calls a model, database, payment or manufacturer.

The local gallery is http://127.0.0.1:54327/. Original files, front/back PNGs, wrap PNGs, and identity/geometry metadata are linked per case. Screenshot evidence is in `C:/Users/richh/.codex/visualizations/2026/10/14/01a13b7a-543e-7191-b334-430d0970ace5/groups_219_*.png` and `mug-mobile.png`.

All nine cases/36 images loaded in the actual browser. Desktop pairs and 390px single-column layouts verified, including full-wrap expansion and no horizontal overflow. Browser canvas module was separately exercised using the real backend `mockupInputFor` output and the same markup/CSS as the wizard. This is local component verification, not a live paid-session or checkout claim.

Existing Gift UI regression checks pass. Focused checks cover unmirrored artwork, unchanged source pixels, transparency and full-wrap links.

## Remaining visible limitations

- The existing roll places the artwork edge join within the Back view. It is visible, particularly with backgrounds that do not join seamlessly. No replacement background, duplication, outpainting or hiding of this seam was performed.
- The supplied 2048×868 compositions need a centered 37px top trim (793px retained height, with the remainder below) to fit the current 2670×1034 printable band. This demonstration discloses the 8.64% area trim and preserves each original alongside it. The live browser renderer does no such cropping; it consumes the server's final layout.
- Physical sample/handle clearance remains unverified. No claim of manufacturing certification is made.
