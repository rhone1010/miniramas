# Print Shop / My Collection browser pass — 2026-10-21

## Baseline and ownership

- Authoritative checkout verified read-only: `E:/Dev/_recovery-staging/gift-session`, branch `fix/gift-pipeline-verify`, HEAD `f6e3cce`.
- HEAD contains Product Selector `cb05bc0`, Final Approval separation `b3b7ec3`, and CC readiness `f6e3cce`. The branch has no upstream. `git ls-remote` found no remote `fix/gift-pipeline-verify`; remote `codex/canonical-2026-09-24` was `cb05bc0` when verified.
- Isolated branch: `codex/print-collection-launch-ready`, based on `f6e3cce`, in `D:/lanes/canonical-2026-09-24/.temp/print-collection-current`.
- Initial canonical checkout at `7da6ab4` was stale. No changes were applied to it or the active Gift Wizard checkout. An initial isolated baseline at `de2adc4` was superseded before committing.
- Ledger found at `docs/GOVERNANCE/LIVE-FILE-LEDGER.md`, not `directives/LIVE-FILE-LEDGER.md`. Its July counts predate these adapters. Counts below were measured from the authoritative checkout on October 21.
- No shared Gift Wizard, masthead, catalog, backend API, migration, or CC-owned files changed.

## Navigate → wall → fix → retest

Preview: https://miniramas-git-codex-canonical-2026-09-24-litenco.vercel.app

1. Opened `/collection` in the real in-app browser at desktop size. Initial paint showed no artwork and “Unlock balance unavailable.” After loading, the existing signed-in session showed 8 owned artworks, 0 locked, and 4 reusable unlocks. No sign-in, new account, artwork creation, or purchase was necessary. This was a transient loading state; no persistent authentication or account-data failure was reproduced. No claim is made about the status of the initial network response.
2. At 390 × 844, selected existing Retro Robot artwork, waited for its full-size image, then used Print Shop. The route carried the same preview ID in `test_piece`; the Print Shop artwork was labelled Atomic Age Robot_01. The naming difference is pre-existing.
3. Selected Fine Art Print, 8 × 8, and reached Review. First independently reproducible navigation wall: no visible Back control at Finish or Size. Inspection showed the existing `.pm-back` button inside `#masthead.site-legacy-masthead`, whose computed display was `none` and dimensions were zero. The visible shared masthead used `#litenMenuBtn` instead.
4. Staged a narrow fix: move the existing Back node beside the active menu, synchronize menu visibility, and account for the asynchronously mounted shared masthead. Restore menu visibility when leaving the phone breakpoint. Reuse the existing hidden-menu CSS declaration for the current menu ID. No markup, customer copy, photography, dimensions, colors, or configuration logic added.
5. Retested in the real Preview browser with only the two staged resources substituted through tab-scoped request interception. At 390 × 844, Back to Select appeared, returned to Select, and retained the artwork. Finish → Size → Review continued successfully with Back to Finish and Back to Size present.
6. Entered browser-only test shipping details with quote and checkout requests intercepted before reaching the server. Simulated quote: Standard shipping 685 cents. Mobile address validation, Done, review, and checkout enablement worked. The intercepted checkout payload retained the selected preview ID as `items[0].renderId`, `size: '8x8'`, `finish: 'fine_art'`, `copies: 1`, `testPrint: true`, `embedded: true`, and the existing success/cancel URLs. Signed artwork URLs and account details are deliberately omitted from this report.
7. Supplied a simulated 503 checkout response; the button recovered for retry. The existing code logs checkout failure to the console but shows no customer-facing error. This is an additional launch issue; see blockers below.
8. At 1440 × 1000, the desktop order retained the artwork and configuration after the mobile flow. It displayed 2900 cents print + 685 cents simulated shipping = 3585 cents total, with Checkout enabled and normal desktop navigation. Back to My Collection navigated to `/collection?from=portraits`.

No Stripe session or payment was created, no manufacturing order was submitted, and no paid generation ran. This verifies frontend checkout handoff, not successful payment, fulfillment, or Final Approval. Quote values were test responses, not an assertion about current shipping prices.

