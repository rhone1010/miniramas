# GOODWILL REFUND POLICY · IMPLEMENTATION STATE · 2026-10-25

Status: one change built and tested locally (migration 061, NOT applied; nothing deployed). The rest of the approved policy was already implemented by Make It Right (migrations 038/039, `lib/store/remedy-*`) and is listed here with where it lives. The instruction text received ended mid-sentence ("Record the"), so anything it went on to require is **not** covered below.

## Policy against the existing system

| Approved rule | State | Where |
|---|---|---|
| One automatic goodwill refund per customer, first eligible dissatisfaction claim, up to $50 | **Already enforced**, atomically: a global advisory lock, the consumed-goodwill flag, and identity keys (user, hashed email, hashed payment identities) so another account on the same payment cannot mint a second one | `authorize_make_it_right_case` (039); `decideRemedy`; `authorizeRemedyCase` |
| Verify the original Stripe payment and prior remedy history | **Already enforced**: paid shares come from the stored purchase, the refund audit must match Stripe's own refunded total, otherwise review | `remedy-purchase-context.ts`, `remedy-allocation.ts`, `remedy-case-execution.ts` |
| Never more than the original payment, never more than $50 automatically | **Already enforced**: allocations are capped by what remains of each original payment; amount over 5000 cents becomes review | `allocateSingleArtworkRefund`; SQL check; `decideRemedy` |
| No duplicate refunds, concurrent claims or repeated requests against one payment | **Already enforced**: unique indexes on (purchase, allocation key) and on the Stripe refund id, claim/record under row locks, idempotency keys, the same artwork can only be remedied once | 038 indexes; `reserve/claim/record_make_it_right_refund` |
| **Subsequent dissatisfaction claims require review** | **Changed now.** Before: a later refund claim was paid automatically when a model judged it a "likely failure". Now every later refund claim becomes `review` (`decision_source: subsequent_review`) whatever the evidence. A later *redo* and the better-photo retry still use the evidence policy (they pay nothing). | `decideRemedy` (tests updated); migration 061 (`lib/v1/retention/migration-061.test.ts`, real Postgres) |
| Refund above $50 needs documented evidence, a verified problem and owner authorization | **Not automatic, by construction** (over 5000 cents is always review, and a single artwork can never be owed more than its two small payments). **No owner-authorization tool exists**: nothing records "owner approved $X with this evidence". Not built. | Open |
| Investigation data (photo, source artwork where retained, effect, composition, product configuration, shipping method, tracking, delivery) | Partly available: the case stores the artwork, source hash and evidence. After this release the source photograph may be gone (60-day retention), and a redo then asks for a new photo. Shipping/tracking/delivery are in `print_orders` and are not read by the case system. Not built. | Open |
| Decide whether the problem originated with LITEN & Co, Prodigi or the carrier | **Not built.** No field or record exists for it. | Open |
| Damaged, defective or incorrectly manufactured products follow a separate remedy process | Not part of Make It Right, which only handles crafted portfolio artwork (`kind: portfolio`; anything else goes to review). No separate process exists in code yet. | Open |
| Preserve the existing Gift Shop full-refund eligibility before manufacturing submission | **Untouched**: `lib/v1/gift/refund.ts` (request through Concierge, nothing manufactured while open, a person refunds in Stripe, recorded after verifying with Stripe) | unchanged |
| Preserve legally required refund and cancellation rights | Nothing here removes or narrows any right; the change only stops *automatic* payment of repeat claims, which go to a person | |

## What this changes for customers

A customer whose goodwill is spent and who asks for another refund is no longer paid automatically; their case enters review (`status: reviewing`). That is the approved policy but it is a behaviour change from what Phase 1 shipped, so the customer-facing sentence "Later requests use evidence review; source limitations offer a better-photo retry, and uncertain results offer a redo" (Concierge prompt) now needs "refund requests are reviewed by a person" added. I have not edited customer copy.

## To activate

1. Rich authorizes applying `supabase/migrations/061_goodwill_refund_once.sql`. It only replaces `authorize_make_it_right_case`.
2. Until then the TS policy already sends later refund claims to review, and the old SQL would then simply store whatever the TS decided, so behaviour is already correct in code; 061 makes the database refuse it independently of the application.
