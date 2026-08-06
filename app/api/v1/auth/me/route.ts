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
//   READ ONLY. Nothing here spends, grants, or reconciles. credit_balances
//   is maintained by the RPCs; this only looks at it.

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ user: null }, { status: 401 })

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