## Files, fidelity, and release status

All paths below are relative to the isolated worktree; measured 2026-10-21. Sources remain untouched. The staged copies are deliberately not wired into live HTML, following the standing live-file merge gate.

| Source and lines | Staged destination and lines | Count in → out |
|---|---|---|
| `public/print-phone.next.js`, 1–69 | `public/print-phone.next.next.js`, 1–71 | 69 → 71 |
| `public/print-phone.next.css`, 1–132 | `public/print-phone.next.next.css`, 1–132 | 132 → 132 |

Every deviation, authorized by assignment items 3 (independent frontend fixes) and 4 (preserve navigation state):

- JS source line 13 becomes destination lines 13–15: add `syncNavigation`, observe the late shared-menu mount, call synchronization on breakpoint changes. Adds two lines.
- JS source line 23 becomes destination line 25: replace the hard-coded legacy-menu visibility write with `syncNavigation()`.
- CSS line 11: extend the existing hidden-menu selector to `#litenMenuBtn`; the declaration is unchanged.
- All other source lines are byte-identical, including CRLF endings. No visual/copy donor block was recreated.

Validation: `node --check` accepts the staged JavaScript; PostCSS parses the staged CSS. Both files contain zero backticks. JavaScript syntax parsing validates delimiter structure; CSS parsing validates its blocks. The Back control retains its existing click handler; the mutation observer disconnects after the shared menu is found. Browser screenshots are under `artifacts/print-collection-launch/`: `mobile-back.png`, `mobile-review.png`, `desktop-order.png`.

Activation requires Rich's live-file merge authorization: apply the recorded narrow differences to the two source adapters. Do not copy a prototype over a live engine. No deployment was performed. The browser-only overrides used for verification are not a deployed fix.

## Exact shared Product Studio integration blockers

The existing-artwork path still uses the legacy Print Shop bridge in `public/portraits.html`; this pass neither copied the Gift selector nor created a configuration system.

1. **Owned Collection artwork has no verified adoption interface into a Gift/Studio session.** Current `POST /api/v1/gift/sessions` accepts `CreateSessionRequest { image_b64: string }`. Existing `POST /api/v1/gift/sessions/{id}/artwork` accepts `{ previewId: string }`, but `lib/v1/gift/compose.ts` and the store require a ready preview belonging to that Gift session. A Collection preview ID must not be passed off as a Gift preview or converted to a new upload/generation. CC/shared integration must supply an owner-checked adoption operation that resolves the Collection preview to a Studio session/favorite, preserves the original identity and entitlement, and returns the existing `SessionView`. No new endpoint name is proposed or implemented here.
2. **Shared selector entry is not a public Collection entry contract.** After adoption exists, Print Shop must enter the integrated selector with the returned `sessionId`/favorite and a same-origin Collection return location. Preserve `from` series and existing `liten_collection_return` and `liten_collection_mobile_view` state. The shared owner must define the route or exported entry point; do not duplicate `public/gift-wizard/wizard.next.ts` or serialize clean image URLs into navigation state.
3. **Reuse these existing configuration contracts after adoption:** `GET /api/v1/print/catalog`; canonical `productId`, status/selectability, attributes, retail cents, and requirements from `lib/v1/print/catalog-types.ts`; `PUT /api/v1/gift/sessions/{id}/lines` with `{ lines: [{ lineId, productId, copies }] }`; existing `GiftBackend.setLines` and `selectArtwork` adapters. Legacy `{ size, finish }` values are not a replacement for canonical product IDs. The catalog and shared adapters remain untouched.
4. **Aspect adaptation is a shared Studio responsibility.** The current square artwork exposes square print sizes; rectangular sizes are disabled. To offer them, reuse the existing session composition, product-preview, and per-composition approval flow. Product previews can be `ready`, `provisional`, `adaptation_required`, or `not_available`. Provisional imagery is not purchase authorization. Approved scene photography and catalog samples already exist under `public/gift-wizard`; leave their selection and configuration to the active shared integration.
5. **Payment and Final Approval remain unverified by this pass.** Browser testing stopped at an intercepted legacy checkout request. CC's new approval/manufacturing separation and 055/056 migration readiness are not changed or claimed complete here. A successful simulated payment/receipt/approval walk must use their verified contracts once integrated, with manufacturing held.
6. **Failure presentation needs an approved UI/copy block.** A simulated legacy checkout failure silently returns to an enabled button; the failure is only logged. Adding customer-facing error markup or copy would require an approved source under the standing fidelity rules. This pass records the exact failure without inventing a message or modifying the shared payment shell.

