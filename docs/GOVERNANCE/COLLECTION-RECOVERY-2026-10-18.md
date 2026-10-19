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
