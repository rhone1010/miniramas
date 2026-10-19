# Customer product scenes: backend integration (2026-10-19)

Status: BUILT AND TESTED LOCALLY. Not pushed, not deployed. No paid call, order, Stripe, Prodigi or database write was made. Codex's photography, masks, fixed detail insets, catalog artwork, prices, availability and Step 4 layout are byte-for-byte unchanged.

Answers `GIFT-CUSTOMER-SCENES-CC-HANDOFF-2026-10-19.next.md` (Codex). Branch `integration/customer-scenes` (worktree `E:\Dev\_recovery-staging\scene-integration`), based on Codex's `b982516`.

## What the backend does now

`getLineMockup` (`lib/v1/gift/mockup.ts`) is the same authenticated boundary, in the same order: owned session, line on the order, refund and payment checks, current composition, stale-composition check, frozen geometry, `compositionFitsProduct`. Only then is a renderer chosen:

1. **Scene** (`lib/v1/gift/scenes.ts`, `mockup-real.ts`): when a photographed scene truthfully shows the frozen purchase.
2. **Calibrated** (the six existing renderers, untouched): for every other configuration, and when a scene cannot be rendered (logged, retried on the next call).

`MockupView` gains two optional fields, `renderer: 'scene' | 'calibrated'` and `scene: { sceneId, revision, fit, representationId } | null`. Nothing else changes; older clients ignore them. `GIFT_SCENE_MOCKUPS=0` switches every scene off.

## Two pictures, never confused

| | Production | Scene |
|---|---|---|
| What | the composed file the customer approves and Prodigi prints (`composed_path`) | a derivative that fills the photographed opening |
| Geometry | frozen from `CanonicalProduct.requirements` | the photographed plane's measured extent (not a print ratio) |
| Stored | yes, as before | **no file**: built in memory per render, never returned, never given a URL |
| Linked | | `plan.sceneRepresentation` on the same composition row: scene id and revision, `representationId`, content `sha256`, production `artworkSha256`, `compositionId`, `attempt`, `favoriteId` (the selected preview), source/prepared size, added pixels, fit |

Scene adaptation writes only `plan.mockup`, `plan.sceneRepresentation` and `plan.artworkSha256`. The composition's status, attempt, files, approval and correction counts are never touched, so it **cannot consume a customer correction** (tested: `correctionsRemaining` and the whole session view are identical before and after).

## Which scene may show which configuration

A scene is chosen only when ALL hold: same family; same photographed finish, wrap and SKU; same orientation; and an opening whose shape the existing composition rules reach WITHOUT generation, i.e. inside the 2% "recommended" band (exact, or a mirror-extension of a few pixels that keeps every original pixel). Nothing is rotated, recoloured, stretched, cropped or outpainted. Verified photographic facts are in `SCENE_FACTS`; an unverified finish is `null` and never routes.

Coverage over all 55 catalog SKUs (test: `scenes.test.ts`):

| Scene | Serves | 
|---|---|
| `gallery-canvas-square` | canvas 8x8, 12x12, 16x16, 20x20 (MirrorWrap). Opening 1.0178, so a ~1.8% mirror-extension. |
| `ceramic-mug` | mug `GLOBAL-MUG-W` (white). The existing rolled 2670:1110 wrap, exact. |
| `greeting-card` | card `GLOBAL-GRE-MOH-7X5-BLA`. Front 5:7 (0.7143) vs opening 0.7136: 0 to 2 pixels. |

**Unsupported (calibrated renderer, explicit reasons):**

| Configuration | Reason |
|---|---|
| canvas 8x12, 12x18, 16x24, 20x30; fine art 8x12 to 20x30; premium 8x8 to 20x20 | `orientation_not_photographed`: no portrait canvas, portrait fine art or square premium photograph exists |
| fine art 8x8 to 20x20 | `shape_needs_extension`: opening 0.9338 is 7.1% from square; would need a paid outpaint |
| premium 8x12 to 20x30 | `shape_needs_extension`: opening 0.7951 is 19.3% from 2:3; would need a paid outpaint |
| framed (black) all sizes, matted all sizes | `configuration_not_photographed`: the classic-framed photograph is landscape with an unverified frame colour; the matted photograph's frame colour is unverified (and its opening is 2.3% off square) |
| framed canvas, all sizes | `configuration_not_photographed`: the photograph shows a natural brown wood frame; the catalog sells black only |
| other card SKUs (gloss 7x5, 6x4, 6x6) | `configuration_not_photographed`: other SKUs than the one photographed |
| `gallery-canvas-landscape`, `matted-frame-landscape` | no landscape canvas product exists; the second is a canvas despite its name and its wrap is unverified |

To add a configuration later: Codex photographs it (or confirms the finish of an existing photograph), the facts go in `SCENE_FACTS`, and nothing else changes. Product availability is NOT affected by scenes: `templateFor` still gates `product_not_available`, and `gift-enablement.ts` is untouched.

## The scene-compatible picture (`prepareSceneArtwork`)

