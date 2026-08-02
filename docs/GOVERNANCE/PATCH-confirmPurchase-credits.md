# PATCH — confirmPurchase must land credits

**2026-07-31 · CUI V23.** Reviewed and applied by Rich.
Target: `lib/store/entitlements.ts`, `confirmPurchase`, around line 322.

---

## WHY

The Stripe webhook is model-agnostic and well built — it verifies the
signature, dispatches on event type, and always returns 200 after
verification because Stripe retries on non-2xx. It hands `stripeSessionId`
and `stripeChargeId` to `confirmPurchase` and knows nothing about what was
bought.

**`confirmPurchase` is the only place that knows.** It flips the purchase to
`paid`, then queries `entitlements`. That query is the single
entitlement-specific line in the whole payment path.

A credit purchase writes the same `purchases` row and has no entitlements.
Without this patch it is marked paid and **nothing reaches the ledger** — the
customer is charged and receives nothing.

---

## THE CHANGE

In `confirmPurchase`, immediately after the status update succeeds and
**before** the entitlements query, insert:

```ts
  // ── Credits ───────────────────────────────────────────────
  // A credit block has no entitlements; the payment lands in the ledger
  // instead. grant_credits is idempotent by ref_id, so a replayed webhook
  // delivery credits once — belt and braces alongside the charge-id guard
  // above, because the two protect against different failures: that guard
  // catches a full replay, this catches a partial one where the status
  // update landed and the grant did not.
  const { data: sku } = await supabaseAdmin
    .from('skus')
    .select('kind, count')
    .eq('id', existing.sku_id)
    .maybeSingle()

  if (sku?.kind === 'credits') {
    const owner = existing.user_id
    if (!owner) {
      // Guest was removed 2026-07-27 and the purchase route refuses without
      // an owner, so this cannot happen through the front door. If it does,
      // the money is real and the credits have nowhere to go — log loudly
      // and leave the purchase paid for manual reconciliation. Throwing
      // would make Stripe retry forever against a row that will never work.
      console.error(
        '[confirmPurchase] credits purchase has no owner',
        existing.id, args.stripeSessionId,
      )
      return { purchaseId: existing.id, entitlementIds: [] }
    }

    const { data: balance, error: grantErr } = await supabaseAdmin.rpc(
      'grant_credits',
      {
        p_owner:  owner,
        p_n:      sku.count,
        p_reason: 'purchase',
        p_ref:    args.stripeSessionId,
      },
    )
    if (grantErr) {
      // Do throw here. The purchase is paid and the credits are not granted;
      // a Stripe retry is exactly what should happen, and grant_credits is
      // idempotent so the retry is safe.
      throw new Error(`credit_grant_failed: ${grantErr.message}`)
    }

    console.log(
      `[confirmPurchase] credits +${sku.count} owner=${owner} balance=${balance} session=${args.stripeSessionId}`,
    )
    return { purchaseId: existing.id, entitlementIds: [] }
  }
```

**`existing.sku_id` and `existing.user_id` must be added to the select at the
top of the function.** It currently reads:

```ts
    .select('id, status, stripe_charge_id')
```

and needs:

```ts
    .select('id, status, stripe_charge_id, sku_id, user_id')
```

Without that the two fields are `undefined` and the branch never fires.

---

## WHAT IS DELIBERATELY NOT DONE

**No rollback of the paid status if the grant fails.** The purchase is paid —
that is a fact about the world, not a state we choose. Throwing makes Stripe
retry, and `grant_credits` is idempotent, so a retry is correct and safe.
Un-paying a paid purchase would be a lie in the ledger.

**No touching the entitlements path.** Singles and bundles behave exactly as
before. This is a branch, not a rewrite, and `/store` still runs on the old
model until it is retired.

---

## VERIFY AFTER APPLYING

With the Stripe CLI forwarding:

```
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

1. Buy 60 credits with test card `4242 4242 4242 4242`
2. Ledger shows one row: `delta 60, reason 'purchase', ref_id cs_test_...`
3. Balance is 60
4. **Replay the event from the Stripe dashboard.** Balance stays 60 and no
   second ledger row appears. This is the test that matters — everything
   else is arithmetic, and this is the one that protects the customer.
