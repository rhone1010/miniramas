// entitlements-route.ts
// app/api/v1/entitlements/route.ts
//
// GET — current user's entitlements + recent purchases. Used by /account.

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { listEntitlementsForUser } from '@/lib/store/entitlements'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const entitlements = await listEntitlementsForUser(user.id)

    // Recent purchases — last 50.
    const { data: purchases, error: pErr } = await supabaseAdmin
      .from('purchases')
      .select('id, sku_id, status, amount_cents, stripe_session_id, created_at, paid_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (pErr) throw new Error(pErr.message)

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      entitlements,
      purchases: (purchases ?? []).map((p) => ({
        id:              p.id,
        skuId:           p.sku_id,
        status:          p.status,
        amountCents:     p.amount_cents,
        stripeSessionId: p.stripe_session_id,
        createdAt:       p.created_at,
        paidAt:          p.paid_at,
      })),
    })
  } catch (e) {
    console.error('[api/v1/entitlements] failed', e)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }
}
