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

import { notifyPrintOrder } from '@/lib/v1/print/order-email'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/v1/print/stripe-client'
import { prepareAndPlacePrint } from '@/lib/v1/print/fulfillment'
import {
  getPrintOrderBySessionId,
  markPaid,
  markPlaced,
  markError,
  markWithheld,
  canFulfil,
} from '@/lib/v1/print/db'
import { requireSandboxPrint } from '@/lib/v1/print/owned-source'

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

  // A verified Stripe refund event is notification evidence, never a refund command.
  if(event.type==='charge.refunded'){
    const charge=event.data.object as Stripe.Charge
    if(process.env.VERCEL_ENV==='preview' && charge.livemode)return NextResponse.json({error:'test_refund_required'},{status:409})
    const intent=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id
    if(!intent)return NextResponse.json({ok:true,ignored:true})
    const {data:order,error}=await supabaseAdmin.from('print_orders').select('stripe_session_id').eq('stripe_payment_intent',intent).maybeSingle()
    if(error)return NextResponse.json({error:'order_lookup_failed'},{status:500})
    if(order)for(const refund of charge.refunds?.data||[]){if(refund.status==='succeeded')await notifyPrintOrder(order.stripe_session_id,{id:refund.id,amount:refund.amount})}
    return NextResponse.json({ok:true})
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
    await notifyPrintOrder(session.id)
    return NextResponse.json({ ok: true, deduped: true, status: order.status })
  }

  const squareTest = ['square_8x8','catalog_v2'].includes(session.metadata?.print_test || '')
  if (squareTest) {
    try {
      requireSandboxPrint()
      if (session.livemode || session.payment_status !== 'paid') throw new Error('paid_test_checkout_required')
      if (!order.owner_key || !order.items.length || order.items.some(i=>!Number.isInteger(i.copies)||i.copies<1||i.copies>20)) throw new Error('invalid_print_order')
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'sandbox_required' }, { status: 409 })
    }
  }

  // ── Mark paid ──────────────────────────────────────────────
  try {
    await markPaid(session.id, session.payment_intent as string)
  } catch (err) {
    console.error('[print-webhook] markPaid failed:', err)
    // Don't bail — keep going and update status further down.
  }

  // ── FULFILMENT GATE ────────────────────────────────────────
  // May this account place a real, billable order? Default false, and every
  // failure mode is false — no owner, no flag row, unreachable database.
  //
  // The order is recorded and the payment stands. Only the manufacturing is
  // withheld, and it is withheld silently to Stripe: a 200 stops the retries,
  // because a retry cannot change the answer.
  const allowed = await canFulfil(order.owner_key)
  if (!allowed) {
    const why = order.owner_key
      ? `account ${order.owner_key} is not cleared for fulfilment`
      : 'order has no signed-in owner'
    console.warn(
      `[print-webhook] WITHHELD — ${why}. session=${session.id} ` +
      `items=${order.items.length} retail=$${(order.retail_total_cents / 100).toFixed(2)}. ` +
      `Nothing was sent to Prodigi. Enable with: ` +
      `update account_flags set fulfilment = true where owner_key = '${order.owner_key ?? '<uid>'}';`
    )
    await markWithheld(session.id, why).catch(err =>
      console.error('[print-webhook] markWithheld failed:', err))
    return NextResponse.json({ ok: true, withheld: true, reason: why })
  }

  try {
    const prodigiOrderId=await prepareAndPlacePrint(order,squareTest)
    await markPlaced({sessionId:session.id,prodigiOrderId,wholesaleCents:null})
    return NextResponse.json({ok:true,prodigiOrderId})
  }catch(err){
    const msg=err instanceof Error?err.message:String(err)
    await markError(session.id,msg).catch(()=>{})
    return NextResponse.json({ok:false,error:msg})
  }
}
