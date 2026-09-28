# Print Shop refinement round 2 — 2026-09-27

## Scope
Rich's approved round-two instructions and supplied Print Shop mockup govern this refinement. Existing commerce, single-piece 8×8 Fine Art limit, ownership/clean-square eligibility, embedded Stripe and Prodigi sandbox guards are unchanged. No backend files, migrations, secrets or external configuration changed.

## Implemented
- Full-stage atelier field in existing palette; cream configuration/order surfaces and stronger PRINT SHOP identity.
- Selected artwork reduced to 210px at normal desktop (previously about 360px); title and selected/in-order state beneath it.
- Existing My Collection portfolio/status/unlock reads populate a four-column, internally scrolling gallery. Locked, incomplete, rectangular and unsupported-series items excluded. Selection reuses the existing server-owned clean-square source verifier before enabling configuration; existing order remains until Add is used.
- Collapsed Ships to / Edit destination. Done validates required fields, requotes using existing Prodigi endpoint, and closes the editor. Address edits retain stale-response protection.
- Reusable --ui-serif-interactive-desktop token and .ui-serif-interactive class: 1.6rem desktop serif interactive floor. Captions/forms remain separately styled.

## Verification
- 11 inline scripts parse.
- Focused shipping stale-response, invalidation and incomplete-address tests pass.
- Collection fixture test excludes locked, unfinished, rectangular and unsupported-series artwork.
- Deployed Preview at 1280×720: 18 thumbnails, four columns, 240px gallery viewport / 440px content; internal overflow. Checkout bottom 608px, within viewport. Shipping collapsed by default; Back computed font 25.6px.
- Done collapsed editor and refreshed $29.00 print + $6.85 shipping + $0 tax = $35.85, Checkout enabled.
- Actual gallery selection: Action Figure passed existing source verification; selected artwork changed while the Reclaimed Bronze order remained intact. No checkout/payment/order submitted.

## Deferred / boundaries
No multi-piece checkout, rectangles, additional products, bulk download, new Prodigi work or live order. Foyer durable-handoff remains outside this task. Existing legacy Print Shop masthead differences remain logged, not investigated. Visual acceptance remains Rich's gate.
