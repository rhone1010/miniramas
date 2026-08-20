// app/api/v1/groups/retry/route.ts
//
// Redeems a free retry token, or explains why it cannot.
//
// ── WHERE THIS SITS IN THE FLOW ────────────────────────────────────────
//
//   analyze -> price -> [ retry? ] -> gate -> generate
//
// The glass calls this INSTEAD of the credit gate when the customer takes
// the retry offer. A true return means the craft proceeds with no charge.
// A false return means fall through to a normal paid craft — the offer
// simply was not valid, which is a sentence rather than an error.
//
// It cannot run after the gate. The whole point is that no money moves.
//
// ── IT PROVES THE INPUTS CHANGED ───────────────────────────────────────
//
// The database does the deciding, not this route and not the browser. The
// token records what was sent the first time; redeem_groups_retry compares
// it to what is about to be sent and refuses if nothing meaningful moved.
//
//   some_figures  -> more source photographs than last time
//   most_figures  -> a different effect id
//
// Ungated this would be a reroll button. The change test is what makes it
// a second attempt instead.
//
// ── THE REFUSAL REASONS ARE FOR THE CURATOR, NOT THE LOG ───────────────
//
// `no_new_photograph` and `same_effect` are different sentences from
// `already_redeemed`, and both are different from `expired`. The customer
// who forgot to add a photo should be told that; the customer who already
// used their retry should not be told the same thing.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/store/auth'
import { GROUPS_EFFECTS } from '@/lib/v1/groups/groups-effects'

export const runtime = 'nodejs'

// POST { ref_id, effect_id, source_count }
//   ok  -> { ok: true,  reason: 'some_figures' | 'most_figures' }
//   !ok -> { ok: false, reason: 'no_token' | 'already_redeemed' | 'expired'
//                              | 'no_new_photograph' | 'same_effect'
//                              | 'signed_out' | 'unknown_effect' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const user = await getUser().catch(() => null)
    if (!user?.id) {
      return NextResponse.json({ ok: false, reason: 'signed_out' }, { status: 401 })
    }

    const refId = typeof body.ref_id === 'string' ? body.ref_id.trim().slice(0, 64) : ''
    if (!refId) {
      return NextResponse.json({ ok: false, reason: 'no_token' }, { status: 400 })
    }

    const effectId = typeof body.effect_id === 'string' ? body.effect_id : ''
    if (!(effectId in GROUPS_EFFECTS)) {
      return NextResponse.json({ ok: false, reason: 'unknown_effect' }, { status: 400 })
    }

    const sourceCount = Math.max(0, Math.floor(Number(body.source_count) || 0))

    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
    }

    const db = createClient(url, key, { auth: { persistSession: false } })

    const { data, error } = await db.rpc('redeem_groups_retry', {
      p_owner:        user.id,
      p_ref_id:       refId,
      p_effect_id:    effectId,
      p_source_count: sourceCount,
    })

    if (error) {
      console.error(`[groups/retry] rpc failed ref=${refId}: ${error.message}`)
      return NextResponse.json({ ok: false, reason: 'redeem_failed' }, { status: 500 })
    }

    // The function returns a single row: (allowed boolean, reason text).
    const row = Array.isArray(data) ? data[0] : data
    const allowed = row?.allowed === true
    const reason  = row?.reason ?? 'no_token'

    console.log(
      `[groups/retry] ref=${refId} owner=${user.id} ` +
      `allowed=${allowed} reason=${reason}`,
    )

    return NextResponse.json({ ok: allowed, reason })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    console.error(`[groups/retry] ${msg}`)
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}
