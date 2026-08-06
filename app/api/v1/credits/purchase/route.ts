// app/api/v1/credits/purchase/route.ts
//
// Buy a credit block. Creates a Stripe Checkout session and a pending
// purchase row; the webhook lands the credits.
//
// WHY THIS IS NOT /api/v1/checkout
//   That route sells ENTITLEMENTS — createCartCheckout writes one row per
//   piece with locked_style and locked_variant, and the status route signs a
//   result token for a specific job. That is preview-then-unlock, superseded
//   2026-07-27 (LOCKED-DECISIONS). Credits buy into a ledger and are spent
//   later against anything. Different shape, not a different payload.
//
// WHAT IS REUSED
//   The purchases table, unchanged: stripe_session_id, amount_cents, status.
//   It is model-agnostic; only the entitlements JOIN was specific.
//
// PRICE AUTHORITY
//   The client sends a SKU id and nothing else. Never an amount, never a
//   credit count. The row holds the price, Stripe holds the price, and the
//   two are checked against each other before a session is made. A client
//   total is not validated here because none is accepted.
//
// CUI V24 · 2026-08-02 · EMBEDDED CHECKOUT
//
//   Ruled by Rich: the customer buys credits without leaving the workshop.
//   Hosted checkout took the whole window, so a shortfall meant leaving
//   mid-craft and finding their way back — the queue, the photograph and the
//   pose all held only by the resume machinery, and the studio replaced by
//   a Stripe page.
//
//   ui_mode 'embedded' returns a client_secret instead of a url. The form
//   renders inside our own slide-out, styled with Stripe's appearance API,
//   and the customer watches their balance change without the studio ever
//   going away.
//
//   WHAT DID NOT CHANGE: the price is still the SKU's, still checked against
//   Stripe before a session exists, and the webhook still lands the credits.
//   This is where the form is drawn, not who decides what it costs.
//
//   return_url replaces success_url and cancel_url — embedded sessions take
//   one. There is no cancel: the customer closes the slide-out, the session
//   expires on its own, and the pending row is never confirmed.

import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getAppUrl } from '@/lib/store/stripe'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const skuId = typeof body.skuId === 'string' ? body.skuId : ''
  if (!skuId) {
    return NextResponse.json({ error: 'sku_required' }, { status: 400 })
  }

  // ── Identity ────────────────────────────────────────────────
  // Guest was removed 2026-07-27. The gate refuses without an owner, so
  // there is no anonymous purchase path to support: money cannot land in a
  // ledger that has no owner_key.
  const ownerKey = typeof body.ownerKey === 'string' ? body.ownerKey.trim() : ''
  if (!ownerKey) {
    return NextResponse.json({ error: 'identity_required' }, { status: 401 })
  }

  // ── The SKU is the price ────────────────────────────────────
  const { data: sku, error: skuErr } = await supabaseAdmin
    .from('skus')
    .select('id, display_name, kind, count, price_cents, stripe_price_id, active')
    .eq('id', skuId)
    .maybeSingle()

  if (skuErr) {
    console.error('[credits/purchase] sku read failed', skuErr.message)
    return NextResponse.json({ error: 'read_failed' }, { status: 500 })
  }
  if (!sku)          return NextResponse.json({ error: 'sku_not_found' }, { status: 404 })
  if (!sku.active)   return NextResponse.json({ error: 'sku_inactive' }, { status: 404 })
  if (sku.kind !== 'credits') {
    // A single or bundle reaching this route means the caller is wired to the
    // wrong path. Refuse rather than half-fulfil.
    return NextResponse.json({ error: 'sku_not_credits' }, { status: 400 })
  }

  const stripe = getStripe()
  const appUrl = getAppUrl()

  // ── Price agreement ─────────────────────────────────────────
  // The row and Stripe both carry an amount. If they disagree the customer
  // is charged one and credited against the other, so stop before the
  // session exists rather than reconciling afterwards.
  try {
    const price = await stripe.prices.retrieve(sku.stripe_price_id)
    if (!price.active) {
      return NextResponse.json({ error: 'stripe_price_inactive' }, { status: 409 })
    }
    if (price.unit_amount !== sku.price_cents) {
      console.error(
        `[credits/purchase] price mismatch ${sku.id}: db=${sku.price_cents} stripe=${price.unit_amount}`,
      )
      return NextResponse.json({ error: 'price_mismatch' }, { status: 409 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[credits/purchase] price retrieve failed', msg)
    return NextResponse.json({ error: 'stripe_price_unavailable' }, { status: 502 })
  }

  // ── Return URL ──────────────────────────────────────────────
  // Same-origin only. Stripe sends the customer here when the payment
  // completes; accepting an arbitrary host makes this an open redirect.
  //
  // Embedded sessions take ONE url and no cancel. Closing the slide-out is
  // the cancel: the session expires by itself and the pending row is simply
  // never confirmed.
  const base = safeReturn(body.returnUrl, appUrl)

  // ── Session ─────────────────────────────────────────────────
  let session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded',
      line_items: [{ price: sku.stripe_price_id, quantity: 1 }],
      return_url: appendQuery(base, 'credits=1&session_id={CHECKOUT_SESSION_ID}'),
      client_reference_id: ownerKey,
      metadata: {
        kind:      'credits',
        skuId:     sku.id,
        credits:   String(sku.count),
        ownerKey,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[credits/purchase] session create failed', msg)
    return NextResponse.json({ error: 'checkout_failed' }, { status: 502 })
  }

  // An embedded session carries a client_secret, never a url. If it is
  // missing the form cannot be drawn, and saying so here is better than a
  // slide-out that opens on nothing.
  if (!session.client_secret) {
    return NextResponse.json({ error: 'stripe_session_missing_secret' }, { status: 502 })
  }

  // ── Pending purchase row ────────────────────────────────────
  // Written after the session so there is never a row without a session to
  // confirm it. The reverse — a session with no row — is recoverable: the
  // webhook finds nothing, logs, and the session expires on its own.
  const { error: purErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      user_id:           ownerKey,
      sku_id:            sku.id,
      stripe_session_id: session.id,
      amount_cents:      sku.price_cents,
      status:            'pending',
    })

  if (purErr) {
    // The session exists and we cannot confirm it. Say so plainly rather
    // than sending the customer to a checkout that will never land.
    console.error('[credits/purchase] purchase insert failed', purErr.message, session.id)
    return NextResponse.json({ error: 'purchase_insert_failed' }, { status: 500 })
  }

  console.log(
    `[credits/purchase] ${sku.id} ${sku.count}cr $${(sku.price_cents / 100).toFixed(2)} owner=${ownerKey} session=${session.id}`,
  )

  // The stage is a static HTML file — no build step, no process.env. The
  // publishable key can only reach the browser in a response, so it travels
  // with the client secret. It is the one Stripe key meant to be public;
  // the secret key never leaves the server.
  return NextResponse.json({
    clientSecret:   session.client_secret,   // ← was `url`; the form is ours now
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '',
    sessionId:      session.id,
    credits:        sku.count,
    amountCents:    sku.price_cents,
    label:          sku.display_name,
  })
}

// ── helpers ───────────────────────────────────────────────────

function safeReturn(returnUrl: unknown, appUrl: string): string {
  const fallback = `${appUrl}/portraits.html`
  if (typeof returnUrl !== 'string' || !returnUrl) return fallback
  try {
    const u = new URL(returnUrl, appUrl)
    if (u.origin !== new URL(appUrl).origin) return fallback
    return `${u.origin}${u.pathname}`
  } catch {
    return fallback
  }
}

function appendQuery(url: string, query: string): string {
  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`
}
