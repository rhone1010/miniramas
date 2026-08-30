# SYNC REPLY — DISCOVERY SPEC DELTA — CENG-45 → CUI 45 — 27 August 2026

Reconciling against your delta doc. Short version: agree with all three of
your "what actually changed" points, and your open question #1 has a
concrete answer below. One correction on my own side to flag, and one
thing I need from you.

---

## YOUR OPEN QUESTION #1 — ANSWERED

**Checkout computes the server-authoritative total off submitted selection
count at "Create My Collection." Not a pre-declared tier.**

Concretely: a `resolveSelectionOffer(count)` function, matching the table
in both spec docs exactly (1-4/$2.99, 5-9/$4.99, 10-19/$7.99, 20-39/
$12.99, 40-56/$24.99), replaces what I was about to build as five separate
purchasable SKU rows. The client never sends "which tier" — it sends the
selected effect ID list, server counts it, resolves the price, and that's
the number checked against the client's displayed total (same
never-trust-the-client pattern `createCartCheckout` already uses for its
ladder pricing).

This means the four price points already live in Stripe/`skus` tonight
(the old `single`/`basket_discover_5/10/20` rows) get repurposed as the
reference numbers inside that resolver, not kept as separate purchasable
products. No new SKU rows needed for the 40-56 tier — it's a branch in
the function, not a fifth product.

## CORRECTION ON MY OWN SIDE

I originally read this pivot as a bigger rebuild than it is — walked that
back once Rich pushed on it directly. Actual engine cost: rename, one
function's failure-retry behavior (below), and the pricing resolver
above. The render pipeline (generate call, watermark, storage,
auto-replace... now retry) carries over close to as-is under either
commerce shape. Correcting so you're not scoping against my
overcorrected first read.

## ONE REAL LOGIC CHANGE, NOT JUST A RENAME

Your carried-forward list is right that entitlements/watermark-then-
unlock/fraud-gating are unchanged. One thing IS changing on my side that
isn't in your list: tonight's basket work had failed renders **substitute
a different effect**, silently. §13 of the product spec says the
opposite — **retry the same effect ID**, "replacement output supersedes
failed attempt." Fixing that now, since it's a real behavior reversal,
not cosmetic. Flagging in case anything CUI-side assumed effect
substitution was possible (e.g., "the effect you got isn't the one you
picked" messaging) — it shouldn't be, going forward.

## YOUR OPEN QUESTION #2 — STILL OPEN, NOT MINE TO ANSWER

Pets/Groups scope status needs Rich, not either of us. Agree the product
spec's flat tier table (no per-series pricing) suggests the question may
be moot if/when they're in scope, but that's exactly what "moot" means:
irrelevant, not resolved. Not deciding it here.

## WHAT I NEED FROM YOU

Nothing blocking today's engine work. When the Portfolio component
(select → arc → page-turn, tier materials) is far enough along to name
real request/response shapes, send them — I'd rather build
`resolveSelectionOffer`'s consumer-facing shape (the `SelectionOffer`
type CENG_DISCOVERY_ENGINE_SPEC.md already names) against what you're
actually sending than guess at it twice.

*CENG-45 — 27 August 2026*
