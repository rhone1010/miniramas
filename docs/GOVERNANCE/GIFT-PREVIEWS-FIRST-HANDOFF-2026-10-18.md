# Gift Wizard: previews before purchase (2026-10-18)

**Authoritative model (owner decision):** the first six artwork previews are FREE, the second six are FREE, further batches of six are $2.99 each, and no physical-product purchase is needed for the first twelve. Entitlements are server-controlled, persistent and protected against repeated free allocations.

Customer journey: Upload Photo -> Choose Effects -> Generate Previews -> Select Favorite -> Choose Gifts -> Checkout -> Product Compositions -> Final Approval -> Fulfilment.

Status: implemented and tested, UNCOMMITTED and migration 050 NOT applied. It must not be deployed before migration 050 is applied (the backend calls the new 8-argument reservation). Three things need approval first (section 6).

## 1. What changed

| Area | Before | Now |
| --- | --- | --- |
| Generating previews | needed a paid product order | needs only a signed-in account and a session; no order |
| Free previews | two batches granted by payment | two batches per session from a server allocation (migration 050); a purchase grants no previews |
| More previews | $2.99 packs after the two free | unchanged: $2.99 per six, payment verified before generation |
| Favorite | selected after payment | selected and SAVED before any order; kept through checkout and payment |
| Checkout | needed lines only | also needs a saved favorite (409 `artwork_not_selected`) |
| Compositions, corrections, mockups, line approvals, final approval, fulfilment | after payment | unchanged: only after verified payment, only for purchased SKUs, final release only on explicit approval |

Preserved: effect registries, prompts, calibrated compositors, geometry, NB2.1 pipeline, geometry sharing, authenticated mockups, frozen purchased geometry, webhook and checkout idempotency.

## 2. Free-preview allocation and abuse protection (migration 050)

Every free batch is a row in `gift_free_grants`, a ledger that is NOT deleted with the session (its session and batch links are set null). The caps are enforced inside `gift_reserve_batch`, under the session lock, by `gift_free_status` (one rule, one home):

| Cap | Value |
| --- | --- |
| per session | 2 free batches (the owner-confirmed model) |
| per account and photograph (all sessions, deleted ones included) | 2 |
| per account in any 24 hours | 6 (PROPOSED, needs approval) |
| per account, lifetime | 20 (PROPOSED, needs approval) |

Recreating or deleting a session cannot reset any of them; another photograph or account has its own allocation. Same idempotency key = same batch, no second allocation. When no free batch is available the next batch is a pack (`payment_required`, $2.99). The numbers are function parameters (`lib/v1/gift/policy.ts` `FREE_PREVIEWS`), so changing them needs no migration. Not covered: rate limiting of session creation itself (photo analysis uses OpenAI) and per-IP limits; the signed-in account is the identity.

## 3. State transitions

- Session with no order: `order.state: 'none'`. Generate batches, choose effects, select/save a favorite, choose products (`PUT lines`), all free of any purchase.
- Checkout (`POST checkout`) requires lines AND a saved favorite. `checkout_open` while unpaid; generation and favorite changes remain possible.
- Verified payment -> `awaiting_artwork`: compositions for the purchased lines are generated from the SAVED favorite (`POST compositions`), corrections, authenticated mockups, line approvals.
- Final approval releases manufacturing. After release (`approved` and later) generation and favorite changes are refused (`order_not_awaiting_artwork`).
- A refund request or refund blocks generation and selection as before.

## 4. Contract changes for Codex (`lib/v1/gift/types.ts`)

```ts
SessionView.entitlement: {
  freeBatchesTotal: number        // always 2 (server constant)
  freeBatchesUsed: number         // free batches this session has used (0..2)
  paidPacksAvailable: number      // the account's unused $2.99 packs
  freeAvailable: boolean          // may the next batch be free?
  freeBlockedReason: 'session_limit' | 'photo_limit' | 'daily_limit' | 'lifetime_limit' | null
}
SessionView.order.freeBatchesGranted: number   // always 2; kept for compatibility, no longer granted by payment
SessionView.nextBatch:  { kind: 'free' } | { kind: 'paid', packAvailable: true } | { kind: 'payment_required', amountCents: 299, currency: 'USD' }
                        | { kind: 'blocked', reason: ... }          // 'order_payment_required' is no longer produced
```

