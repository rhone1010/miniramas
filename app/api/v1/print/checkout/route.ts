import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/v1/print/stripe-client'
import { getQuote, type ShippingMethod } from '@/lib/v1/print/prodigi-client'
import { getLaunchSku, type PrintSize, type PrintFinish } from '@/lib/v1/print/sku-map'
import { createPrintOrder, type ShippingAddress } from '@/lib/v1/print/db'
import { getUser } from '@/lib/store/auth'
import { ownedPrintPreview } from '@/lib/v1/print/owned-source'
import { printPlan } from '@/lib/v1/print/geometry'
import { canFulfil } from '@/lib/v1/print/db'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

interface CheckoutBody {
  embedded?: boolean
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
  const user = await getUser().catch(() => null)
  if (!user) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })
  const ownerKey = user.id
  if (!await canFulfil(ownerKey)) return NextResponse.json({ error: 'fulfilment_not_allowed' }, { status: 403 })
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
    if (!item.renderId) {
      return NextResponse.json({ error: 'item.renderId and item.renderUrl required' }, { status: 400 })
    }
    if (!Number.isInteger(item.copies) || item.copies < 1 || item.copies > 20) {
      return NextResponse.json({ error: 'copies must be >= 1' }, { status: 400 })
    }
    let entry
    let source
    try {
      entry = getLaunchSku(item.size, item.finish)
      source = await ownedPrintPreview(ownerKey, item.renderId)
      printPlan(source.width, source.height, entry)
    }
    catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Bad SKU' }, { status: 400 })
    }
    retailSubtotalCents += entry.retailCents * item.copies
    dbItems.push({
      renderId:    item.renderId,
      renderUrl:   source.art,
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
        attributes: getLaunchSku(i.size, i.finish).attributes,
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
    const entry = getLaunchSku(i.size, i.finish)
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
  if (body.embedded && !process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
  const stripe = getStripe()
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode:                 'payment',
      payment_method_types: ['card'],
      line_items:           lineItems,
      customer_email:       body.email,
      ...(body.embedded ? { ui_mode: 'embedded' as const, redirect_on_completion: 'if_required' as const, return_url: new URL('/print', req.url).href + '?print=1&session={CHECKOUT_SESSION_ID}' } : { success_url: new URL('/print', req.url).href + '?print=1&session={CHECKOUT_SESSION_ID}', cancel_url: new URL('/print', req.url).href }),
      metadata: {
        merchant_ref: merchantRef,
        print_source: 'collection_v1',
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
    await stripe.checkout.sessions.expire(session.id).catch(() => {})
    // Stripe session was created but DB persist failed. Worst case: customer pays
    // but webhook can't find a matching row — we'd see this in logs and resolve manually.
    console.error('[checkout] DB persist failed:', err, 'session=', session.id)
    return NextResponse.json(
      { error: 'Order persistence failed; please retry' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    totalCents: retailTotalCents,
    clientSecret: session.client_secret,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY,
    checkoutUrl: session.url,
    sessionId:   session.id,
  })
}
