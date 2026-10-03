import { notifyPrintOrder } from '@/lib/v1/print/order-email'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
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

export async function handlePrintWebhook(event: Stripe.Event) {
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
