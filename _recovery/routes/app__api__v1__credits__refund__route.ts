// app/api/v1/credits/refund/route.ts
// Craft-failure refund (CREDITS-AND-CODES-SPEC-v4 §5). When a debited craft
// produces no image — hard error, exception, or a chain that throws after the
// gate — the workshop calls this to return the credits so a failed attempt
// never silently burns a credit.
//
// Reverses the gate's debit 1:1 (the gate writes delta -1 per image; this writes
// delta +1 per image, reason 'refund'). Mirrors the gate's service-role client +
// owner resolution + admin skip. Admins are never charged, so never refunded.
//
// NOTE: balance is updated read-then-write (not an atomic RPC) — fine for the
// single-user cold walk; the durable version is a refund_credits SECURITY
// DEFINER RPC paralleling spend_credits (migration follow-up).
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
async function resolveOwner(guestKey: unknown): Promise<string | null> {
  const user = await getUser().catch(() => null)
  if (user?.id) return user.id
  return typeof guestKey === 'string' && guestKey.trim() ? guestKey.trim() : null
}

// POST { count, guest_key? } → { ok, refunded, balance_after } | { ok:false, reason }
export async function POST(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
    const body  = await req.json().catch(() => ({}))
    const owner = await resolveOwner(body.guest_key)
    if (!owner) return NextResponse.json({ ok: false, reason: 'no_owner' }, { status: 400 })

    const n = Math.max(1, Math.floor(Number(body.count) || 1))

    // Admin never decrements → nothing to refund.
    let isAdmin = false
    const { data: reds } = await db.from('code_redemptions').select('code').eq('owner_key', owner)
    const codes = (reds || []).map((r: { code: string }) => r.code)
    if (codes.length) {
      const { data: adminCodes } = await db
        .from('access_codes').select('code').eq('kind', 'admin').in('code', codes).limit(1)
      isAdmin = Array.isArray(adminCodes) && adminCodes.length > 0
    }
    if (isAdmin) return NextResponse.json({ ok: true, refunded: 0, admin: true })

    const { data: bal } = await db.from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
    const before = bal?.balance ?? 0
    const after  = before + n
    await db.from('credit_balances')
      .upsert({ owner_key: owner, balance: after, updated_at: new Date().toISOString() }, { onConflict: 'owner_key' })

    // N ledger rows, reason 'refund', delta +1, balance walking up to `after`.
    const ledger = Array.from({ length: n }, (_, k) => ({
      owner_key: owner, delta: 1, reason: 'refund', ref_id: null as string | null,
      balance_after: before + k + 1,
    }))
    await db.from('credit_ledger').insert(ledger)

    return NextResponse.json({ ok: true, refunded: n, balance_after: after })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}
