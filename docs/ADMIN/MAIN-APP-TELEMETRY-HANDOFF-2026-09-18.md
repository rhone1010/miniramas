# MAIN APP TELEMETRY HANDOFF
**Date:** 2026-09-18 · **From:** Admin lane (`H:\LitenCo_Admin`, branch `admin/control-panel`) · **To:** the CC team owning the customer application

Preserved unchanged from the Admin Phase 1 proposal, per Rich's ruling 2026-09-18.

**Nothing here is implemented by the Admin lane.** This is a request contract, not a change set. Admin does not instrument customer-facing pages, Discovery, checkout, generation, or the print webhook.

---

## THE GOOD NEWS FIRST

**The transport already exists and you build nothing.** `public/track.js` handles `anon_id`, `session_id`, first-touch UTM capture, batching, and a `sendBeacon` flush on tab close. The ingest route, the closed allowlist (`lib/analytics/event-names.ts`, 40+ names), and the `events` table all exist and are correct.

Every request below is **one `window.track(name, props)` call at the right moment.**

### Shared ingest contract

`POST /api/v1/events`, verified at `app/api/v1/events/route.ts`:

- Accepts `[{...}]` or `{events:[...]}`, capped at `MAX_BATCH`
- Per event: `name` (≤64, **must be in `EVENT_NAMES` or it is silently dropped**), `anon_id` + `session_id` (UUID, required — `track.js` supplies both), optional `owner_key` (≤128), `series` (≤64), `props` (object, ≤`MAX_PROPS_BYTES`), `path` (≤512), `referrer` (≤512), `utm`
- Server adds `device`, `ua` (≤512), `country` from `x-vercel-ip-country`
- **Every name below is already on the allowlist.** No allowlist change is needed.

---

## ANALYTICS EMITTERS — 8 SIGNALS

| Signal | Trigger semantics | Required fields | Idempotency | Enables |
|---|---|---|---|---|
| `series_view` | Customer opens a Series/room and its content becomes visible. Not on hover, not on prefetch | `series`, `path` | Once per session per series. Re-entry within a session should not double-count | Funnel step 2; Marketing `Series opened`; **Rooms entered** (groups by `series`) |
| `upload_complete` | Source photo upload **succeeds** server-side. Not on file-select, not on a failed upload | `series`, `props.source_photo_id` | Once per successful upload. A retry of the same photo is a new event | Funnel step 3 |
| `effect_add` | Customer commits a finish to their selection | `series`, `props.preset` | Fires per add. **Expect duplicates by design** — see contract notes | Funnel step 4 |
| `checkout_open` | Checkout surface becomes visible with a non-empty basket | `series`, `props.item_count` | Once per checkout opening; reopening is a new event | Funnel step 5 |
| `purchase_complete` | Client-side confirmation that payment succeeded. **Advisory only — never the source of truth for revenue** | `props.order_ref` | Must tolerate double-fire on redirect-back. Include `order_ref` so Admin can dedupe | Funnel step 6; `sources[].paid`; `campaigns[].paid` |
| `printshop_open` | Print Shop panel becomes visible | `path` | Once per opening | Marketing `Print Shop opened` |
| `print_checkout_open` | Print checkout becomes visible with a configured item | `props.sku` | Once per opening | Marketing `Print intent` |
| `nav_click` | Masthead/menu navigation click | **`props.target` (required)** — the SQL groups on it | Fires per click | **Pages opened** (`017:161-163` groups by `props->>'target'`) |

### Two contract notes that matter to Admin

1. The funnel SQL is `count(*)`, not `count(distinct anon_id)`. Until that changes, a customer firing `effect_add` three times counts three times. Either emit once per session per step, or tell Admin to switch the SQL to distinct counting — **your call, and it changes what the funnel means.**
2. Unknown names are dropped **silently** with no error to the client. A typo produces zero data and no warning.

---

## DATA-LAYER SIGNALS — 3 REQUESTS

| Signal | What's needed | Evidence it's absent | Enables |
|---|---|---|---|
| **`identity_map` population** | An upsert on first touch — first authenticated session, or first guest `owner_key` issuance. Columns already exist (`014_identity_map.sql:18-25`: `owner_key`, `user_id`, `email`, `anon_id`, `first_seen`, `updated_at`) | Repo-wide grep for `identity_map` across `app/`, `lib/`, `public/` returns **one hit, a comment at `public/track.js:105`**. The only writer ever was the one-shot backfill at `014:37-50` | `New customers` (currently 0 forever); the entire Customers tab (currently frozen); also fixes `crafted_only` overstating by counting guest buyers as never having bought |
| **`logIncident()` call sites** | Call the existing helper at engine/route/webhook failure points. Redaction, fingerprint dedupe (`count` increments rather than new rows), and the `Timeline` class are all already built in `lib/errors/log-incident.ts` | The only reference outside its own file is `app/admin/panel.tsx:507` — the panel's own admission that it is unwired | `Open incidents`; the whole Health incidents feed; `Copy for Claude` |
| **`track.js` coverage** | Add the one-line script tag to `public/index.html` and `public/discovery-consolidated-draft.html` | Loaded by 10 pages; **absent from the homepage and all of Discovery.** `public/foyer.html:644` explicitly notes "which this page does not load" | Removes the undercount on every `session_start`-derived metric |

---

## PRIVACY REQUIREMENTS — BINDING ON ALL OF THE ABOVE

- **No `props` may carry** email, name, address, prompt text, image bytes or data URIs. `events.props` is size-capped but **not content-filtered** — the cap is not a privacy control.
- `events` already stores `ua`, `country`, `anon_id` and optional `owner_key`. Adding identifying data to `props` turns a behavioural table into a personal-data store with `service_role`-only RLS and no retention policy.
- `logIncident()` already redacts correctly — no keys, no customer email, no image bytes, prompt bodies by hash only (`lib/errors/log-incident.ts:5-13`, `016_error_log.sql:11-13`). **Preserve that contract at every new call site.**
- `purchase_complete` should carry an opaque `order_ref`, never a Stripe session id or customer email.

---

## NOT REQUESTED

`craft_events` outcome rows (`craft_succeeded`, `craft_failed`, `redirected`, `intake_rejected`) currently have no writer — the only writer is `app/api/v1/credits/gate/route.ts:386`, which inserts `craft_started` only. And `render_ref` is never sent in a generate request body, so Engine's `attributed` metric is always 0.

**Both are in generation, which is explicitly out of scope.** Logged, not requested.

---

## ADMIN-SIDE STATUS WHILE THIS IS OUTSTANDING

Per Rich's C7 ruling, Admin will **not** substitute a transactional approximation for the behavioural funnel. Every metric depending on the eight events above will display **"Not instrumented yet"** — never `0` — until this contract is implemented. A genuine measured zero remains visually and semantically distinct from unavailable telemetry.
