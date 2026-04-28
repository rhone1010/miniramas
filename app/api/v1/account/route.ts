// account-route.ts
// app/api/v1/account/route.ts
//
// DELETE — delete the signed-in user's auth account. We forfeit any
// remaining entitlements (per the brief's open-item default) and log
// the event so we can audit later.

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Count any unused credits being forfeited so we can monitor the rate.
  const { count: forfeited } = await supabaseAdmin
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'available')

  if ((forfeited ?? 0) > 0) {
    console.warn(
      '[account/delete] forfeited_credits',
      `userId=${user.id}`,
      `count=${forfeited}`,
    )
  }

  // Delete the auth user — cascades through to purchases/entitlements via
  // the FK references. (refund_log too.)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('[account/delete] auth.admin.deleteUser failed', error.message)
    return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, forfeited: forfeited ?? 0 })
}