Input: what `mockupArtwork` already gives (whole front of a flat product, the card's front panel, the mug's rolled wrap). Steps: (1) reduce to at most 2400 px long edge (never enlarge); (2) the minimal pixel extent of the opening's shape that contains the whole picture; (3) the EXISTING `preparePanelComposition` (mirror extension only, original pixels kept). It refuses (`scene_extension_not_permitted`, `scene_input_shape`) rather than guess, makes no network call and needs no provider key.

### Front-only versus already-wrapped input (found and fixed)

`pictureArea` assumed a composed file is the whole lab file and always removed the wrap margin. The composition step actually stores the FRONT PICTURE ALONE. On a real composition a 12 x 18 canvas was refused (`ASPECT_RATIO_MISMATCH`) and a square canvas was silently trimmed about 1% per side. `pictureArea` now chooses by the nearer shape: front-only (and every square) passes through whole; a true lab-shaped file still loses exactly its mirrored margin. This changes the INPUT the calibrated renderer receives for canvas and framed canvas; the calibrated renderer itself, its templates and its calibration are untouched.

## Cache identity

`mockupIdentityKey` is unchanged for calibrated mockups (their cached files keep being re-signed, not re-rendered). For a scene it adds `scene: { sceneId, revision, representationId, representation }`. `revision` is the adapter's hash of renderer code, the shared compositor, the inventory, the scene manifest and every scene asset. `representationId` is a function of the production artwork hash, composition id and attempt, favorite, scene, scene revision and derivation version, so a cached mockup is found without rebuilding the picture, and a revised scene, a correction or a new favorite is a new identity. The old file is removed; approval history is not modified.

Order of checks on a call: identity hit re-signs the stored file; otherwise the scene is tried; on failure the calibrated renderer serves (and its own cached file is honoured). Clean (paid) and watermarked (draft) variants are applied AFTER scene placement (`cleanMockupJpeg` or `deps.watermark`), exactly as before; the watermark is never skipped on an unpaid view.

The frozen purchase is validated independently of the scene renderer (which deliberately does not echo a configuration): the line's SKU and `finalPx` must equal the catalog's own entry, else `mockup_configuration_mismatch`.

## Serverless tracing and bundle

Codex's staged `next.config.next.js` was verified to be the existing `next.config.js` plus 47 trace entries, and merged into `next.config.js` (the staged file is removed). `renderer-bundle.test.ts` now requires the traced list to equal the renderer manifest plus `tools/product-scenes/bundle.next.json`, and checks every scene file's size and SHA-256.

Two corrections to the handoff:
* `bundle.next.json` recorded a hash for `tools/catalog-samples/scene-replacement-review.next.cjs` that did not match the committed bytes (2620 bytes, `1f30b4...` versus 2619 committed). Updated to the committed bytes.
* `.gitattributes` protected `tools/product-mockup/**` and `public/gift-wizard/**` from line-ending conversion but not `tools/product-scenes/**` or the scene compositor, so a Windows checkout hashed differently from Linux (the Vercel build) and the mockup cache revision would have differed by platform. Both are now `-text`.

`outputFileTracingIncludes` is still a prepared trace, NOT a verified deployed Vercel bundle: confirm on the first Preview that `/api/v1/gift/sessions/[id]/lines/[lineId]/mockup` renders a scene (the response says `renderer: "scene"`; `renderer: "calibrated"` for a supported configuration means the scene files were not in the function).

## Tests

* `scenes.test.ts` (14): the routing table over the real manifests, refusal reasons, pixel preservation, no network, identity.
* `mockup.test.ts` (+14, 88 total): scene identity, cache, revision, correction, fallback, kill switch, watermark of a draft, ownership, session and composition untouched.
* `mockup.scene.e2e.test.ts` (8): real composition, real scene renderer and real calibrated renderer on safe fixtures.
* `renderer-bundle.test.ts` (10) and Codex's `tools/product-scenes/adapter.next.test.cjs` (3, updated to read `next.config.js`).

## Evidence (fixtures, NOT a live customer session)

`E:\Dev\_recovery-staging\frontend-deploy-review\customer-scenes-20261019\` (`contact-sheet.jpg` and `clean/`): clean (paid) mockups exactly as stored and signed, from one of Codex's committed sample paintings through the real composition pipeline: canvas 12x12, mug 11 oz and card 7x5 in their scenes; fine art 12x18 and 8x8, canvas 12x18 and framed 12x18 through the calibrated fallback. No authenticated Preview session was used: that needs the combined deploy.

## Frontend

None required. `MockupView` is backward compatible, signed-URL refresh, `watermarked`, stale-composition and geometry-repair behaviour are unchanged, and no browser composition or new endpoint exists. Codex MAY show `renderer` / `scene` for diagnostics; nothing depends on it.

## Not verified

* A deployed Vercel bundle (see above) and a live authenticated Preview session.
* Visual equivalence of scene output on real customer artwork beyond the fixtures.
* The calibrated fallback for portrait products shows the artwork turned in the lay-flat templates (fine art 12x18 tile in the contact sheet). That renderer is unchanged by this work; it is for Codex to confirm that is the intended look.
