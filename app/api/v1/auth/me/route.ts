// app/api/v1/auth/me/route.ts
//
// Lightweight signed-in check for client components.
//
// CUI V25 · 2026-08-03 · it carries the balance now.
//
//   The masthead had no way to show a customer their credits. Nothing told
//   the page its balance except a spend — /credits/gate answers with
//   balance_after, and that only after money has moved. So the number could
//   not be shown before the first craft, or after a purchase, or on arrival.
//
//   This is the read every surface already makes on boot, so the balance
//   travels with it rather than needing a route of its own.
//
//   Soft on failure. A balance that cannot be read returns null and the
//   masthead shows nothing — never a zero, which would read as "you have no
//   credits" to somebody who has sixty.
//
//   ONE EXCEPTION TO READ-ONLY, 2026-08-24: the launch grant is claimed
//   here. /api/v1/invite records a promise against an email; its header
//   said claimLaunchGrant() pays it on first sign-in, and that function
//   was never written - every invited person signed in to zero. This is
//   the read every surface makes on boot, so claiming here makes the
//   grant self-healing and shows the credits on the very first paint.
//   Idempotent by ledger ref (invite_<email>); nothing else writes.

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { claimLaunchGrant } from '@/lib/v1/launch/claim-grant'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ user: null }, { status: 401 })

  // The claim runs before the read, so an invited person's first ever
  // /auth/me already answers with their grant in the balance.
  await claimLaunchGrant(supabaseAdmin, user)

  let credits: number | null = null
  try {
    const { data, error } = await supabaseAdmin
      .from('credit_balances')
      .select('balance')
      .eq('owner_key', user.id)
      .maybeSingle()

    if (error) {
      // Logged, not thrown. Losing the number must not lose the session.
      console.warn('[auth/me] balance read failed:', error.message)
    } else if (data && typeof data.balance === 'number') {
      credits = data.balance
    } else {
      // No row yet is a real state: an account that has never bought or been
      // granted anything. That is zero, not unknown.
      credits = 0
    }
  } catch (e) {
    console.warn('[auth/me] balance read threw:', e instanceof Error ? e.message : String(e))
  }

  return NextResponse.json({ user, credits })
}
