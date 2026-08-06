// app/api/v1/print/quote/route.ts
//
// POST /api/v1/print/quote
//
// Called from the Print Shop whenever the order or the destination changes.
// Returns the retail subtotal and EVERY shipping option Prodigi offers for
// that basket to that country, priced.
//
// Wholesale numbers are logged server-side but NEVER returned to the client.
//
// CUI V25 · 2026-08-03 · shipping is a choice, not a constant.
//
//   This route used to send shippingMethod: 'Budget' and return the first
//   quote. That threw away the rest of the answer.
//
//   There are no shipping SKUs. Prodigi treats shipping as an order-level
//   method, and the Quote endpoint returns every method actually available
//   for that basket to that destination — availability varies by product and
//   country, so a hard-coded list would offer options that fail at checkout.
//   Asking without a method returns them all.
//
//   It also consolidates: the largest item carries the main charge and each
//   piece after it adds less. Quoting the real basket rather than summing
//   per-item estimates is the only way to get that right.
//
// Request body:
// {
//   items: [{ size: '8x8'|'12x12'|..., finish: 'unframed'|'framed', copies: 1 }],
//   destination: { countryCode: 'US', postcode?: '94952' },
//   shippingMethod?: 'Budget' | ...    // optional; omit to get every option
// }
//
// Response:
// {
//   retailSubtotalCents,
//   currency,
//   shipping: [
//     { method, label, retailShippingCents, retailTotalCents, carrier, lab }
//   ]
// }

import { NextResponse } from 'next/server'
import { getQuote, type ShippingMethod } from '@/lib/v1/print/prodigi-client'
import { getSku, type PrintSize, type PrintFinish } from '@/lib/v1/print/sku-map'

export const runtime = 'nodejs'

/* Prodigi's values on the left, what a customer reads on the right. Anything
   Prodigi returns that is not in here is passed through under its own name
   rather than hidden — a new method appearing is not a reason to lose it. */
const METHOD_LABEL: Record<string, string> = {
  Budget:       'Economy',
  Standard:     'Standard',
  StandardPlus: 'Priority',
  Express:      'Express',
  Overnight:    'Overnight',
}

/* The order they should be offered in — cheapest and slowest first, so the
   default choice is the one most people want. */
const METHOD_ORDER = ['Budget', 'Standard', 'StandardPlus', 'Express', 'Overnight']

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

  // ── Resolve SKUs + compute retail subtotal from our locked map ────────────
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

  // ── Ask for everything ────────────────────────────────────────────────────
  // No shippingMethod means "what can you do", which is the question worth
  // asking. A named method is honoured when the caller has one.
  try {
    const quote = await getQuote({
      ...(body.shippingMethod ? { shippingMethod: body.shippingMethod } : {}),
      destinationCountryCode: body.destination.countryCode.toUpperCase(),
      currencyCode:           'USD',
      items:                  prodigiItems,
    } as Parameters<typeof getQuote>[0])

    const quotes = Array.isArray(quote.quotes) ? quote.quotes : []
    if (!quotes.length) {
      return NextResponse.json({ error: 'No shipping available to that address' }, { status: 502 })
    }

    const shipping = quotes.map((q: any) => {
      const method = q.shipmentMethod || q.shippingMethod || 'Standard'

      // Wholesale — logged, never returned.
      const wholesaleItemsCents    = Math.round(parseFloat(q.costSummary?.items?.amount ?? '0') * 100)
      const wholesaleShippingCents = Math.round(parseFloat(q.costSummary?.shipping?.amount ?? '0') * 100)
      console.log(
        `[quote] ${method}: wholesale items=${wholesaleItemsCents} ` +
        `shipping=${wholesaleShippingCents} margin=${retailSubtotalCents - wholesaleItemsCents}`
      )

      // Retail shipping is wholesale shipping; the markup already lives in
      // the print price. Change it here if that ever stops being true.
      const retailShippingCents = wholesaleShippingCents

      return {
        method,
        label:  METHOD_LABEL[method] || method,
        retailShippingCents,
        retailTotalCents: retailSubtotalCents + retailShippingCents,
        carrier: q.shipments?.[0]?.carrier?.service ?? null,
        lab:     q.shipments?.[0]?.fulfillmentLocation?.labCode ?? null,
      }
    })

    // Cheapest-and-slowest first, so the option a customer lands on is the
    // one most of them want. Unknown methods sort to the end rather than
    // disappearing.
    shipping.sort((a, b) => {
      const ai = METHOD_ORDER.indexOf(a.method)
      const bi = METHOD_ORDER.indexOf(b.method)
      if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
      return a.retailShippingCents - b.retailShippingCents
    })

    return NextResponse.json({
      retailSubtotalCents,
      currency: 'USD',
      shipping,

      // Kept so an older caller that read the flat shape still works. The
      // first option is the cheapest after the sort above.
      retailShippingCents: shipping[0].retailShippingCents,
      retailTotalCents:    shipping[0].retailTotalCents,
      carrier:             shipping[0].carrier,
      fulfillmentLab:      shipping[0].lab,
    })
  } catch (err) {
    console.error('[quote] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Quote failed' },
      { status: 500 }
    )
  }
}
