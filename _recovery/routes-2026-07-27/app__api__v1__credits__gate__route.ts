// app/api/v1/credits/gate/route.ts
// The craft gate (CREDITS-AND-CODES-SPEC-v3 §4). runAll calls this INSTEAD of
// Stripe checkout. On ok the caller marks items entitled and reaches the existing
// wired craftPending(). This route is UPSTREAM of the render path — it does not
// touch craftPending() or any of the 13 existing fetch() calls.
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

// POST { count, series?, presets?[], guest_key? }
//   ok  → { ok:true, balance_after, granted, admin }
//   !ok → { ok:false, reason:'insufficient_credits', balance, needed }
export async function POST(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
    const body = await req.json().catch(() => ({}))
    const owner = await resolveOwner(body.guest_key)
    if (!owner) return NextResponse.json({ ok: false, reason: 'no_owner' }, { status: 400 })

    const n       = Math.max(1, Math.floor(Number(body.count) || 1))
    const series  = typeof body.series === 'string' ? body.series : 'portraits'
    const presets: string[] = Array.isArray(body.presets)
      ? body.presets.filter((p: unknown): p is string => typeof p === 'string')
      : []

    // Admin (RHONE3166 / any admin-kind code redeemed) never decrements —
    // but still writes a complete audit trail (delta 0).
    let isAdmin = false
    const { data: reds } = await db.from('code_redemptions').select('code').eq('owner_key', owner)
    const codes = (reds || []).map((r: { code: string }) => r.code)
    if (codes.length) {
      const { data: adminCodes } = await db
        .from('access_codes').select('code').eq('kind', 'admin').in('code', codes).limit(1)
      isAdmin = Array.isArray(adminCodes) && adminCodes.length > 0
    }

    let balanceAfter: number
    if (isAdmin) {
      const { data: bal } = await db.from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
      balanceAfter = bal?.balance ?? 0
    } else {
      const { data: spent, error } = await db.rpc('spend_credits', { p_owner: owner, p_n: n })
      if (error) return NextResponse.json({ ok: false, reason: `spend_failed: ${error.message}` }, { status: 500 })
      if (typeof spent !== 'number' || spent < 0) {
        const { data: bal } = await db.from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
        return NextResponse.json({ ok: false, reason: 'insufficient_credits', balance: bal?.balance ?? 0, needed: n })
      }
      balanceAfter = spent
    }

    // Audit — N craft_started events + N craft ledger rows (spec §4). balance_after
    // per row walks from the pre-spend balance down to balanceAfter.
    const delta = isAdmin ? 0 : -1
    const events = Array.from({ length: n }, (_, i) => ({
      owner_key: owner, series, preset: presets[i] ?? presets[0] ?? null,
      event: 'craft_started', attempts: 1, credits_delta: delta,
    }))
    await db.from('craft_events').insert(events)
    const ledger = Array.from({ length: n }, (_, k) => ({
      owner_key: owner, delta, reason: 'craft', ref_id: null as string | null,
      balance_after: isAdmin ? balanceAfter : balanceAfter + (n - 1 - k),
    }))
    await db.from('credit_ledger').insert(ledger)

    return NextResponse.json({ ok: true, balance_after: balanceAfter, granted: n, admin: isAdmin })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}
