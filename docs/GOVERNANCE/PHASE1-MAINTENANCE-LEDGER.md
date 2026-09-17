# Phase 1 maintenance ledger

Durable record of work that is **parked, not done**. Written so the
identifiers survive context compaction and a later session can act without
re-deriving them.

Opened 2026-09-17 by Rich's ruling. Branch `feat/discovery-curator-pass2`.

---

## M1 · Collection purge — PARKED, PRE-A6

**Status: report accepted, execution NOT authorized. No deletion has been
performed and none is approved.**

Rich's ruling, 2026-09-17: Collection cleanup is no longer blocking Phase 1 or
A4. It becomes a controlled data-maintenance task to be run *before* A6.

### KEEP — do not delete, reconcile or mutate

These are Phase 0/1 evidence. Deleting any of them destroys the ability to
verify work already accepted.

| Keep | Portfolio id | Why |
|---|---|---|
| 1 | `9f26ce5f-b87b-4c23-ab0e-9e5e795df73e` | Today's 4-pack. A2/A3 acceptance run, 2026-09-17 19:34:05Z |
| 2 | `6d57664c-8c71-4101-bf2e-c90edea0b9d3` | Render-timing evidence. Cited by name in `RENDER-TIMING-EVIDENCE-2026-09-16.md` (23:11Z fast path, 21 152 ms) |
| 3 | `67dbd54e-c18e-445c-a868-f98b1fbb46cd` | Phase 0 stranded-run evidence (22:33Z, dispatch 401, 3+1 recovery) |

**Keep 4 — all six A4 unlock purchases**, both paid duplicates and the four
unpaid. These rows *are* the A4 failure evidence: they prove the entitlement
was minted bound and never flipped.

| Purchase id | Preview | Slot | Stripe session | Paid |
|---|---|---|---|---|
| `d0be7f75-d598-4acd-a377-577237197e09` | `2291acca-72de-44d4-a4a7-e91e0a4ced71` | 3 | `cs_test_a18dbt5bux…` | no |
| `92451f16-d0af-4ac0-8c2b-715fc83bb967` | `2291acca-72de-44d4-a4a7-e91e0a4ced71` | 3 | `cs_test_a1pvlIAaAS…` | **PAID $2.99** |
| `bd5d0b10-c20c-49a7-be35-c79c5016b8ae` | `2291acca-72de-44d4-a4a7-e91e0a4ced71` | 3 | `cs_test_a1DIQi9sYL…` | no |
| `eb90961b-eb73-435b-b35e-1934921f3233` | `2291acca-72de-44d4-a4a7-e91e0a4ced71` | 3 | `cs_test_a1D2i8iNNa…` | no |
| `ddceb621-e277-465e-9b88-6919bb9ce16e` | `2291acca-72de-44d4-a4a7-e91e0a4ced71` | 3 | `cs_test_a10QZdkbzu…` | **PAID $2.99** |
| `84394ad0-d400-45bc-8cd8-a13ef346cfeb` | `06370cb7-63b0-4d96-ad2b-c0d26556e8f1` | 1 | `cs_test_a12Oqkwo…` | no |

Previews known unlocked during that session (A3 PASS and one further):
`eb6a228d-92ae-4617-af15-f6c48ee40b20` (entitlement `25643dea-…`),
`fe6885f6-5562-4a8f-9637-8bfc610e22f1` (entitlement `d69e1376-…`).

### PURGE CANDIDATES — not authorized

The other **27** portfolios observed in Rich's own `/status` polls over a
6-hour window on 2026-09-17. 30 distinct ids were seen; the three Keep rows
above are excluded. 30 is a **lower bound** — only portfolios polled in that
window. The full 30-id list is in the session transcript; it must be
re-derived and verified against `user_id` before any deletion.

### Deletion order (from code; FK behaviour UNVERIFIED)

1. storage `previews/{series}/{previewId}.png` — clean masters
2. storage `previews/locked/{series}/{previewId}.jpg` — locked derivatives
3. storage `previews/watermarked/{series}/{previewId}.png` — retired bake
4. `preview_ledger` — **keyed by `email = 'portfolio:{portfolioId}:{slot}'`, NOT by user_id**
5. `entitlements` — by `purchase_id`
6. `portfolio_items` — by `portfolio_id`
7. `portfolios`
8. `purchases`
9. `discovery_sessions` — owner column unknown

**The `preview_ledger` key is the trap.** `portfolio-render.ts:184` writes the
synthetic `portfolio:{id}:{slot}` string into `email` and `ip_hash`. A purge
filtering that table by `user_id` deletes nothing and orphans every storage
object.

### MUST NOT be touched

`skus` · `collection_pieces` (a different product path — Portraits/Pets/
Groups/Halloween live there) · `credit_balances` · `credit_ledger` ·
`access_codes` · `code_redemptions` · `generation_grants` · `refund_log` ·
`craft_events` · `qa_log` · `events` · `auth.users` · `foyer_reveals`
(migration 032 — standing instruction: do not re-apply).

Stripe test-mode objects stay as historical payment records.

### Required before any future purge — all eight, per Rich

1. Live-schema FK / `ON DELETE` inspection for `portfolios`,
   `portfolio_items`, `discovery_sessions` — **none has a `CREATE TABLE` in
   this repo**, only ALTERs (028/029/030)
2. Positive `user_id` ownership verification for every candidate portfolio
3. `discovery_sessions` ownership/schema identification
4. Exact candidate row counts
5. Exact storage-object inventory
6. Confirmation no `collection_pieces` or other non-Discovery data is included
7. Snapshot/backup plan
8. Final explicit approval from Rich

### Rollback limitation

**There is no undo.** No soft-delete, no archive table, no snapshot step
exists in this codebase. The clean master is the only copy of purchased
artwork and cannot be re-rendered identically — NB2 is stochastic. Preview and
Production share this database; there is no test-data partition.

---

## M2 · Duplicate unlock sessions — OPEN, awaiting ruling

Six checkout sessions were created for two intended unlocks on 2026-09-17,
and **two were carried to payment for the same piece** — $5.98 charged where
$2.99 was intended. `UNLOCK_INFLIGHT` guards the unlock *call* but nothing
guards *checkout creation*, and the Feature Image and Gallery Image buttons
each open their own session.

Not yet ruled on. Recorded so it is not lost.

---

## Standing Phase 0 parking lot

Unchanged and still parked: `_recovery` phantom gitlinks and the two stale
test copies they add to the suite, the `portfolio-render` retry
`Authorization`, `flip_18` dead data, the unused gear PNG, dormant Pose, the
duplicate `buildCheckoutPayload`, `additionalAvailable`, the stale unlock
comment, untracked working files, and the untested webhook/dispatch/cron
paths. Plus Phase 0 **B3**: Start over still 400s (`'clear'` is not a valid
action), visible during acceptance testing and not a new regression.
