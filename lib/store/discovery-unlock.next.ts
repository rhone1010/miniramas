// lib/store/discovery-unlock.ts
//
// THE ADDITIONAL DISCOVERY UNLOCK — $2.99, one piece, paid.
// Phase 1 A4. Rich's rulings, 2026-09-17.
//
// WHAT WAS BROKEN. The old path posted the Discovery unlock at the shared
// cart route. Three joints were wrong and they were stacked, so only the
// first was ever visible:
//   1. PRICE   — the client sent 299c, checkout.ts's VOLUME_LADDER answered
//                399c at n=1, and createCartCheckout threw price_mismatch
//                before Stripe. Observed on Preview 2026-09-16 23:12:05Z.
//   2. SHAPE   — createCartCheckout builds a HOSTED session and the route
//                answers { url }, while Discovery's modal needs a
//                clientSecret. Latent behind (1).
//   3. SCOPE   — portraits/unlock only spends entitlements on the
//                PORTFOLIO's own purchase. A paid unlock mints its own
//                purchase, so it was excluded by construction. The route
//                says so itself: "Paid additional unlocks are not built yet."
//
// This file is the Discovery-specific path that repairs all three at once.
// The legacy cart (createCartCheckout, VOLUME_LADDER, the pieces flow) is
// not touched: nothing here imports it and nothing there changes.
//
// PRICE AUTHORITY IS THE SKU ROW, NOT A CONSTANT HERE. `unlock_addon_1` is
// already seeded and active at 299c with a real Stripe price. The server
// reads it, and cross-checks it against Stripe before a session exists --
// the same guard credits/purchase uses. A number in this file could drift
// from the button; a row that Stripe agrees with cannot.
//
// METADATA IS CONTEXT, NOT AUTHORIZATION. The session carries canonical ids
// so a human reading a Stripe dashboard can tell what was bought. Nothing
// downstream trusts them: the binding that matters is the entitlement row
// written here, AFTER the caller's ownership of that exact piece has been
// checked against the database. On confirmation we re-read our own rows and
// re-verify the chain. Forged client metadata cannot mint anything.
//
// THE ENTITLEMENT IS BORN 'pending'. It is bound to one preview and is not
// spendable until payment confirms, because portraits/unlock only ever
// selects 'available'. That also makes failure clean: handlePaymentFailure
// already deletes pending and available rows for a purchase
// (entitlements.ts:456-461), so an abandoned checkout reaps itself.

import type Stripe from 'stripe'
import { getStripe } from './stripe'
import { createBrandedSession } from './stripe-branding'
import { supabaseAdmin } from '@/lib/supabase'

/** The seeded, active SKU for one additional Discovery unlock. */
export const DISCOVERY_UNLOCK_SKU_ID = 'unlock_addon_1'

/** Marks an entitlement as belonging to this path. Paired with
 *  locked_variant = the preview id it may be spent on, and nothing else. */
export const DISCOVERY_UNLOCK_LOCK = 'discovery_unlock'

export interface DiscoveryUnlockCheckout {
  clientSecret: string
  sessionId:    string
  purchaseId:   string
  priceCents:   number
}

/* The ledger's email column carries `portfolio:{portfolioId}:{slot}` — the
   key portfolio-render.ts:184 writes. Same parse the unlock route uses. */
function portfolioIdFromLedgerEmail(email: string | null): string | null {
  if (!email) return null
  const m = /^portfolio:([0-9a-f-]{36}):(\d+)$/i.exec(email)
  return m ? m[1] : null
}

/**
 * An unlock checkout this customer already has open for this exact preview,
 * or null. Reads our own pending rows, then asks Stripe whether the session
 * is still usable -- a row alone is not evidence that a session is open.
 *
 * Lookup failures fail closed: an unknown payment state must never create
 * another checkout for the same piece.
 */
