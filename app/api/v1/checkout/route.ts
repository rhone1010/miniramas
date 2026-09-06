// checkout-route.ts
// app/api/v1/checkout/route.ts
//
// Thin wrapper over lib/store/checkout. Two modes:
//   • single / bundle  → createCheckout       (pay-then-generate; unchanged)
//   • cart  / unlock   → createCartCheckout   (preview-first; { url } response)
//
// Cart mode is detected by a `cart` body or a known cart skuId. The cart
// response matches the workshop contract: { url: <hosted Stripe URL> },
// success → returnUrl?paid=1, cancel → returnUrl?canceled=1.

import { NextRequest, NextResponse } from 'next/server'
import { createCheckout, createCartCheckout } from '@/lib/store/checkout'
import { getUser }        from '@/lib/store/auth'

const CART_SKUS = new Set(['portrait_pieces_cart', 'portrait_unlock_web'])

// Error message prefixes that are the caller's fault → 400.
const CART_BAD_REQUEST = [
  'cart_identity_required',
  'cart_empty',
  'cart_too_large',
  'cart_invalid_piece',
  'cart_invalid_resolution',
  'price_mismatch',
]

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const skuId = typeof body.skuId === 'string' ? body.skuId : ''
  const isCart = !!body.cart || CART_SKUS.has(skuId)

  // Logged-in users come through Supabase Auth cookies; guests pass an
  // email in the body. We trust the cookie path and fall back to
  // guestEmail only if no user is signed in.
  const user = await getUser()
  const guestEmail =
    !user && typeof body.guestEmail === 'string' ? body.guestEmail.trim().toLowerCase() : undefined

  // ── Cart / unlock mode ───────────────────────────────────────
  if (isCart) {
    const cart = (body.cart ?? {}) as {
      kind?: unknown
      pieces?: unknown
      totalCents?: unknown
    }
    try {
      const result = await createCartCheckout({
        skuId:            skuId || 'portrait_pieces_cart',
        userId:           user?.id,
        guestEmail,
        kind:             cart.kind === 'unlock' ? 'unlock' : 'pieces',
        pieces:           Array.isArray(cart.pieces) ? (cart.pieces as any[]) : [],
        clientTotalCents: Number(cart.totalCents),
        returnUrl:        typeof body.returnUrl === 'string' ? body.returnUrl : '',
      })
      return NextResponse.json(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[api/v1/checkout] cart failed', msg)
      if (CART_BAD_REQUEST.some((p) => msg.startsWith(p))) {
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      return NextResponse.json({ error: 'checkout_failed', message: msg }, { status: 500 })
    }
  }

  // ── Single / bundle mode (unchanged) ─────────────────────────
  if (!skuId) return NextResponse.json({ error: 'sku_required' }, { status: 400 })

  try {
    const result = await createCheckout({
      skuId,
      userId:         user?.id,
      guestEmail,
      style:          typeof body.style          === 'string' ? body.style          : undefined,
      variant:        typeof body.variant        === 'string' ? body.variant        : undefined,
      sourceImageRef: typeof body.sourceImageRef === 'string' ? body.sourceImageRef : undefined,
      returnUrl:      typeof body.returnUrl      === 'string' ? body.returnUrl      : undefined,
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
