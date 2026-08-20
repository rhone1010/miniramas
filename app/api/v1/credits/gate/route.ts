// app/api/v1/credits/gate/route.ts
// The craft gate. runAll calls this INSTEAD of Stripe checkout. On ok the
// caller marks items entitled and reaches craftPending(). Upstream of the
// render path — it does not touch craftPending() or the existing fetch calls.
//
// CUI V22 · 2026-07-28 · corrected to CREDITS-AND-CODES-SPEC-v4.
//
// WHAT WAS WRONG
//   spend_credits(p_owner, p_n) decrements `balance - p_n`, so p_n is CREDITS.
//   The route passed the IMAGE count. At ten credits an image a five-image
//   craft therefore spent 5 credits instead of 50, and every ledger row
//   recorded -1 rather than -10. The client already sends cost_per; the route
//   simply never read it.
//
//   Fixing this client-side would have produced a correct price against a
//   false audit trail. The spend and the ledger must agree, and both live here.
//
// ALSO CHANGED
//   · guest_key removed. Guest is retired (LOCKED-DECISIONS, USERS & AUTH).
//     No owner, no craft.
//   · cost_per validated against the server's own figure rather than trusted.
//   · ledger and events write -cost_per per row, and balance_after walks by
//     cost_per.
//   · header cites v4.
//
// CUI V24 · 2026-08-01 · the charge is now nameable.
//
//   The refund route matches a ledger row on reason='craft' AND ref_id, and
//   refuses outright without one. This route wrote `ref_id: null`, so no
//   refund could ever find the charge it was reversing. Verified against the
//   live ledger 2026-08-01 — ten consecutive craft rows, null on all ten.
//
//   Rich lost fifty credits to this in one session: a photograph with three
//   people was redirected to Groups, nothing was delivered, and every refund
//   came back 400 ref_id_required.
//
//   A ref_id is now minted here, written to both the ledger and the craft
//   events, and returned to the caller so the refund can name what it
//   reverses. The client may supply its own, so a retried gate call reuses
//   one reference rather than charging under two.
//
// CUI V29 · 2026-08-19 · the price is no longer one number.
//
//   THE BLOCK THIS REMOVES
//   CREDITS_PER_IMAGE was a flat 10 and the route refused anything else.
//   Groups is banded by subject count — 10 / 15 / 25 / 40 — so every Groups
//   craft above the smallest band was refused with cost_per_mismatch. The
//   engine was finished and unsellable. CENG flagged this as the only thing
//   standing between the two.
//
//   Price is now resolved per Series by priceFor(). Portraits and everything
//   else keep the flat ten and behave exactly as before; the diff for a
//   portraits craft is nil. Groups calls groupsCreditCost() out of
//   lib/v1/groups/groups-shared.ts rather than restating the bands here, so
//   there is one place the numbers live and it is CENG's.
//
//   WHAT THIS DOES NOT YET DO — read this before trusting the figure
//   The band comes from `subject_count` in the request body, which today
//   arrives from the client. A client that lowers it pays a smaller band.
//   The gate cannot check it: the authoritative count is produced by the
//   engine's pre-flight vision pass, which does not run until /generate is
//   called, by which time the money has already moved.
//
//   The close is a Groups analyze route (CENG, briefed 2026-08-19) that
//   counts on upload and persists the figure against the owner. When that
//   lands, priceFor() reads the stored count and `subject_count` stops being
//   an input. The seam is deliberately one function wide so that change is
//   small.
//
//   Until then this is a soft-launch exposure, not an open door: an owner
//   must be signed in, must hold credits, and every craft is named in the
//   ledger by ref_id with the count it was charged at. Underpayment is
//   visible after the fact rather than silent.
//
//   ALSO: canRender now judges Groups. It only ever judged portraits, so a
//   Groups effect with no prompt behind it took the credits and returned a
//   400 from the generate route. isGroupsEffectId() is the same guard the
//   engine uses.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser }      from '@/lib/store/auth'
import { PRESET_LABELS }        from '@/lib/v1/portraits/portraits-shared'
import { isExperimentalEffect } from '@/lib/v1/portraits/portraits-experimental'
import { groupsCreditCost }     from '@/lib/v1/groups/groups-shared'
import { isGroupsEffectId }     from '@/lib/v1/groups/groups-effects'

