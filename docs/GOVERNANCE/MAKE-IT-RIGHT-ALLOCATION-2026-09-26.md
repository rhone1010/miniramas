# Help / Concierge / Make It Right — canonical Preview implementation, 2026-09-26

## Approved rule
A single-artwork refund comprises its proportional actual paid craft value plus its attributable actual paid unlock value, each capped by its original transaction's remaining refundable balance. Included/free unlocks add zero. Unlock All uses its immutable purchased set. Previously allocated value cannot be refunded again. Whole-batch complaints remain Batch Review.

## Current implementation state
Rich approved the scoped PNG reconstruction exception and merge on 2026-09-26. The reviewed drafts have been promoted to the application paths for canonical Preview. No Production deployment, refund, generation, or unlock consumption is part of this deployment verification. Installed migrations 038–040 are preserved and were not rerun.

- `lib/store/remedy-allocation.next.ts`: deterministic integer-cent shares; separate original-payment budgets; committed/reserved allocation subtraction; unknown external refunds require reconciliation.
- `lib/store/remedy-purchase-context.next.ts`: owner-verified portfolio and entitlement/set membership; reads original Stripe Checkout/payment intent/charge; uses captured cash, rejects mismatched/disputed payments; excludes included allowances; does not double count set entitlements.
- `supabase/migrations/038_make_it_right_allocations.next.sql`: review draft (installed version: `038_make_it_right_allocations.sql`) extending existing `refund_log`, with a service-only atomic reservation function. Requires an already-authorized case and identical server-verified allocation snapshot. Does not authorize goodwill or execute Stripe refunds.

Rounding: split integer cents evenly, giving the remainder cents to stable original slots or sorted entitlement/set-member IDs. Membership never depends on which artwork is currently visible, owned, or loaded. Example: a $7.99 wallet purchase allocates 267/266/266 cents, totaling exactly $7.99.

## Verification
50 focused tests passed across allocation, purchase context, policy, refund execution, owner-verified cases, case authorization and global included-unlock redemption. Covered conservation, ownership, captured rather than catalog amount, included crossover zero value, persisted-set membership, duplicate set entitlement exclusion, prior allocation subtraction, separate transaction caps, invalid inputs, unknown external-refund reconciliation, cash ceilings, repeat-remedy holds, lost Stripe responses, bounded idempotent retry, human receipts and customer-safe case projection. These tests use mocked dependencies and issue no live refunds.

Focused TypeScript checks passed before adding the existing renderer dependency to the scope. The extended check reports the unchanged `PostgrestFilterBuilder.catch` typing error in the renderer's existing failure handler (live source line 241; staged source line 257). This was logged, not investigated or fixed. Existing Next configuration has `ignoreBuildErrors: true`; no configuration change was made.

Shared Supabase `miniramas` (`dqctwzertbujhsjatfyv`) was inspected read-only through Table Editor definition views. `refund_log` matches the existing entitlement-restoration schema (id/user/email/entitlement/reason/timestamp); no cash allocation or Stripe refund fields exist. Existing records were not changed. After explicit approval, migration 038 was installed successfully. Read-only verification confirmed all 10 new columns, all 3 audit indexes, the validated shape constraint, service-role execute=true, anon/authenticated execute=false, existing legacy records=3, cash records=0. No reservation/concurrency/refund tests were run on the shared database.

Focused in-memory DOM checks passed for the staged Help structure, single Concierge instance, closed-on-Help entry, and the dock close CSS fix. Both staged scripts parse. These are not Preview visual/customer-path acceptance.

## Database approval boundary
The draft drops `refund_log.entitlement_id` NOT NULL because a craft-value cash refund need not correspond to an unlock entitlement. A replacement constraint still requires an entitlement for legacy restoration rows, or the complete case/payment/allocation record for new cash rows. It adds nullable audit columns, partial unique/index constraints, and one service-only reservation RPC. It creates no table, deletes no data, changes no customer payment/entitlement rows, and calls no external service. Rich explicitly approved this scoped audit extension; it was installed on 2026-09-26. This approval did not authorize additional schema changes or execute any refund.

