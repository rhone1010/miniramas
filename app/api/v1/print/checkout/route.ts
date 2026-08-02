// app/api/v1/print/checkout/route.ts
//
// POST /api/v1/print/checkout
//
// Creates a Stripe Checkout Session and persists a corresponding `print_orders`
// row (status='created'). Returns the Checkout URL for the cart UI to redirect to.
//
// Stripe Checkout collects the payment; address + email arrive here from your
// own UI (the spec already collects them client-side). When payment completes,
// Stripe sends a webhook to /api/v1/print/webhook, which runs the asset pipeline
// and places the Prodigi order.
//
// Request body:
// {
//   items: [{
//     renderId:  'render_abc123',     // your stable render identifier
//     renderUrl: 'https://...',        // publicly fetchable source URL
//     size:      '12x16',
//     finish:    'unframed',
//     copies:    1
//   }],
//   email: 'customer@example.com',
//   shippingAddress: { name, line1, line2?, city, state?, postcode, countryCode },
//   shippingMethod?: 'Budget' | 'Standard' | 'Express' | 'Overnight',
//   successUrl: 'https://yourapp.com/thanks?session={CHECKOUT_SESSION_ID}',
//   cancelUrl:  'https://yourapp.com/cart'
// }
//
// Response:
// { checkoutUrl: 'https://checkout.stripe.com/...', sessionId: 'cs_test_...' }
//
// CUI V24 · 2026-08-01 · the order now records who placed it.
//
//   The row carried only customer_email. An email is not an account: two
//   accounts can share one, and a customer can type a different address at
//   checkout than the one they signed in with. So there was no way for the
//   webhook to ask whose fulfilment flag applied, and every paid order went
//   to Prodigi regardless of who placed it.
//
//   owner_key is resolved from the session here and written to the row.
//   Migration 012 adds the column; the webhook reads it.
//
//   AN UNSIGNED ORDER IS STILL ACCEPTED. Refusing at checkout would be a
//   change to who can buy a print, and that is a product decision nobody has
//   made. It is recorded with a null owner and withheld at the webhook, which
//   is the same protection one step later and no money lost either way.

import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/v1/print/stripe-client'
import { getQuote, type ShippingMethod } from '@/lib/v1/print/prodigi-client'
import { getSku, type PrintSize, type PrintFinish } from '@/lib/v1/print/sku-map'
import { createPrintOrder, type ShippingAddress } from '@/lib/v1/print/db'
import { getUser } from '@/lib/store/auth'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

interface CheckoutBody {
  items: Array<{
    renderId:  string
    renderUrl: string
    size:      PrintSize
    finish:    PrintFinish
    copies:    number
  }>
  email:           string
  shippingAddress: ShippingAddress
  shippingMethod?: ShippingMethod
  successUrl:      string
  cancelUrl:       string
}

export async function POST(req: Request) {
  // Who is placing this. Never fatal — see the header note. A null owner is
  // recorded honestly and withheld at the webhook rather than refused here.
  const ownerKey = await getUser().then(u => u?.id ?? null).catch(() => null)
  if (!ownerKey) {
    console.warn('[checkout] no signed-in account — this order cannot be fulfilled')
  }

  let body: CheckoutBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Validate ────────────────────────────────────────────────
  if (!body.items?.length) {
    return NextResponse.json({ error: 'No items' }, { status: 400 })
  }
  if (!body.email || !body.shippingAddress || !body.successUrl || !body.cancelUrl) {
    return NextResponse.json({ error: 'Missing email/address/urls' }, { status: 400 })
  }
  const addr = body.shippingAddress
  if (!addr.name || !addr.line1 || !addr.city || !addr.postcode || !addr.countryCode) {
    return NextResponse.json({ error: 'Address missing required fields' }, { status: 400 })
  }

  // Resolve SKUs + compute retail subtotal
  const dbItems = []
  let retailSubtotalCents = 0
  for (const item of body.items) {
    if (!item.renderId || !item.renderUrl) {
      return NextResponse.json({ error: 'item.renderId and item.renderUrl required' }, { status: 400 })
    }
    if (!item.copies || item.copies < 1) {
      return NextResponse.json({ error: 'copies must be >= 1' }, { status: 400 })
    }
    let entry
    try { entry = getSku(item.size, item.finish) }
    catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Bad SKU' }, { status: 400 })
    }
    retailSubtotalCents += entry.retailCents * item.copies
    dbItems.push({
      renderId:    item.renderId,
      renderUrl:   item.renderUrl,
      size:        item.size,
      finish:      item.finish,
      copies:      item.copies,
      sku:         entry.sku,
      retailCents: entry.retailCents,
    })
  }

  // ── Live shipping quote ─────────────────────────────────────
  const shippingMethod: ShippingMethod = body.shippingMethod || 'Budget'
  let retailShippingCents = 0
  let carrierLabel        = shippingMethod
  try {
    const quote = await getQuote({
      shippingMethod,
      destinationCountryCode: addr.countryCode.toUpperCase(),
      currencyCode:           'USD',
      items: dbItems.map(i => ({
        sku:    i.sku,
        copies: i.copies,
        assets: [{ printArea: 'default' }],
      })),
    })
    const q = quote.quotes[0]
    if (!q) throw new Error('Empty Prodigi quote')
    retailShippingCents = Math.round(parseFloat(q.costSummary.shipping.amount) * 100)
    carrierLabel        = (q.shipments[0]?.carrier?.service || shippingMethod) as ShippingMethod
  } catch (err) {
    console.error('[checkout] quote failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Shipping quote failed' },
      { status: 502 }
    )
  }

  const retailTotalCents = retailSubtotalCents + retailShippingCents
  const merchantRef      = `mr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // ── Build Stripe line items ─────────────────────────────────
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = dbItems.map(i => {
    const entry = getSku(i.size, i.finish)
    return {
      price_data: {
        currency: 'usd',
        product_data: {
          name: entry.description,
          description: i.finish === 'framed' ? 'Framed, ready to hang' : 'Unframed',
        },
        unit_amount: entry.retailCents,
      },
      quantity: i.copies,
    }
  })
  if (retailShippingCents > 0) {
    lineItems.push({
      price_data: {
        currency:    'usd',
        product_data: { name: `Shipping (${carrierLabel})` },
        unit_amount: retailShippingCents,
      },
      quantity: 1,
    })
  }

  // ── Create Stripe Checkout Session ──────────────────────────
  const stripe = getStripe()
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode:                 'payment',
      payment_method_types: ['card'],
      line_items:           lineItems,
      customer_email:       body.email,
      success_url:          body.successUrl,
      cancel_url:           body.cancelUrl,
      metadata: {
        merchant_ref: merchantRef,
      },
    })
  } catch (err) {
    console.error('[checkout] Stripe session create failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe error' },
      { status: 502 }
    )
  }

  // ── Persist order row ───────────────────────────────────────
  try {
    await createPrintOrder({
      stripeSessionId:     session.id,
      ownerKey,
      customerEmail:       body.email,
      shippingAddress:     addr,
      items:               dbItems,
      retailSubtotalCents,
      retailShippingCents,
      retailTotalCents,
      shippingMethod,
      prodigiMerchantRef:  merchantRef,
    })
  } catch (err) {
    // Stripe session was created but DB persist failed. Worst case: customer pays
    // but webhook can't find a matching row — we'd see this in logs and resolve manually.
    console.error('[checkout] DB persist failed:', err, 'session=', session.id)
    return NextResponse.json(
      { error: 'Order persistence failed; please retry' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    checkoutUrl: session.url,
    sessionId:   session.id,
  })
}
