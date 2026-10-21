# Gift Wizard controlled launch: Stripe, environment and manufacturing, 2026-10-21

Tools (all print names and verdicts, never a value): `scripts/check-launch-env.ts`, `scripts/verify-webhook-secret.ts`, `scripts/check-prodigi-sandbox.ts`, `scripts/gift-release-order.ts`.

## 1. Legacy test order d60ae2cf: resolved (done 2026-10-21)
A Gift test order paid before the approval-only lifecycle existed sat in `paid` (fulfilment-visible) with a queued upscale job and a session that was never approved. Closed with guarded updates (only if still `paid`, no Prodigi id, never placed, session unapproved, not refunded, job `queued` and unleased): the job is `rejected` with a review note and an `operator_closed` event; the order is back in `awaiting_artwork` (invisible to fulfilment). Nothing deleted: payment time and intent kept, the session byte-identical, every other order and job byte-identical. Working asset jobs now in the system: 0.
Still fulfilment-visible and NOT touched (unrelated Print Shop test orders, Stripe test mode): `8e8267f6`, `b2c337eb`, `352ae746` (status `paid`, 2026-08-07, GLOBAL-FAP-8X8) and `2c9ac470` (status `error`, 2026-10-14, GLOBAL-FAP-12X18), none with a Prodigi id. Production's poller would try to place the three `paid` ones. Owner decision: cancel or move them before the poller runs there.

## 2. Stripe
Current test-mode destinations: `we_1U1b97CW...` (Preview alias, DISABLED, history kept) and `we_1U1b7nCW...` = `https://litenco.com/api/v1/webhooks/stripe`, enabled, subscribed to `checkout.session.completed` ONLY. Evidence its secret matches Production's: Stripe's own deliveries to it succeeded (three portfolio purchases confirmed within a second on 2026-10-18), and an unsigned probe gets `400 invalid_signature` (a missing secret would be `503`).

**Owner-only (the harness blocked CC from changing this destination; it points at Production):** add the five events the route handles to the existing test-mode destination:
```
stripe webhook_endpoints update we_1U1b7nCWHIffAtyWj62nvd6u --enabled-events checkout.session.completed --enabled-events checkout.session.async_payment_succeeded --enabled-events charge.refunded --enabled-events checkout.session.expired --enabled-events charge.failed
```
(the flag replaces the list, so all five are named). Safe on today's Production: older code ignores event types it has no case for, and the Gift events only fail there until the Gift build is deployed.

**Production LIVE webhook (needs your approval; CC did not create it):**
1. Stripe Dashboard, LIVE mode: Developers > Webhooks > Add endpoint: URL `https://litenco.com/api/v1/webhooks/stripe`, API version `2024-04-10`, the same five events. Copy its signing secret.
2. Vercel Production env: `STRIPE_WEBHOOK_SECRET` = that secret; `STRIPE_SECRET_KEY` = `sk_live_...`; `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` = `pk_live_...` (all three must be the same mode; the checker flags a mix).
3. Verify the deployed secret without touching an order: `vercel env pull .env.production.check --environment=production`, then `npx tsx --env-file=.env.production.check scripts/verify-webhook-secret.ts --url https://litenco.com/api/v1/webhooks/stripe` (200 = MATCH, 400 = MISMATCH, 503 = NOT CONFIGURED), then delete the pulled file.
4. After the first real test payment: Dashboard > the destination > the event should show a 200 and the order `awaiting_artwork`; resend one event: the order must not change (idempotent).
Do not enable live payments until 1-3 pass and you approve.

## 3. Production environment (exact)
Run `npx tsx scripts/check-launch-env.ts --file .env.production.check`; it must end `READY (production)`. Required:
| name | value form | used for |
|---|---|---|
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | `sk_live_` / `pk_live_` (or both `_test_` while payments stay off) | checkout, verification, refunds |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` of the destination above | the main webhook |
| `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` | project URL, service role | all server reads/writes |
| `REPLICATE_API_TOKEN` | token | NB2.1 generation and `prunaai/p-image-upscale` |
| `OPENAI_API_KEY` | key | age/people-count gate, likeness scoring, print QA |
| `STABILITY_API_KEY` | key | bounded extension of compositions |
| `CRON_SECRET` | 16+ chars | internal generate calls and the poller |
| `APP_URL` (and/or `NEXT_PUBLIC_APP_URL`) | exactly `https://litenco.com` | return URLs and the app's calls to its own generate routes (a localhost value fails every generation) |
| `PRODIGI_ENV`, `PRODIGI_KEY_SANDBOX` (`PRODIGI_KEY_LIVE` only for live) | `sandbox` until you authorize live | manufacturing |
| `RESEND_API_KEY`, `SUPPORT_TO_EMAIL` (`SUPPORT_FROM_EMAIL` optional, defaults to hello@litenco.com) | key, a real inbox | order/refund mail, support, delayed-order notices |
Must be ABSENT or default: `GIFT_REQUIRE_APPROVED_SCENE` (never `0`), `GIFT_SCENE_MOCKUPS` (never `0`), `GIFT_MOCKUP_TOOLS_DIR`, `GIFT_COMPOSITIONS_BEFORE_PAYMENT` (not `1`).
Checked on this machine's `.env.local` (a TEST setup, not Production): everything present except two errors: `APP_URL` is `http://localhost:3000` and `SUPPORT_TO_EMAIL` is unset; Stripe test keys and `PRODIGI_ENV=sandbox` are correct for a controlled launch. CC cannot read the Vercel Production environment (no CLI or token here), so Production's values are unverified except that `STRIPE_WEBHOOK_SECRET` is set (the route answers 400, not 503).

## 4. Manufacturing: controlled launch
- Prodigi sandbox: `scripts/check-prodigi-sandbox.ts` ran (read-only: GET /Products, POST /Quotes, never an order): all 16 sellable configurations (every fine art size, premium squares, canvas squares) are known to the sandbox and quote (shipping 10.75 to 25.90 USD to the US). Prodigi answers `CreatedWithIssues` for a quote that carries no artwork URL; checkout needs only the shipping amount.
- Release is operator-only: the customer's `POST /finalize` records approval and nothing else. To release one finalized order: `npx tsx --env-file=.env.local scripts/gift-release-order.ts --session <uuid> --user <uuid> --operator <you@litenco.com>` (dry run), then add `--execute`. It moves the order to `paid` and the existing pipeline (account gate, payment and refund recheck, `prunaai/p-image-upscale` to the required pixels, QA, Prodigi) takes over; with `PRODIGI_ENV=sandbox` nothing real is made.
- Order of a controlled launch: env checker READY, Stripe destination subscribed and secret verified, deploy, one internal paid test order end to end in sandbox, then you release it and watch the job in the upscale dashboard, then widen.
