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
 * Never throws: if Stripe cannot be asked, the caller mints a fresh session
 * rather than failing the customer's click.
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
    .eq('status', 'pending')
    .eq('locked_style', DISCOVERY_UNLOCK_LOCK)
    .eq('locked_variant', previewId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !ents || ents.length === 0) return null

  for (const row of ents as any[]) {
    if (!row.purchase_id) continue
    const { data: pur } = await supabaseAdmin
      .from('purchases')
      .select('id, status, stripe_session_id, amount_cents, user_id')
      .eq('id', row.purchase_id)
      .maybeSingle()
    if (!pur || pur.status !== 'pending' || pur.user_id !== userId || !pur.stripe_session_id) continue
    try {
      const s = await stripe.checkout.sessions.retrieve(pur.stripe_session_id)
      /* Open, unpaid, and still has a secret to mount. Anything else --
         'complete', 'expired', or a session that has since been paid -- is
         not handed back. */
      if (s.status === 'open' && s.payment_status !== 'paid' && s.client_secret) {
        return {
          clientSecret: s.client_secret,
          sessionId:    s.id,
          purchaseId:   pur.id,
          priceCents:   pur.amount_cents,
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[discovery-unlock] could not read session ${pur.stripe_session_id}: ${msg}`)
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

  /* ── 4b. REUSE BEFORE CREATE ──────────────────────────────────
     On 2026-09-17 six sessions were minted for two intended unlocks and two
     of them were paid -- $5.98 for one piece. The client guard released
     before the modal opened, so every extra click made a new session, a new
     purchase and a new pending entitlement.

     The server is the authority. Before minting anything, look for a
     checkout this customer already has open for this exact piece, and hand
     back the same one. A session Stripe no longer considers open (expired,
     completed, or gone) is not reused; a fresh one replaces it and the stale
     row reaps itself when Stripe expires it.

     NOT ATOMIC, AND NOT CLAIMED TO BE. Two genuinely simultaneous requests
     could both read "none open" before either writes. Rich's ruling,
     2026-09-17: no migration, no partial unique index, no advisory lock.
     The residual race is accepted and parked as payment hardening. This
     removes the observed failure -- ordinary and rapid repeat clicks -- not
     every theoretical one. */
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
  const session = await createBrandedSession(stripe, params)
  if (!session.client_secret) throw new Error('unlock_session_missing_secret')

  // ── 6. Our own rows: the purchase, then the bound entitlement ─
  const { data: purchaseRow, error: purErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      user_id:           args.userId,
      guest_email:       null,
      sku_id:            sku.id,
      stripe_session_id: session.id,
      amount_cents:      sku.price_cents,
      status:            'pending',
    })
    .select('id')
    .single()
  if (purErr) throw new Error(`unlock_purchase_insert_failed: ${purErr.message}`)

  /* BOUND, AND NOT YET SPENDABLE. locked_variant names the one preview this
     may ever unlock; 'pending' keeps it out of portraits/unlock's selection
     (which takes 'available' only) until the payment confirms. */
  const { error: entErr } = await supabaseAdmin
    .from('entitlements')
    .insert({
      purchase_id:    purchaseRow.id,
      user_id:        args.userId,
      guest_email:    null,
      locked_style:   DISCOVERY_UNLOCK_LOCK,
      locked_variant: args.previewId,
      status:         'pending',
    })
  if (entErr) {
    console.error(
      `[discovery-unlock] entitlement insert failed for purchase=${purchaseRow.id} ` +
      `preview=${args.previewId}: ${entErr.message}`,
    )
    throw new Error(`unlock_entitlement_insert_failed: ${entErr.message}`)
  }

  console.log(
    `[discovery-unlock] session ${session.id} purchase=${purchaseRow.id} ` +
    `portfolio=${args.portfolioId} preview=${args.previewId} slot=${item.slot} ${sku.price_cents}c`,
  )

  return {
    clientSecret: session.client_secret,
    sessionId:    session.id,
    purchaseId:   purchaseRow.id,
    priceCents:   sku.price_cents,
  }
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
    console.log(`[discovery-unlock] ACTIVATE entitlement=${ent.id} was not pending — duplicate delivery, no change`)
    return { activated: false, reason: 'not_pending', entitlementId: ent.id }
  }

  console.log(
    `[discovery-unlock] ACTIVATE ok purchase=${purchase.id} entitlement=${ent.id} ` +
    `preview=${previewId} portfolio=${portfolio.id}`,
  )
  return { activated: true, entitlementId: ent.id }
}
