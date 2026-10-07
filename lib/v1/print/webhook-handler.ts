import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
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

import { ownedPrintSource } from '@/lib/v1/print/owned-source'
export async function handlePrintWebhook(event: Stripe.Event) {
  // We only care about successful checkout completion for the print flow.
  if (event.type !== 'checkout.session.completed') {
    console.log(`[print-webhook] ignoring event type: ${event.type}`)
    return NextResponse.json({ ok: true, ignored: event.type })
  }

  const session = event.data.object as Stripe.Checkout.Session
  if (session.payment_status !== 'paid') return NextResponse.json({ ok: true, unpaid: true })

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

  // ── Asset pipeline per item ────────────────────────────────
  const prodigiItems: Array<{
    sku:    string
    copies: number
    attributes?: Record<string, string>
    sizing: 'fillPrintArea' | 'fitPrintArea' | 'stretchToPrintArea'
    assets: Array<{ printArea: string; url: string }>
  }> = []

  try {
    for (const item of order.items) {
      console.log(`[print-webhook] preparing asset for renderId=${item.renderId} size=${item.size}`)
      // 1. Fetch source render
      let sourceB64: string
      if (session.metadata?.print_source === 'collection_v1') {
        const source = await ownedPrintSource(order.owner_key!, item.renderId)
        sourceB64 = source.bytes.toString('base64')
      } else {
        const res = await fetch(item.renderUrl)
        if (!res.ok) throw new Error('print_source_unavailable')
        sourceB64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      }

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
        attributes: skuEntry.attributes,
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
