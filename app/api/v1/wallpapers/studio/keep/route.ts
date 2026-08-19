// app/api/v1/wallpapers/studio/keep/route.ts
//
// Spends four credits and releases the clean, unwatermarked file.
//
// ── FOUR CREDITS, NOT SIX ──────────────────────────────────────────────
//
// The photo wallpapers are six ($2.99). The Studio is four ($1.99), because
// nobody's face is in it — the market will not bear a portrait's price for
// something a stranger's face is not in.
//
// A craft is ten. This route therefore does NOT call /api/v1/credits/gate,
// which validates cost_per against CREDITS_PER_IMAGE and would refuse
// anything that is not ten. It spends directly, against the same RPC and
// writing the same ledger shape.
//
// ── THE ORDER OF OPERATIONS IS THE WHOLE ROUTE ─────────────────────────
//
//   1  signed in?
//   2  does the clean file exist?
//   3  spend
//   4  sign the URL
//
// Two comes before three because money must not move for a file that
// cannot be delivered — the same rule the craft gate learned when a
// customer paid ten credits for an effect with no prompt behind it and
// received a 400.
//
// Four comes after three because a signed URL handed out before the spend
// settles is the file, given away.
//
// ── EVERY CHARGE IS NAMEABLE ───────────────────────────────────────────
//
// The refund route matches a ledger row on reason and ref_id and refuses
// outright without one. A ref_id written as null is a charge nothing can
// reverse — that cost Rich fifty credits in one session. So a ref is minted
// here and returned, and the client may supply its own so a retried keep
// reuses one reference rather than charging under two.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { getUser } from '@/lib/store/auth'
import {
  STUDIO_BUCKET,
  studioCleanPath,
  STUDIO_SIGNED_URL_SECONDS,
} from '@/lib/v1/wallpapers/studio-store'

export const runtime = 'nodejs'

/** $1.99. See the header. */
const STUDIO_KEEP_CREDITS = 4

// POST { id, ref_id? }
//   ok  → { ok:true, url, ref_id, balance_after, spent }
//   !ok → { ok:false, reason:'signed_out' | 'no_credits' | ... }
export async function POST(req: Request) {
  try {
    const db = svc()
    if (!db) {
      return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))

    const rawId = typeof body.id === 'string' ? body.id.trim() : ''
    // Round ids are `<8 chars>-<0..3>`. Anything with a slash or a dot is
    // somebody trying to name a different object in the bucket.
    if (!rawId || !/^[A-Za-z0-9_-]{1,80}$/.test(rawId)) {
      return NextResponse.json({ ok: false, reason: 'bad_id' }, { status: 400 })
    }

    // ── 1 · Signed in ──
    // The page handles this by name: it sends them to sign in and back.
    const user = await getUser().catch(() => null)
    if (!user?.id) {
      return NextResponse.json({ ok: false, reason: 'signed_out' }, { status: 401 })
    }
    const owner = user.id

    // ── 2 · The file exists ──
    // Checked BEFORE the spend. A missing object here means the round was
    // swept or never stored, and the customer must not pay for it.
    const path = studioCleanPath(rawId)
    const { data: found, error: listErr } = await db.storage
      .from(STUDIO_BUCKET)
      .list('studio', { search: `${rawId}.jpg`, limit: 1 })

    if (listErr) {
      console.error(`[studio/keep] storage list failed: ${listErr.message}`)
      return NextResponse.json({ ok: false, reason: 'storage_unavailable' }, { status: 503 })
    }
    if (!found || found.length === 0) {
      return NextResponse.json({ ok: false, reason: 'expired' }, { status: 404 })
    }

    // ── 3 · Spend ──
    const suppliedRef = typeof body.ref_id === 'string' ? body.ref_id.trim() : ''
    const refId = suppliedRef ? suppliedRef.slice(0, 64) : `studio_${randomUUID()}`

    const { data: spent, error: spendErr } = await db.rpc('spend_credits', {
      p_owner: owner,
      p_n:     STUDIO_KEEP_CREDITS,
    })

    if (spendErr) {
      return NextResponse.json(
        { ok: false, reason: `spend_failed: ${spendErr.message}` }, { status: 500 })
    }

    // The RPC returns -1 for insufficient funds AND for no balance row at
    // all. Both are the same thing to a customer: they need credits.
    if (typeof spent !== 'number' || spent < 0) {
      const { data: bal } = await db
        .from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
      return NextResponse.json({
        ok: false,
        reason:  'no_credits',
        balance: bal?.balance ?? 0,
        needed:  STUDIO_KEEP_CREDITS,
      })
    }

    const balanceAfter = spent

    // Audit. Non-fatal — the customer has paid and must get their file even
    // if the ledger write fails, and a failed write is loud enough to
    // reconcile by hand.
    const { error: ldErr } = await db.from('credit_ledger').insert({
      owner_key:     owner,
      delta:         -STUDIO_KEEP_CREDITS,
      reason:        'studio_keep',
      ref_id:        refId,
      balance_after: balanceAfter,
    })
    if (ldErr) {
      console.error(`[studio/keep] credit_ledger insert FAILED ref=${refId}: ${ldErr.message}`)
    }

    // ── 4 · Release ──
    const { data: signed, error: signErr } = await db.storage
      .from(STUDIO_BUCKET)
      .createSignedUrl(path, STUDIO_SIGNED_URL_SECONDS)

    if (signErr || !signed?.signedUrl) {
      // Paid and undelivered. This is the one state that must never be
      // quiet — the ref is logged so it can be refunded by name.
      console.error(
        `[studio/keep] PAID BUT UNDELIVERED owner=${owner} ref=${refId} ` +
        `id=${rawId}: ${signErr?.message ?? 'no url'}`,
      )
      return NextResponse.json({
        ok: false, reason: 'delivery_failed', ref_id: refId,
      }, { status: 500 })
    }

    console.log(`[studio/keep] kept id=${rawId} owner=${owner} ref=${refId}`)

    return NextResponse.json({
      ok:            true,
      url:           signed.signedUrl,
      ref_id:        refId,
      balance_after: balanceAfter,
      spent:         STUDIO_KEEP_CREDITS,
    })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error(`[studio/keep] ${msg}`)
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}

function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
