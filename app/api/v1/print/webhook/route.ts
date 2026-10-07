// app/api/v1/print/webhook/route.ts
//
// Stripe webhook handler. THIS IS THE CRITICAL PATH.
//
// Flow on `checkout.session.completed`:
//   1. Verify Stripe signature (rejects forged calls)
//   2. Load the matching `print_orders` row by session_id
//   3. Idempotency check — bail if already processed
//   4. Mark paid
//   5. FULFILMENT GATE — may this account place a real order? (CUI V24)
//   6. For each item: fetch render URL → asset pipeline → signed Supabase URL
//   7. Call Prodigi /Orders with all signed URLs
//   8. Mark placed (or error)
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
// The CLI prints a `whsec_*` secret — put it in .env.local as STRIPE_PRINT_WEBHOOK_SECRET.
//
// ── CUI V24 · 2026-08-01 · THE FULFILMENT GATE ───────────────────────────
//
//   Nothing stood between a tester with granted credits and a real, billable
//   print. LOCKED-DECISIONS has said since 27 July that a per-account flag
//   gates this; it had never been built.
//
//   Checked 2026-08-01: PRODIGI_ENV reads 'sandbox', so nothing has in fact
//   been billable. The risk arrives the moment it reads 'live'. This is the
//   guard that must be in place before it does.
//
//   The gate sits AFTER markPaid and BEFORE the asset pipeline. That order is
//   deliberate:
//
//     · after paid, because the payment is real and the row must say so
//       whatever happens next. A withheld order is a paid order.
//     · before the pipeline, because upscaling and uploading an asset for an
//       order that will never be manufactured costs time and storage for
//       nothing.
//
//   A withheld order gets its own status, not 'error'. Nothing went wrong: it
//   is the guard doing its job. Filing it as an error would bury the orders
//   that genuinely need a human under the ones that do not.
//
//   Password-gating the Print Shop is NOT this protection. That controls who
//   reaches the button; this controls whether the button reaches Prodigi.

import { handlePrintWebhook } from '@/lib/v1/print/webhook-handler'
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
  markWithheld,
  canFulfil,
} from '@/lib/v1/print/db'
import { getSku } from '@/lib/v1/print/sku-map'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const sig = (await headers()).get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'No stripe-signature header' }, { status: 400 })
  }
  const secret = process.env.STRIPE_PRINT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[print-webhook] Missing STRIPE_PRINT_WEBHOOK_SECRET in env')
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

  return handlePrintWebhook(event)
}
