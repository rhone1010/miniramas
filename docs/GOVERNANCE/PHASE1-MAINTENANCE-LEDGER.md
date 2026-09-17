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

## M2 · Duplicate unlock sessions — PARKED PAYMENT HARDENING

Six checkout sessions were created for two intended unlocks on 2026-09-17,
and **two were carried to payment for the same piece** — $5.98 charged where
$2.99 was intended. `UNLOCK_INFLIGHT` guards the unlock *call* but nothing
guards *checkout creation*, and the Feature Image and Gallery Image buttons
each open their own session.

Ruled 2026-09-17: **PARKED PAYMENT HARDENING only.** It did not reproduce on
the passing 8-pick run — each unlock created exactly one session — but
nothing in that path was changed, so not-reproducing is not fixed. Parked,
not closed, and not a Section A blocker.

---

## A3 / A4 — RUNTIME ACCEPTANCE PASS, 2026-09-17

Accepted by Rich from the clean Collection baseline that followed the
database purge and commit `2ae2f73`. An **8-pick purchase — not a 4-pack**
(the 4-pack at `9f26ce5f…` in M1 above is the earlier, pre-purge run whose
A4 leg failed). Purchased and generated,
then **the corrected A4 flow proved twice consecutively**: included unlock,
then two separate $2.99 unlocks, each launching Stripe, completing payment,
closing the modal and delivering the clean image **automatically — no console
work, no manual intervention, no refresh**.

```
A3 INCLUDED UNLOCK      = PASS
A4 PAYMENT LAUNCH       = PASS
A4 PAYMENT              = PASS
A4 POST-PAYMENT UNLOCK  = PASS     (previously FAIL)
A4 CLEAN DELIVERY       = PASS     (x2)
```

### Human runtime evidence, as reported by Rich

- 8 picks purchased and generated
- collection landed successfully
- included unlock succeeded
- first $2.99 unlock succeeded end-to-end
- second $2.99 unlock succeeded end-to-end

**A4 is PASS and CLOSED.** The passing flow is not to be investigated further.

### Runtime evidence — Preview `miniramas-1aidba6x6`, portfolio `e2813285-c534-46dd-b881-d809f6c9a31d`

```
16:35:47  [portraits/unlock] delivered preview=bfd1c9d4… ent=5d2d83ba…      included, free
16:35:51  POST /portraits/unlock, no delivery                                correct: included spent
16:35:53  [discovery-unlock] session cs_test_a1O62ovf… purchase=c869d13b…
            preview=14f196e8… slot=1 299c
16:35:59  [discovery-unlock] ACTIVATE ok ent=1441549a… preview=14f196e8…
          [unlock-confirm]  session=cs_test_a1O62ovf… activated=true
16:36:01  [portraits/unlock] paid additional unlock preview=14f196e8… ent=1441549a…
          [portraits/unlock] delivered              preview=14f196e8…
16:36:07  POST /portraits/unlock, no delivery                                correct: slot 3 unpaid
16:36:09  [discovery-unlock] session cs_test_a1f2HlfG… purchase=64f8149b…
            preview=75053b63… slot=3 299c
16:36:16  [discovery-unlock] ACTIVATE ok ent=21aa4b34… preview=75053b63…
          [unlock-confirm]  session=cs_test_a1f2HlfG… activated=true
16:36:17  [portraits/unlock] paid additional unlock preview=75053b63… ent=21aa4b34…
          [portraits/unlock] delivered              preview=75053b63…
```

Eight seconds from checkout to clean image, both times. The joint that had
failed every prior attempt — `unlock-confirm` reaching a deployment that
carries `activateDiscoveryUnlock` — is the one that now holds.

### What this run does NOT prove

- **The 8-pack purchase and the crafting→landed UI transition were not
  observed by CC.** The log watcher was armed late (two earlier attempts
  failed silently: `vercel logs` is not a live stream in this CLI, and it
  writes to stderr). Steps 1-6 rest on Rich's runtime observation alone.
- **M2 did not reproduce, and that is not a fix.** Each unlock created
  exactly one session. Nothing was changed in that path; a single clean run
  does not retire the finding. M2 stays OPEN.

---

## A2 — CLOSED, 2026-09-17. The 1/4/8/16 ladder is complete.

Matrix A2 requires "Real 1 / 4 / 8 / 16 end-to-end tests". All four sizes are
now done on the fixed build:

| size | price | included | delivery | result |
|---|---|---|---|---|
| 1  | $2.99  | 0 | purchased | **PASS** — born unlocked, clean image delivered |
| 4  | $4.99  | 1 | preview   | **PASS** |
| 8  | $7.99  | 1 | preview   | **PASS** — the A3/A4 acceptance run above |
| 16 | $12.99 | 2 | preview   | **PASS** |

Ladder read from `lib/store/portfolio-checkout.ts:59-62`.

**Rich's runtime evidence for 1 + 16, run CONCURRENTLY:** most images landed
within ~15 seconds, all under 30. Included unlocks worked. Clean,
un-watermarked delivery worked. The $2.99 paid unlock succeeded.

### What the 16-run retired, and what it did not

CC flagged before the run that `dispatch/route.ts:108-127` fans out with
`Promise.allSettled` over every pending item and **no concurrency cap** — 16
simultaneous `items/render` POSTs under a 300s ceiling, where the comparable
wallpapers route caps at 3. The predicted failure was orphaned children
recovered only by cron at `MAX_ITEMS_PER_TICK = 3` every two minutes, i.e.
~12 minutes for 16 items.

**It did not happen.** Sixteen items, concurrent with a separate size-1 run,
all landed under 30 seconds. The concern is retired **as observed**, not as
fixed: nothing in that path changed, the cap still does not exist, and matrix
**E4** makes render concurrency a Rich-approval item. Recorded so the next
person to read `dispatch` finds the evidence rather than re-deriving the
worry.

---

## Standing Phase 0 parking lot

Unchanged and still parked: `_recovery` phantom gitlinks and the two stale
test copies they add to the suite, the `portfolio-render` retry
`Authorization`, `flip_18` dead data, the unused gear PNG, dormant Pose, the
duplicate `buildCheckoutPayload`, `additionalAvailable`, the stale unlock
comment, untracked working files, and the untested webhook/dispatch/cron
paths. Plus Phase 0 **B3**: Start over still 400s (`'clear'` is not a valid
action), visible during acceptance testing and not a new regression.
