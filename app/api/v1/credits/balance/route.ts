// app/api/v1/credits/balance/route.ts
// GET → { balance, admin, owner }. Display-only.
//
// CUI V22 · 2026-07-28.
//
// WHAT WAS WRONG
//   Nothing in the admin check — it is the same two queries the gate runs, in
//   the same order. The fault was the OWNER.
//
//   Both this route and the redeem route fell back to ?guest_key when there
//   was no session. redeem_code therefore wrote code_redemptions under
//   whichever owner it happened to hold, and this route looked the row up
//   under whichever owner it happened to hold. Redeem while signed out and
//   check while signed in and the row exists but cannot be found — which is
//   exactly why RHONE3166 returned kind:'admin' on redemption and admin:false
//   on balance.
//
//   The carryover blamed redeem_code for not writing the row. It does write
//   it, unconditionally, before the balance insert. The row was never missing;
//   it was filed under a different name.
//
// NOW
//   Guest is retired (LOCKED-DECISIONS, USERS & AUTH). One owner, one place it
//   comes from. A signed-out caller gets zero rather than a second identity.
//
//   `owner` is returned so a mismatch of this kind is visible from the client
//   instead of having to be inferred from two disagreeing endpoints.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser }      from '@/lib/store/auth'

export const runtime = 'nodejs'

function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ balance: 0, admin: false, owner: null })

    const user  = await getUser().catch(() => null)
    const owner = user?.id ?? null
    if (!owner) {
      return NextResponse.json({ balance: 0, admin: false, owner: null, signed_in: false })
    }

    const { data: bal } = await db
      .from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()

    let admin = false
    const { data: reds } = await db
      .from('code_redemptions').select('code').eq('owner_key', owner)
    const codes = (reds || []).map((r: { code: string }) => r.code)
    if (codes.length) {
      const { data: ac } = await db
        .from('access_codes').select('code').eq('kind', 'admin').in('code', codes).limit(1)
      admin = Array.isArray(ac) && ac.length > 0
    }

    return NextResponse.json({
      balance: bal?.balance ?? 0,
      admin,
      owner,
      signed_in: true,
    })
  } catch {
    return NextResponse.json({ balance: 0, admin: false, owner: null })
  }
}