export const runtime = 'nodejs'

/** Spec v4. An image costs ten credits everywhere except Groups, which is
 *  banded by subject count. The client sends a figure; the server does not
 *  take its word for it. */
const CREDITS_PER_IMAGE = 10
const MAX_PAYLOAD = 10          // payloads of ten — the queue caps here too

/** The largest party the engine will accept. Above this /generate refuses
 *  outright rather than slicing, so the gate refuses too — money must not
 *  move for a payload the renderer will reject. */
const MAX_SUBJECTS = 14

function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** What one image of this Series costs, in credits.
 *
 *  Returns a number, or a reason the price cannot be established. Groups is
 *  the only Series that needs anything from the body; everything else is the
 *  flat rate and ignores its arguments.
 *
 *  This is the seam the Groups analyze route replaces. When a server-held
 *  count exists, it is read here and `subjectCount` stops being a parameter.
 */
function priceFor(series: string, subjectCount: unknown):
  { ok: true; cost: number; subjects: number | null } |
  { ok: false; reason: string; detail?: unknown } {

  if (series !== 'groups') {
    return { ok: true, cost: CREDITS_PER_IMAGE, subjects: null }
  }

  const n = Math.floor(Number(subjectCount))
  if (!Number.isFinite(n) || n < 1) {
    // Groups without a count has no price. Refusing is correct: charging the
    // smallest band and rendering a twelve-person craft is a loss with no
    // record of why.
    return { ok: false, reason: 'subject_count_required' }
  }
  if (n > MAX_SUBJECTS) {
    return { ok: false, reason: 'too_many_subjects', detail: MAX_SUBJECTS }
  }

  const cost = Math.floor(Number(groupsCreditCost(n)))
  if (!Number.isFinite(cost) || cost <= 0) {
    return { ok: false, reason: 'price_unavailable' }
  }
  return { ok: true, cost, subjects: n }
}

/** Can the engine actually render this preset?
 *
 *  The gate sits upstream of /generate and used to spend without asking. A
 *  customer could pick an effect with no prompt behind it, pay ten credits,
 *  and receive a 400. Money must not move for work that cannot be done.
 *
 *  Portraits and Groups are wired. Another Series returns true rather than
 *  blocking a craft this route cannot judge — better to let it through than
 *  to refuse work that would have succeeded.
 */
function canRender(series: string, preset: string): boolean {
  if (series === 'groups') return isGroupsEffectId(preset)
  if (series !== 'portraits') return true
  if (preset in PRESET_LABELS) return true
  try { if (isExperimentalEffect(preset)) return true } catch { /* seam unwired */ }
  return false
}

/** Guest is retired. An owner is a signed-in user or there is no craft. */
async function resolveOwner(): Promise<string | null> {
  const user = await getUser().catch(() => null)
  return user?.id ?? null
}