async function findReusableSession(
  stripe: Stripe, userId: string, previewId: string,
): Promise<DiscoveryUnlockCheckout | null> {
  /* Two plain reads rather than a join. This is a money path and it is read
     by people; `purchases!inner(...)` buys nothing here except a shape that
     is harder to check. */
  const { data: ents, error } = await supabaseAdmin
    .from('entitlements')
    .select('id, purchase_id')
    .eq('locked_style', DISCOVERY_UNLOCK_LOCK)
    .eq('locked_variant', previewId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`unlock_reuse_lookup_failed: ${error.message}`)
  if (!ents || ents.length === 0) return null

  for (const row of ents as any[]) {
    if (!row.purchase_id) continue
    const { data: pur, error: purErr } = await supabaseAdmin
      .from('purchases')
      .select('id, status, stripe_session_id, amount_cents, user_id')
      .eq('id', row.purchase_id)
      .maybeSingle()
    if (purErr) throw new Error(`unlock_reuse_purchase_failed: ${purErr.message}`)
    if (!pur || pur.user_id !== userId || !pur.stripe_session_id) throw new Error('unlock_reuse_purchase_missing')
    if (pur.status === 'paid') throw new Error('unlock_payment_already_completed')
    try {
      const s = await stripe.checkout.sessions.retrieve(pur.stripe_session_id)
      if (s.payment_status === 'paid' || s.status === 'complete') throw new Error('unlock_payment_already_completed')
      /* Open, unpaid, and still has a secret to mount. Anything else --
         'complete', 'expired', or a session that has since been paid -- is
         not handed back. */
      if (s.status === 'open' && s.client_secret) {
        return {
          clientSecret: s.client_secret,
          sessionId:    s.id,
          purchaseId:   pur.id,
          priceCents:   pur.amount_cents,
        }
      }
      if (s.status !== 'expired') throw new Error('unlock_session_state_unknown')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`unlock_reuse_session_failed: ${msg}`)
    }
  }
  return null
}

/**
 * Create the embedded Stripe session for one additional unlock.
 *
 * Every id is checked against the database before Stripe is called, so a
 * session only ever exists for a piece this customer actually owns and that
 * is actually still locked.
 */
export async function createDiscoveryUnlockCheckout(args: {
  userId:      string
  portfolioId: string
  previewId:   string
  returnUrl:   string
}): Promise<DiscoveryUnlockCheckout> {
  if (!args.userId)      throw new Error('unlock_requires_user')
  if (!args.portfolioId) throw new Error('unlock_portfolio_required')
  if (!args.previewId)   throw new Error('unlock_preview_required')

  // ── 1. The portfolio is this customer's ──────────────────────
  const { data: portfolio, error: pErr } = await supabaseAdmin
    .from('portfolios')
    .select('id, user_id, series')
    .eq('id', args.portfolioId)
    .maybeSingle()
  if (pErr) throw new Error(`unlock_portfolio_lookup_failed: ${pErr.message}`)
  if (!portfolio) throw new Error('unlock_portfolio_not_found')
  if (portfolio.user_id !== args.userId) throw new Error('unlock_wrong_owner')

  // ── 2. The preview is a piece OF that portfolio ──────────────
  //    Not "a preview this user owns" — this exact portfolio's item.
  const { data: item, error: iErr } = await supabaseAdmin
    .from('portfolio_items')
    .select('id, slot, status, preview_id')
    .eq('portfolio_id', args.portfolioId)
    .eq('preview_id', args.previewId)
    .maybeSingle()
  if (iErr) throw new Error(`unlock_item_lookup_failed: ${iErr.message}`)
  if (!item) throw new Error('unlock_preview_not_in_portfolio')
  if (item.status !== 'done') throw new Error('unlock_preview_not_ready')

  // ── 3. It is still locked ────────────────────────────────────
  const { data: ledger, error: lErr } = await supabaseAdmin
    .from('preview_ledger')
    .select('id, email, unlocked_at')
    .eq('id', args.previewId)
    .maybeSingle()
  if (lErr) throw new Error(`unlock_ledger_lookup_failed: ${lErr.message}`)
  if (!ledger) throw new Error('unlock_preview_not_found')
  if (ledger.unlocked_at) throw new Error('unlock_already_unlocked')
  /* The ledger names its own portfolio. If that disagrees with the one the
     caller asked about, the two records are inconsistent and nothing is sold
     until a human has looked. */
  const ledgerPortfolio = portfolioIdFromLedgerEmail(ledger.email)
  if (ledgerPortfolio !== args.portfolioId) {
    throw new Error('unlock_preview_portfolio_mismatch')
  }

  // ── 4. The price is the SKU's, and Stripe must agree ─────────
  const { data: sku, error: sErr } = await supabaseAdmin
    .from('skus')
    .select('id, price_cents, stripe_price_id, active')
    .eq('id', DISCOVERY_UNLOCK_SKU_ID)
    .maybeSingle()
  if (sErr) throw new Error(`unlock_sku_lookup_failed: ${sErr.message}`)
  if (!sku || !sku.active) throw new Error('unlock_sku_unavailable')
  if (!sku.stripe_price_id) throw new Error('unlock_sku_missing_price')

  const stripe = getStripe()
  const price = await stripe.prices.retrieve(sku.stripe_price_id)
  if (price.unit_amount !== sku.price_cents) {
    console.error(
      `[discovery-unlock] price mismatch ${sku.id}: db=${sku.price_cents} stripe=${price.unit_amount}`,
    )
    throw new Error('unlock_price_mismatch')
  }

  // Retain legacy open sessions. New sessions use a persisted reservation,
  // a Stripe idempotency key, and atomic purchase/entitlement persistence.
  const reusable = await findReusableSession(stripe, args.userId, args.previewId)
  if (reusable) {
    console.log(
      `[discovery-unlock] reusing open session ${reusable.sessionId} purchase=${reusable.purchaseId} ` +
      `preview=${args.previewId} -- no new session, purchase or entitlement`,
    )
    return reusable
  }

  // ── 5. The session ───────────────────────────────────────────
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    ui_mode: 'embedded',
    redirect_on_completion: 'if_required',
    return_url: args.returnUrl,
    line_items: [{ price: sku.stripe_price_id, quantity: 1 }],
    /* CONTEXT, NOT AUTHORIZATION. Canonical ids only — never a display
       label, which is what the old path sent (`preset: p.name`). */
    metadata: {
      kind:        'discovery_unlock',
      portfolioId: args.portfolioId,
      previewId:   args.previewId,
      userId:      args.userId,
      slot:        String(item.slot),
    },
  }
  const reserve = async (expiredAttempt: string | null = null) => {
    const { data, error } = await supabaseAdmin.rpc('reserve_discovery_unlock', {
      p_preview: args.previewId, p_user: args.userId, p_params: params,
      p_amount: sku.price_cents, p_expired_attempt: expiredAttempt,
    })
    if (error || !data) throw new Error(`unlock_reservation_failed: ${error?.message ?? 'no reservation'}`)
    return data
  }
  let attempt = await reserve()
  let session: Stripe.Checkout.Session | null = null
  if (attempt.session_id) {
    session = await stripe.checkout.sessions.retrieve(attempt.session_id)
    if (session.payment_status === 'paid' || session.status === 'complete') {
      throw new Error('unlock_payment_already_completed')
    }
    if (session.status === 'expired') {
      attempt = await reserve(attempt.attempt_id)
      session = attempt.session_id ? await stripe.checkout.sessions.retrieve(attempt.session_id) : null
    }
  }
  if (!session) {
    // Stripe retains keys for at least 24h. Never retry an ambiguous creation
    // beyond that retention window: reconcile it instead of risking a second charge.
    if (Date.now() - Date.parse(attempt.created_at) >= 23 * 60 * 60 * 1000) {
      throw new Error('unlock_checkout_requires_reconciliation')
    }
    session = await createBrandedSession(stripe, attempt.params, {
      idempotencyKey: `discovery-unlock:${attempt.attempt_id}`,
    })
  }
  if (session.status !== 'open' || session.payment_status === 'paid') {
    throw new Error('unlock_payment_not_open')
  }
  if (!session.client_secret) throw new Error('unlock_session_missing_secret')
  // Do not return a payable secret until BOTH local records are committed.
  const { data: purchaseId, error: completeErr } = await supabaseAdmin.rpc('complete_discovery_unlock_checkout', {
    p_preview: args.previewId, p_user: args.userId,
    p_attempt: attempt.attempt_id, p_session: session.id,
  })
  if (completeErr || !purchaseId) throw new Error(`unlock_checkout_persist_failed: ${completeErr?.message ?? 'no purchase'}`)
  return { clientSecret: session.client_secret, sessionId: session.id, purchaseId, priceCents: attempt.amount_cents }

}

