# LITEN & CO — EXISTING ADMIN BASELINE
**Date:** 2026-09-18 · **Lane:** `H:\LitenCo_Admin` (worktree of `D:\minramas`) · **Branch:** `admin/control-panel` · **HEAD:** `4743bb2`

Evidence base for Admin development, per Rich's ruling 2026-09-18. Read-only inspection: no file changed, no route invoked, no dev server, no production write.

Every headline claim below was verified first-hand against the repo. One subagent claim was found wrong and is corrected in §D.

---

## A · WHAT EXISTS TODAY

Single-operator control panel at `/admin`, built 2026-08-08 (commit `1dd10a1`), untouched since. 13 files, 1,731 lines. Seven tabs behind a single-password HMAC cookie, with a day-range selector of Today / 7 / 30 / All.

| File | Lines |
|---|---|
| `app/admin/page.tsx` | 31 |
| `app/admin/panel.tsx` | 954 |
| `app/admin/login/page.tsx` | 180 |
| `app/api/admin/auth/check/route.ts` | 14 |
| `app/api/admin/auth/login/route.ts` | 27 |
| `app/api/admin/auth/logout/route.ts` | 10 |
| `app/api/admin/incidents/[id]/route.ts` | 98 |
| `app/api/admin/rejection-patterns/route.ts` | 53 |
| `app/api/admin/settings/route.ts` | 79 |
| `lib/admin/auth.ts` | 96 |
| `lib/admin/format.ts` | 32 |
| `lib/admin/panel-data.ts` | 44 |
| `lib/admin/panel-types.ts` | 113 |

### What is architecturally sound and must be preserved

1. **All arithmetic lives in Postgres** — `supabase/migrations/017_panel_functions.sql` (289 lines), seven RPCs. `lib/admin/panel-data.ts` is a 44-line dispatch table with no calculation.
2. **All 11 tables read by the panel have migration definitions in the repo.** Verified individually. Nothing is live-DB-only.
3. **The service-role key cannot reach the browser.** `panel-types.ts` and `format.ts` have zero imports; `panel.tsx` is `'use client'` importing only `useState`, `useRouter`, a type-only `PanelData`, and four formatters.
4. **Exactly one route can write**, and there is no DELETE handler anywhere on the surface.
5. **Constant-time comparisons and server-side expiry** in `lib/admin/auth.ts`.
6. **The editorial voice** is Rich's, not a dashboard template. It is an asset.
7. **Self-reporting windows** — Engine and Health label their own range from the RPC (`Last {e.days} days`).

---

## B · SECTION MAP

Entry: `app/admin/page.tsx` — server component, `force-dynamic`, guards at line 23 (`isAdmin()` or redirect), allowlists `days` to `[1,7,30,365]` default 7, fetches seven slices in one `Promise.all`.

| Tab | Sections | Read/write |
|---|---|---|
| Overview | Range control · 4 tiles (Revenue, Crafts, Prints ordered, New customers) · 6-step funnel · "Needs you" alert card | Read |
| Engine | 4 tiles (Renders, First-pass rate, **Cost per kept piece**, **Renders per kept piece**) · Finishes crafted · Where renders end · Cost and quality by finish | Read |
| Marketing | 4 tiles (Visits, Series opened, Print Shop opened, Print intent) · Where they came from · By campaign · Rooms entered · Pages opened | Read |
| Customers | 4 tiles (Known, Crafted never bought, Repeat, Credits held) · "Everyone" table, 200-row cap | Read |
| Fulfilment | 4 tiles (Orders, In error, Print revenue, **Margin**) · Orders table with Track links | Read |
| Health | 4 tiles (Typical craft time, Slowest 1 in 20, Failure rate, Open incidents) · 24-hour chart (UTC, unlabelled) · Incidents feed with "Copy for Claude" | Read |
| Controls | Per-series QA sliders + toggle + Save · Fulfilment flags table · Prompts table (read-only) | **WRITE ×2** |

10 interactive controls. Seven are local state or navigation. Three touch the server: Sign out, Copy for Claude, and the two Controls writers. `rejection-patterns` exists but the panel never calls it.

---

## C · DATA PROVENANCE

Flow: tab → `d.<slice>` → `panel-data.ts` RPC → migration 017 SQL → table. All seven RPCs granted to `service_role` only.

