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

---

# Launch closeout swarm — findings, 2026-09-17

Six parallel audits run at Rich's direction after A4 closed. Everything below
is recorded because it existed only in a conversation that had already
compacted once. Nothing here changed product code.

Naming collision, stated once so it does not mislead: the **B1-B4** below are
this swarm's tester-readiness blockers. They are NOT the matrix's Section B
(Format / Mobile 9:16), and this swarm's B3 is unrelated to Phase 0's B3
("Start over" 400s), which appears here as a should-fix in its own right.

## B1-B4 — blockers to external testing

**B1 · Vercel SSO — testers cannot load the page at all.** Preview 302s to
`vercel.com/sso-api`. The only in-repo trace is `lib/store/internal-fetch.ts:75-76`
sending `x-vercel-protection-bypass`; the protection itself is dashboard-side.
Nothing else on this list matters until a tester can reach a page.

**B2 · A signed-out visitor sees 28 fabricated demo pieces.** The nav handler
calls `openMyCollection()` with no auth guard (`discovery-consolidated-draft.html:7027-7029`),
and `openMyCollection` paints unconditionally (`:6921-6929`). But
`renderCollection()` — and therefore `reconcileCollection` — runs only under
`if (ME)` (`:5506`). So `PIECES` is still the parse-time demo seed
(`:6812-6832`): "Renaissance Noble", a permanent "Crafting…" tile (`demo27`),
and 28 "Unlock · $2.99" buttons that do nothing (`unlockPiece` early-returns
with no `previewId`, `:7315-7319`).

**This is the blind spot in the reconciliation fix of `2ae2f73`, not a
pre-existing quirk that fix left alone.** That commit made the collection
reconcile against the server; it did not make an unauthenticated visitor
reach the server at all.

**B3 · The Foyer has no entry path until a photo is chosen.** `public/foyer.html:415`
ships `#go` as `inert` and invisible; `showGo()` fires only post-photo
(`:592, 879, 991, 1018`). No nav, no masthead route, no skip link. A tester
unwilling to upload on the landing page has no keyboard-reachable way in.

**B4 · Portfolio checkout is not idempotent.** `resetCraftBtn` re-enables
`#btnCraft` the moment the Stripe modal mounts (`:6355`); `closeCheckout`
(`:6209-6215`) cancels nothing server-side; `lib/store/portfolio-checkout.ts`
has no reuse-before-create. Abandon and re-click mints a second portfolio and
a second Stripe session — the same fault already fixed for unlocks
(`lib/store/discovery-unlock.ts:198-223`) and never ported to the pack path.

## D1-D4 — commerce audit

Verified safe, so they are not re-derived later: the 1/4/8/16 price ladder is
a server constant and `clientPriceUsd` is compared but never used, with
`Number(undefined)` failing closed (`portfolio-checkout.ts:56-63, 229-233`);
included unlocks are minted server-side exactly once and survive webhook
replay (`:312, 352-361`); the $2.99 price is cross-checked against Stripe and
the entitlement is bound to (user, purchase, previewId), which is *narrower*
than included-unlock scope, not wider (`discovery-unlock.ts:180-196, 263-272`);
an already-unlocked piece cannot be charged again.

**D1 · Redirect payment methods return to a dead URL. HIGH.**
`unlock-checkout/route.ts:55-58` sets `return_url` to a bare `origin+pathname`
with **no `?paid=1&session_id=`** — unlike the portfolio path
(`portfolio-checkout.ts:249`). With `redirect_on_completion:'if_required'`
(`discovery-unlock.ts:229`) a redirect method leaves the page, so
`onComplete` never fires and `finishUnlockPayment` never runs. The customer
returns with no query string, the return handler bails
(`discovery-consolidated-draft.html:5739`), and `unlock-confirm` is never
called. On a branch deployment the webhook cannot finish it either.

**Customer consequence: pays $2.99 by a redirect method and the image never
unlocks — the exact 2026-09-17 failure, reached through the one door the
mitigation does not cover.** The stale comment at `:5732` still claims the
unlock "returns here on ?paid=1"; it no longer does. Whether it is live
depends on which methods are enabled — dashboard-side, not in the repo.

