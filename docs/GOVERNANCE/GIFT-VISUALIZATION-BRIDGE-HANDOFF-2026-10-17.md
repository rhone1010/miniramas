# Gift Wizard: product-mockup bridge, frozen geometry and composition identity (2026-10-17)

Baseline: Preview `2e143ab` (migration 049 applied). No migration is needed or proposed. Nothing here calls a model, Stripe or Prodigi.
Revision 2 (2026-10-17, after the owner's decisions): the renderer bundle is staged and verified, `next.config` traces it for the one route, the included correction falls back to one generated adaptation, and Groups favorite-reference generation is implemented but OFF. See section 12.

## 1. Status versus remaining gaps

| Area | Status |
| --- | --- |
| Mixed-aspect checkout, geometry sharing, product adaptation, payment verification, independent line approvals | Unchanged and still passing (164 existing Gift/print tests, plus the new ones). |
| Server-owned rendering boundary (one authenticated route) | **Built**: `GET /api/v1/gift/sessions/{id}/lines/{lineId}/mockup`. Tested with a fake renderer; the REAL compositor was run through the wrapper offline for 7 products. |
| Frozen purchased geometry | **Built**: snapshot written at checkout into the order item (no migration); read by composition planning, the session view and the mockup. |
| Composition identity and mockup cache | **Built**: identity key, per-composition stored mockup, automatic invalidation, retry-safe. |
| Real renderer on Preview | **BLOCKED on files that are not in this branch** (see section 5). |
| Correction behaviour | Reviewed; limitation reported (section 7). No behaviour changed. |
| Groups adaptation | Investigated; marked `unvalidated` as metadata only (section 8). No prompts or generation changed. |
| Mug and card | Still disabled, unpriced, with no template; the bridge refuses them. |

## 2. Backend changes (files)

New: `lib/v1/gift/frozen.ts`, `lib/v1/gift/mockup.ts`, `lib/v1/gift/mockup-real.ts`, `lib/v1/gift/test-order.ts` (test helper), `lib/v1/gift/mockup.test.ts`, `app/api/v1/gift/sessions/[id]/lines/[lineId]/mockup/route.ts`.
Changed: `lib/v1/gift/orders.ts` (freeze at checkout), `compose.ts` (frozen products, artwork SHA-256, stale-mockup removal on correction), `service.ts` (view from snapshot, new error codes, `GiftDeps.mockup`, retention), `types.ts`, `store.ts` (types), `policy.ts` (adaptation validation), `handlers.ts`, `real.ts`, `lib/v1/print/db.ts` (optional `frozen` on `PrintOrderItem`), tests `orders.test.ts`, `compose.test.ts`, `multi-aspect.test.ts`, `purchase-handlers.test.ts` (fixtures now carry real SKUs and snapshots), `lib/v1/print/complete.gift.test.ts` (fixture fields).
Not touched: generation prompts, the approved Gift Wizard UI, the compositor, its calibration, masks, MirrorWrap, frame recoloring or cylindrical mapping.

## 3. Contracts (authoritative: `lib/v1/gift/types.ts`)

### Mockup endpoint
`GET /api/v1/gift/sessions/{id}/lines/{lineId}/mockup[?compositionId=<id>]` -> `MockupView` (200, `Cache-Control: no-store`).

```ts
interface MockupView {
  contractVersion: 1; sessionId: string; lineId: string; productId: string; sku: string
  compositionId: string; attempt: number; compositionStatus: 'ready' | 'approved'; sourceArtworkId: string
  templateId: string; templateRevision: string
  identityKey: string                       // stable rendering identity, never a URL
  geometrySource: 'frozen' | 'legacy_catalog'; frozenCatalogVersion: string | null
  url: string; urlExpiresAt: string         // signed, 15 minutes
  width: number; height: number
  cached: boolean                           // true: an existing mockup with the same identity was re-signed, nothing rendered
  watermarked: true; productionPrintFile: false; purchaseAuthorization: false
  crop: Record<string, unknown> | null      // compositor crop/calibration metadata
}
```
Inputs: the session id, the line id, and optionally the composition id the page is showing. Nothing else is read: no composition id to render, no URL, no product id, no geometry.
Errors (`{ error }`): 401 `sign_in_required`; 404 `session_not_found` (also for another customer's session), `line_not_found` (also for a line of another order or a malformed id); 402 `order_payment_required`; 409 `order_not_paid`, `order_refunded`, `refund_pending`, `artwork_not_selected`, `composition_not_found`, `stale_composition` (the page's composition is not current: re-read the session), `geometry_snapshot_invalid`, `geometry_snapshot_unavailable`, `product_not_available` (no template: mugs, cards, other finishes), `mockup_configuration_mismatch`; 502 `mockup_failed` (safe to retry); 503 `mockup_renderer_unavailable`.

### Added to `LineGeometry` and `CompositionView`
`sku`, `geometrySource: 'catalog' | 'frozen' | 'legacy_catalog'`, `adaptationValidation: 'not_applicable' | 'provisional' | 'unvalidated'`; `LineGeometry` also `frozenCatalogVersion`. These are the minimum the page and the bridge need.

## 4. Frozen purchased geometry

- At checkout each purchased line's whole canonical product (productId, SKU, kind, family, size, fixed attributes, picture and final pixels, wrap, orientation, aspect) plus `catalogVersion` and a timestamp is copied into `print_orders.items[i].frozen` (`FrozenLine`, `snapshotVersion: 1`). That jsonb field already exists, so **no migration**.
- Composition planning, the session view's geometry and the mockup read the snapshot, never today's catalog. A catalog change after purchase cannot reinterpret what was bought (test: a snapshot with a different picture size is what the view reports).
- **Orders created before this change** have no snapshot. They resolve from today's catalog ONLY when the catalog still sells the same SKU under the same product id, and are labelled `legacy_catalog`. If the SKU no longer matches, the line is refused (`geometry_snapshot_unavailable`) and goes to Concierge. A snapshot that disagrees with its order line (different SKU/product, wrong version, incomplete geometry) is refused (`geometry_snapshot_invalid`). Nothing is guessed. Only sandbox test orders exist today.
- Open point: the snapshot lives with the print order's items. If a later change makes you want it queryable per line in SQL, a `geometry_snapshot jsonb` column on `gift_order_lines` would be the migration; it is not needed for any current behaviour.

## 5. Renderer invocation boundary

One server-owned boundary, `getLineMockup` in `lib/v1/gift/mockup.ts`, behind the `MockupRenderer` port. The production implementation (`mockup-real.ts`) is a thin wrapper that calls the EXISTING adapter `tools/product-mockup/gift-visualization-adapter.next.cjs` `composeCatalogItem` in-process (Node/Sharp, no separate service). Flow per call: authenticate; verify session, paid order and that the line is on that order; resolve the current composition; resolve the frozen product; map it to the approved template; read the CLEAN composed file from private storage into memory; give a canvas the picture area only (see below); render; compare the renderer's SKU and final pixels with the frozen purchase and refuse a mismatch; watermark the mockup (fails closed); store only the watermarked JPEG; return a signed URL. The clean artwork is never returned, signed or stored beside the mockup.

Finding from running the real compositor: it refuses the full lab file of a non-square canvas (3654 x 5454, margin included) as the wrong shape, and accepts the picture area (3600 x 5400). The wrap margin is the mirrored edge the compositor rebuilds itself, so the bridge removes it (`pictureArea`) before rendering. Nothing inside the picture is cropped.

Offline validation (real adapter, real templates, existing artwork, no model call): 7 of 7 products render, SKU and final pixels match the frozen purchase for each, 0.26 to 1.8 s each (canvas slowest), peak RSS about 270 MB, full-size 3600 x 5400 inputs. `calibration/bridge-validation/` holds the outputs.

**Why it cannot run on Preview yet.** `tools/product-mockup/` and `public/gift-wizard/` (templates and `catalog.next.json`, which the adapter reads at runtime) are untracked in `E:\Dev\liten-co` and not in this branch. Until Codex commits them, the endpoint answers `503 mockup_renderer_unavailable`. Two more things are needed and are NOT done here:
1. Commit `tools/product-mockup/*.cjs` and `public/gift-wizard/mockup-templates/**` and `public/gift-wizard/catalog.next.json` (about 5 MB of templates).
2. A build configuration change so the serverless function bundles those files: `outputFileTracingIncludes` for `tools/product-mockup/**` and `public/gift-wizard/**` in `next.config`. The adapter reads them with `fs` at request time, and Next does not trace dynamic reads. This is a deployment-affecting change and needs your approval.
Also: the adapter's own catalog (`catalog.next.json`) must agree with the canonical catalog. The bridge enforces it per render (SKU and final pixels), and a disagreement returns `mockup_configuration_mismatch` rather than a wrong mockup.

## 6. Composition identity, caching and invalidation

`identityKey = sha256` of: order id, line id and index, composition id and attempt, source artwork (preview) id, SHA-256 of the composed file bytes, template id and revision, the frozen product (id, SKU, final and picture pixels, wrap, orientation, attributes), geometry source and frozen catalog version. Key order is fixed. The template revision is a hash of the renderer code, the adapter, and every file of the template, computed by the renderer.
- The stored mockup (path, identity, template revision, the adapter's own `visualizationKey`, size, crop) is kept on the composition row (`plan.mockup`), so no migration. File path: `gift/{session}/mockups/{identityKey}.jpg`.
- Same identity: re-sign the stored file, render nothing (`cached: true`). Concurrent or retried calls write the same path and cannot affect another line.
- Each line has its own identity, so two lines that share one composition get separate mockups and approvals stay independent.
- **Invalidation is automatic, because anything it depends on changes the key:** a correction creates a new composition (new id and attempt) and removes the old mockup file; choosing another favorite supersedes every affected composition (no mockup is served until the new composition exists); a revised template or renderer changes the revision; a re-composition changes the file hash. A page that still holds the old composition id gets `409 stale_composition`.
- Signed URLs expire after 900 s (`MOCKUP_URL_SECONDS`). To refresh, call the endpoint again: with an unchanged identity that costs one storage signature. A URL string is never part of an identity.
- Retention: stored mockups are removed with the session (counted in `removeObjects`), and a superseded composition's file goes at once.
- A mockup authorizes nothing: approval and fulfilment are unchanged and only the existing approval endpoints can do them.

## 7. What the included correction actually does

Reviewed in `compose.ts` `correctLine`:
- **Deterministic line** (the selected artwork already fits, or bounded extension): the correction recomposes the same artwork through the same composer with the same input, so it can change nothing about placement, subject scale or cropping (test: identical composer input, no generation). It spends the free correction for a picture that can only differ by the outpaint's randomness.
- **Generated line**: the correction is one new NB2.1 generation of the same effect (with the favorite as the reference for Portraits and Pets). It can fix drift, but it is a re-roll: no input exists to steer position or scale.
- It cannot address subject placement, scale, cropping or background-extension complaints on demand. Composition drift can only be re-rolled.
Smallest server-controlled remedy (NOT implemented; it changes customer-facing behavior and cost, so it needs approval): on a deterministic line, make the free correction switch the method to a generated composition (favorite-reference for Portraits and Pets, one NB2.1 call at the product's ratio) so a correction always produces a genuinely different candidate; and for any line allow a server-chosen alternate extension mode (outpaint versus mirror) instead of repeating the same one. No browser crop or position control, no new charge, limit stays one per line.

## 8. Groups adaptation (calibration `gallery.html`, case C6 against its master)

Verified causes, from the code and the calibration records:
1. **No reference conditioning.** `generateGroupsRender` rejects anything but exactly one source image and the request has no reference field, so the favorite cannot be given to the model. Portraits and Pets do pass it. (Verified in code.)
2. **A new generation, not an adaptation.** The prompt describes the setting loosely ("a real old French artist's atelier"), so each sample re-imagines the room; only the photograph anchors identity. The gate scores likeness against the photograph, never against the favorite, so drift from the favorite is invisible to it. (C6 took 3 attempts, all against the photograph.)
3. **The format clause differs.** The 2:3 master got the mobile composition clause ("do not shrink faces..."); the 1:1 case got none, which matches the larger figures and platter seen in C6.
4. **A post-generation margin outpaint runs on every Groups render** (Stability, margin mode). It changes the final frame: the 2:3 master came out 1050 x 1466 (0.716, not 0.667). Portraits has no such step. Pets pads 10%.
Not established: how much of the drift is sampling variance versus 1-3 (no A/B was run), and whether adding the favorite as a reference would fix it (needs a generator change and a paid test).
Proposed correction, for approval before any change: add an internal-only favorite-reference input and clause to the Groups generator (the same wording as Portraits and Pets, headcount still taken from the first image only), skip the margin outpaint for product compositions (our composer does bounded extension), and run a 3-case paid test (about 4 to 6 NB2.1 calls). Interim option: for Groups, only offer products reachable by bounded extension of the master (no regeneration).
**Until then every Groups generated composition carries `adaptationValidation: 'unvalidated'`** (Portraits and Pets generated: `provisional`; deterministic: `not_applicable`). It is metadata only; nothing in generation or approval changed.

## 9. Mug and greeting card

Both stay disabled (`status: 'disabled'`, `retailCents: null`), have no template mapping and cannot be bought. The mug's 21:9 geometry support (2670 x 1110, 3.09% extension) is retained. The card's 6118 x 2161 spread boundaries are not inferred from the 5:7 front mockup. Both visual templates are untouched.

## 10. Tests and validation

Focused: `lib/v1/gift/mockup.test.ts` (37 tests: authorization, identity, cache, invalidation, retry, watermark fail-closed, frozen and legacy resolution, picture area, correction findings, adaptation metadata), checkout freeze test in `orders.test.ts`. The renderer is a fake in tests; the real one was run only by `calibration/validate_bridge.ts` (offline).
Not tested because it cannot be offline: the real renderer on a serverless runtime, signed URLs against real storage, a signed-in HTTP call on Preview.

## 11. Codex integration handoff

- Call `GET /api/v1/gift/sessions/{sessionId}/lines/{lineId}/mockup?compositionId={currentCompositionId}` for each purchased line once its composition is `ready` or `approved`. Display `url`; key your cache on `identityKey`; refresh the URL at `urlExpiresAt` by calling again; on `409 stale_composition` re-read the session. Do not show a mockup whose `compositionId` is not the session's current one for that line.
- `compositions[].adaptationValidation === 'unvalidated'` (Groups regeneration): do not present it as a validated match of the favorite; the customer's approval of that line is the control.
- The renderer files you own must be committed (section 5, items 1 and 2) before the endpoint works on Preview. Keep `catalog.next.json` consistent with `/api/v1/print/catalog` (SKU and final pixels): the bridge refuses a mismatch.
- Exact paths: `E:\Dev\_recovery-staging\vw-push\lib\v1\gift\mockup.ts`, `...\mockup-real.ts`, `...\frozen.ts`, `...\types.ts` (`MockupView`), route `app\api\v1\gift\sessions\[id]\lines\[lineId]\mockup\route.ts`.

## 12. Revision 2: approved decisions implemented

**Renderer bundle and build tracing.** The 35 files the real renderer reads (found by recording every file read while rendering the six purchasable templates) are staged in `tools/product-mockup/` and `public/gift-wizard/` (4.04 MB, no reports, screenshots, fixtures, mug or card templates) with `tools/product-mockup/renderer-manifest.json` (path, size, SHA-256, the adapter interface). Copies were hash-verified against Codex's tree; Codex still needs to confirm the inventory and own the source. `next.config.js` `outputFileTracingIncludes` lists exactly those files for the single mockup route. `lib/v1/gift/renderer-bundle.test.ts` keeps the files, the manifest, the tracing list and the real adapter's interface identical (and renders all six templates with the real compositor).
- A real `next build --webpack` was run locally with placeholder env: the mockup route's `route.js.nft.json` contains all 35 manifest files and no others from `tools/` or `public/`. (The default Turbopack build could not be used here because the worktree's `node_modules` is a link outside the filesystem root; Vercel's own build is unaffected, but its Turbopack trace was therefore not observed.)
- The renderer is loaded through `process.getBuiltinModule('node:module').createRequire`, because webpack warned on a dynamic `createRequire`.
- Note: files under `public/` are also served as static URLs. The templates and `catalog.next.json` are product photographs, masks and a catalog, not secrets.

**Correction fallback (customer-initiated only).** `correctionPlanFor` (composition-plan.ts) + `correctLine` (compose.ts): a deterministic line's one free correction becomes ONE generated adaptation (favorite as the reference for Portraits and Pets; photograph-only for Groups while the Groups reference is off) at the nearest ratio the series can reach within the 20% bound; if none is reachable the old recomposition is kept. The row records `method: generated`, the generation mode and aspect, one NB2.1 call, and `plan.correctionFallbackFrom: 'deterministic'`. The one-correction limit, payment and refund guards, idempotency (a failed generation spends nothing; a retry leaves one attempt-2 row) and the other lines' approvals are unchanged. Nothing generates unless the customer asks for the correction.

**Groups favorite-reference input (implemented, OFF).** `generateGroupsRender` accepts internal-only `favorite_reference_b64`, `adaptation: 'favorite'` and `product_composition` (the route is internal-only already). The photograph stays the only counted, age-checked and scored image; the favorite follows it with the same adaptation clause; `product_composition` skips the margin outpaint. The general Groups effect path is unchanged (tested: one image, no clause, outpaint still runs). `GROUPS_FAVORITE_REFERENCE_ENABLED = false` in `aspects.ts` keeps the Gift flow sending exactly what it sent before, and Groups adaptation stays `unvalidated`.

**Groups calibration (prepared, NOT run):** `calibration/groups_calibration.ts` (dry run by default). 6 generations = 6 NB2.1 calls = **$0.2016** at $0.0336 (one attempt each via `skip_scoring`, so the cost is exact): a second favorite (bronze, 1), and for watercolor and bronze a photograph-only baseline plus a favorite-reference result at 1:1 (4), plus one repeat of the first reference case to measure sampling variance (1). The existing C6 result is the third comparison for free. Unpriced: one OpenAI person-count call per generation and one Stability outpaint on the bronze master. Review: `build_groups_gallery.py` makes `groups-gallery.html` (photograph, favorite, results, with the six fidelity questions: membership, identities, relative positions, pose, artistic treatment, setting and cropping). Only 3-person photographs exist, so the 3:2 four-person path is not covered.