| Metric | RPC | Source |
|---|---|---|
| Revenue | `panel_overview` | `purchases.amount_cents` (paid) **+** `print_orders.retail_total_cents` |
| Crafts | `panel_overview` | `qa_log` count, no status filter |
| Prints ordered | `panel_overview` | `print_orders` where `paid_at` in window |
| Credits held | `panel_overview` | `credit_balances.balance` |
| Orders in error | `panel_overview` | `print_orders` status `'error'`, all-time |
| Funnel ×6 | `panel_overview` | `events` — `session_start`, `series_view`, `upload_complete`, `effect_add`, `checkout_open`, `purchase_complete` |
| New customers | `panel_overview` | `identity_map.first_seen` |
| Engine (all) | `panel_engine` | `qa_log` + `collection_pieces` |
| Marketing (all) | `panel_marketing` | `events` exclusively |
| Customers | `panel_customers` | `identity_map` + `collection_pieces` + `print_orders` + `purchases` + `credit_balances` |
| Fulfilment | `panel_fulfilment` | `print_orders` exclusively |
| Health | `panel_health` | `qa_log` + `error_log` |
| Controls | `panel_controls` | `qa_settings`, `account_flags`, `prompt_versions` |

**The fetch layer swallows every failure.** `panel-data.ts:16-19` catches any RPC error, `console.error`s it, returns `null`. All seven `PanelData` members are `| null`, driving 13 `<Empty what="" />` guards that render "Nothing recorded yet. " with no diagnostic. A dead RPC and an empty table are indistinguishable in the UI.

---

## D · WORKING vs PARTIAL vs PLACEHOLDER

### Working — trustworthy today
Overview's four top tiles and "Needs you" card (live transactional tables). Engine's render counts, first-pass rate, outcomes, per-finish table. Health's latency percentiles and failure rate. All of Controls. Fulfilment's order counts, revenue, order table.

### Partial — real but misleading as labelled
- **`Margin` shows 100%, always.** `wholesale_cost_cents` is written only at `lib/v1/print/db.ts:246`, guarded by `if (input.wholesaleCents !== null)`, and its only production caller passes `wholesaleCents: null` at `app/api/v1/print/webhook/route.ts:209`. No other writer exists. Margin = `(retail-0)/retail` = 100%.
- **`New customers` always 0; `Known customers` frozen.** `identity_map` has **no application writer** — the only repo hit outside migrations is a comment at `public/track.js:105`. Populated once by the migration-014 backfill.
- **`Crafts` counts attempts, not crafts** — `qa_log` with no status filter; includes intake-rejected, redirected, abandoned `in_progress`.
- **"In error — paid, not printed"** filters `status='error'` with **no `paid_at` check**, yet copy asserts the customer has been charged. Drives an Overview alert.
- **`credits_held` labelled "bought, not yet crafted"** includes granted, referral and promo-code credits.
- **`Orders — all time`** is a bare count including never-paid `'created'` rows.
- **`crafted_only` / `repeat`** computed over the 200-row `people` CTE while `total` counts the whole table.
- **Cost figures** derive from `QA_COST` in `app/api/v1/portraits/generate/route.ts:135-136`, commented "for qa_log observability only — not billing".
- **Revenue** adds credit/bundle sales to print retail **including shipping**.
- **Health** — `failure_pct` and `hourly.fails` use different denominators; latency excludes rows that never reached `finish()` (survivor bias); hourly buckets are unlabelled UTC.

### Placeholder / dead
- **Two Engine tiles can never show a number.** `panel.tsx:234-235` read `e.cost_per_kept` and `e.renders_per_kept`. Repo-wide grep: **those two lines are the only occurrences.** The `Engine` type offers `cost_per_render` and `cost_per_passed`. Both tiles render `—` permanently. The SQL documents the deliberate switch at `017:112-116`; the UI was never updated. It ships because `next.config.js` sets `typescript: { ignoreBuildErrors: true }` while `tsconfig.json` has `"strict": true`. Meanwhile `cost_per_render`, `cost_per_passed`, `cost_total_cents` and `attributed` are fetched every request and never rendered.
- **Funnel past step 1, and most of Marketing, are structurally zero.** `track.js` exists, is loaded by 10 pages, posts to `/api/v1/events` — but auto-fires only `session_start` and `page_view`. Emitter count for the ten names the panel queries:

  | Event | Emitters |
  |---|---|
  | `session_start`, `page_view` | 1 (track.js itself) |
  | `series_view`, `upload_complete`, `effect_add`, `checkout_open`, `purchase_complete`, `printshop_open`, `print_checkout_open`, `nav_click` | **0** |

  **The panel's honest empty-state copy is keyed on `visited === 0`** — and `visited` is the one step that works, so the disclaimers never fire. The funnel renders a real visit count then five zeros, captioned *"Every step here is a real person who got that far and no further."* A real revenue figure sits above a `Paid` funnel step of 0.