**D2 · Concurrent clicks yield the clean original for free. MEDIUM.**
Two simultaneous requests on a locked preview with no entitlement: A wins the
claim (`portraits/unlock/route.ts:89-95`), finds nothing to spend, and
releases (`:217`); B loses the claim and takes the redelivery branch
(`:97-109`), which checks ownership only and returns `image_b64`. B receives
the unwatermarked file having paid nothing. Needs two tabs or clients —
`UNLOCK_INFLIGHT` guards a single page.

**D3 · A double payment has no unwind. MEDIUM.** No refund code exists
anywhere (`grep stripe.refunds` → none) and no alert fires. If the parked M2
race ever lets two sessions be paid, the customer is charged $5.98, receives
one image, and $2.99 strands indefinitely with nothing detecting it. This is
M2's residue, not its trigger.

**D4 · The shared database cannot express Stripe mode. MEDIUM.** `skus` has
one `stripe_price_id` (`003:20`, `012:37`) and there is no `livemode` column
anywhere. With Preview on the Production-linked database, either Preview
transacts in Production's mode or the shared rows hold test ids and
Production checkout breaks. Blast radius is bookkeeping and reconciliation —
Stripe's key isolation prevents cross-mode fund movement. One query settles
it.

## A5 — bypass removal, prepared not executed

Both guards are `VERCEL_ENV === 'preview'` in `lib/v1/foyer/foyer-preview-bypass.ts`
(L40 `previewAllowanceBypass`, L45 `previewIntakeCapBypass`). No request input
can set it.

- **Reveal allowance** — `app/api/v1/foyer/reveal/route.ts:45-46, 58-59, 87-101`.
  Added 34f6486. **Already on main.**
- **Intake per-IP cap** — `app/api/v1/foyer/intake/route.ts:31, 53-61`. Added
  13bae2c. Branch-only.

**Trap, found before it cost a merge:** do NOT `git revert 34f6486` on the
reveal route — `git apply --reverse` conflicts, because a93ad6a and b7e6baf
later added `nb2_ms/mark_ms/total_ms` timing logs on top. It needs a hand
edit: drop L45-46, L58-59, L87-93 and L101, unindent the `claimReveal` block,
replace `claimId` with `claim.id` at L113/L119.

**Test landmines:** `lib/store/tests/foyer-preview-bypass.test.ts` L104-114,
L119-141 and L143-165 pass *only because* the bypass exists; the file's own
header says to delete it with the bypass. Separately, `foyer-reveal.test.ts`
never unsets `VERCEL_ENV` (L63), so it silently depends on CI not being a
Preview build — removal fixes that.

**Post-removal behaviour, cited:** reveal → `claim_foyer_reveal`,
`REVEALS_PER_WINDOW = 3` (`foyer-policy.ts:24`), exhausted 429, error 503
fail-closed. Intake → `claimIntake`, `INTAKES_PER_WINDOW = 20`
(`foyer-policy.ts:36`), capped 429.

**The scheduling consequence, stated plainly:** removal re-imposes 3 reveals
and 20 intakes per IP per 24h on Preview, against an allowance database
shared with production. That is survivable for Rich and hostile to a group of
weekend testers behind one IP. A5 removal and "where do testers actually go"
are one decision, not two.

**The marker did not work.** `REMOVE BEFORE PR #178 MERGE` appears in five
places across the module, both routes and the test file. **#178 merged
2026-09-13.** An in-code comment is not a control; the intake-cap bypass
carries the same marker and would ship the same way.

## BrowserStack matrix

**Breakpoints, read from the CSS rather than assumed.** min-width: 1330 (:54)
· 1660 (:62) · 1920 (:69) · 2000 (:84) · 2400 (:87) · 2560 (:90). max-width:
1659 (:1097, :1127) · 1279 (:1178, :1213) · 1100 (:1187) · 1024 (:1222, :1349
`__A1_MYCOLL_COLS__`) · 767 (:1300, :1390, :1737 `.ck-*`) · 400 (:1354) · 359
(:2002). Desktop-only max-height: 820, 840, 960.

**Boundary pairs to test:** 1920 · 1660/1659 · 1330/1329 · 1280/1279 ·
1101/1100 · 1025/1024 · 768/767 · 401/400 · 390 · 360/359, plus one short
desktop (1366x768) for the max-height rules.

