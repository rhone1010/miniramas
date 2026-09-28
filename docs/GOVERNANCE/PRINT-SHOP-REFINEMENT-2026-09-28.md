# Print Shop refinement — 2026-09-28

Application commit: e52fba5, deployed canonical Preview. No Production deployment or order submission.

## Collection entry
Existing canonical Portraits/Pets candidate checks already accept 1:1, 2:3 and 3:2. Owned clean server eligibility remains authoritative. Shop gallery already accepts these formats and excludes incompatible geometry. No catalog, price or aspect-policy changes were necessary. Focused tests exercise all three formats and locked/incompatible exclusions in both actual HTML implementations. Real rectangular visual acceptance still lacks compatible owned artwork in this account.

## Product imagery
Existing paper photographs reused from public/previews/finishes/fine_art.jpg and premium.jpg. These are the same existing paper image; no new visual claim of a different premium construction is made. Existing public/print/mirror_wrap.png reused for Canvas. Classic Frame uses official Prodigi no-mount photograph, downloaded without alteration from:
https://www.prodigi.com/download/product-range/classic-frames/Classic%20black%20framed%20print%20corner%20no%20mount.jpg
Source inventory: https://www.prodigi.com/products/wall-art/framed-prints/classic-frames/
All four cards use consistent 4:5 image regions with object-fit contain, then existing product name, server material description, starting price. No generated product representations. Browser verified all four load.

## Receipt
Cause: five-second full-page reload for created/paid, repeating full receipt reads and ownedPrintPreview image analysis. Replaced with bounded status-only reads of owner-scoped persisted order. Maximum 24 five-second attempts; hidden tabs skip fetching and still consume the bound; placed/shipped/error/withheld stop polling. View Order refreshes status in place. Image/address/order composition stays mounted. Receipt entry suppresses workshop resume and test-piece eligibility bootstrap. Initial receipt signs its persisted order artwork without re-running print eligibility or downloading/analyzing images. No fulfillment code changes.

Verification: 33 focused tests pass; TypeScript and inline script parsing pass. Existing created receipt observed with unchanged performance.timeOrigin and zero analysis/source/quote/checkout requests. No new order or payment required for verification. No migrations/config changes.

Deferred: existing old print receipt items may show raw stored size/finish labels; existing legacy Print Shop masthead remains outside this scope. Not investigated.
