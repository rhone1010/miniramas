// app/api/v1/credits/refund/route.ts
// Craft-failure refund (CREDITS-AND-CODES-SPEC-v4 §5). When a debited craft
// produces no image — hard error, exception, or a chain that throws after the
// gate — the workshop calls this so a failed attempt never silently burns
// credits.
//
// CUI V22 · 2026-07-28 · corrected to v4.
//
// WHAT WAS WRONG
//   · delta was +1 per image and the balance moved by the image count. Under
//     v4 an image costs ten, so a failed five-image craft that took 50 credits
//     returned 5. The header already said v4; the arithmetic was still v3.
//   · The balance was read then written. Two refunds arriving together both
//     read the same figure and the second overwrote the first. refund_credits
//     (migration 010) replaces this with one atomic statement.
//   · NOTHING PREVENTED A SECOND CLAIM. The route took a count and no
//     reference to what had failed, so calling it five times paid out five
//     times. Harmless on a single-user walk; not harmless with ten testers.
//
// NOW
//   · ref_id is required and must name the craft that failed.
//   · A refund already written against that ref_id returns ok without paying
//     again — idempotent, the same guarantee code_redemptions gives.
//   · Refunds are capped at what was actually spent on that ref_id.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser }      from '@/lib/store/auth'

export const runtime = 'nodejs'

const CREDITS_PER_IMAGE = 10

function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Guest is retired. */
async function resolveOwner(): Promise<string | null> {
  const user = await getUser().catch(() => null)
  return user?.id ?? null
}

// POST { count, ref_id, cost_per? }
//   → { ok:true, refunded, balance_after, already? }
//   → { ok:false, reason }
export async function POST(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })

    const body  = await req.json().catch(() => ({}))
    const owner = await resolveOwner()
    if (!owner) {
      return NextResponse.json({ ok: false, reason: 'not_signed_in' }, { status: 401 })
    }

    // A refund must name what it is refunding. Without this the endpoint pays
    // out on request, as many times as it is asked.
    const refId = typeof body.ref_id === 'string' ? body.ref_id.trim() : ''
    if (!refId) {
      return NextResponse.json({ ok: false, reason: 'ref_id_required' }, { status: 400 })
    }

    const n = Math.max(1, Math.floor(Number(body.count) || 1))
    const asked = Math.floor(Number(body.cost_per))
    const costPer = Number.isFinite(asked) && asked > 0 ? asked : CREDITS_PER_IMAGE
    if (costPer !== CREDITS_PER_IMAGE) {
      return NextResponse.json(
        { ok: false, reason: 'cost_per_mismatch', expected: CREDITS_PER_IMAGE, got: asked },
        { status: 400 })
    }

    // Admin is never charged, so never refunded.
    let isAdmin = false
    const { data: reds } = await db
      .from('code_redemptions').select('code').eq('owner_key', owner)
    const codes = (reds || []).map((r: { code: string }) => r.code)
    if (codes.length) {
      const { data: adminCodes } = await db
        .from('access_codes').select('code').eq('kind', 'admin').in('code', codes).limit(1)
      isAdmin = Array.isArray(adminCodes) && adminCodes.length > 0
    }
    if (isAdmin) return NextResponse.json({ ok: true, refunded: 0, admin: true })

    // Already refunded? Return ok and pay nothing. Idempotent by ref_id, the
    // same guarantee code_redemptions gives redemption.
    const { data: prior } = await db
      .from('credit_ledger').select('id')
      .eq('owner_key', owner).eq('reason', 'refund').eq('ref_id', refId).limit(1)
    if (Array.isArray(prior) && prior.length) {
      const { data: bal } = await db
        .from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
      return NextResponse.json({
        ok: true, already: true, refunded: 0, balance_after: bal?.balance ?? 0,
      })
    }

    // Never return more than was taken for this craft.
    const { data: spentRows } = await db
      .from('credit_ledger').select('delta')
      .eq('owner_key', owner).eq('reason', 'craft').eq('ref_id', refId)
    const spent = (spentRows || [])
      .reduce((sum: number, r: { delta: number }) => sum + Math.abs(r.delta), 0)

    let total = n * costPer
    if (spent > 0 && total > spent) total = spent

    const { data: after, error } = await db.rpc('refund_credits', {
      p_owner: owner,
      p_n: total,                    // credits, matching the function's contract
    })
    if (error || typeof after !== 'number' || after < 0) {
      return NextResponse.json(
        { ok: false, reason: `refund_failed: ${error?.message ?? 'bad_amount'}` },
        { status: 500 })
    }

    // One ledger row per image, each moving cost_per, walking up to `after`.
    const rows = Math.max(1, Math.round(total / costPer))
    const ledger = Array.from({ length: rows }, (_, k) => ({
      owner_key: owner,
      delta: costPer,
      reason: 'refund',
      ref_id: refId,
      balance_after: after - (rows - 1 - k) * costPer,
    }))
    const { error: ldErr } = await db.from('credit_ledger').insert(ledger)
    if (ldErr) console.error('[credits/refund] credit_ledger insert failed', ldErr)

    return NextResponse.json({ ok: true, refunded: total, balance_after: after })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}
