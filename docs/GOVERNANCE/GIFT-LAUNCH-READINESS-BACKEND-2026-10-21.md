# Gift Wizard launch readiness, backend, 2026-10-21

## 1. Migrations 055 and 056 (target: dqctwzertbujhsjatfyv, read-only checks over the Data API)
| item | state on the target |
|---|---|
| 046 (upscale jobs, `print_asset_jobs`), 047, 048, 049, 052 (`repair_seq`, `gift_repair_claims`) | present: dependencies met |
| 055 `gift_composition_jobs`, `gift_claim_composition()` | **absent** |
| 056 `gift_sessions.final_approved_at`, `gift_finalize_order()`, `gift_release_order()` | **absent** |
| 053 `render_recovery_ledger`, 054 | not part of this launch path; not applied (053's table name was not probed) |
Data-integrity check for 056: no gift session has `approved_at` set (0), so nothing already released changes meaning; 4 orders sit at `awaiting_artwork`, 4 at `paid`, 17 `placed`, 9 `created`, 1 `error`. 055 only creates a table.

**NOT APPLIED. I cannot apply them**: the only credential available is the service-role key, which speaks the Data API (no DDL), and there is no database connection string or Management API token on this machine. The approved procedure in this repo is the Supabase SQL Editor (052 was applied that way). Steps:
1. SQL Editor on the target project: run `gift-composition-jobs-055-preflight-and-verify.sql` and `gift-056-preflight-and-verify.sql` (read-only): expect "not applied yet", no FAIL.
2. Paste and run `docs/GOVERNANCE/gift-launch-apply-055-056.sql` once (055 then 056, one transaction, idempotent; `lib/v1/gift/launch-bundle.test.ts` pins it to the two migrations and runs it on Postgres twice).
3. Re-run both verify files: expect nothing FAIL and nothing "not yet". Then tell CC; the HTTP checks below are repeated against the real database.

## 2. Final Approval: verified without the migrated database
Real handlers + memory store (mirrors 056; the SQL itself is run on real Postgres by `migration-056.test.ts`): not-approved lines -> 409; approve -> 200 `state approved, manufacturing not_released, releasedAt null`; five concurrent repeats -> one approval time; restore -> `approved`, `suggestedStep order`; corrections and compositions unchanged; correction after approval -> 409; fulfilment gates still refuse. Walk script `tools/gift-walk/w24.cjs`. **Not verified against the live database** (056 absent: the endpoint returns 503 `finalization_unavailable` there) and not in a real browser UI: after a reload the Wizard (as of this commit) still opens the per-line review with a disabled "Approve This Product" instead of an approved screen. That is Codex's UI to wire to `order.state === 'approved'`.

## 3. Product Selector compatibility (no backend change was needed)
Pinned by `product-selector-compat.test.ts`. The existing flat catalog (`GET /api/v1/print/catalog`) already carries `family`, `familyLabel`, `size`, `requirements.skuOrientation`, `status`, `selectable`, `attributes`, so each family appears once and orientation/size/finish are options inside it.
- Launch families: fine_art, premium, canvas, framed. Orientations: **square** (8x8, 12x12, 16x16, 20x20) and **portrait** (8x12, 12x18, 16x24, 20x30). **There is no landscape launch SKU** (only disabled framed_canvas 8x12 and cards): the selector must not offer landscape.
- Finish: one fixed value per family today (fine art EMA 200gsm, premium HPR 308gsm, canvas MirrorWrap, framed black).
- Approved scenes (exact): every fine art size (`fine-art-square`, `fine-art-portrait`), premium squares (`premium-square`), canvas squares. NOT available: premium portrait (opening 19.3% off), canvas portrait, all framed, and everything disabled. Product-preview returns `renderer: 'scene'` only for the first group.

## 4. Payment and release safeguards
- Server-side payment gate for unsupported configurations is `GIFT_REQUIRE_APPROVED_SCENE=1` (refuses at add-to-cart and at checkout, tested). **It is OFF by default, so today the backend alone does not stop a framed print, premium/canvas portrait reaching payment; only Codex's UI does.** I tried to make it default-on and the harness blocked the change as a feature-flag write; it needs the owner: set `GIFT_REQUIRE_APPROVED_SCENE=1` in the Preview/Production environment (or tell CC to change the default).
- Stripe Gift webhook: unchanged and compatible (`webhook-events.test.ts`, `webhook-conflict.test.ts` pass; finalization does not touch the order row the webhook confirms).
- Manufacturing needs the separate operator release (`scripts/gift-release-order.ts`); `enqueueOrderJobs` refuses `awaiting_artwork` orders, so no upscale or Prodigi job can exist before release (`complete.gift.test.ts`).
- Print-resolution preparation uses `prunaai/p-image-upscale` (`upscale/providers.ts`: Replicate route `models/prunaai/p-image-upscale/predictions`, or Pruna `p-image-upscale`), asserted in `upscale-core.test.ts`. Requires migration 046 (present) and the pipeline flag; nothing here calls Prodigi's order API; `giftDeps` only imports Prodigi's quote client for shipping at checkout.