| P | Device | Width | Why |
|---|---|---|---|
| P0 | iPhone 15 Pro, iOS 17 Safari | 393 | Stripe iframe, safe-area, `.ck-*` phone block |
| P0 | Galaxy S23, Chrome | 360 | crosses the 359 rule |
| P0 | Win11 Chrome 1366x768 | 1366 | the 1330-1659 region + short-height rules |
| P0 | Win11 Chrome 1280 / 1279 | — | tablet-landscape floor |
| P1 | iPad Pro 12.9 portrait | 1024 | exact bottom-sheet boundary |
| P1 | iPad 10.2 portrait | 768 | sheet-vs-phone flip |
| P1 | macOS Safari | 1920 | 4-column grid |

**Mechanical:** `scrollWidth <= innerWidth` per stage (the `__A1_REVIEW_OVERFLOW__`
class of bug) · `#mycollGrid` columns match `--grid-cols` · `.btn-create.on`
single-line at 1366 · `.ck-card` inside viewport · tap targets >= 44px.
**Rich's eyes:** Garamond sizing under the <=1659 sans swap, image fidelity,
bottom-sheet brand feel, crafting animation.

**A real iOS defect.** The viewport meta at `:7` is
`width=device-width,initial-scale=1` — **no `viewport-fit=cover`** — while the
stylesheet uses `env(safe-area-inset-*)` eleven times. Every safe-area
allowance is currently inert on iPhone. One line.

**What Stripe test cards do not prove:** the modal mounts and `onComplete`
fires, and nothing more. Not webhook activation, not the self-confirm poll
path, not real 3DS or Apple Pay sheets. Treat payment on BrowserStack as a UI
test.

## Tester readiness — should fix, not blocking

"Start over" fails 100% of the time: `action:'clear'` is not in
`VALID_ACTIONS` (`discovery/sessions/[sessionId]/select/route.ts:10,29`), so
it falls through to `toggle` with an empty `effectId` and 400s. Not a hard
dead end — picks can be removed one by one — but every attempt shows "That
did not go through" after a confirm dialog.

Paid, then silence: `verifyPurchasePaid` gives up after 4 x 2500ms and only
`console.warn`s, with the modal already closed. A tester who pays during a
slow webhook is returned to the Aspect screen with no message — and is likely
to pay again, which compounds B4.

A failed render shows as "Crafting…" forever: `crafting: i.status !== 'done'`
maps server status `failed` to an indefinite crafting tile, and polling stops
after 60 x 3s with no message.

**COPY LAW breaches in customer-visible strings:** "Create your collection"
and "A single effect **renders** directly" (`:5176-5177`), "before anything is
created" (`:5170`), "Creating your collection…" (`:7452`), and the effect
label **"Petal Sculpture"** is live in The Living World (`effect-registry.js:236`,
`lib/v1/portraits/effect-registry.ts:119`). Banned verbs and banned
"sculpture" reach the tester on the two screens they are asked to narrate.

## Four corrections

Recorded because a wrong alarm costs as much as a missed one, and because
each of these was stated to Rich with more confidence than it deserved.

1. **The `preview_ledger.ip_hash` alarm was wrong.** CC called it "potentially
   the single biggest weekend blocker". `checkPreviewAllowed` is imported at
   `portraits/generate/route.ts:32` and **never invoked** — closed 2026-09-10.
   Discovery writes synthetic keys. Shared-IP testers were never blocked by it.
2. **The `client_secret` hypothesis for M2 was wrong.** Stripe documents
   `client_secret` as a plain nullable attribute with no presence caveat,
   unlike `url`. The guard at `discovery-unlock.ts:107` is not the bug; the
   residual is the read-then-write race already acknowledged at `:210-215`.
3. **The size-16 fan-out warning was wrong.** Uncapped `Promise.allSettled`
   was predicted to orphan children and need ~12 minutes of cron recovery.
   Sixteen items landed in under thirty seconds, concurrent with a size-1 run.
4. **The reconciliation fix does not cover signed-out visitors.** See B2. That
   is a gap in `2ae2f73`, not a pre-existing quirk it declined to fix.
