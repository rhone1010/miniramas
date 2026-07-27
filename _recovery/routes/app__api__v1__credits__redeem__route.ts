// app/api/v1/credits/redeem/route.ts
// Code redemption (CREDITS-AND-CODES-SPEC-v3 §6). REQUIRES an account — a guest
// token would let one code be re-redeemed from every fresh browser. Idempotent
// per account (the redeem_code function + code_redemptions PK enforce it).
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

// POST { code }
export async function POST(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
    const body = await req.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!code) return NextResponse.json({ ok: false, reason: 'code_required' }, { status: 400 })

    const user = await getUser().catch(() => null)
    if (!user?.id) {
      return NextResponse.json(
        { ok: false, reason: 'account_required', message: 'Sign in to redeem a code.' },
        { status: 401 },
      )
    }
    const { data, error } = await db.rpc('redeem_code', { p_code: code, p_owner: user.id })
    if (error) return NextResponse.json({ ok: false, reason: `redeem_failed: ${error.message}` }, { status: 500 })
    return NextResponse.json(data)   // { ok, granted, balance, kind } | { ok:false, reason } | { ok:true, already:true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}
