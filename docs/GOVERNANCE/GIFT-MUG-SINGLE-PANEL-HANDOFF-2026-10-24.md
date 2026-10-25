# CC: Gift Shop single-image mug — owner decision, 2026-10-24

Supersedes the proposed 21:9 Groups/full-wrap activation. Do not enable that discarded strategy.

Owner approved direction: ONE complete artwork panel on the visible face; square (1:1) or landscape (3:2); opposite side clean white; original mug beauty-photo background; one customer product view. No repeated image, wrap fill, mirrored image or background extension. Preserve existing paid/approved compositions under their original immutable layout.

Required backend work:
- Define a versioned single-panel GLOBAL-MUG-W layout with verified printable bounds, panel dimensions and face center. Return those exact dimensions/placement in the shared preview contract. The frontend draft's pixel placement is photographic only, not a print specification.
- Offer supported square/landscape choices for the mug, using normal permitted source ratios (including five-person Action Figures); one physical 11oz SKU. Do not fake new SKUs or defeat group/effect safeguards.
- Produce one panel on white with white reverse. Store orientation/layout with generation/composition; preserve generation ID, dimensions, sha256 and selected layout through acceptance, cart, checkout and print preparation.
- Expose the exact signed panel artwork for display plus the layout/version and matching placement contract. The frontend must not reinterpret existing full-wrap responses as single-panel artwork.
- Keep old paid/approved panel/full-wrap mugs unchanged. No resetting sessions, paid generation, Production deployment or manufacturing submissions.
- Verify availability, mocked generation, acceptance and final print-file geometry for both compositions. Return commit and exact contract. Codex 1 will integrate and deploy protected Preview.

Frontend prepared: public/gift-wizard/mug-panel.next.js. It preserves the approved photograph outside the supplied artwork mask, reconstructs white ceramic beneath the old sample art, fits the whole supplied artwork without cropping/stretching, and applies cylindrical shading only to the display derivative. Caller must supply agreed placement; no hard-coded print dimensions or subject strategy.

Local visual review: http://127.0.0.1:54327/panel.html. Explicit development-only placement until the backend contract is ready. Not connected to live acceptance or checkout yet.

2026-10-25 integration: bdb418b4 supplies square/landscape generation.options and composition POST. Remaining blocker: gift-profiles.ts routes both to buildMugWrap, which composites two panels (including a mirrored duplicate) onto a blurred wash. New orders require one panel on white and a white reverse, under a distinct persisted layout version so existing paid square mugs remain unchanged. Supply matching preview input/placement for that version before frontend single-panel activation.

2026-10-25 resolution: bb876e25 supplies mug_single_panel and exact placement. Frontend now composites the supplied 1335×555 beauty view with the existing cylindrical mapping, retains the original background, and displays one view. Legacy inputs without placement retain their original renderer. Square/Landscape choices are taken from availability.

Verification: real local create/effect/generation/preview/accept/lines handlers with in-memory storage and clearly labeled simulated model output. Desktop square and 390px landscape reached explicit acceptance, cart and checkout entry. Refresh retained the landscape cart. Only two generation POSTs occurred, each carrying the selected composition. No payment or external order submitted. Pixel preservation, backend placement, legacy print behavior, renderer bundle and mocked checkout identity checks passed.

Contract port (2026-10-25): lib/v1/print/production-profiles.ts lines 1–210 → public/gift-wizard/backend-contracts/print/production-profiles.ts lines 1–210. 210 lines in / 210 out; byte-identical; no deviations. JavaScript compiled from that TypeScript contract.

2026-10-25 enlarged v2 integration: e11c220d. Browser renderer recognizes both single-panel layout versions through the shared isMugSingleLayout contract. New square uses 1034x1034; landscape 1122x748. Rendering consumes backend beautyInput.placement and the exact rolled beauty input. Existing v1 placement remains supported; older records retain the legacy path.

Browser verification: desktop square and 390px landscape completed preview, explicit acceptance, cart and checkout delivery entry using real local Gift handlers with labeled simulated model output and in-memory storage. Square cart survived refresh. Mobile document and viewport both measured 390px. No payment, customer approval, paid generation or manufacturing submission occurred. The landscape sample is a square test image contained into 3:2; its white side padding is fixture content, not production placement. Focused backend placement/legacy/identity and renderer bundle checks passed; the browser compositor test covers both layouts and both compositions.

Contract port (2026-10-25): lib/v1/print/production-profiles.ts lines 1-229 -> public/gift-wizard/backend-contracts/print/production-profiles.ts lines 1-229. 229 lines in / 229 out; SHA256 matches; no deviations. JavaScript compiled from that TypeScript contract. Preview verification does not constitute a completed live payment journey.