// POST { count, cost_per?, series?, presets?[], subject_count?, ref_id? }
//   ok  → { ok:true, ref_id, balance_after, granted, spent, cost_per,
//           subject_count, admin }
//   !ok → { ok:false, reason:'insufficient_credits', balance, needed }
export async function POST(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })

    const body  = await req.json().catch(() => ({}))
    const owner = await resolveOwner()
    if (!owner) {
      return NextResponse.json({ ok: false, reason: 'not_signed_in' }, { status: 401 })
    }

    const n = Math.max(1, Math.floor(Number(body.count) || 1))
    if (n > MAX_PAYLOAD) {
      return NextResponse.json(
        { ok: false, reason: 'payload_too_large', max: MAX_PAYLOAD }, { status: 400 })
    }

    const series = typeof body.series === 'string' ? body.series : 'portraits'

    // The server's own figure, before the client's is looked at.
    const priced = priceFor(series, body.subject_count)
    if (!priced.ok) {
      return NextResponse.json(
        { ok: false, reason: priced.reason, detail: priced.detail }, { status: 400 })
    }
    const costPer = priced.cost

    // cost_per is read, not trusted. A client asking for a cheaper rate gets
    // the server's figure; anything else is a bug or an attack. It stays
    // OPTIONAL — a caller that sends nothing is quoted the server price
    // rather than refused, which is how the Groups page will behave until it
    // knows the band up front.
    if (body.cost_per !== undefined && body.cost_per !== null) {
      const asked = Math.floor(Number(body.cost_per))
      if (asked !== costPer) {
        return NextResponse.json(
          { ok: false, reason: 'cost_per_mismatch', expected: costPer, got: asked },
          { status: 400 })
      }
    }

    // A charge must be nameable or nothing can reverse it. The refund route
    // matches on this; until now it was written as null and every refund
    // failed with ref_id_required.
    //
    // The client may supply one, so a gate call retried after a network drop
    // reuses the same reference instead of charging under a second name. It
    // is length-capped because it reaches a text column and comes from
    // outside.
    const suppliedRef = typeof body.ref_id === 'string' ? body.ref_id.trim() : ''
    const refId = suppliedRef ? suppliedRef.slice(0, 64) : `craft_${crypto.randomUUID()}`

    const total  = n * costPer          // credits, not images
    const presets: string[] = Array.isArray(body.presets)
      ? body.presets.filter((p: unknown): p is string => typeof p === 'string')
      : []

    // Nothing is spent for work that cannot be done. This runs BEFORE the
    // balance is touched, so a bad preset costs nothing and says which.
    if (presets.length) {
      const unavailable = presets.filter(p => !canRender(series, p))
      if (unavailable.length) {
        return NextResponse.json({
          ok: false,
          reason: 'preset_unavailable',
          unavailable,
        }, { status: 400 })
      }
      if (presets.length !== n) {
        return NextResponse.json({
          ok: false,
          reason: 'preset_count_mismatch',
          count: n, presets: presets.length,
        }, { status: 400 })
      }
    }

    // Admin never decrements, but still writes a complete audit trail at
    // delta 0 so the craft is visible in the ledger.
    let isAdmin = false
    const { data: reds } = await db
      .from('code_redemptions').select('code').eq('owner_key', owner)
    const codes = (reds || []).map((r: { code: string }) => r.code)
    if (codes.length) {
      const { data: adminCodes } = await db
        .from('access_codes').select('code').eq('kind', 'admin').in('code', codes).limit(1)
      isAdmin = Array.isArray(adminCodes) && adminCodes.length > 0
    }

    let balanceAfter: number
    if (isAdmin) {
      const { data: bal } = await db
        .from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
      balanceAfter = bal?.balance ?? 0
    } else {
      const { data: spent, error } = await db.rpc('spend_credits', {
        p_owner: owner,
        p_n: total,                     // credits, matching the function's contract
      })
      if (error) {
        return NextResponse.json(
          { ok: false, reason: `spend_failed: ${error.message}` }, { status: 500 })
      }
      if (typeof spent !== 'number' || spent < 0) {
        const { data: bal } = await db
          .from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
        return NextResponse.json({
          ok: false, reason: 'insufficient_credits',
          balance: bal?.balance ?? 0, needed: total,
        })
      }
      balanceAfter = spent
    }

    // Audit — one craft_started event and one ledger row per image, each
    // moving cost_per. balance_after walks from the pre-spend balance down.
    const delta = isAdmin ? 0 : -costPer

    const events = Array.from({ length: n }, (_, i) => ({
      owner_key: owner,
      series,
      preset: presets[i] ?? presets[0] ?? null,
      event: 'craft_started',
      attempts: 1,
      credits_delta: delta,
      source_photo_id: refId,   // the only reference column on this table
    }))
    const { error: evErr } = await db.from('craft_events').insert(events)
    if (evErr) console.error('[credits/gate] craft_events insert failed', evErr)

    const ledger = Array.from({ length: n }, (_, k) => ({
      owner_key: owner,
      delta,
      reason: 'craft',
      ref_id: refId,          // the refund route matches on this
      balance_after: isAdmin ? balanceAfter : balanceAfter + (n - 1 - k) * costPer,
    }))
    const { error: ldErr } = await db.from('credit_ledger').insert(ledger)
    if (ldErr) console.error('[credits/gate] credit_ledger insert failed', ldErr)

    return NextResponse.json({
      ok: true,
      ref_id: refId,          // the client holds this and sends it to /refund
      balance_after: balanceAfter,
      granted: n,
      spent: isAdmin ? 0 : total,
      cost_per: costPer,
      subject_count: priced.subjects,   // null off Groups
      admin: isAdmin,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}
