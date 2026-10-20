# Assets 3: CC integration requirements

2026-10-20. Frontend/photo integration only; no backend composition or payment changes. 19 registered scenes, 16 rendered with existing compatible artwork, 24 catalog exports refreshed without generation. Latest ZIP includes loose revised Fine Art, Premium landscape and Wrapped landscape bytes (compared equal).

## Required CC changes

In lib/v1/gift/scenes.ts SCENE_FACTS add verified unframed mappings: fine-art-portrait (fine_art, portrait, attributes {}), fine-art-landscape (fine_art, landscape, {}), premium-square (premium, square, {}), premium-landscape (premium, landscape, {}). Existing resolveScene/prepareSceneArtwork must retain 2% tolerance. No new generation or geometry changes. Fine Art portrait ratio 614/919=0.668118; landscape1043/695=1.500719; premium square916/930=0.984946; landscape1002/667=1.502249. Landscape catalog SKUs remain absent: do not expose purchasing from scene availability.

Frontend accepts the approved new scene IDs. Do not route wood frame scenes to black SKUs. Keep rejects below unrouted. Square Fine Art current scene ratio=1 now routes with existing backend mapping.

Copy the exact additions below into the existing mockup tracing list in next.config.js (product-preview already shares it). Hashes in tools/product-scenes/bundle.next.json and tools/product-mockup/renderer-manifest.json are refreshed. All hash tests now pass. Exact tracing test intentionally still fails until CC applies these paths. Automatic approval review prohibited editing backend scene resolver/deployment configuration in Codex's ownership lane; neither was edited.

## Actual customer journey wall

Authenticated branch Preview session7c63738b-ccfa-4d55-ba79-a4e1f3a27295: Review Your Gifts -> Fine Art12x18 technical repair message -> Next Gift -> personalized approved Canvas8x8 -> combined Final Approval disabled. No new purchases/generation/approval. Stored Fine Art composition7834b6ad-6c7e-41b2-8573-803233755b64 remains invalid. CC must use technical repair without consuming correction or changing approved Canvas. Photography alone does not repair its geometry.

## Rejected or unsupported

- Duplicate fine art portrait artwork bw mask: 28,630 selected pixels overlap protected background. Use aligned portrait art bw mask (zero overlap), already integrated.
- Framed Canvas landscape:1,116 fully selected pixels overlap protected background near inset top; not integrated. Requires aligned mask pair, not automatic normalization.
- Duplicate matted square art bw mask:40,852 pixels overlap protected background. Existing hyphenated mask aligns; its opening0.97778 is outside2% for square and photograph shows wood, not black.
- Classic portrait opening0.68311 exceeds2% for2:3. All supplied Classic/Matted frame photos show wood rather than catalog black.
- Wrapped Canvas portrait opening0.69937 exceeds2% for2:3.
- Matted portrait0.69308 mismatches actual catalog mat openings0.57326–0.61538.
- Premium portrait existing0.79510 remains incompatible; no replacement portrait in new archive.
- Mislabeled matted landscape is wrapped canvas about4:3; no matching catalog SKU.
- Fine Art square has two isolated fully selected pixels conflicting with background at inset boundary x625,y886–887; sources preserved untouched. No visible defect at review scale; no mask normalization applied.

## Tracing additions