## Remaining before release
After a second explicit approval, migrations 039 and 040 were installed on 2026-09-26. Verification: all eight new functions exist, security-definer=true, service_role execute=true, anon/authenticated execute=false; two case indexes exist; case_number is an identity column; the deployed 035 redemption function remains present. Cash audit rows=0; remedy replacement portfolios=0. No function execution or concurrency tests were performed against customer data.

Staged implementation now includes deterministic authorization/history, Stripe execution/reconciliation, complimentary generation linkage preserving the original effective composition, subsequent vision evidence, better-photo submission, Batch Review evidence, global included-unlock confirmation, Account case history and meaningful-event email wiring. These are merged for Preview and await customer acceptance. No actual refund, replacement, email or unlock was issued by the agent.

Design authority is resolved: Visual 1 governs presentation, Visual 2 workflow/states, and the written specification takes precedence. Final UI includes reference-based icons, cards, library, support tiles, visual artwork selection, four-step request flow, status outcomes, Account history and included-unlock confirmation. Canonical Preview customer acceptance of executed remedies remains pending.

## Port trace / drafts
Paths below are relative to `D:/lanes/canonical-2026-09-24`; all counts measured 2026-09-26.
- Help shell: `public/help-phase1.js` line 4 serializes 15 source lines; `public/help-phase1.remedies.next.js` line 4 is byte-identical, 15 in / 15 out, no deviation. Surrounding controller implements the approved workflow under the scoped PNG exception; it is not claimed as a verbatim port.
- Existing Help CSS: `public/help-phase1.css` lines 1–27, 27 lines, copied unchanged into `public/help-phase1.remedies.next.css` lines 1–27; 27 in / 27 out. Additional staged reference-based styling is not a claimed verbatim port.
- Concierge: `public/concierge.js` lines 1–750 → `public/concierge.remedies.next.js` lines 1–751. Deviations: hidden rule gains `!important` (spec §2 close fix); one `askFromHelp` bridge line connects the approved Ask input to the same existing `ask` function (§1–2); message font changes from 1.12em to 1.25em (§2 readable typography). No second chat instance introduced.
- Portraits: `public/discovery-consolidated-draft.html` lines 1–10966 → `public/discovery-consolidated-draft.remedies.next.html` lines 1–10973. Pets: `public/pets.html` lines 1–10497 → `public/pets.remedies.next.html` lines 1–10504. Deviations only in included-unlock request/confirmation, cancellation handling, origin balance decrement and obsolete portfolio-bound guidance (spec §11).
- Case verifier: `lib/support-case.ts` lines 1–62 → `lib/support-case.remedies.next.ts` lines 1–74. Adds server-verified artwork/batch scope and batch snapshot (§9, §12).
- Support route: `app/api/v1/support/route.ts` lines 1–187 → `app/api/v1/support/route.remedies.next.ts` lines 1–240. Wires durable execution, idempotent receipt/resume, customer-safe statuses, better-photo validation and case email integration (§5–15). Existing support persistence and studio messaging retained.
- Concierge route: `app/api/v1/concierge/route.ts` lines 1–276 → `app/api/v1/concierge/route.remedies.next.ts` lines 1–285. Reconciles policy/global included-unlock guidance and verified customer case projection (§2, §6–11, §13).
- Redemption route: `app/api/v1/portraits/unlock/route.ts` lines 1–330 → `app/api/v1/portraits/unlock/route.remedies.next.ts` lines 1–337. Uses atomic v2 function, confirmation response and provenance; legacy path preserved (§11).
- Renderer: `lib/store/portfolio-render.ts` lines 1–301 → `lib/store/portfolio-render.remedies.next.ts` lines 1–317. Reads remedy linkage, preserves original generation composition separately from owned delivery, and refreshes/emails the linked case on completion (§6, §8, §12, §14). Existing generation and technical retry machinery retained.
- Per-portfolio allowance response: `app/api/v1/portfolios/[portfolioId]/unlocks/route.ts` lines 1–92 → `app/api/v1/portfolios/[portfolioId]/unlocks/route.remedies.next.ts` lines 1–92. Complimentary replacement with zero included allowance does not duplicate the original portfolio's displayed allowance (§10–11).

