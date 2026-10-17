import { notifyPrintOrder } from '@/lib/v1/print/order-email'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { assetRuntime } from '@/lib/v1/print/upscale/runtime'
import { enqueueOrderJobs } from '@/lib/v1/print/upscale/orders'
import { pipelineHoldReason, pipelineState } from '@/lib/v1/print/upscale/pipeline'
import {
  getPrintOrderBySessionId,
  markPaid,
  markError,
  markWithheld,
  canFulfil,
} from '@/lib/v1/print/db'
import { requireSandboxPrint } from '@/lib/v1/print/owned-source'
import { GIFT_ORDER_KIND, isGiftOrder } from '@/lib/v1/gift/order-kind'

/**
 * GIFT WIZARD EVENTS BELONG TO THE GIFT LOGIC, WHICHEVER ENDPOINT STRIPE USES.
 * A Gift order is a print_orders row too, so an event for it can arrive here (a Stripe endpoint pointed at /api/v1/print/webhook) as well as
 * at /api/v1/webhooks/stripe. This handler must never treat it as an ordinary print: marking it paid would skip gift_confirm_order, so the
 * order would never reach awaiting_artwork and the two included batches would never be granted (seen on the first Preview Sandbox run), and the
 * Print Shop's own asset queue would start on an order whose artwork does not exist yet. Instead the event goes to confirmGiftOrder, which
 * re-verifies with Stripe and is idempotent in the database (the first delivery grants, every other one is a no-op), so any number of deliveries
 * through any number of endpoints, in any order, gives one confirmation and one grant. Everything else here is unchanged for ordinary orders.
 */
export interface PrintWebhookDeps {
  confirmGift?: (stripeSessionId: string) => Promise<unknown>
  applyGiftRefunds?: (charge: Stripe.Charge) => Promise<unknown>
}
const realGift: Required<PrintWebhookDeps> = {
  async confirmGift(id) {
    const [{ confirmGiftOrder }, { getStripe: stripeClient }, { supabaseGiftStore }] = await Promise.all([import('@/lib/v1/gift/orders'), import('@/lib/store/stripe'), import('@/lib/v1/gift/store')])
    return confirmGiftOrder({ stripe: stripeClient(), store: supabaseGiftStore(supabaseAdmin) }, id)
  },
  async applyGiftRefunds(charge) {
    const [{ applyVerifiedRefunds }, { getStripe: stripeClient }, { supabaseGiftStore }] = await Promise.all([import('@/lib/v1/gift/refund'), import('@/lib/store/stripe'), import('@/lib/v1/gift/store')])
    return applyVerifiedRefunds({ stripe: stripeClient(), store: supabaseGiftStore(supabaseAdmin) }, charge)
  },
}
/** Refusals a retry cannot change: acknowledged (200) so Stripe stops retrying. Anything else is 500 so Stripe retries a transient failure safely. */
const GIFT_DEFINITIVE = new Set(['order_not_found', 'payment_not_confirmed', 'order_session_mismatch', 'order_not_payable'])
async function routeGift(sessionId: string, deps: PrintWebhookDeps) {
  try {
    await (deps.confirmGift ?? realGift.confirmGift)(sessionId)
    return NextResponse.json({ ok: true, gift: true })
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err)
    if (GIFT_DEFINITIVE.has(code)) return NextResponse.json({ ok: false, gift: true, error: code })
    console.error('[print-webhook] gift confirmation failed (will be retried by Stripe):', code)
    return NextResponse.json({ ok: false, gift: true, error: 'gift_confirmation_failed' }, { status: 500 })
  }
}

export async function handlePrintWebhook(event: Stripe.Event, deps: PrintWebhookDeps = {}) {
  // A verified Stripe refund event is notification evidence, never a refund command.
  if(event.type==='charge.refunded'){
    const charge=event.data.object as Stripe.Charge
    if(process.env.VERCEL_ENV==='preview' && charge.livemode)return NextResponse.json({error:'test_refund_required'},{status:409})
    const intent=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id
    if(!intent)return NextResponse.json({ok:true,ignored:true})
    const {data:order,error}=await supabaseAdmin.from('print_orders').select('stripe_session_id, items').eq('stripe_payment_intent',intent).maybeSingle()
    if(error)return NextResponse.json({error:'order_lookup_failed'},{status:500})
    // A refund of a Gift order is recorded by the Gift logic (verified with Stripe, once per refund id), never as an ordinary print refund notice.
    if(order&&isGiftOrder(order as {items?:Array<{renderId:string}>})){
      try{await (deps.applyGiftRefunds??realGift.applyGiftRefunds)(charge);return NextResponse.json({ok:true,gift:true})}
      catch(err){console.error('[print-webhook] gift refund handling failed (will be retried by Stripe):',err instanceof Error?err.message:err);return NextResponse.json({ok:false,gift:true,error:'gift_refund_failed'},{status:500})}
    }
    if(order)for(const refund of charge.refunds?.data||[]){if(refund.status==='succeeded')await notifyPrintOrder(order.stripe_session_id,{id:refund.id,amount:refund.amount})}
    return NextResponse.json({ok:true})
  }
  // We only care about successful checkout completion for the print flow.
  if (event.type !== 'checkout.session.completed') {
    console.log(`[print-webhook] ignoring event type: ${event.type}`)
    return NextResponse.json({ ok: true, ignored: event.type })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // A Gift Wizard order is confirmed by the Gift logic, not marked paid here (see routeGift).
  if (session.metadata?.kind === GIFT_ORDER_KIND) return routeGift(session.id, deps)

  // ── Idempotency check ──────────────────────────────────────
  const order = await getPrintOrderBySessionId(session.id)
  if (!order) {
    // No DB row for this session — shouldn't happen if /checkout persisted correctly.
    console.error('[print-webhook] no DB row for session', session.id)
    // Return 200 anyway — retrying won't help.
    return NextResponse.json({ ok: false, reason: 'no_db_row' })
  }
  if (isGiftOrder(order)) return routeGift(session.id, deps)          // the metadata was missing but the items say it is a Gift order
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

  // The pictures are prepared OUTSIDE this request: queued, resumable jobs (upscale, inspection, any human
  // review) run from the asset poller, and the Prodigi order is placed only when every one is approved
  // (lib/v1/print/complete.ts). Doing that work here put a multi-minute paid pipeline inside Stripe's
  // response window and left no record if the function was killed mid-way. This only records the work.
  // THE ACTIVATION GATE. Everything above (payment record, sandbox verification, account clearance) has already
  // run and is not affected by the flag. If the pipeline is off or not ready, the order is withheld VISIBLY (existing
  // 'withheld' status and notices), with the reason and the picture source recorded, and nothing is started. It is
  // picked up by lib/v1/print/complete.ts when the pipeline is activated.
  const pipeline=await pipelineState()
  if(!pipeline.active){
    const why=pipelineHoldReason(pipeline,squareTest?'owned':'url')
    console.warn(`[print-webhook] pipeline inactive (${pipeline.reason}) — order held. session=${session.id}`)
    await markWithheld(session.id,why).catch(err=>console.error('[print-webhook] markWithheld failed:',err))
    return NextResponse.json({ok:true,withheld:true,reason:why})
  }
  try {
    await enqueueOrderJobs(assetRuntime().store, order, squareTest)
    return NextResponse.json({ok:true,queued:true})
  }catch(err){
    const msg=err instanceof Error?err.message:String(err)
    await markError(session.id,msg).catch(()=>{})
    return NextResponse.json({ok:false,error:msg})
  }
}
