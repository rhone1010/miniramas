// checkout-route.ts
// app/api/v1/checkout/route.ts
//
// Thin wrapper over lib/store/checkout.createCheckout for callers that
// need to invoke it from the browser (the /store page) or from another
// server context.

import { NextRequest, NextResponse } from 'next/server'
import { createCheckout } from '@/lib/store/checkout'
import { getUser }        from '@/lib/store/auth'

export async function POST(req: NextRequest) {
  let body: {
    skuId?:          unknown
    guestEmail?:     unknown
    style?:          unknown
    variant?:        unknown
    sourceImageRef?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const skuId = typeof body.skuId === 'string' ? body.skuId : ''
  if (!skuId) return NextResponse.json({ error: 'sku_required' }, { status: 400 })

  // Logged-in users come through Supabase Auth cookies; guests pass an
  // email in the body. We trust the cookie path and fall back to
  // guestEmail only if no user is signed in.
  const user = await getUser()

  try {
    const result = await createCheckout({
      skuId,
      userId:         user?.id,
      guestEmail:     !user && typeof body.guestEmail === 'string' ? body.guestEmail.trim().toLowerCase() : undefined,
      style:          typeof body.style          === 'string' ? body.style          : undefined,
      variant:        typeof body.variant        === 'string' ? body.variant        : undefined,
      sourceImageRef: typeof body.sourceImageRef === 'string' ? body.sourceImageRef : undefined,
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/v1/checkout] failed', msg)
    if (msg.startsWith('sku_not_found') || msg.startsWith('sku_inactive')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (msg.startsWith('bundle_purchase_requires_user') ||
        msg.startsWith('single_purchase_requires_')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: 'checkout_failed', message: msg }, { status: 500 })
  }
}
