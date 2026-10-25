# CC: Gift Shop single-image mug — owner decision, 2026-10-24

Supersedes the proposed 21:9 Groups/full-wrap activation. Do not enable that discarded strategy.

Owner approved direction: ONE complete artwork panel on the visible face; portrait, square or landscape; opposite side clean white; original mug beauty-photo background; one customer product view. No repeated image, wrap fill, mirrored image or background extension. Preserve existing paid/approved compositions under their original immutable layout.

Required backend work:
- Define a versioned single-panel GLOBAL-MUG-W layout with verified printable bounds, panel dimensions and face center. Return those exact dimensions/placement in the shared preview contract. The frontend draft's pixel placement is photographic only, not a print specification.
- Offer supported portrait/square/landscape choices for the mug, using normal permitted source ratios (including five-person Action Figures); one physical 11oz SKU. Do not fake new SKUs or defeat group/effect safeguards.
- Produce one panel on white with white reverse. Store orientation/layout with generation/composition; preserve generation ID, dimensions, sha256 and selected layout through acceptance, cart, checkout and print preparation.
- Expose the exact signed panel artwork for display plus the layout/version and matching placement contract. The frontend must not reinterpret existing full-wrap responses as single-panel artwork.
- Keep old paid/approved panel/full-wrap mugs unchanged. No resetting sessions, paid generation, Production deployment or manufacturing submissions.
- Verify availability, mocked generation, acceptance and final print-file geometry for all three orientations. Return commit and exact contract. Codex 1 will integrate and deploy protected Preview.

Frontend prepared: public/gift-wizard/mug-panel.next.js. It preserves the approved photograph outside the supplied artwork mask, reconstructs white ceramic beneath the old sample art, fits the whole supplied artwork without cropping/stretching, and applies cylindrical shading only to the display derivative. Caller must supply agreed placement; no hard-coded print dimensions or subject strategy.

Local visual review: http://127.0.0.1:54327/panel.html. Explicit development-only placement until the backend contract is ready. Not connected to live acceptance or checkout yet.