- `./public/gift-wizard/mockup-scenes/classic-framed-portrait/class framed print portrait art bw.png`
- `./public/gift-wizard/mockup-scenes/classic-framed-portrait/class framed print portrait background bw.png`
- `./public/gift-wizard/mockup-scenes/classic-framed-portrait/class framed print portrait frame bw.png`
- `./public/gift-wizard/mockup-scenes/classic-framed-portrait/class framed print portrait.png`
- `./public/gift-wizard/mockup-scenes/classic-framed-portrait/scene.next.json`
- `./public/gift-wizard/mockup-scenes/classic-framed-square/classic framed print square art bw.png`
- `./public/gift-wizard/mockup-scenes/classic-framed-square/classic framed print square background bw.png`
- `./public/gift-wizard/mockup-scenes/classic-framed-square/classic framed print square frame bw.png`
- `./public/gift-wizard/mockup-scenes/classic-framed-square/classic framed print square.png`
- `./public/gift-wizard/mockup-scenes/classic-framed-square/scene.next.json`
- `./public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print  landscape- background bw.png`
- `./public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print  landscape.png`
- `./public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print landscape - art bw.png`
- `./public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print landscape - frame bw.png`
- `./public/gift-wizard/mockup-scenes/fine-art-landscape/fine art print landscape art bw.png`
- `./public/gift-wizard/mockup-scenes/fine-art-landscape/fine art print landscape background bw.png`
- `./public/gift-wizard/mockup-scenes/fine-art-landscape/fine art print landscape.png`
- `./public/gift-wizard/mockup-scenes/fine-art-landscape/scene.next.json`
- `./public/gift-wizard/mockup-scenes/fine-art-portrait/fine art print portrait art bw.png`
- `./public/gift-wizard/mockup-scenes/fine-art-portrait/fine art print portrait background bw.png`
- `./public/gift-wizard/mockup-scenes/fine-art-portrait/fine art print portrait.png`
- `./public/gift-wizard/mockup-scenes/fine-art-portrait/scene.next.json`
- `./public/gift-wizard/mockup-scenes/framed-canvas-portrait/framed canvas portrait art bw.png`
- `./public/gift-wizard/mockup-scenes/framed-canvas-portrait/framed canvas portrait background bw.png`
- `./public/gift-wizard/mockup-scenes/framed-canvas-portrait/framed canvas portrait frame bw.png`
- `./public/gift-wizard/mockup-scenes/framed-canvas-portrait/framed canvas portrait.png`
- `./public/gift-wizard/mockup-scenes/framed-canvas-portrait/scene.next.json`
- `./public/gift-wizard/mockup-scenes/gallery-canvas-portrait/scene.next.json`
- `./public/gift-wizard/mockup-scenes/gallery-canvas-portrait/wrapped canvas portrait art.png`
- `./public/gift-wizard/mockup-scenes/gallery-canvas-portrait/wrapped canvas portrait background bw.png`
- `./public/gift-wizard/mockup-scenes/gallery-canvas-portrait/wrapped canvas portrait.png`
- `./public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait art bw.png`
- `./public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait background.png`
- `./public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait frame bw.png`
- `./public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait matte bw.png`
- `./public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait.png`
- `./public/gift-wizard/mockup-scenes/matted-frame-portrait/scene.next.json`
- `./public/gift-wizard/mockup-scenes/premium-landscape/premium fine art print landscape art.png`
- `./public/gift-wizard/mockup-scenes/premium-landscape/premium fine art print landscape background.png`
- `./public/gift-wizard/mockup-scenes/premium-landscape/premium fine art print landscape.png`
- `./public/gift-wizard/mockup-scenes/premium-landscape/scene.next.json`
- `./public/gift-wizard/mockup-scenes/premium-square/premium fine art print square art bw.png`
- `./public/gift-wizard/mockup-scenes/premium-square/premium fine art print square background bw.png`
- `./public/gift-wizard/mockup-scenes/premium-square/premium fine art print square.png`
- `./public/gift-wizard/mockup-scenes/premium-square/scene.next.json`

## Combined branch verification

Integrated onto fix/gift-pipeline-verify at 1360b11, preserving all CC backend files and untracked .walk work. No UI markup or styling ports; approved layout unchanged.

Fixed the local review server matching /mockup-scenes PNG requests as API mockups: narrow the route to /api/v1/gift/sessions/{id}/lines/{id}/mockup. Actual HTTP PNG signature and API JSON are regression tested. Browser at 1660 and 390 shows the Fine Art configuration photograph loaded (1254 x 1254); mobile document width equals viewport width. This is simulated-service verification, not live personalized Fine Art success.

Current combined tests: asset 9/9, frontend 79/79, HTTP image regression 1/1, scene compatibility 17/17, renderer bundle 9/10 (only missing 45 tracing paths). Hash assertions pass. Existing artwork rendered into 16 scenes; unsupported geometry/finishes remain unrouted. No paid generation.

Live authenticated Preview reload: existing Canvas 8x8 personalized mockup and approved state persist. Fine Art 12x18 still shows technical repair; combined review reached, Approve My Gifts disabled. No approval, order, correction, or generation writes performed. New local scene changes have not been deployed.
