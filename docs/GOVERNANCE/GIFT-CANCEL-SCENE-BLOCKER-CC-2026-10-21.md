# CC: Classic Framed Print review blocker — 2026-10-21

Cancel fix deployed separately as 95df69b to protected Preview:
https://miniramas-54va8llht-litenco.vercel.app

Existing customer session: 5af32d81-1d7e-4943-b313-028cab7f8021
Line: 93979589-227f-477a-89b2-e8e0cb1b0eea
Approved composition: 8db65e2f-57e9-4c5b-9b40-50dbe8f00852
Product: framed:16x24 / GLOBAL-CFP-16X24 / color black / portrait.
Frozen picture geometry: 4800 x 7200 (2:3).

Observed authenticated mockup GET returns HTTP 200, renderer calibrated, scene null,
sceneRefusal.reason configuration_not_photographed. The frontend rejects retired
calibrated photography. The customer therefore has no review image. Preserve this
composition and its approval; do not regenerate, correct, or rewrite the order.

Exact missing mapping:
lib/v1/gift/scenes.ts SCENE_FACTS has only classic-framed (landscape,
attributes:null) for family framed. Candidate classic-framed-portrait is absent.
A verified mapping would need family framed, orientation portrait, verified
attributes {color:'black'}, and compatibility with GLOBAL-CFP-16X24. Do not
activate it solely by adding this object: the geometry also fails below.

Existing candidate assets:
public/gift-wizard/mockup-scenes/classic-framed-portrait/scene.next.json
class framed print portrait.png
class framed print portrait art bw.png
class framed print portrait background bw.png
class framed print portrait frame bw.png
(The four PNGs are in that same scene directory.)
These assets are listed in tools/product-scenes/bundle.next.json.

Read-only reproduction against deployed source:
getProduct('framed:16x24') => picturePx 4800x7200, attributes {color:'black'}.
resolveScene(product, describeScene) => configuration_not_photographed.
tools/product-scenes/adapter.next.cjs describeScene('classic-framed-portrait')
reads maskBounds x315..938, y146..1058: opening623x912, aspect0.6831140351.
aspectCompatibility(4800,7200,623,912) => extension0.02467105263,
compatibility:'extension'. This exceeds the unchanged 2% tolerance.

Required resolution:
1. Codex/asset owner: verify whether the supplied portrait scene's measured opening
   is accurate. If it is, this asset is incompatible at 2.47%; an approved corrected
   opening/photograph is needed. Do not fake calibration, crop/stretch, or loosen tolerance.
2. CC: once a compatible approved black portrait scene is verified, add its facts
   to SCENE_FACTS and verify the mockup bridge returns renderer:scene with the same
   artwork/composition identity. Include revision/cache invalidation and deployed tracing.
3. Confirm authenticated GET still reports the original approved composition.

No backend, database, order, approval, geometry, or photography changes were made
by this Cancel deployment. This document is a handoff, not evidence CC has received it.
