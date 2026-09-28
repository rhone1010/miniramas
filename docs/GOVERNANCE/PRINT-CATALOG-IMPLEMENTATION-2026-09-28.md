# Print catalog expansion — 2026-09-28

Canonical branch: codex/canonical-2026-09-24.
Application deployment: e18e496, Vercel successful on canonical Preview.

## Implemented
- Four server-catalog families: Fine Art Print, Premium Fine Art, Gallery Canvas, Classic Frame.
- Existing square retail preserved; approved rectangular retail and verified Prodigi SKUs enabled.
- Matted Frame and Framed Canvas retained in legacy catalog but excluded from new purchases.
- Native square / 2:3 portrait / 3:2 landscape compatibility; same documented SKU for landscape.
- Original resolution inspected before upscale. No initial reduction, crop, or fit:fill.
- Canvas front uses nominal dimensions at 300dpi; user-approved 27px reflected extension on each side gives exact API MirrorWrap dimensions. Other families have no extension.
- Existing private sRGB JPEG assets, checkout, ownership, sandbox and fulfillment controls preserved.
- Server-populated options, independently configured multi-artwork lines, combined quote, bounded order list.
- Adding another line automatically refreshes shipping.

## Verified
- 25 focused tests pass: owner verification, compatible catalog, intact front pixels, reflected borders, both rectangular orientations, exact API dimensions, resolution decisions.
- Full-size synthetic Canvas output tests: 2454x2454, 2454x3654, 3654x2454; preserved centers; sRGB JPEG.
- Focused TypeScript check passes; all inline scripts in the three affected HTML files parse.
- Actual rendered customer path: canonical Collection Reclaimed Bronze lightbox -> visible checking/enabled Send to Print Shop -> four-family shop -> square 8x8 Fine Art -> quote $29 + $6.85 shipping = $35.85, displayed tax $0; Checkout enabled.
- Same artwork Fine Art + MirrorWrap Canvas quote: $88 + $20.85 shipping = $108.85.
- Independently selected Impressionist Premium Fine Art added: three lines/two artworks, $127 + $20.85 shipping = $147.85; Checkout enabled.
- Deployed rectangular 8x12 quote endpoint returns HTTP 200 shipping options for all four launch families, including MirrorWrap Canvas. These are API quote checks, not rectangular customer-path acceptance.

## Pending acceptance — not a pass
- Signed-in visible canonical Collection has 79 owned square previews, eight 1076x1440 previews and four 922x1652 previews. No native 2:3 / 3:2 candidate found.
- Representative 3:4 portfolio clean-source eligibility returns 409 compatible_artwork_required, correctly excluding incompatible artwork.
- Need owned native 2:3 and 3:2 artwork to exercise rectangular visible entry, selection, quote and actual prepared customer assets.
- No new Stripe payment or Prodigi sandbox order submitted during this expansion verification. Representative expanded-order sandbox fulfillment remains pending.
- Prior single-square commerce acceptance is not evidence of expanded-order acceptance.

## Preserved / deferred
No migrations, environment changes, Production deployment, live Prodigi order, artwork generation or unlock consumption.
No crop editor or My Collection multi-select.
Observed legacy Print Shop shell masthead differs from canonical Discovery masthead; logged without investigation, outside catalog/asset scope.
Historical unrelated drafts untouched. No localhost server used.
