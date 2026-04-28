// checkout-cancel-route.ts
// app/api/v1/checkout/[sessionId]/cancel/route.ts
//
// Best-effort fast-path called from /store/cancel — voids a pending
// purchase without waiting for the eventual checkout.session.expired
// webhook. If the purchase has already moved past 'pending' we leave
// it alone (paid or already failed). The webhook is canonical.

import { NextRequest, NextResponse } from 'next/server'
import { handlePaymentFailure } from '@/lib/store/entitlements'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await ctx.params
  if (!sessionId) {
    return NextResponse.json({ error: 'session_required' }, { status: 400 })
  }

  // Only act on still-pending rows.
  const { data: purchase, error } = await supabaseAdmin
    .from('purchases')
    .select('id, status')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'read_failed' }, { status: 500 })
  if (!purchase) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (purchase.status !== 'pending') {
    return NextResponse.json({ ok: true, status: purchase.status })
  }

  try {
    await handlePaymentFailure({ stripeSessionId: sessionId, reason: 'user_cancelled' })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[checkout/cancel] failed', e)
    return NextResponse.json({ error: 'cancel_failed' }, { status: 500 })
  }
}
