# Gift Wizard final-order approval: contract for the final button (CC -> Codex), 2026-10-21

## What changed
The customer's final approval and manufacturing are now two different operations. The customer can only do the first.
- **Final approval** records the approval durably. It does not release the order to fulfilment: no Prodigi, no queue, no status change on the order row (it stays `awaiting_artwork`, invisible to fulfilment), no `kick`.
- **Release to manufacturing** is a separate operator-only step (`scripts/gift-release-order.ts`). No route, handler or button can call it.
- Needs **migration 056** (`supabase/migrations/056_gift_final_approval.sql`, NOT applied anywhere). Until it is applied the endpoint answers `503 finalization_unavailable`. Check with `docs/GOVERNANCE/gift-056-preflight-and-verify.sql`.

## Endpoint
`POST /api/v1/gift/sessions/{sessionId}/finalize`
- Auth: the signed-in customer (same as every Gift route). No body. `Cache-Control: no-store`.
- Success `200`: a full `SessionView` (the same object as `GET /api/v1/gift/sessions/{id}`), see below.
- Idempotent: any number of repeats, refreshes, second tabs or simultaneous clicks all return `200` with the same `order.finalApprovedAt` and the same `order.unlockPortfolioId`. Safe to retry after a network error.
- `POST /api/v1/gift/sessions/{id}/approve` is a deprecated alias of `/finalize` (approval-only too). Use `/finalize`.

### Success response (relevant fields)
```
order: {
  state: 'approved',                       // the customer has approved; see "UI states"
  approvedAt:      '<ISO>',                // == finalApprovedAt (kept for older readers)
  finalApprovedAt: '<ISO>',                // when the customer approved
  releasedAt:      null,                   // set only by an operator release
  manufacturing:   'not_released',         // 'not_released' | 'released' | 'with_lab'
  unlockPortfolioId: '<uuid>'              // the one My Collection piece created at approval
}
```
Payment, order lines, favorite, approved compositions and `correctionsRemaining` are unchanged by this call.

### Errors (`{ error: code }`, all `no-store`)
| status | code | meaning / what to show |
|---|---|---|
| 401 | sign in required | existing sign-in handling |
| 404 | `session_not_found` | not this customer's session |
| 402 | `order_payment_required` | no paid order |
| 409 | `compositions_not_approved` | at least one purchased line is not approved yet: send the customer back to the unapproved line(s) |
| 409 | `composition_geometry_mismatch` | a stored composition is the wrong shape for what was bought: "we are fixing your artwork" (operator repair); do not retry |
| 409 | `artwork_not_selected`, `order_has_no_lines`, `preview_not_ready` | session not ready; send to the matching step |
| 409 | `refund_pending`, `order_refunded` | a refund is in progress / done: no approval, show the refund state |
| 409 | `order_not_awaiting_artwork` | the order is no longer open (for example cancelled); show the order state |
| 503 | `finalization_unavailable` | 056 not applied: "temporarily unavailable", offer retry later |

## UI states (derive everything from `order.state` and `order.manufacturing`)
| `order.state` | `manufacturing` | Final Approval screen |
|---|---|---|
| `awaiting_artwork` | `not_released` | per-line review and corrections as today. "Approve and finalize" enabled only when **every** `compositions[i].status === 'approved'`; otherwise disabled with the unapproved lines named |
| `approved` | `not_released` | DONE: show "Approved, thank you" (plus the My Collection piece). No approve button, no corrections, no product changes. Do NOT say "in production" or "shipping": nothing has been released |
| `approved` | `released` / `with_lab` | same screen; you may say it is with our print partner once `with_lab` |
| `with_lab` | any | with the lab |
| `refund_requested` / `refunded` / `cancelled` / `needs_attention` | any | existing handling |

After `approved`: these calls now answer `409 order_not_awaiting_artwork`: select artwork, corrections, composition approve/ensure, new/retry batches, lines. Do not call them from the approved state. Refresh recovery: `GET /sessions/{id}` and `GET /restore` return `order.state 'approved'` and `resume.suggestedStep 'order'` after a reload; the Wizard must open on the approved screen, not on the per-line review.

## Operator release (not for the UI)
`npx tsx --env-file=.env.local scripts/gift-release-order.ts --session <uuid> --user <uuid> --operator <you@liten.co> [--execute]` (dry run by default). Needs the final approval first (`final_approval_required` otherwise), then moves the order to the state the existing fulfilment pipeline acts on (it still runs its own account gate, payment and refund rechecks, upscale, QA and Prodigi checks). Idempotent.

## Verified
`lib/v1/gift/final-approval.test.ts` (service + handlers + a static check that nothing customer-reachable can reach `kick`, Prodigi, `completePrintOrder` or release) and `lib/v1/gift/migration-056.test.ts` (real Postgres: the order row stays byte-identical on approval, release is the only step that moves it to `paid`, permissions closed to browser roles). Not verified: a live database (056 unapplied) and the browser.
