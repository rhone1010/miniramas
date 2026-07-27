// app/api/v1/print/quote/route.ts
//
// POST /api/v1/print/quote
//
// Called from cart UI when customer changes size, quantity, or destination.
// Returns retail subtotal + retail shipping + retail total for display.
//
// Wholesale numbers are logged server-side but NEVER returned to the client.
//
// Request body:
// {
//   items: [{ size: '8x10'|'12x16'|'18x24', finish: 'unframed'|'framed', copies: 1 }],
//   destination: { countryCode: 'US', postcode?: '94952' },
//   shippingMethod?: 'Budget' | 'Standard' | 'Express' | 'Overnight'
// }
//
// Response:
// {
//   retailSubtotalCents, retailShippingCents, retailTotalCents,
//   currency, carrier, fulfillmentLab
// }

import { NextResponse } from 'next/server'
import { getQuote, type ShippingMethod } from '@/lib/v1/print/prodigi-client'
import { getSku, type PrintSize, type PrintFinish } from '@/lib/v1/print/sku-map'

export const runtime = 'nodejs'

interface QuoteBody {
  items: Array<{ size: PrintSize; finish: PrintFinish; copies: number }>
  destination: {
    countryCode: string
    postcode?:   string
  }
  shippingMethod?: ShippingMethod
}

export async function POST(req: Request) {
  let body: QuoteBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.items?.length || !body.destination?.countryCode) {
    return NextResponse.json(
      { error: 'Missing items or destination.countryCode' },
      { status: 400 }
    )
  }

  // Resolve SKUs + compute retail subtotal from our locked map
  let retailSubtotalCents = 0
  const prodigiItems: Array<{ sku: string; copies: number; assets: Array<{ printArea: string }> }> = []
  for (const item of body.items) {
    let entry
    try {
      entry = getSku(item.size, item.finish)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Bad SKU' },
        { status: 400 }
      )
    }
    if (!item.copies || item.copies < 1) {
      return NextResponse.json({ error: 'copies must be >= 1' }, { status: 400 })
    }
    retailSubtotalCents += entry.retailCents * item.copies
    prodigiItems.push({
      sku:    entry.sku,
      copies: item.copies,
      assets: [{ printArea: 'default' }],
    })
  }

  try {
    const quote = await getQuote({
      shippingMethod:         body.shippingMethod || 'Budget',
      destinationCountryCode: body.destination.countryCode.toUpperCase(),
      currencyCode:           'USD',
      items:                  prodigiItems,
    })

    const q = quote.quotes[0]
    if (!q) {
      return NextResponse.json({ error: 'Empty quote from Prodigi' }, { status: 502 })
    }

    // Wholesale (server-side only — don't leak to client)
    const wholesaleItemsCents    = Math.round(parseFloat(q.costSummary.items.amount)    * 100)
    const wholesaleShippingCents = Math.round(parseFloat(q.costSummary.shipping.amount) * 100)
    const grossMarginCents       = retailSubtotalCents - wholesaleItemsCents
    console.log('[quote] wholesale=', wholesaleItemsCents, 'cents, shipping=', wholesaleShippingCents, 'cents, margin=', grossMarginCents, 'cents')

    // For MVP: retail shipping = wholesale shipping (we absorb in retail margin already).
    // To bake in a shipping markup, multiply here.
    const retailShippingCents = wholesaleShippingCents
    const retailTotalCents    = retailSubtotalCents + retailShippingCents

    return NextResponse.json({
      retailSubtotalCents,
      retailShippingCents,
      retailTotalCents,
      currency:       'USD',
      carrier:        q.shipments[0]?.carrier?.service ?? null,
      fulfillmentLab: q.shipments[0]?.fulfillmentLocation?.labCode ?? null,
    })
  } catch (err) {
    console.error('[quote] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Quote failed' },
      { status: 500 }
    )
  }
}
