# Gift final approval: exact remaining backend boundary

Inspected on fix/gift-pipeline-verify at 8770a5e. No backend files modified.

Existing POST /api/v1/gift/sessions/[id]/approve -> handlers.approveOrderH -> compose.approveOrder verifies all active purchased compositions approved and checks frozen geometry. It then calls store.approveOrder and deps.kick. real.ts binds kick to completePrintOrder; print/complete.ts can call prepareAndPlacePrint and place the order with Prodigi.

Frontend approveOrder remains blocked. It is not safe to treat this endpoint as an approval-only action under the current instruction prohibiting manufacturing submission.

CC must provide or confirm an authenticated, owner-scoped, idempotent final-approval contract that persists final customer approval while keeping fulfilment held: no kick/prepareAndPlacePrint, and no background worker eligibility caused by the approval write. It must return authoritative SessionView and eligibility/rejection for unapproved, stale, failed, correction-in-progress, refunded, or geometry-mismatched purchased compositions. If retaining the current endpoint, separate approval from manufacturing release server-side and document that invariant. Frontend must not invent a flag that the server ignores.

Frontend change: Add/Update and checkout require an unexpired ready/provisional approved-scene product-preview response. Pending, unavailable, invalid/retired and failed responses cannot add or increase a gift. Removal/reduction remains possible. Existing preview messages and Change Product controls are retained. No new designs or customer copy.

Actual paid Preview session: Fine Art 12x18 ready, Canvas 8x8 approved; both personalized scenes visible and combined review reachable. No approval, correction, generation or order mutations performed. Fine Art visual quality still requires customer review; ready geometry does not override the reported failed automated quality evaluation.

Browser shopping/configuration/cart refresh/checkout coverage uses the local review-journey simulated service, not a new live purchase. Automated UI contracts are mocked; scene/bundle tests are offline. No claim of end-to-end Production readiness until final-approval separation and customer artwork approval are resolved.
