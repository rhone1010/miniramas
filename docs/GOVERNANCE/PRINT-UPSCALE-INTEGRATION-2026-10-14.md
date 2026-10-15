# Print upscale integration: prunaai/p-image-upscale — 2026-10-14

STATUS: implemented in the development workspace only. Not deployed. Migration 046 not applied anywhere.
The pipeline is OFF by default (see "The activation flag"): nothing starts until `PRINT_UPSCALE_PIPELINE_ENABLED` is true AND it is ready.
Nothing has called Replicate, Pruna, OpenAI, Prodigi or Stripe from this work. Real-ESRGAN is gone from the code.

## What changed

Payment no longer triggers picture preparation inside the Stripe request. When the pipeline is active, the webhook records the order and queues one
**job per order line**. A cron poller (`/api/v1/print/assets/poll`, every 2 minutes, `CRON_SECRET`) advances the jobs.
The Prodigi order is placed only when **every** job is `approved`.

```
Stripe webhook ─▶ markPaid ─▶ fulfilment gate (unchanged) ─▶ ACTIVATION GATE ─▶ enqueue jobs ─▶ 200 {queued}
                                                                   └─ off / not ready ─▶ order withheld, nothing started
poller ─▶ (gate) ─▶ job: prepare ─▶ submit ─▶ upscale ─▶ finish ─▶ inspect ─▶ approved
                                                                      └─▶ review (a person) ─▶ approved | rejected
poller / admin approval ─▶ completePrintOrder ─▶ (gate) ─▶ re-check refund, account, payment ─▶ prepareAndPlacePrint ─▶ Prodigi
```

| Concern | Where |
|---|---|
| Aspect correction, bleed, canvas wrap, exact final size (unchanged geometry) | `lib/v1/print/asset-pipeline.ts` (`prepareComposition`, `finishPrintAsset`), `geometry.ts` |
| Activation flag and readiness | `upscale/pipeline.ts` |
| Product-specific handling behind one interface | `upscale/profiles.ts` (only the flat-print profile exists) |
| Target megapixels, output validation, source-detail measure | `upscale/target.ts` |
| Remote settings: resolve, validate, snapshot hash | `upscale/settings.ts`, table `print_upscale_settings` |
| Replicate and Pruna direct adapters | `upscale/providers.ts` |
| Resumable job processor and crash handling | `upscale/process.ts`, `upscale/store.ts` |
| Deterministic file checks | `upscale/checks.ts` |
| OpenAI visual inspection | `upscale/qa.ts` |
| Order-level gating | `upscale/orders.ts`, `fulfillment.ts`, `complete.ts` |
| Concierge and notices | `upscale/runtime.ts` (`notifyAttention`) |
| Admin: settings and review queue | `app/api/admin/settings` (`print_upscale`), `app/api/admin/print-assets`, `app/admin/print-assets.tsx` |
| Calibration harness (20 images) | `upscale/calibration/` |
| Schema | `supabase/migrations/046_print_upscale_jobs.sql` |
| Prodigi Preview-live guard | `lib/v1/print/prodigi-client.ts` |

## Decisions applied
Queued processing outside the webhook; 300 PPI for every product initially; a source-detail shortfall is a warning that
sends the job to review (default floor 100 PPI of real detail, adjustable); existing admin auth; both providers built,
Replicate active; uncertain, defective or unavailable inspection goes to review; NB2.1 generation resolution unchanged.

## Rules the code enforces
- Settings are frozen into the job when it starts (`settings_snapshot`, `settings_hash`). A config change never reaches a running job.
- Inspection compares the enlargement with the **aspect-corrected** artwork (after any outpaint or reflection), and only the picture area (not canvas wrap).
- Automatic approval needs: file checks pass, inspection `pass`, no source-detail warning, no possible double charge, and `human_approval = flagged`.
  Inspection disabled, `human_approval = all`, or any doubt means review. An inspection outage is never a verdict.