Final Help controller: 119 lines; CSS: 117 lines. The existing serialized shell remains 15/15 source lines and the first 27 CSS lines remain unchanged. All newly reconstructed sections are authorized by the explicit scoped PNG exception.

Unrelated existing dirty `.next` files were preserved. Historical lanes were not edited.

## Approved promotion manifest — 2026-09-26

Draft to live promotion copies entire files without line-count changes. TypeScript import suffixes alone change from staged names to their live names, as required by the approved merge. Earlier source-to-draft deviations are itemized above; PNG-derived sections are reconstruction under the express exception, not verbatim ports.

- `lib/support-case.remedies.next.ts` lines 1–74 → `lib/support-case.ts` lines 1–74; 74 in / 74 out.
- `lib/store/portfolio-render.remedies.next.ts` lines 1–317 → `lib/store/portfolio-render.ts` lines 1–317; 317 in / 317 out.
- `lib/store/remedy-allocation.next.ts` lines 1–88 → `lib/store/remedy-allocation.ts` lines 1–88; 88 in / 88 out.
- `lib/store/remedy-purchase-context.next.ts` lines 1–86 → `lib/store/remedy-purchase-context.ts` lines 1–86; 86 in / 86 out.
- `lib/store/remedy-policy.next.ts` lines 1–40 → `lib/store/remedy-policy.ts` lines 1–40; 40 in / 40 out.
- `lib/store/remedy-evidence.next.ts` lines 1–84 → `lib/store/remedy-evidence.ts` lines 1–84; 84 in / 84 out.
- `lib/store/remedy-refund-execution.next.ts` lines 1–61 → `lib/store/remedy-refund-execution.ts` lines 1–61; 61 in / 61 out.
- `lib/store/remedy-case-execution.next.ts` lines 1–100 → `lib/store/remedy-case-execution.ts` lines 1–100; 100 in / 100 out.
- `lib/store/remedy-email.next.ts` lines 1–27 → `lib/store/remedy-email.ts` lines 1–27; 27 in / 27 out.
- `app/api/v1/support/route.remedies.next.ts` lines 1–240 → `app/api/v1/support/route.ts` lines 1–240; 240 in / 240 out.
- `app/api/v1/concierge/route.remedies.next.ts` lines 1–285 → `app/api/v1/concierge/route.ts` lines 1–285; 285 in / 285 out.
- `app/api/v1/portraits/unlock/route.remedies.next.ts` lines 1–337 → `app/api/v1/portraits/unlock/route.ts` lines 1–337; 337 in / 337 out.
- `app/api/v1/portfolios/[portfolioId]/unlocks/route.remedies.next.ts` lines 1–92 → `app/api/v1/portfolios/[portfolioId]/unlocks/route.ts` lines 1–92; 92 in / 92 out.
- `public/concierge.remedies.next.js` lines 1–751 → `public/concierge.js` lines 1–751; 751 in / 751 out.
- `public/help-phase1.remedies.next.js` lines 1–119 → `public/help-phase1.js` lines 1–119; 119 in / 119 out.
- `public/help-phase1.remedies.next.css` lines 1–117 → `public/help-phase1.css` lines 1–117; 117 in / 117 out.
- `public/discovery-consolidated-draft.remedies.next.html` lines 1–10973 → `public/discovery-consolidated-draft.html` lines 1–10973; 10973 in / 10973 out.
- `public/pets.remedies.next.html` lines 1–10504 → `public/pets.html` lines 1–10504; 10504 in / 10504 out.

Focused post-merge verification: 7 test files / 50 tests passed. In-memory Help/Concierge and request-step checks passed. Unrelated pre-existing drafts remain excluded. Real remedy execution, email delivery and included-credit consumption are reserved for acceptance.
