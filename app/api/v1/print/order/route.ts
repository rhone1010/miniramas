// app/api/v1/print/order/route.ts
//
// GET — read one print order back, for the receipt shown after payment.
//
// Stripe returns the customer to  …?print=1&session={CHECKOUT_SESSION_ID}
// and until now nothing caught it: they paid and the screen said nothing.
// This is what the receipt reads.
//
// ── WHY THE OWNER IS IN THE WHERE CLAUSE ──────────────────────────────────
//   The session id travels in a URL. URLs get shared, pasted into chats,
//   and kept in browser history on shared machines. A print order carries a
//   full shipping address, so the session id alone must never be enough to
//   read one. The query is scoped to the caller's owner_key as well, the
//   same shape as the archive endpoint: scoped in the WHERE, not checked
//   first and read after.
//
//   The consequence is deliberate. Somebody who paid as a guest and then
//   cleared their browser cannot retrieve the receipt. That is the correct
//   trade — an address is worth more than the convenience.
//
// ── WHY THE IMAGE COMES FROM collection_pieces ────────────────────────────
//   print_orders.items carries a renderUrl, but on a real order that is a
//   signed Supabase URL with an expiry. A receipt someone opens tomorrow
//   would show broken images. The piece is looked up instead and signed
//   fresh on every read, so the receipt is good whenever it is opened.
//
//   An item whose piece cannot be found still returns — without an image.
//   The order is the fact; the picture is the courtesy.
//
// Failure is soft, as elsewhere in this lane: no Supabase, no session, or
// an order that is not the caller's all return ok:false with a reason, and
// the panel says it could not be read rather than showing nothing.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/store/auth'

export const runtime = 'nodejs'

const SIGNED_URL_TTL = 60 * 60 * 24 // a day is long enough to read a receipt

function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function resolveOwner(guestKey: unknown): Promise<string | null> {
  const user = await getUser().catch(() => null)
  if (user?.id) return user.id
  const gk = typeof guestKey === 'string' && guestKey.trim() ? guestKey.trim() : null
  return gk
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('session')
    if (!sessionId) {
      return NextResponse.json({ ok: false, reason: 'no_session' }, { status: 400 })
    }

    const sb = db()
    if (!sb) return NextResponse.json({ ok: false, reason: 'unconfigured' })

    const ownerKey = await resolveOwner(url.searchParams.get('guest_key'))
    if (!ownerKey) return NextResponse.json({ ok: false, reason: 'no_owner' })

    const { data: order, error } = await sb
      .from('print_orders')
      .select(
        'id, status, prodigi_order_id, error_message, customer_email, ' +
        'shipping_address, shipping_method, items, ' +
        'retail_subtotal_cents, retail_shipping_cents, retail_total_cents, ' +
        'tracking_number, tracking_url, created_at, paid_at, placed_at, shipped_at',
      )
      .eq('stripe_session_id', sessionId)
      .eq('owner_key', ownerKey)
      .maybeSingle()

    if (error) {
      console.warn('[print/order] read failed:', error.message)
      return NextResponse.json({ ok: false, reason: 'read_failed' })
    }
    if (!order) return NextResponse.json({ ok: false, reason: 'not_found' })

    // Fresh signed URLs for whatever is being made.
    const items = Array.isArray(order.items) ? order.items : []
    const renderIds = items
      .map((it: any) => (typeof it?.renderId === 'string' ? it.renderId : null))
      .filter(Boolean) as string[]

    const artById: Record<string, string> = {}
    const labelById: Record<string, string> = {}

    if (renderIds.length) {
      const { data: pieces } = await sb
        .from('collection_pieces')
        .select('id, label, image_path')
        .eq('owner_key', ownerKey)
        .in('id', renderIds)

      for (const p of pieces ?? []) {
        if (p.label) labelById[p.id] = p.label
        if (!p.image_path) continue
        const { data: signed } = await sb.storage
          .from('collection')
          .createSignedUrl(p.image_path, SIGNED_URL_TTL)
        if (signed?.signedUrl) artById[p.id] = signed.signedUrl
      }
    }

    return NextResponse.json({
      ok: true,
      order: {
        id:            order.id,
        status:        order.status,
        prodigiId:     order.prodigi_order_id,
        errorMessage:  order.error_message,
        email:         order.customer_email,
        shipTo:        order.shipping_address,
        shippingMethod: order.shipping_method,
        subtotalCents: order.retail_subtotal_cents,
        shippingCents: order.retail_shipping_cents,
        totalCents:    order.retail_total_cents,
        trackingNumber: order.tracking_number,
        trackingUrl:   order.tracking_url,
        placedAt:      order.placed_at,
        paidAt:        order.paid_at,
        shippedAt:     order.shipped_at,
        items: items.map((it: any) => ({
          size:        it?.size ?? null,
          finish:      it?.finish ?? null,
          copies:      Number(it?.copies) || 1,
          retailCents: Number(it?.retailCents) || 0,
          renderId:    it?.renderId ?? null,
          art:         (it?.renderId && artById[it.renderId]) || null,
          label:       (it?.renderId && labelById[it.renderId]) || null,
        })),
      },
    })
  } catch (e: any) {
    console.warn('[print/order] failed:', e?.message || 'unknown')
    return NextResponse.json({ ok: false, reason: 'error' })
  }
}