- `prepareAndPlacePrint` refuses unless every job is approved, and re-reads each file and checks its SHA-256 against the job record before signing a URL.
- `completePrintOrder` re-checks the order is still waiting, the account is cleared and no refund is recorded; sandbox orders re-run the existing Stripe verification.
- The customer's artwork is never regenerated. Nothing here refunds, credits or contacts a customer.

## The activation flag

`PRINT_UPSCALE_PIPELINE_ENABLED` (server environment variable). Only the exact values `true` or `1` turn it on. Unset, empty, `false`, `0`, `yes`, a typo: **off**.

**Active = flag on AND ready.** Readiness (`upscale/pipeline.ts`, cached 30 s) requires: migration 046 applied (the global settings row, the jobs table and the lease function), `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, the selected provider's key (`REPLICATE_API_TOKEN`, or `PRUNA_API_KEY` for direct), `OPENAI_API_KEY` while inspection is enabled, and not "Preview with `PRODIGI_ENV=live`". If the flag is on but anything is missing, the pipeline is **not active**, fails closed, and says exactly what is missing. Switching the flag on early cannot half-start anything.

| Place | Flag off, or on but not ready | Active |
|---|---|---|
| Stripe webhook | Payment is recorded, the sandbox verification and the account-clearance gate run exactly as before, then the order is **withheld visibly**: `withheld` status, note `print_pipeline_disabled;source=...` (or `print_pipeline_not_ready:<reasons>;source=...`), and the existing studio and customer notices. No job is created. | Jobs are queued. |
| Poller `/api/v1/print/assets/poll` | Returns `{skipped:true, reason}` after the cron-secret check. Flag off: no database read, no job read or lease, no network call. | Advances jobs, places approved orders. |
| `completePrintOrder`, admin approval, retry route | Return or throw before reading or creating anything (`pipeline_disabled`, `pipeline_not_ready`, `print_pipeline_inactive`). | Run as described above. |
| Admin panel | Shows off, or "switched on, not ready" with the missing items. The flag is an environment setting; the panel cannot change it. | Shows active. |

**The flag only decides whether new automated work starts. It cannot loosen anything:** payment recording, sandbox verification, account clearance, the refund check and the Prodigi Preview-live guard all run exactly as before, after or around the gate.

### The trade-off (read before deploying anywhere)
The original synchronous fulfilment path (artwork prepared and the Prodigi order placed inside the Stripe webhook, using Real-ESRGAN) was replaced, not kept behind the flag, and was deliberately not reconstructed. So **flag off is not "behave like before"**. It is "do not start anything automatic": paid print orders are recorded and held visibly instead of fulfilled.
The benefit: the code cannot silently run the new pipeline before its migration and keys exist, and no paid order is lost or half-processed.
The cost: **deploying this code to an environment that currently auto-fulfils real orders, with the flag off, stops that fulfilment** until the pipeline is activated.
Preview is sandbox-only (the Prodigi Preview guard), so deploying there is safe. For Production, either activate in the same change window, or first confirm no live print orders are being taken, or do not deploy until a decision is made.

## Orders and jobs when the flag changes
- **Paid while off or not ready:** held (`withheld`, `print_pipeline_...`). On activation the poller re-checks the account and the refund record, then queues it once (enqueue is idempotent per order line). Placement then re-verifies payment and refund as for any order.
- **Held for any other reason** (account not cleared, no owner): never resumed by activation.
- **Switched off mid-flight:** the poller stops; leases expire; no job is lost or reset. Provider predictions already created keep their ids. On re-enable, jobs resume from their last saved step with no new submission.
- **Approved but not yet placed when switched off:** deferred; placed exactly once after re-enable. Prodigi's idempotency key (the Stripe session id) also prevents a duplicate order.
- **Already placed:** never touched in any flag state.
- **Retry route while off:** refuses without creating jobs (the order stays in its error state; retry again after activation).

## The paid-call crash window (provider call created, process dies before the id is saved)
No provider offers an idempotency key. Handling, in order: the attempt is recorded before the call; the id is saved the instant the call returns;
a resumed job asks the provider whether it already has a prediction for this job; failing that, one blind re-submission flagged `possible_duplicate`, then a person.
- **Replicate:** recovered by listing recent predictions and matching the job's unique input path. Residual risk: the provider's list lagging behind a new prediction. Mitigation: 60 s wait before concluding none exists. Unverified against the live API until the first run.
- **Pruna direct:** no list endpoint is documented, so no recovery. Residual risk: one extra upscale (at most $0.12), flagged and held for review.

## Not built, on purpose
Mugs and greeting cards. The seam is `profiles.ts`; the sandbox print areas are recorded in its header. Which part of a card sheet is the front, and how a mug wrap treats a square picture, are unverified product decisions. Those SKUs fail with `no_artwork_profile` and cannot reach a lab.

## Deployment and activation sequence
Each step needs your explicit go-ahead. Do Preview completely before Production.

1. **Deploy with the flag unset (off).** Preview only first. Effects: new print orders are held, the cron is inert, the admin panel reads "off". Nothing needs the migration yet. (Not on Production if it currently auto-fulfils: see the trade-off.)
2. **Apply migration 046** to the Supabase project (SQL editor, whole file, one transaction). Verify: `select scope, provider, target_ppi, output_quality from print_upscale_settings;` returns one `global` row (replicate, 300, 95); `select count(*) from print_asset_jobs;` returns 0; `select has_function_privilege('anon','lease_print_asset_job(uuid,integer,uuid)','execute');` returns false.
3. **Confirm environment** in Vercel for the target scope: `CRON_SECRET`, `REPLICATE_API_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set; for direct Pruna, create a Pruna key and set `PRUNA_API_KEY`, then change the provider in the admin panel. Confirm `PRODIGI_ENV` is `sandbox` on Preview (the guard also blocks live there).
4. **Run the calibration** (paid; about $2.64 expected, $3.30 worst case) and review it. Confirm Replicate accepts the signed-URL `image` input and what it charges.
5. **Set `PRINT_UPSCALE_PIPELINE_ENABLED=true`** for that scope and redeploy (Vercel applies environment changes to new deployments). Open the admin panel: it must read "active". If it reads "switched on, not ready", fix the listed items; nothing has started.
6. **Watch the first tick:** held orders are queued once; jobs move prepare, upscale, finish, inspect; the review queue fills only with jobs needing a person.
7. **One sandbox end-to-end order** (Stripe test mode, Prodigi sandbox) through queue, inspection, approval and placement. Optionally set `human_approval = all` in the panel so you approve every job at first.
8. **Production:** repeat 1 to 7 with its own approval, with `PRODIGI_ENV` set deliberately for Production.

