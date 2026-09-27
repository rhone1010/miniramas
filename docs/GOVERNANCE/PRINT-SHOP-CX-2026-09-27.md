# Print Shop customer-experience pass — 2026-09-27

Canonical branch/worktree: `codex/canonical-2026-09-24`, `D:/lanes/canonical-2026-09-24`. Preview only. Rich accepted the preceding single-piece commerce chain; this pass does not repeat payment or submit a live order.

## Changes
- Address input/change invalidates shipping and disables Checkout immediately; debounced existing Prodigi quote refreshes totals; stale responses cannot overwrite current quotes.
- Existing Discovery embedded Stripe shell is copied into Print Shop. Stripe owns the payment fields and Link flow. Server creates an embedded session when requested; existing order persistence, signed webhook and fulfillment remain. Square sandbox request explicitly carries its existing test marker.
- Existing shop columns now identify Your artwork / Make your print / Your order. Existing rail is repurposed on `/print` as Your Prints, with order thumbnails/current selection and Add another artwork returning to My Collection.
- Print Shop links added to Portraits/Pets shared masthead and existing Portraits/Groups/Halloween/Community navigation. Direct `/print` entry without a selected piece returns to current My Collection; no new artwork library. Groups/Halloween links navigate to the canonical shop instead of opening their old local shop panels.
- Existing receipt resolves portfolio-owned artwork through the verified source helper; shows product, finish, size, quantity, destination and monetary breakdown; removes lab/internal error identifiers. Actions: View Order, Back to My Collection, Print Another. Created orders say confirming payment, not payment received.

## Verification
- Focused checkout/receipt TypeScript passes. Existing receipt query required explicit existing PrintOrderRow type for its concatenated select projection.
- Six changed HTML inline-script sets parse.
- Focused shipping checks pass: edits invalidate old totals/disable checkout, latest response wins, incomplete addresses cannot quote. No broad regression run.
- Deployed Preview: direct Print Shop opens My Collection; owned 1:1 Reclaimed Bronze opens shop through visible customer lightbox action.
- Entering receipt email automatically fetched shipping without removing/re-adding artwork: $29.00 print + $6.85 shipping = $35.85; Checkout enabled.
- Checkout opened actual embedded Stripe Test Mode at $35.85 inside copied Liten & Co shell. Closed without payment; one expected unpaid test checkout/order remains.
- Read-only receipt API for the earlier unpaid test session returned owned artwork URL present, fine_art/8x8/one copy, subtotal 2900, shipping 685, tax 0, total 3585, status created. This is receipt-field verification, not a new paid fulfillment result.
- Final visual corrections restore Checkout text on modal close, use existing light-surface rail button styling, and allow the sole Fine Art option the full existing options row.

## Verbatim port audit
Source: `public/discovery-consolidated-draft.html`; destination: `public/portraits.html`, measured 2026-09-27.
- Payment CSS: source 2399–2452 → destination 4921–4974; 54 lines in / 54 out, byte-identical.
- Payment markup: source 10583–10597 → destination 12605–12619; 15 lines in / 15 out, byte-identical.
- Authorized runtime adaptations: print heading, product/total, print endpoint session, existing Stripe loader and completion return to print receipt. Stripe iframe unchanged.
- Other changes are the expressly requested existing-shop adaptations, not new donor ports.

## Boundaries / deferred
- Next enhancement: `My Collection Select mode → multiple Download / Send to Print Shop`.
- No rectangular products, Prodigi architecture changes, migrations, external configuration changes, Production deployment, or live order.
- Foyer persistence and durable-handoff investigation remain pending and untouched.
- Legacy shop masthead/catalog naming outside the specified navigation addition remains; no unrelated redesign.
- Customer visual/functional acceptance of this refinement remains Rich's gate.
