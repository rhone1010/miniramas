# Gift checkout: frontend handoff (2026-10-17)

Backend revision: Preview `8bbcff8` plus the uncommitted checkout-consistency change described in section 1. Authoritative types: `lib/v1/gift/types.ts` (copy: `public/gift-wizard/backend-contracts/gift/types.ts`).

## 1. What the checkout now guarantees (`lib/v1/gift/orders.ts`)

- `POST /api/v1/gift/sessions/{id}/checkout` is idempotent for identical details: it returns the SAME open Stripe session (same `clientSecret`) only when the products, email, shipping address (case and surrounding spaces ignored), shipping method, shipping quote and total all match what the order was last sold with.
- Anything else replaces the session safely: a new Stripe session is created, then the order's session id, email, address, shipping method, quote, totals and items are persisted in ONE update that applies only while the order is still unpaid, then the old Stripe session is expired so it can no longer be paid.
- A session that is already paid at Stripe (confirmation pending) is never replaced: the call answers `409 order_already_paid` and the page must call confirm. An order paid while a replacement was being prepared is left untouched, the unused new session is expired, and the call answers `409 order_already_paid`.
- Stale confirmations: confirming a replaced session id answers `404 order_not_found` and grants nothing (the order no longer maps to it).
- The order id, the Prodigi merchant reference and the frozen product geometry from the first checkout are kept across replacements. Prices, SKUs and shipping always come from the server; tax is not applied (the Stripe session has no tax), so `totalCents = itemsCents + shippingCents`.
- Preview entitlements are granted exactly once, by `confirmGiftOrder`, whichever route delivers the payment (the main Stripe webhook, the Print Shop webhook, or the browser's confirm): order `awaiting_artwork`, two included six-preview batches.
- Ordinary Print Shop checkout and fulfilment are untouched.

## 2. Contracts

```ts
POST /api/v1/gift/sessions/{id}/checkout    // signed in; the session must already have its lines
body: { email: string; shippingAddress: { name; line1; line2?; city; state?; postcode; countryCode /* 2 letters */ };
        shippingMethod?: 'Budget' | 'Standard' | 'Express' | 'Overnight' /* default Budget */;
        disclosureAccepted: true; disclosureVersion: string /* REQUIRED: the Disclosure.version the page displayed */;
        returnPath: '/gift-wizard' | '/gift-wizard.next.html' }
200: { clientSecret: string; stripeSessionId: string; publishableKey: string;
       totals: { itemsCents: number; shippingCents: number; totalCents: number }; disclosure: { version: string; text: string } }

POST /api/v1/gift/orders/confirm   body: { stripeSessionId }   // re-verifies with Stripe; idempotent
200: { confirmed: boolean; session?: SessionView }

GET /api/v1/gift/sessions/{id}  -> SessionView  (order.state, order.totalCents, order.freeBatchesGranted, order.disclosureVersion, entitlement, nextBatch)
```

**Flow.** (1) After the customer chooses products and fills delivery details, POST checkout. (2) Mount Stripe Embedded Checkout with `publishableKey` and `clientSecret` and show `totals` (authoritative: do not compute your own). (3) On `onComplete` (card payments finish without a redirect) call confirm with `stripeSessionId`. (4) If `confirmed: false` (payment still processing) wait 2 to 3 seconds and call confirm again, up to about 30 seconds, then show "we are confirming your payment; we will email you" (the webhook will finish it). (5) `confirmed: true`: `session.order.state === 'awaiting_artwork'`, `freeBatchesGranted === 2`, `nextBatch.kind === 'free'`: go to Create Art.

**Restoration.** On reload, `GET session`: `order.state === 'checkout_open'` means a payment was started and not finished. POST checkout again with the same details to get the same `clientSecret` (reuse); with changed details a new session replaces it, so always send the CURRENT form values. After redirect returns, Stripe appends `?gift_order_session=cs_...`: call confirm with it. `awaiting_artwork` or later: never show checkout again. `lines_locked (409)`: products cannot change once an order exists.

**Order states** (`session.order.state`): `none`, `checkout_open`, `awaiting_artwork`, `approved`, `with_lab`, `refund_requested`, `refunded`, `cancelled`, and new `needs_attention` (an unexpected state; show a support message, never treat as approved). Your validator must accept `needs_attention`.

**Errors** (`{ error }` with status): 401 `sign_in_required` (sign in, then retry); 400 `disclosure_required`, `disclosure_version_required` (the request had no `disclosureVersion`), `invalid_email`, `invalid_address`, `no_lines`; 409 `disclosure_version_mismatch` (the page showed an older or unknown version: reload so the current text is shown and accepted again), 409 `product_not_available`, `product_not_available_for_artwork` (a chosen product cannot be made for this artwork: go back to product choice); 409 `fulfilment_unavailable` (this account cannot place orders: show the account-unavailable message, not a retry); 502 `shipping_quote_failed` (retry later); 409 `order_already_paid` (call confirm, then continue); 503 `checkout_unavailable` (payments not available; also an invalid `returnPath`); 500 `order_persist_failed` (retry); confirm: 404 `order_not_found` (stale or unknown session id: POST checkout again), 409 `payment_not_confirmed` (the payment did not match the order: do not proceed, show the support message), 404 `session_not_found`.

## 3. Configuration

- **CSP:** the repository sets no Content-Security-Policy today (next.config and middleware have none), so nothing blocks Stripe. If one is added, per Stripe's guide: `script-src https://js.stripe.com`, `frame-src https://js.stripe.com https://hooks.stripe.com`, `connect-src https://api.stripe.com`, `img-src https://*.stripe.com`.
- **Environment (Preview, test mode):** `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` (`pk_test_`), `STRIPE_SECRET_KEY` (`sk_test_`), `PRODIGI_ENV=sandbox` and `PRODIGI_KEY_SANDBOX` (the shipping quote), and a Stripe webhook secret. Observed on Preview: `/api/v1/webhooks/stripe` answers 503 (`STRIPE_WEBHOOK_SECRET` not set) while `/api/v1/print/webhook` verifies signatures (`STRIPE_PRINT_WEBHOOK_SECRET`); both now confirm Gift orders, so either works. The Stripe test endpoint should send `checkout.session.completed` and `charge.refunded`.
- The account must be flagged for fulfilment (`account_flags.fulfilment`) or checkout answers `fulfilment_unavailable`.

## 4. Disclosure (version `2026-10-18-2`, approved wording)

Authoritative: `DISCLOSURE` in `lib/v1/gift/orders.ts`. Show `disclosure.text` exactly as returned (paragraph breaks are `

`), and send `disclosureAccepted: true` together with `disclosureVersion: <the version you displayed>` on every checkout call. Until the first checkout response you do not have it: build the page with the approved version (`2026-10-18-2`) and take the text and version from the response afterwards. A missing version is `400 disclosure_version_required`; a different one is `409 disclosure_version_mismatch`, both before any Stripe session is created or reused. The same text is the Stripe submit message, and the version is stamped on each Stripe session (`metadata.disclosure`). An open session created under an older version is not reused: it is replaced and expired.

Records: the version and time the customer accepted are stored on the Gift session when its order is FIRST created (`disclosure_version`, `disclosure_accepted_at`, shown as `order.disclosureVersion`); a later checkout for the same order (changed details) never rewrites them, so sessions created under `2026-10-16-1` keep that record. Each Stripe session's own metadata records the version it showed.
