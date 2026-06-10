// app/api/v1/print/webhook/route.ts
//
// Stripe webhook handler. THIS IS THE CRITICAL PATH.
//
// Flow on `checkout.session.completed`:
//   1. Verify Stripe signature (rejects forged calls)
//   2. Load the matching `print_orders` row by session_id
//   3. Idempotency check — bail if already processed
//   4. Mark paid
//   5. For each item: fetch render URL → asset pipeline → signed Supabase URL
//   6. Call Prodigi /Orders with all signed URLs
//   7. Mark placed (or error)
//
// Idempotency: Stripe retries on non-2xx responses. Our session-id keyed DB
// row plus Prodigi's idempotencyKey (set to the same session_id) ensure
// repeated firings don't create duplicate Prodigi orders.
//
// We always return 200 to Stripe once we've recorded the event in our DB.
// If asset pipeline or Prodigi fails, we set status='error' and surface in
// our admin tooling, NOT by failing the webhook. Failing the webhook makes
// Stripe retry up to 3 days, which won't help if the issue is structural.
//
// Local dev: use Stripe CLI to forward webhooks:
//   stripe listen --forward-to localhost:3000/api/v1/print/webhook
// The CLI prints a `whsec_*` secret — put it in .env.local as STRIPE_WEBHOOK_SECRET.

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/v1/print/stripe-client'
import { preparePrintAsset } from '@/lib/v1/print/asset-pipeline'
import { createOrder as createProdigiOrder } from '@/lib/v1/print/prodigi-client'
import {
  getPrintOrderBySessionId,
  markPaid,
  markPlaced,
  markError,
} from '@/lib/v1/print/db'
import { getSku } from '@/lib/v1/print/sku-map'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const sig = (await headers()).get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'No stripe-signature header' }, { status: 400 })
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[print-webhook] Missing STRIPE_WEBHOOK_SECRET in env')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const raw = await req.text()  // must be raw body for signature verification

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    console.error('[print-webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // We only care about successful checkout completion for the print flow.
  if (event.type !== 'checkout.session.completed') {
    console.log(`[print-webhook] ignoring event type: ${event.type}`)
    return NextResponse.json({ ok: true, ignored: event.type })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // ── Idempotency check ──────────────────────────────────────
  const order = await getPrintOrderBySessionId(session.id)
  if (!order) {
    // No DB row for this session — shouldn't happen if /checkout persisted correctly.
    console.error('[print-webhook] no DB row for session', session.id)
    // Return 200 anyway — retrying won't help.
    return NextResponse.json({ ok: false, reason: 'no_db_row' })
  }
  if (order.status !== 'created') {
    console.log(`[print-webhook] session ${session.id} already at status=${order.status}, skipping`)
    return NextResponse.json({ ok: true, deduped: true, status: order.status })
  }

  // ── Mark paid ──────────────────────────────────────────────
  try {
    await markPaid(session.id, session.payment_intent as string)
  } catch (err) {
    console.error('[print-webhook] markPaid failed:', err)
    // Don't bail — keep going and update status further down.
  }

  // ── Asset pipeline per item ────────────────────────────────
  const prodigiItems: Array<{
    sku:    string
    copies: number
    sizing: 'fillPrintArea' | 'fitPrintArea' | 'stretchToPrintArea'
    assets: Array<{ printArea: string; url: string }>
  }> = []

  try {
    for (const item of order.items) {
      console.log(`[print-webhook] preparing asset for renderId=${item.renderId} size=${item.size}`)
      // 1. Fetch source render
      const res = await fetch(item.renderUrl)
      if (!res.ok) throw new Error(`fetch render ${item.renderUrl} → ${res.status}`)
      const buf      = Buffer.from(await res.arrayBuffer())
      const sourceB64 = buf.toString('base64')

      // 2. Upscale + upload + signed URL
      const asset = await preparePrintAsset({
        imageB64: sourceB64,
        renderId: item.renderId,
        size:     item.size,
        finish:   item.finish,
      })

      const skuEntry = getSku(item.size, item.finish)
      prodigiItems.push({
        sku:    skuEntry.sku,
        copies: item.copies,
        sizing: skuEntry.defaultSizing,
        assets: [{ printArea: 'default', url: asset.signedUrl }],
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[print-webhook] asset pipeline failed:', msg)
    await markError(session.id, `asset_pipeline: ${msg}`).catch(() => {})
    return NextResponse.json({ ok: false, error: msg })
  }

  // ── Place Prodigi order ────────────────────────────────────
  try {
    const prodigiRes = await createProdigiOrder({
      shippingMethod:    order.shipping_method as 'Budget' | 'Standard' | 'Express' | 'Overnight',
      idempotencyKey:    session.id,                      // dedupe duplicate webhook firings
      merchantReference: order.prodigi_merchant_ref || session.id,
      recipient: {
        name:  order.shipping_address.name,
        email: order.customer_email,
        address: {
          line1:           order.shipping_address.line1,
          line2:           order.shipping_address.line2,
          postalOrZipCode: order.shipping_address.postcode,
          countryCode:     order.shipping_address.countryCode.toUpperCase(),
          townOrCity:      order.shipping_address.city,
          stateOrCounty:   order.shipping_address.state,
        },
      },
      items: prodigiItems,
    })

    await markPlaced({
      sessionId:      session.id,
      prodigiOrderId: prodigiRes.order.id,
      wholesaleCents: null,  // could derive from a re-quote if needed
    })

    console.log(`[print-webhook] placed at Prodigi: ${prodigiRes.order.id} for session ${session.id}`)
    return NextResponse.json({ ok: true, prodigiOrderId: prodigiRes.order.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[print-webhook] Prodigi order placement failed:', msg)
    await markError(session.id, `prodigi: ${msg}`).catch(() => {})
    return NextResponse.json({ ok: false, error: msg })
  }
}
