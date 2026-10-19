# Faces 2-9, Collection status, activation contract and retry safety (2026-10-18)

## What changed

1. **Faces 2-9 subjects** (`lib/v1/groups/groups-effects.ts`). Merged from the approved `groups-effects.next.ts`: only these differ from the deployed file, and nothing else was copied
   (7 hunks: the two doc comments, the error text, `case 2:` returning *"Arrange two equal portrait panels side by side in one centered row."*, and `MIN_FACES_SUBJECTS = 3 -> 2`).
   `groups-faces-two.test.ts` proves: 3-9 clauses are word for word as before; all 48 effect definitions hash the same as before; all 324 prompts that were reachable before (every effect, 3 formats, every
   Faces count 3-9) hash the same as before; two is accepted by all 10 Faces effects and carries the two-panel clause; 0, 1, 10, 18 and 20 are refused.
2. **Collection status** (`public/pets.html`, `discovery-consolidated-draft.html`, `groups.html`). One mapping, inside `loadPortfolio`: server item `done` -> finished; `failed` (or any unfinished item of a `failed`
   portfolio) -> "Didn't finish"; `rendering` -> "Crafting..."; `pending` and anything unrecognised -> **"Waiting to start..."** (queued). Before, every item that was not done or failed was drawn as "Crafting...",
   so a piece nobody had started looked like one being made, and a failed portfolio's unfinished items kept turning. Queued items are still counted as in flight, so the pages keep polling exactly as before.
   Pets still lists nothing for a portfolio that is not yet activated; Discovery and Groups still list its items (their paid-run polling depends on it) but now as waiting.
3. **`/portfolios/{id}/activate`**. No such route has ever existed: the Pets and Discovery pages POSTed to it for every `pending` portfolio on each load and got a 404 each time. The call, its function and its
   once-per-session flag are removed. **Activation is the Stripe webhook's alone** (`confirmPurchase`, then `activatePortfolio`, which is the authoritative mechanism). A route was NOT added: the same call would
   have started paid generation for every historical pending portfolio the next time anyone opened the Collection, which is exactly what must not happen automatically. A test fails if a live page calls a portfolio route that does not exist.
4. **Retry** (`lib/store/portfolio-render.ts`). Three defects, one cause each:
   * the retry call to `items/render` sent no `Authorization` and was refused 401 every time, silently. It now carries the internal secret and logs a refusal; without the secret the item stays `pending` for the cron poller;
   * every write to an item was by id alone, so a late failure could reset a **finished** item to `pending` (and render it again, billed), fail it, or a late success could overwrite it. Every write is now conditional on the
     invocation still holding the claim it made (status `rendering` and the same `rendering_started_at`); a write that matches nothing starts nothing; a finished or given-up item is never rendered from here;
   * the top-level failure handler used `.catch(...)` on a Supabase builder, which has none: it threw a TypeError from inside the handler, the caller then put the item back to `pending`, and a render that failed for a
     lasting reason was re-rendered again and again. It is a try/catch now.
   The claim in `items/render` and the poller (`pending -> rendering`, one winner) is unchanged and still prevents two renders of one item.

Nothing was regenerated, retried, activated, deleted or edited in any database. Existing records and artwork are untouched.

## Which existing failed items can be retried

I have no database access, so I cannot list them; run the read-only queries in `collection-recovery-readonly.sql` and apply these rules to each row. **None is retried by this change**: failed items are never selected by the
cron poller or by dispatch, and nothing here changes a row.

Safe to retry (a person re-queues it on purpose):
* `status = 'failed'`, `preview_id` is null (no artwork exists, so nothing is duplicated), and the portfolio is paid (`delivery = 'purchased'`, or an activated preview bundle), not `pending`;
* the recorded `error` is a transient one: `generate_failed`, `locked_preview_failed`, `locked_preview_upload_failed`, `ledger_write_failed`, `render_failed`, `unhandled_error` after a timeout.

Do **not** retry: any item that has a `preview_id` (it already has artwork: retrying makes a second generation); `age_restricted`, `unknown_groups_effect`, `unknown_pets_effect` (retrying cannot succeed or must not); any item of a portfolio
that is `pending` (not paid or not activated); a portfolio whose purchase is refunded.

## Paid portfolios stuck at `pending`