- **Incidents feed structurally empty — and the panel says so honestly.** `logIncident()` exists in `lib/errors/log-incident.ts` with redaction and a `Timeline` class; `error_log` (016) and the `log_incident` RPC exist. Nothing calls it. The only reference outside its own file is `panel.tsx:507`: *"Nothing has failed. Incidents appear here once logIncident() is wired."*
- **Dead markup** — a `curatorDeckle` SVG filter never referenced; a `gold-rule` span emitted 5× that CSS sets `display:none`; an empty `<th>`.

### Corrected subagent claim
A subagent reported `outcomes.failed` is structurally always 0 because `'failed'` is never written to `qa_log`. **Wrong.** `app/api/v1/portraits/generate/route.ts:552` writes `'failed'` on the primary path when an image was produced but missed fidelity/aesthetic thresholds. The agent saw only the catch-path fallback at line 567.

The adjacent point holds and was verified: `017:87-90` buckets `passed`, `failed`, `intake_rejected`, `redirected` — **`'errored'` and `'in_progress'` are in no bucket.** "Where renders end" omits hard generator failures, the bars don't sum to `renders_all_time`, and Engine and Health disagree about what a failure is (Health correctly counts `('failed','errored')`).

---

## E · PRODUCTION WRITE SURFACES

Only **one** route can write. `incidents/[id]` and `rejection-patterns` export `GET` only — verified across all six routes.

### `POST /api/admin/settings`, `kind: 'qa'`
UI: Controls → `Save {series}` (`panel.tsx:626`). Mutates `qa_settings` UPDATE on `series` (primary key) — `source_strictness`, `render_strictness`, `qa_enabled`. Auth: `isAdmin()` cookie. Safeguards: 1-10 integer range checks mirroring DB CHECK constraints; closed `kind` switch; one row max. Consequence: live QA thresholds read per-request by `lib/shared/qa-log.ts`, consumed by portraits gate + generate. `qa_enabled: false` disables source-photo and render quality gating for every customer craft in that series.

### `POST /api/admin/settings`, `kind: 'flag'`
UI: Controls → fulfilment checkbox (`panel.tsx:654`) — **auto-saves on change, no confirmation.** Mutates `account_flags` **UPSERT** on `owner_key`. Auth: `isAdmin()` cookie. Validation: `owner_key` must be a truthy string — that is all. Verified chain: `account_flags.fulfilment` → `canFulfil()` at `lib/v1/print/db.ts:186` → gate at `app/api/v1/print/webhook/route.ts:129`. Setting `true` means the next paid order is manufactured and shipped by Prodigi — irreversible. `canFulfil` withholds on error, so it fails closed.

**The two Controls toggles look identical and behave differently** — QA is deferred until Save, fulfilment writes immediately.

**Absent from both:** no audit trail (`updated_by` is the constant `'control-panel'`; `account_flags` has no `updated_by` column), no rate limit, no confirmation, no dry-run, no undo, no CSRF token beyond `sameSite: 'lax'`.

### Auth findings
- **`POST /api/admin/auth/logout` has no guard at all** — 10 lines, no `isAdmin()`. Impact bounded (clears a cookie). `middleware.ts` excludes `/api` entirely, so every guard is in-route and only in-route; this file shows the pattern has already failed once.
- **`POST .../login` has no rate limiting, no lockout, no logging** of success or failure — only a 500 ms sleep, ineffective against parallel requests, against a single shared password guarding service-role DB access with an unrevocable 7-day session.
- **`ADMIN_API_KEY` fails closed correctly** — unset *or* empty both hit 503 before the header is read. The variable is absent from `.env.local`, so `rejection-patterns` is inert.

---

## F · GAPS (evidence-backed)

