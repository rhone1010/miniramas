# SOURCE PHOTOGRAPH RETENTION · 2026-10-25

Status: **built and tested locally; migration 060 written, NOT applied; nothing deployed; no customer photograph has been deleted.**

## The approved policy

| Work | Source photograph is deleted | Clock |
|---|---|---|
| Unpurchased artwork | 60 days after creation | `portfolios.created_at` (Gift sessions: the existing 7/30-day expiry is shorter and still applies) |
| Portraits, Pets, Groups (purchased) | 60 days after the qualifying purchase or Collection unlock | the later of the paid `purchases.paid_at` and the latest `preview_ledger.unlocked_at` of the portfolio's items |
| Gift Shop, Print Shop | 60 days after customer artwork approval | `gift_sessions.final_approved_at` (else `approved_at`) |
| Anything with an active dispute | suspended until resolved | see "Dispute" |

Kept untouched: crafted/generated artwork (`previews`, `collection`), Gift masters, previews and compositions, approved manufacturing files (`print-assets`), `purchases`, `print_orders`, refund and support records, and the photograph's **sha256** (the hash is not the picture).

## Where a source photograph lives, and what now removes it

| Copy | Location | Removed by |
|---|---|---|
| Portraits / Pets / Groups source | `portfolios.source_image` (base64 text in the database; there is no storage object, thumbnail or analysis copy) | `retention_sweep_portfolio_sources` (migration 060), nulls the column |
| Copy a Gift approval makes into its new portfolio (`gift_approve_order`, origin `gift`) | `portfolios.source_image` | same function; clock = the Gift session's approval |
| Foyer free-reveal claim | `foyer_result_claims.source_image` | already removed after 2 hours (`/api/v1/foyer/cleanup`); adoption moves it to `portfolios` and nulls the claim |
| Gift session source | `previews` bucket, `gift/{session}/source.jpg` (re-encoded JPEG, EXIF stripped) | `purgeApprovedSources` (60 days after approval); `purgeExpired` (unapproved sessions, unchanged) |
| Gift "from Collection" session | its own `gift/{session}/source.jpg`, copied from `portfolios.source_image` | same as any Gift session |
| My Collection pieces | none: `collection_pieces` stores only the crafted piece (`source_path` is unused) | n/a |
| Print Shop | none: `print-assets` holds compositions made from the customer's artwork, never the photograph | n/a |
| `baskets.source_image` | the code writes it (`lib/store/basket-checkout.ts`) but **the table does not exist** in the live database | nothing to delete; if that table is ever created it needs the same sweep |
| Browser `localStorage` data URL (`public/portraits.html`) | the customer's own browser | not reachable from the server |

Every portfolio and gift session was checked against the live database read-only on 2026-10-25: 80 portfolios (all have a source, oldest 37.9 days), 34 gift sessions (28 unpinned, 6 pinned, none with a final approval), 4 support cases (1 open). **No record is yet old enough for any clock to have expired**, and no clock can expire before 2026-11-16 (the oldest portfolio plus 60 days).

## How the deletion is made safe

* **Dry run by default.** `GET /api/v1/retention/cleanup` (daily cron, internal auth) only deletes when `SOURCE_RETENTION_DELETE=1`; `?dry=1` forces a dry run. A dry run reads and reports; the SQL function takes `p_apply=false`. Tested: a dry run changes nothing.
* **Dispute.** A source is held while any Make It Right case of that customer is not `resolved` and either names that artwork or is not scoped to a single artwork (batch/unscoped); or an open Gift refund request exists (`gift_refund_requests.status='requested'`, or `refund_requested_at` set and `refunded_at` empty). It is released automatically on the next run after the case closes (tested). The existing Gift expiry sweep now holds a disputed session too (it did not before).
* **Still needed.** A portfolio with an item still rendering (started in the last 7 days) is held; a render stuck for over a week does not hold the photograph.
* **Idempotent and retry-safe.** Portfolios: one transactional function, only rows with a non-null `source_image`, row locks with `skip locked`, a log row per deletion (`retention_log`: ids and dates only, never image content). Gift: the object is removed first and `source_path` cleared after, so a storage failure leaves the session to be found again; removing a missing object is not an error. Tested: failure, retry, and a second run that finds nothing.
* **Identity survives.** The deletion stores the photograph's sha256 (`portfolios.source_sha256`, byte-for-byte the value `lib/store/remedy-evidence.ts` computes, tested against Node), so repeat-refund detection still works after deletion.
* **Signed URLs.** The only URL ever issued for a source photograph is `photoUrl` in the Gift session view, valid one hour. After deletion the session view has no `photoUrl` and the object no longer exists, so an earlier URL has nothing to serve (tested). Portraits/Pets/Groups sources are database text and are never signed. (The research that preceded this said Gift never signs the source; that was wrong and the test caught it.) Supabase's CDN may serve a cached copy of a deleted object for a short time after deletion; that is a provider property and is not verified here.

## Consequences the owner should know

1. **Make It Right redo.** A redo re-runs the craft from the photograph. After deletion the policy now answers a redo with "send a better photograph" (the existing `source_photo` path), and does **not** spend the customer's goodwill. A refund does not need the photograph and is unchanged.
2. **Gift from My Collection.** Needs the source photograph for corrections; once the portfolio's source is gone the entrance returns `artwork_unavailable` (existing behaviour for a missing source). A customer then re-uploads a photograph.
3. **Gift corrections / new generations** after the source is deleted (60 days after approval) fail with `generation_unavailable`. The one free correction should be used before then.
4. **Customer-facing copy is now out of date.** The Concierge prompt, the FAQ, Terms and Privacy (and the 8 Aug drafts) say the photograph is deleted "once the work using it is finished" and that disputes "may stay open up to a year". Neither matches 60 days; I have not edited customer copy. See `HELP-AND-SUPPORT-CONTENT-2026-10-25.md`.
5. **Disputes have no time limit in code.** A case left unresolved holds the photograph indefinitely.

## External provider retention (not verifiable from this repository)

The photograph is sent for processing to: the image-generation models (Replicate/Google, `app/api/v1/groups/generate`, the series routes), OpenAI (photograph analysis and fidelity scoring, the Concierge), and, for Gift products, only the *artwork* goes to Prodigi (never the photograph). Deleting our copy **cannot** delete what those providers hold. This repository contains no provider contract, data-processing terms or retention setting, so their retention periods are **unknown here**. The privacy drafts state the photograph is "processed and not retained for training"; that is a claim to confirm with each provider (and, for OpenAI, whether the account has zero-data-retention) before the 60-day promise is stated publicly without qualification.

## To activate (nothing below has been done)

1. Rich authorizes applying `supabase/migrations/060_source_photo_retention.sql`.
2. Call the route with `?dry=1` (or leave `SOURCE_RETENTION_DELETE` unset) and read the report: `portfolios.due`, `portfolios.disputed`, `gift.due`.
3. Only when the report is as expected: set `SOURCE_RETENTION_DELETE=1` in Production.

Tests: `lib/v1/retention/migration-060.test.ts` (real Postgres via PGlite: the clocks, disputes, dry run, apply, idempotency, hash equality, financial rows untouched) and `lib/v1/retention/source-retention.test.ts` (Gift deletion, disputes, retry, URLs, combined report, remedy policy).
