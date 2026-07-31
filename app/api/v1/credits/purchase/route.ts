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

  // ── Return URLs ─────────────────────────────────────────────
  // Same-origin only. A return url is where the customer lands after paying;
  // accepting an arbitrary host makes this an open redirect.
  const base = safeReturn(body.returnUrl, appUrl)

  // ── Session ─────────────────────────────────────────────────
  let session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: sku.stripe_price_id, quantity: 1 }],
      success_url: appendQuery(base, 'credits=1&session_id={CHECKOUT_SESSION_ID}'),
      cancel_url:  appendQuery(base, 'canceled=1'),
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

  if (!session.url) {
    return NextResponse.json({ error: 'stripe_session_missing_url' }, { status: 502 })
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

  return NextResponse.json({
    url:       session.url,
    sessionId: session.id,
    credits:   sku.count,
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