## Rollback
| Situation | Action | Effect |
|---|---|---|
| Stop all new automatic work, fastest | Set the flag to `false` or remove it; redeploy. | New orders held; poller inert; in-flight jobs pause, nothing lost; re-enable resumes. |
| Hold every picture for a person, no redeploy | Admin panel: `human_approval = all`. | Applies to new jobs; running jobs keep the settings they started with. |
| Bad results from one provider | Admin panel: switch provider, or add a product override. | New jobs only. |
| Abandon a stuck order | Reject its job in the review queue, then refund in Stripe by hand, or place it by hand in the Prodigi dashboard from the saved print file. | Nothing is automatic; the saved files and the job record remain. |
| Roll the code back to the previous deployment | Redeploy the previous build. | The old code does not know about jobs: orders waiting in the new pipeline stay unplaced until handled by hand or the new code is restored. Migration 046 is additive and harmless to leave in place. |
| Remove migration 046 (last resort) | Only after a code rollback and after exporting `print_asset_jobs`: `drop table print_asset_jobs; drop table print_upscale_settings_history; drop table print_upscale_settings; drop function enqueue_print_asset_job(uuid,integer,text,text,text,text,text,integer), lease_print_asset_job(uuid,integer,uuid), review_print_asset_job(uuid,text,text,text), print_upscale_settings_audit();` | Destroys the job audit trail. Rarely needed. |
