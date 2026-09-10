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
import { GRANT_STALE_CLAIM_MS } from '@/lib/store/generation-grants'

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

    /* A PORTRAITS CRAFT REFUNDS BY ITS GRANTS, NOT BY WHAT IT IS ASKED FOR.
       Each image has a grant (migration 031). Only grants that never
       delivered are refunded -- issued, or claimed by a render dead longer
       than any render can live -- and a grant whose canonical result exists
       is completed as delivered instead. The caller's count is not an input
       to the money; it only decides whether "those credits are back" is a
       true thing to tell the customer. Repeating the call refunds nothing
       twice. */
    const { data: grantRows, error: grantLookupErr } = await db
      .from('generation_grants').select('id').eq('owner_key', owner).eq('ref_id', refId).limit(1)
    if (grantLookupErr) {
      return NextResponse.json({ ok: false, reason: `grant_lookup_failed: ${grantLookupErr.message}` }, { status: 500 })
    }
    if (Array.isArray(grantRows) && grantRows.length > 0) {
      const { data: out, error: rErr } = await db.rpc('refund_generation_grants', {
        p_owner:         owner,
        p_ref:           refId,
        p_stale_seconds: Math.round(GRANT_STALE_CLAIM_MS / 1000),
      })
      const r = (Array.isArray(out) ? out[0] : out) as
        | { refunded_units: number; refunded_credits: number; already_refunded: number;
            delivered_units: number; held_units: number; balance_after: number }
        | undefined
      if (rErr || !r) {
        return NextResponse.json({ ok: false, reason: `refund_failed: ${rErr?.message ?? 'no result'}` }, { status: 500 })
      }
      const covered = r.refunded_units + r.already_refunded
      const ok = r.held_units === 0 && covered >= n
      return NextResponse.json({
        ok,
        refunded:         r.refunded_credits,
        refunded_units:   r.refunded_units,
        already:          r.refunded_units === 0 && r.already_refunded > 0,
        delivered_units:  r.delivered_units,
        held_units:       r.held_units,
        balance_after:    r.balance_after,
        ...(ok ? {} : { reason: r.held_units > 0 ? 'held_in_progress' : 'delivered_not_refundable' }),
      })
    }

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
    /* NEVER MORE THAN WAS SPENT, AND NOTHING FOR A REF THAT SPENT NOTHING.
       This used to cap only when it found a spend: a ref_id with no spend
       rows -- one the caller simply made up -- skipped the cap and refunded
       count x cost_per, with count taken from the body. Any signed-in
       account could mint credits. The gate writes a craft as 'craft' rows
       and a wallpaper basket as one 'wallpapers' row; both count. */
    const { data: spentRows } = await db
      .from('credit_ledger').select('delta')
      .eq('owner_key', owner).in('reason', ['craft', 'wallpapers']).eq('ref_id', refId)
    const spent = (spentRows || [])
      .reduce((sum: number, r: { delta: number }) => sum + Math.abs(r.delta), 0)

    if (!(spent > 0)) {
      return NextResponse.json({ ok: false, reason: 'nothing_to_refund' }, { status: 400 })
    }
    let total = n * costPer
    if (total > spent) total = spent

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