/**
 * Confirmation. Called from the Stripe webhook after confirmPurchase has
 * marked the purchase paid.
 *
 * IDEMPOTENT. The flip is a conditional update on status='pending'; a second
 * delivery of the same event matches no rows and says so. Nothing here
 * depends on the event arriving exactly once.
 *
 * It re-reads our own persisted rows and re-verifies the chain
 * (purchase -> entitlement -> ledger -> portfolio -> owner) rather than
 * trusting the session metadata it was handed.
 */
export async function activateDiscoveryUnlock(args: {
  stripeSessionId: string
}): Promise<{ activated: boolean; reason?: string; entitlementId?: string }> {
  const { data: purchase, error: purErr } = await supabaseAdmin
    .from('purchases')
    .select('id, user_id, status, sku_id')
    .eq('stripe_session_id', args.stripeSessionId)
    .maybeSingle()
  if (purErr) {
    console.error(`[discovery-unlock] ACTIVATE purchase lookup failed session=${args.stripeSessionId}: ${purErr.message}`)
    throw new Error(`unlock_activate_purchase_lookup_failed: ${purErr.message}`)
  }
  if (!purchase) {
    console.error(`[discovery-unlock] ACTIVATE no purchase row for session=${args.stripeSessionId} — payment taken, nothing to bind`)
    return { activated: false, reason: 'purchase_not_found' }
  }
  if (purchase.status !== 'paid') {
    console.error(`[discovery-unlock] ACTIVATE purchase=${purchase.id} is '${purchase.status}', not paid — refusing to mint`)
    return { activated: false, reason: 'purchase_not_paid' }
  }

  // The entitlement written at session time. It carries the binding.
  const { data: ents, error: entErr } = await supabaseAdmin
    .from('entitlements')
    .select('id, status, locked_style, locked_variant, user_id')
    .eq('purchase_id', purchase.id)
    .eq('locked_style', DISCOVERY_UNLOCK_LOCK)
    .order('created_at', { ascending: true })
  if (entErr) {
    console.error(`[discovery-unlock] ACTIVATE entitlement lookup failed purchase=${purchase.id}: ${entErr.message}`)
    throw new Error(`unlock_activate_entitlement_lookup_failed: ${entErr.message}`)
  }
  if (!ents || ents.length === 0) {
    console.error(
      `[discovery-unlock] ACTIVATE purchase=${purchase.id} is PAID but carries no bound entitlement — ` +
      `session=${args.stripeSessionId}. Money taken, nothing to spend. Reconcile by hand.`,
    )
    return { activated: false, reason: 'entitlement_missing' }
  }

  const ent = ents[0]
  if (ent.status === 'available' || ent.status === 'consumed') {
    // A duplicate delivery, or the customer already spent it. Both fine.
    console.log(`[discovery-unlock] ACTIVATE purchase=${purchase.id} already '${ent.status}' — duplicate delivery, no change`)
    return { activated: false, reason: 'already_' + ent.status, entitlementId: ent.id }
  }

  // ── Revalidate the chain from persisted state, not from metadata ──
  const previewId = ent.locked_variant
  if (!previewId) {
    console.error(`[discovery-unlock] ACTIVATE entitlement=${ent.id} has no bound preview — refusing`)
    return { activated: false, reason: 'entitlement_unbound' }
  }
  const { data: ledger } = await supabaseAdmin
    .from('preview_ledger')
    .select('id, email')
    .eq('id', previewId)
    .maybeSingle()
  const boundPortfolioId = portfolioIdFromLedgerEmail(ledger?.email ?? null)
  if (!boundPortfolioId) {
    console.error(`[discovery-unlock] ACTIVATE preview=${previewId} names no portfolio — refusing`)
    return { activated: false, reason: 'preview_unbound' }
  }
  const { data: portfolio } = await supabaseAdmin
    .from('portfolios')
    .select('id, user_id')
    .eq('id', boundPortfolioId)
    .maybeSingle()
  if (!portfolio) {
    console.error(`[discovery-unlock] ACTIVATE portfolio=${boundPortfolioId} not found — refusing`)
    return { activated: false, reason: 'portfolio_not_found' }
  }
  /* The piece must belong to the account that paid. This is the check that
     makes forged client metadata worthless: whatever the session said, the
     entitlement only becomes spendable if OUR rows agree. */
  if (portfolio.user_id !== purchase.user_id || ent.user_id !== purchase.user_id) {
    console.error(
      `[discovery-unlock] ACTIVATE owner mismatch: purchase=${purchase.id} user=${purchase.user_id} ` +
      `portfolio=${portfolio.id} user=${portfolio.user_id} entitlement=${ent.id} user=${ent.user_id} — refusing`,
    )
    return { activated: false, reason: 'owner_mismatch' }
  }

  // ── The flip, conditional so a repeat is a no-op ──────────────
  const { data: flipped, error: flipErr } = await supabaseAdmin
    .from('entitlements')
    .update({ status: 'available' })
    .eq('id', ent.id)
    .eq('status', 'pending')
    .select('id')
  if (flipErr) {
    console.error(
      `[discovery-unlock] ACTIVATE flip failed entitlement=${ent.id} purchase=${purchase.id}: ${flipErr.message}. ` +
      `Payment succeeded and the unlock is NOT spendable. Reconcile by hand.`,
    )
    throw new Error(`unlock_activate_flip_failed: ${flipErr.message}`)
  }
  if (!flipped || flipped.length === 0) {
    const { data: current, error: currentErr } = await supabaseAdmin.from('entitlements')
      .select('status').eq('id', ent.id).maybeSingle()
    if (currentErr || !current || !['available', 'consumed'].includes(current.status)) {
      throw new Error('unlock_activate_state_unconfirmed')
    }
    return { activated: false, reason: 'already_' + current.status, entitlementId: ent.id }
  }

  console.log(
    `[discovery-unlock] ACTIVATE ok purchase=${purchase.id} entitlement=${ent.id} ` +
    `preview=${previewId} portfolio=${portfolio.id}`,
  )
  return { activated: true, entitlementId: ent.id }
}
