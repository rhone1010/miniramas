// app/api/v1/baskets/route.ts
//
// POST — create a Discovery Collection basket. Payment-first: returns a
// Stripe hosted checkout URL, same response contract as the existing
// cart route ({ url }), so CUI's success/cancel handling doesn't need a
// second shape to branch on.
//
// Does NOT touch app/api/v1/checkout/route.ts. Basket purchases are not
// cart purchases (flat price vs. ladder, N renders vs. N paid pieces) —
// a shared route trying to detect both would just be CART_SKUS with a
// second set bolted on. Separate route, separate file, same conventions.

import { NextRequest, NextResponse } from 'next/server'
import { createBasketCheckout, type BasketSeries } from '@/lib/store/basket-checkout'
import { getUser } from '@/lib/store/auth'

const BASKET_BAD_REQUEST = [
  'basket_purchase_requires_user',
  'sku_wrong_kind',
  'basket_wrong_size',
  'basket_invalid_preset',
  'basket_source_image_required',
]

const VALID_SERIES = new Set<BasketSeries>(['portraits', 'halloween', 'groups', 'pets'])

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'basket_purchase_requires_user' }, { status: 401 })

  const skuId  = typeof body.skuId === 'string' ? body.skuId : ''
  const series = typeof body.series === 'string' ? body.series : ''
  if (!skuId)  return NextResponse.json({ error: 'sku_required' }, { status: 400 })
  if (!VALID_SERIES.has(series as BasketSeries)) {
    return NextResponse.json({ error: 'basket_invalid_series' }, { status: 400 })
  }

  try {
    const result = await createBasketCheckout({
      skuId,
      userId:         user.id,
      series:         series as BasketSeries,
      presets:        Array.isArray(body.presets) ? body.presets : [],
      sourceImageRef: typeof body.sourceImageRef === 'string' ? body.sourceImageRef : '',
      returnUrl:      typeof body.returnUrl === 'string' ? body.returnUrl : '',
    })
    return NextResponse.json({ url: result.checkoutUrl, basketId: result.basketId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/v1/baskets] failed', msg)
    if (msg.startsWith('sku_not_found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (BASKET_BAD_REQUEST.some((p) => msg.startsWith(p))) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: 'basket_checkout_failed', message: msg }, { status: 500 })
  }
}