Rules for the UI: show "free" while `nextBatch.kind === 'free'`; after the second free batch (`freeBlockedReason: 'session_limit'`) offer the $2.99 pack (`POST /api/v1/gift/preview-pack/checkout`, then confirm); `photo_limit`, `daily_limit`, `lifetime_limit` mean free previews are not available now (the customer can still buy a pack); `blocked: order_not_awaiting_artwork` means the order was approved and released.

Endpoint order: `POST sessions` -> `POST sessions/{id}/batches` (idempotency key, up to the allocation) -> `POST sessions/{id}/artwork { previewId }` (saves the favorite; allowed before any order) -> `PUT sessions/{id}/lines` -> `POST sessions/{id}/checkout` (needs `disclosureAccepted: true` and `disclosureVersion`; 409 `artwork_not_selected` if no favorite) -> `POST orders/confirm` -> `POST sessions/{id}/compositions` -> per-line mockups, corrections, `POST compositions/{id}/approve` -> `POST sessions/{id}/approve`.

Errors added or changed: `POST batches` no longer answers `order_payment_required`; `POST artwork` no longer answers `order_payment_required`; both answer `order_not_awaiting_artwork` only after approval. `POST checkout` answers `artwork_not_selected` (409). Codex's order-state validator still needs `needs_attention`.

## 5. Migrations (NOT applied by me: no database access; run the verify files before and after)

- `050_gift_previews_before_purchase.sql` (verify: `docs/GOVERNANCE/gift-050-preflight-and-verify.sql`): adds `gift_free_grants` and `gift_free_status`; REPLACES `gift_reserve_batch` (the old 5-argument overload is dropped; the 8-argument one has the same name and result columns) and `gift_select_artwork`. Reversible by re-running 048's definitions. The verify file also prints order, session and batch counts to compare before and after: 050 changes no order and no session row.
- `051_gift_session_rate_limit.sql` (verify: `docs/GOVERNANCE/gift-051-preflight-and-verify.sql`): adds `gift_session_attempts` and `gift_record_session_attempt`. Additive.
- The shared Supabase project serves Preview and Production; neither migration affects the Production app, which does not call these functions. Apply 050 and 051 BEFORE deploying this code (it calls the new functions).

## 6. Approved decisions and the contract

Limits (approved): 2 free batches per session; 2 per photograph across sessions; 6 per account per rolling 24 hours; 20 per account lifetime; further batches $2.99.

**Photo analysis rate limit (migration 051).** Every session-creation attempt is counted BEFORE the paid analysis runs, in a ledger with no link to sessions (deleting or recreating sessions cannot reset it) and atomically per account: 10 per hour and 30 per 24 hours per account, and 5 per 24 hours per account and photograph. Failed analyses (unsupported subject, outage) count; an invalid or oversized upload refused by validation does not. Over the limit: `429 { error: 'rate_limited' }` and no analysis is run. The numbers are `SESSION_ATTEMPTS` in `policy.ts` (function parameters, no migration needed to change them).

**Disclosure `2026-10-18-1`** (authoritative: `DISCLOSURE` in `lib/v1/gift/orders.ts`; the page must send this version): "Your first twelve personalized artwork previews are free, provided in two sets of six. Additional sets of six are available for $2.99.

Once you've chosen your favorite artwork, you can select and purchase the gifts you'd like us to create.

After payment, you'll review how your artwork looks on each purchased product and approve the final composition before production begins.

Nothing is printed or manufactured until you approve your gifts." Stale or missing versions are refused (`400 disclosure_version_required`, `409 disclosure_version_mismatch`) before any Stripe session is created or reused; sessions already recorded under older versions keep their records.

**Refund behavior that conflicts with the new sequence (reported; nothing changed):**
1. The refund policy text in `lib/v1/gift/refund.ts` and the Concierge message describe eligibility as "dissatisfied after reviewing their included previews". Previews now come BEFORE payment, so that trigger no longer describes the customer's situation.
2. The new disclosure no longer mentions refunds at all (the previous one did), so customers are not told one exists.
3. The implementation itself is unchanged and unconditional: a refund can be requested once an order is paid and until it is placed with the lab (`refund_not_available_after_manufacturing` afterwards); nothing ties it to previews.

**Contract for Codex:** see section 4 for entitlement and nextBatch; add: `POST /api/v1/gift/sessions` may answer `429 rate_limited`; checkout `disclosureVersion` must be `2026-10-18-1`.
