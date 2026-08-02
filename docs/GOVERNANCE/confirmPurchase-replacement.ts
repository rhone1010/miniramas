export async function confirmPurchase(args: {
  stripeSessionId: string
  stripeChargeId:  string
}): Promise<{ purchaseId: string; entitlementIds: string[] }> {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from('purchases')
    .select('id, status, stripe_charge_id, sku_id, user_id')
    .eq('stripe_session_id', args.stripeSessionId)
    .maybeSingle()
  if (readErr) throw new Error(`purchase_read_failed: ${readErr.message}`)
  if (!existing) throw new Error(`purchase_not_found: ${args.stripeSessionId}`)

  if (existing.status === 'paid' && existing.stripe_charge_id === args.stripeChargeId) {
    // Already confirmed — return entitlements for the response shape.
    // A credits purchase has none, and grant_credits already ran; it is
    // idempotent by ref_id so nothing needs undoing here.
    const { data: ents } = await supabaseAdmin
      .from('entitlements')
      .select('id')
      .eq('purchase_id', existing.id)
    return { purchaseId: existing.id, entitlementIds: (ents ?? []).map((e) => e.id) }
  }

  const { error: updErr } = await supabaseAdmin
    .from('purchases')
    .update({
      status:           'paid',
      stripe_charge_id: args.stripeChargeId,
      paid_at:          new Date().toISOString(),
    })
    .eq('id', existing.id)
  if (updErr) throw new Error(`purchase_confirm_failed: ${updErr.message}`)

  // ── Credits ───────────────────────────────────────────────
  // A credit block has no entitlements; the payment lands in the ledger
  // instead. Without this branch the purchase is marked paid and nothing
  // reaches the customer's balance — charged, no goods, no error.
  //
  // grant_credits is idempotent by ref_id. That is belt-and-braces beside
  // the charge-id guard above, because the two catch different failures:
  // the guard catches a full replay, this catches a partial one where the
  // status update landed and the grant did not.
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
      // would make Stripe retry forever against a row that can never work.
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
      // Do throw. The purchase is paid and the credits are not granted; a
      // Stripe retry is exactly what should happen, and grant_credits is
      // idempotent so the retry is safe.
      throw new Error(`credit_grant_failed: ${grantErr.message}`)
    }

    console.log(
      `[confirmPurchase] credits +${sku.count} owner=${owner} balance=${balance} session=${args.stripeSessionId}`,
    )
    return { purchaseId: existing.id, entitlementIds: [] }
  }

  // ── Entitlements — singles and bundles, unchanged ──────────
  const { data: ents, error: entsErr } = await supabaseAdmin
    .from('entitlements')
    .select('id')
    .eq('purchase_id', existing.id)
  if (entsErr) throw new Error(`purchase_confirm_ent_query_failed: ${entsErr.message}`)

  return { purchaseId: existing.id, entitlementIds: (ents ?? []).map((e) => e.id) }
}