Remaining independent work can resume after approval of the error presentation source; shared work can resume after the adoption/entry contract and active selector integration land. The completed navigation fix is isolated and reviewable now.

## Follow-up: Collection state and shared ownership — 2026-10-21

Rich subsequently assigned all product selection, configuration, photography, and styling to Codex 1. No further changes to those areas are included here. The legacy phone-navigation proposal above is still staged, not activated; it may be superseded by the unified Studio. Codex 1 was given the baseline, commit, touched paths, and missing personalized-preview contract. This follow-up owns only Collection view persistence.

Browser reproduction: in a separate test tab, desktop Collection → Filter → Oldest First → Apply → refresh reset the filter to Newest First. The user's existing Print Shop tab had an in-progress order, so it was not navigated, reloaded, or edited. Investigation found viewport guards around both saving and restoring `liten_collection_mobile_view`. Those guards excluded desktop. Delaying the adapter during browser override verification also reproduced a second issue: restored values could coexist with an already populated grid still in the old order.

Staged fix, measured 2026-10-21:

| Source and lines | Destination and lines | Count in → out |
|---|---|---|
| `public/collection-design.next.js`, 1–75 | `public/collection-design.next.next.js`, 1–76 | 75 → 76 |

Every deviation is authorized by Rich's follow-up requirement to continue independent Collection work and preserve navigation state:

- Lines 8–9: remove only the mobile-width guards from state restoration and saving. Keep the existing tab-scoped storage key, allowed values, fields, and error handling; no migration or new state format.
- Destination line 31: invoke the existing `renderMyCollectionGrid()` after restoring the existing visibility/sort function when a saved view exists. This handles artwork that loaded before the adapter, before the existing scroll-restoration decorator runs.
- Every other line is byte-identical to the source, including CRLF endings. No customer-facing markup, text, CSS, artwork action, Print Shop handoff, or checkout code changed. JavaScript syntax check passes; zero backticks; unchanged-line comparison passes.

Real-browser verification with the staged script substituted only in the test tab:

- At desktop, Unlocked + Oldest First survived refresh; the filter dialog showed both selected and the grid returned Retro Robot first.
- At 390 × 844, the same selections survived refresh and the populated grid immediately reflected Oldest First. This also verifies moving a saved desktop view to mobile.
- Returned to 1440 × 1000 and refreshed again: Filter · 2 and Retro Robot first remained. Eight existing owned artworks remained available.
- Evidence: `artifacts/print-collection-launch/desktop-filter-restored.png`, `desktop-grid-restored.png`, and `mobile-filter-restored.png`.
- No account data, artwork, checkout/order state, payment, or manufacturing data was created or changed. The test tab is disposable; browser-only overrides and viewport changes are cleared after testing. Scroll uses the existing restoration mechanism; no nonzero-scroll persistence claim is made in this pass.

### Prepared connection to Codex 1's Studio

Codex 1 proposed (not yet a landed contract) `mountStudio(host, { products, state, previewHtml, canAdd, onChange, onAdd, onExit, utilityHtml? })`. Studio owns panel steps, selection, options, Back, photography, and styling. The eventual Print adapter must only map existing owner-checked source/catalog responses and supply callbacks after that module and its exact entry contract land.

