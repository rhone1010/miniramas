# Stripe webhook readiness (test mode), 2026-10-20

## Destinations (test mode, account acct_1PCoffCWHIffAtyW)
| id | url | state |
|---|---|---|
| we_1U1b97CWHIffAtyWHrcqoweh | miniramas-git-codex-canonical-2026-09-24-litenco.vercel.app/api/v1/print/webhook | DISABLED 2026-10-20 (history kept). Vercel Authentication answered every delivery with 401; it could never deliver. |
| we_1U1b7nCWHIffAtyWj62nvd6u | https://litenco.com/api/v1/webhooks/stripe | enabled. Subscribed to `checkout.session.completed` ONLY. |

## What the main route (`app/api/v1/webhooks/stripe/route.ts`) does
| event | handling | tested (webhook-events.test.ts, real route, real Stripe signature check) |
|---|---|---|
| checkout.session.completed | paid + kind gift_order -> confirmGiftOrder (re-retrieves the session from Stripe, verifies against our order rows); unpaid -> ignored | yes, incl. 3 parallel duplicates, transient failure -> 500 then retry succeeds |
| checkout.session.async_payment_succeeded | same as completed | yes (unpaid "completed" ignored, then async success confirms) |
| charge.refunded | applyVerifiedRefunds: re-reads charge and refund list from Stripe, applies each SUCCEEDED refund id once | yes: partial then full, duplicates, pending refund ignored, non-gift charge ignored |
| checkout.session.expired | handlePaymentFailure (purchases table). A Gift session has no purchases row -> logged and acknowledged; the order stays `created` and checkout can start again | yes |
| charge.failed | looks up a purchase by charge; none for Gift -> acknowledged | yes |
| anything else | acknowledged, ignored | yes |

Signature failures answer 400, a missing secret 503, a handler error 500 (Stripe retries).

## Why Gift events failed on litenco.com
Production (`E:\Dev\liten-co`, branch codex/homepage-preview) has no `gift_order` branch in this route: a Gift event falls through to the portfolio purchase path and errors. The Gift code is not deployed. (Inferred from the code and from Stripe showing 2 pending destinations on the Gift events; the per-attempt response is in the Dashboard.)

## Impact so far
None lost. Every paid Gift test order was confirmed by the browser's payment verification (`verifyGiftPayment`), which the webhook merely duplicates. Portfolio purchases (3) were confirmed by this endpoint within a second. The 8 older print orders are `placed`.

## Safe Production rollout (in this order)
1. Deploy the combined Gift build to Production (user + Codex; never one half alone). Migrations first or together: 052 (applied), 053, 055 (NOT applied; the code degrades without it), 054 optional.
2. Confirm `STRIPE_WEBHOOK_SECRET` in the Production environment is the signing secret of we_1U1b7nCWHIffAtyWj62nvd6u (Dashboard -> that destination -> Signing secret; compare in Vercel, never paste it anywhere). A mismatch shows as 400 invalid_signature on every delivery.
3. Only then add the events this route handles to that destination, so nothing arrives before a handler exists:
   `stripe webhook_endpoints update we_1U1b7nCWHIffAtyWj62nvd6u --enabled-events checkout.session.completed --enabled-events checkout.session.async_payment_succeeded --enabled-events charge.refunded --enabled-events checkout.session.expired --enabled-events charge.failed`
   (the flag replaces the whole list, so all five are named).
4. In the Dashboard, resend one failed Gift test event to that destination and confirm 200 and the order's state (idempotent: an already-confirmed order is unchanged).
5. Live mode needs its own destination and secret; none was touched here.