1. No instrumentation for 8 of 10 tracked event names.
2. `wholesale_cost_cents` never written → fabricated 100% margin.
3. `identity_map` has no live writer → new-customer count 0, customer list frozen.
4. `logIncident()` has no call sites → incident feed permanently empty.
5. RPC failures invisible — null renders as zero/empty with no distinction. If `panel_health` dies the red dot vanishes and the panel looks *healthier*.
6. Type checking disabled (`ignoreBuildErrors: true`) — what let the dead tiles ship. 49 pre-existing `tsc` errors repo-wide, **zero in the Admin files**.
7. No audit trail on either write path.
8. **No release or deployment information anywhere in the panel.** Grep for deploy/commit/version/`VERCEL_GIT` — the only hit is copy saying a settings change needs *no* deploy.
9. **Login lands on a 404.** `app/admin/login/page.tsx:27` pushes to `/admin/store`, which exists nowhere; that line is its only occurrence. Sub-copy still says "Sign in to manage the bundle catalog"; brands itself `miniRama Admin` against the panel's `Liten & Co / Control Panel`.
10. **Controls shows stale values after a tab switch.** No `router.refresh()` anywhere in `panel.tsx` — only two `router.push` calls. `Controls` seeds `useState` from the `data` prop and unmounts on tab change, so a saved value reverts on return while the DB holds the new one.
11. `copyIncident` never checks `res.ok` — on an expired cookie it puts the literal string `unauthorized` on the clipboard under "Copied. Paste it into a chat with Claude."
12. Cost figures displayed as dollar amounts with no estimate marker.

---

## G · EXISTING DATA THAT MAY SUBSTITUTE FOR MISSING TELEMETRY

Discovered while scoping Phase 1. These are **existing tables with existing writers**, so Admin-side derivation does not require customer-app changes. Each would need Rich to settle a business definition first.

- **`craft_events`** (migration 007) has a live writer at `app/api/v1/credits/gate/route.ts:386`, inserting `event: 'craft_started'` rows with `owner_key`, `series`, `preset`, `source_photo_id`, `credits_delta` — one per image in the basket. Wallpapers purchases deliberately excluded. Only `craft_started` is ever written; `craft_succeeded` / `craft_failed` / `redirected` / `intake_rejected` have no writers.
- **`credit_ledger`** carries `reason` distinguishing `'purchase'` (written at `lib/store/entitlements.ts:369`) from `'grant'` / `'code'` / `'referral'`, so purchased-vs-granted credits are separable from existing data.
- **`collection_pieces`** is the honest count of pieces actually kept.

### Adjacent observation (logged, not fixed — AGENTS.md §3)
`credit_ledger`'s CHECK constraint (`012:167-170`) allows only `purchase|code|grant|referral|craft|refund|recraft`, but `'wallpapers'` is written at `app/api/v1/credits/gate/route.ts:371` and `app/api/v1/wallpapers/purchase/route.ts:253`, and `'studio_keep'` at `app/api/v1/wallpapers/studio/keep/route.ts:207`. The constraint is declared `not valid`. Not investigated further; outside Admin scope.

---

## H · OPERATIONAL QUESTIONS THE PANEL CANNOT ANSWER

1. Where do people actually drop out? Only "Visited" is real.
2. What is the true margin on a print? Margin is 100% by construction.
3. Who are my customers as of this week? `identity_map` stopped growing at the backfill.
4. What broke, when, for whom, and is it still broken? The incident feed has never received a row.
5. Is the panel itself telling the truth right now? No health signal for the reporting pipeline; a failed RPC makes the business look worse and the system look fine.

---

## VERIFICATION PERFORMED

- `npm ci` exit 0 — 528 packages, lockfile-exact.
- `npx tsc --noEmit` — **49 pre-existing errors, none in the 13 Admin files.** (Corrected 2026-09-18: this originally read "11", which was a `tail -20` truncation artifact of the first run, not the real count. The Admin-clean finding is unchanged; the repo-wide figure was understated.)
- `npx eslint` on the Admin surface — 1 error (`no-explicit-any`, `rejection-patterns:35`), 1 warning (custom font, `login/page.tsx:37`). Both pre-existing.
- Client/server boundary confirmed statically.
- All 7 RPCs and all 11 tables confirmed present in migrations.
- Exported HTTP methods enumerated across all six routes.
- Worktree status clean; `tsconfig.tsbuildinfo` gitignored.
- `D:\minramas` pre/post snapshot diff — identical.

`next build` was deliberately **not** run: it can execute route handlers during prerender and reach production, and the same evidence was available statically under the no-write policy.