- Keep Collection preview identity separate from Studio product IDs and from Gift session preview IDs. Continue to resolve ownership through the existing source endpoint; never infer ownership from saved view state.
- Preserve the existing Collection return URL/series and `liten_collection_return`; preserve `liten_collection_mobile_view` as tab-scoped view state. Do not place signed artwork URLs, prices, address details, payment secrets, or order authorization in this navigation record.
- Existing source/catalog data can supply artwork identity/dimensions and canonical product options. It cannot supply an approved personalized product mockup for a Collection preview. The legacy UI shows artwork and generic finish imagery separately. Gift mockup/product-preview calls require a Gift session/favorite. This missing contract was explicitly reported to Codex 1 before adapter implementation.
- Do not enable Add to Cart based on a fabricated composition, treat a separate artwork image as a personalized product preview, or manufacture a Gift session. Common blocked-review presentation belongs in Codex 1's authoritative module. No new Print product screen or entrance adapter has been authored in this follow-up.
- Required next handoff: completed shared-module commit, exact callable interface and activation route, and the owner-checked Collection preview/review contract or approved common unavailable state. Integration remains held until those are available. Existing checkout state is not migrated or discarded while waiting.

Like the earlier fix, this source copy is not wired live. Rich's standing live-file merge gate still applies. No independent push or deployment is included.

## Shared Studio data adapter handoff — 2026-10-21

Codex 1 supplied shared module commits `85eda48` and `3fa7d41`, including `unavailablePreview` and the authoritative staged `public/print-studio.next.html` shell. They were cherry-picked unchanged as `d323cd5` and `821f8f5` into this worktree for integration; they are not Print-owned UI edits. Codex 1 should take only the subsequent adapter commit because those shared changes already exist in their branch.

New Print-owned files: `public/product-studio/print.next.ts` and its generated `print.next.js`; focused tests in `test/print-studio-adapter.test.mjs`. The adapter authors no product markup, styling, or photography and calls `mountStudio` and `unavailablePreview` directly.

- `test_piece` is validated and resolved again through authenticated `GET /api/v1/print/source`. A returned different ID or denied fulfilment stops loading before catalog requests.
- Catalog is requested with the verified artwork dimensions; contract version and echoed dimensions must match. Geometry, prices, compatibility, and SKU come from that response. Family labels and photography paths come from Gift's catalog JSON. No price or photograph is independently authored.
- State is saved under `liten_print_studio_view:<pieceId>`, containing only Studio step, family ID, size, quantity, and per-family selection drafts. Restored values are checked against the current catalog. No image URL, credentials, prices, address, order, or checkout session is persisted by this adapter. Storage denial falls back to in-memory operation.
- Back out of Studio uses `/collection?from=<validated series>`, preferring the explicit route context, then the existing `liten_collection_return` key. The source URL is not rewritten. Receipt URLs containing `session` are not consumed or redirected by the adapter.
- `canAdd` is always false, `onAdd` has no effect, and the shared unavailable-review renderer owns the displayed explanation. No quote, payment, composition, Gift adoption, or manufacturing request is made. This is a truthful blocked-review connection, not purchase readiness.
- The supplied staged shell already loads `/product-studio/print.next.js`; no live route was edited here. Codex 1 owns activation. Preserve the existing receipt/checkout route handling and do not replace a customer's in-progress legacy cart with this shell. A future enabled purchase path needs the missing verified Collection-personalized-preview contract and explicit cart/state migration decisions.

Verification: TypeScript `--noEmit` passes, generated adapter compiles, and four focused tests pass: source identity rejection before catalog/commerce, authoritative catalog/photo mapping, piece-scoped state and series return, and disabled review/receipt-session preservation. The final test mounts the actual shared renderer in a DOM, confirms Add to Cart is disabled, and confirms clicks cannot emit commerce calls.

Browser limitation for this adapter pass: attempted to open the staged shell on a local fixture-only server, but browser tools returned `Browser is not available: iab`; inventory then contained no browsers. Therefore no real-browser result is claimed for the new Studio adapter. Earlier browser evidence applies only to the independent navigation/Collection fixes. Codex 1 must browser-test the integrated adapter at desktop and 390px, including Back, refresh, reopened state, receipt bypass, and the unavailable review before Preview activation. The fixture harness made no remote calls and is not a deployment.