The webhook never reached them (on Preview the webhook is answered by Vercel's sign-in page). The second query lists purchases that are paid with a portfolio still `pending`. Activating one starts paid generation, so it is a decision:
approve the specific ids, then activate each through the same functions the webhook uses (a script or a deliberate route), never from a page load.

---

# Automatic recovery of transient render failures (2026-10-19)

Status: BUILT AND TESTED, DEPLOYED OFF. Migration 053 is NOT applied; the sweep is disabled until `RENDER_RECOVERY_ENABLED=1`. Nothing existing is touched.

## The rules (enforced in ONE database transaction: `claim_render_recovery`, migration 053)
| Rule | How |
|---|---|
| one recovery cycle | `recovery_count` 0 -> 1; the item goes back to `pending` with `attempts` 0 (a fresh cycle of the normal retries); a second failure is final |
| two-hour backoff | from `failed_at`, which the render code now records when an item fails for good |
| historical failures never recovered | a failure with no `failed_at` (every failure before this shipped) is refused (`no_failure_time`); a test applies the migration to a table that already holds failures |
| paid, activated, non-refunded | `portfolios.purchase_id` points to a purchase whose status is `paid`; the portfolio is `generating` or `ready` (not `pending`, not `failed`) |
| no artwork | `preview_id` is null, so nothing can be duplicated |
| transient only | allow-list `generate_failed`, `locked_preview_failed`, `locked_preview_upload_failed`, `ledger_write_failed`, `unhandled_error` plus provider-condition messages (timeout, rate limit, 429/502/503/504 as whole words, fetch failed, ECONN...). `age_restricted`, `unknown_*_effect`, safety refusals and every unrecognised error are permanent |
| atomic claim | advisory lock + `for update` on the item: two ticks, two servers, or an operator and the cron cannot both claim; the loser sees `not_failed` |
| $5 a day | each recovery reserves its WORST-CASE cost ((3 retries + 1) x `RENDER_RECOVERY_COST_USD`) in `render_recovery_ledger` before anything is generated; the UTC day may not pass $5 (`RENDER_RECOVERY_DAILY_CEILING_USD` may only lower it); no cost configured = nothing is claimed |

A claimed item is `pending` in a `generating` portfolio (a `ready` one is moved back), so the ordinary scan of the Production cron poller (`render-poll`, every two minutes) renders it, through the existing claim, retry and idempotency safeguards.
When it finishes the portfolio flips back to `ready` as always.

## Where it runs
* **Production cron:** `render-poll` calls `recoverFailedRenders` (limit 2 claims per tick) before its normal scan. Off unless `RENDER_RECOVERY_ENABLED=1`; a failing sweep never stops the tick.
* **Preview (no cron):** `scripts/recover-failed-renders.ts`, operator-only: named `--item` ids only (max 5, no "all"), dry run by default, `--execute --base-url https://<preview>.vercel.app` claims through the SAME database function (so the same limits, and the same ledger) and asks that deployment to render.

## What a customer is told (failed-tile wording)
The status route now reports `recovery` per piece: `scheduled` (a transient failure with no artwork, recovery on and funded), `in_progress` (the automatic try is under way) or null. The tile says:
* scheduled: "We'll try this piece again automatically."
* in progress: "Trying again..."
* otherwise (permanent failure, recovery used up, recovery off, migration not applied): "We couldn't finish this piece. Please contact us."
The old "This piece will be remade" is gone. The raw error never leaves the server.

## Migration and enablement (needs your approval; nothing below has been done)
1. Run `docs/GOVERNANCE/render-recovery-053-preflight-and-verify.sql` (expect no FAIL, "not applied yet").
2. Apply `supabase/migrations/053_render_recovery.sql` in the SQL Editor, then run the verify file again (every row PASS; "no earlier failure" and "every existing row" must be 0).
3. Set on the deployment that should recover: `RENDER_RECOVERY_COST_USD=<cost of one render in USD>` and `RENDER_RECOVERY_ENABLED=1` (Production cron only; Preview has no cron). Optionally `RENDER_RECOVERY_DAILY_CEILING_USD` to lower the $5.
4. Until step 3 nothing recovers. The code is safe before step 2: the failure write falls back when `failed_at` does not exist, the status route's extra read simply fails, and the sweep is off.
Existing failures stay failed forever (no failure time). To recover one on purpose, re-queue it by hand (the SQL in `collection-recovery-readonly.sql` lists the candidates); the operator script only recovers items that failed after the migration.

## RENDER_RECOVERY_COST_USD = 0.31 (2026-10-19)

No invoice or billing record is available to this codebase, so the figure is the application's own cost model, the worst case per render attempt (one call of `renderOnePortfolioItem` = one `/generate` call):

| Stage | Price (¢) | Source |
|---|---|---|
| NB2 image generation, per attempt | 5 | `COST_CENTS.nb2_generation` (`lib/bench/bench-shared.ts`) and `QA_COST.nb2` (`app/api/v1/portraits/generate/route.ts`) |
| likeness/fidelity score, per attempt | 1 | `COST_CENTS.gpt4o_mini_score` |
| subject classify + intake gates, detection, aesthetic score (once each) | 1 each | `QA_COST.gate`; the portraits route charges gates for classify, intake and aesthetic, plus detection |
| Stability outpaint (Realistic/Resolving, Groups when it expands) | 4 | `COST_CENTS.stability_outpaint` |
| gpt-image refine / face swap | 8 / 1 | both OFF in the current pipeline config; not counted |

Internal attempts inside one generate call: Portraits 2 (`MAX_ATTEMPTS`), Pets 2, **Groups 4** (`MAX_ATTEMPTS_GROUPS`).

* Portraits / Pets: 3 gates/detection (classify, intake, detection) 3 + 2 x (5 + 1) = 12 + aesthetic 1 + outpaint 4 = **20¢** (28¢ if the refine pass were switched on).
* Groups: detection 1 + 4 x (5 + 1) = 24 + classify/intake 2 + aesthetic 1 + outpaint 4 = **31¢**.
* Worst case over the three: **$0.31 per render attempt**, so `RENDER_RECOVERY_COST_USD=0.31`.

The sweep reserves a whole cycle up front: (3 retries + the first render) = 4 attempts x $0.31 = **$1.24 per recovery**. With the $5 daily ceiling that is 4 recoveries a day (4 x $1.24 = $4.96; the fifth is refused until the next UTC day).
This overstates the usual cost (most transient failures stop at the first stage and never reach four full attempts), which is the point of a ceiling.
The model states it is accurate to about 20%; before relying on the number, run `render-cost-measure-readonly.sql` (qa_log's recorded cost per request: average, 95th percentile and maximum per series) and compare a few days with the provider invoices. If the measured maximum for Groups is below 31¢ the figure can be lowered; if above, raised. NOT set anywhere: recovery stays off.
