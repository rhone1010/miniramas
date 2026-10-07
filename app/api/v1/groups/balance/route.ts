// app/api/v1/groups/balance/route.ts
//
// Returns the signed-in customer's Groups craft and global unlock
// entitlement balances. Read-only — no credits, no charges.

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { GROUPS_CRAFT_STYLE } from '@/lib/v1/groups/groups-commerce'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getUser().catch(() => null)
  if (!user?.id) {
    return NextResponse.json({ ok: false, reason: 'not_signed_in' }, { status: 401 })
  }

  const [craftsRes, unlocksRes] = await Promise.all([
    supabaseAdmin
      .from('entitlements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'available')
      .eq('locked_style', GROUPS_CRAFT_STYLE),
    supabaseAdmin
      .from('entitlements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'available')
      .is('locked_style', null),
  ])

  return NextResponse.json({
    ok: true,
    crafts: craftsRes.count ?? 0,
    unlocks: unlocksRes.count ?? 0,
  })
}
