// app/api/v1/groups/generate/route.ts
//
// Single-render endpoint for the Groups silo. REWRITTEN 2026-08-11.
//
// Pipeline, delegated to generateGroupsRender:
//   pre-flight face check -> NB2 -> per-figure score -> up to four
//   attempts -> Stability outpaint in margin mode.
//
// ── WHAT THIS REPLACES ─────────────────────────────────────────────────
//
// The previous route took style_id, preset_id, location_id, scale,
// arrangement, plaque_text, experimental_effect and refinement_tweak, and
// read final_pass, refined, expanded and swapped off the result. The flat
// catalog removed every one of those. An effect id and a subject count are
// the whole request now.
//
// ── SUBJECT COUNT IS THE PRICE ─────────────────────────────────────────
//
// It drives the framing clause, the scoring rule AND the credit band, so a
// wrong count is a wrong piece, scored against the wrong bar, at the wrong
// price.
//
// The old route accepted it from the client as `body.subject_count ||
// undefined` and the generator treated absence as "auto". That cannot
// stand now that money depends on it: a client that can send the count is
// a client that can pick its own price.
//
// The posture here is that the route ECHOES the band it computed rather
// than trusting anything. The credit gate charges; this reports what the
// craft should have cost, so a mismatch is visible in the log instead of
// being discovered in the ledger.
//
// ── THE FREE RETRY ─────────────────────────────────────────────────────
//
// When the gate is missed after four attempts, a token is written against
// the charge. It buys one more craft at no cost, and ONLY if the inputs
// change — a closer photograph when some figures missed, a different
// effect when most of them did.
//
// The four attempts are already paid for by the studio; that cost is sunk
// the moment the gate fails. Charging again for a fifth run on identical
// inputs would be charging twice for the same failure. A changed input is
// genuinely different work and is the thing most likely to succeed.
//
// Ungated it would be a reroll button. Gated, it is the only lever that
// improves the odds, and it lets the Curator ask the customer to DO
// something rather than to try again and hope.
//
// Issuing is non-fatal: a token that failed to write costs the studio a
// conversion, not the customer a craft.
//
// ── FAILING THE GATE IS NOT AN ERROR ───────────────────────────────────
//
// Four attempts that all miss the likeness bar return HTTP 200 with
// `passed: false`, an image, and a structured `failure`. The piece is
// offered alongside a refund rather than thrown away, and the Concierge
// speaks from the failure shape.
//
// A 4xx or 5xx from here means the render never happened. Do not conflate
// the two: one is a craft the customer may still want, the other is one
// they never got.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/store/auth'
import { generateGroupsRender } from '@/lib/v1/groups/groups-generator'
import {
  GROUPS_EFFECTS,
  type GroupsEffectId,
} from '@/lib/v1/groups/groups-effects'
import {
  MIN_SUBJECTS,
  MAX_SUBJECTS,
  type GroupsGenerateRequest,
} from '@/lib/v1/groups/groups-shared'
import { GROUPS_CRAFT_STYLE } from '@/lib/v1/groups/groups-commerce'

export const runtime = 'nodejs'

/**
 * Four NB2 calls, four vision calls and one Stability call in the worst
 * case. 300 is the ceiling this plan allows, and a twelve-person craft
 * that needs all four attempts can approach it.
 *
 * If timeouts start appearing here the answer is not a bigger number —
 * there is not one. It is fewer attempts, or moving the loop off the
 * request path.
 */
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()

    // ── Sources ──
    //
    // Both shapes accepted. The old route took one source plus an
    // additional array; the flat pipeline thinks in one list, because a
    // multi_photo composite has no "primary" photograph — it has one per
    // person.
    const sources: string[] = Array.isArray(body.source_images_b64)
      ? body.source_images_b64.filter((s: unknown) => typeof s === 'string')
      : [
          ...(typeof body.source_image_b64 === 'string' ? [body.source_image_b64] : []),
          ...(Array.isArray(body.additional_images_b64)
            ? body.additional_images_b64.filter((s: unknown) => typeof s === 'string')
            : []),
        ]

    if (!sources.length) {
      return NextResponse.json(
        { error: 'source_images_b64 required' },
        { status: 400 },
      )
    }

    if (sources.length !== 1) {
      return NextResponse.json({ error: 'one source image required' }, { status: 400 })
    }

    // ── Effect ──
    const effectId: GroupsEffectId = body.effect_id ?? body.effect

    if (!effectId) {
      return NextResponse.json({ error: 'effect_id required' }, { status: 400 })
    }
    if (!(effectId in GROUPS_EFFECTS)) {
      return NextResponse.json(
        { error: `unknown effect: ${effectId}`, known: Object.keys(GROUPS_EFFECTS) },
        { status: 400 },
      )
    }

    const effect = GROUPS_EFFECTS[effectId]

    // ── Subject count ──
    //
    // THE ROUTE DOES NOT DECIDE THIS.
    //
    // The count drives the framing clause, the scoring bar and the credit
    // band, so a caller that could set it could pick its own price. The
    // engine counts hero subjects itself in its pre-flight pass — the same
    // vision call that checks whether a face is visible at all — and that
    // number is authoritative.
    //
    // Anything sent here is a HINT. It is passed through, the generator
    // logs any disagreement, and the engine's number wins. It is used only
    // when the detection call errors outright, which is the generous
    // reading of an infrastructure failure.
    //
    // For multi_photo the photographs are the count and the generator
    // takes sources.length regardless of what arrives here.
    const hinted = Math.floor(Number(body.subject_count))
    const subjectCountHint = Number.isFinite(hinted)
      ? Math.max(MIN_SUBJECTS, Math.min(hinted, MAX_SUBJECTS))
      : MIN_SUBJECTS

    // ── Env ──
    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN not configured' },
        { status: 500 },
      )
    }

    const openaiApiKey    = process.env.OPENAI_API_KEY    || undefined
    const stabilityApiKey = process.env.STABILITY_API_KEY || undefined

    // Not a warning, and not survivable. Without OpenAI there is no
    // likeness gate AND no subject count, so the craft cannot be framed,
    // scored or priced. The generator refuses rather than rendering
    // something it would have to charge a guessed amount for.
    if (!openaiApiKey) {
      console.error('[groups/generate] OPENAI_API_KEY missing — craft will be refused')
    }
    if (!stabilityApiKey) {
      console.warn('[groups/generate] STABILITY_API_KEY missing — piece will crop at the frame edge')
    }

    // ── Identity ──
    const user     = await getUser().catch(() => null)
    const ownerKey = user?.id ?? null
    const refId    = typeof body.ref_id === 'string' ? body.ref_id.trim().slice(0, 64) : null

    // ── Authorization ──
    //
    // Groups does NOT use the generic credit economy. A paid Groups craft
    // consumes one entitlement with locked_style = 'groups_craft' from
    // the existing entitlements table.
    //
    // Three paths:
    //   1. Internal shoot (skip_scoring + internal) — no entitlement needed
    //   2. Valid retry token — no additional entitlement consumed
    //   3. Paid craft — one groups_craft entitlement consumed atomically
    //
    // The retry check runs BEFORE entitlement consumption, so a retry
    // that changes the input (new photograph for some_figures, different
    // effect for most_figures) is free. The retry token is issued at the
    // end of a generation that failed the likeness gate.
    const isInternal = body.skip_scoring === true && body.internal === true
    let isRetry = false
    let consumedEntitlementId: string | null = null

    if (!isInternal && ownerKey) {
      // Check retry first — a valid retry skips entitlement consumption
      if (refId) {
        const retryResult = await checkRetryToken({
          ownerKey,
          refId,
          effectId,
          sourceCount: sources.length,
        })
        if (retryResult?.allowed) {
          isRetry = true
          console.log(
            `[groups/generate] retry authorized ref=${refId} reason=${retryResult.reason}`,
          )
        }
      }

      if (!isRetry) {
        // Consume one groups_craft entitlement
        const consumed = await consumeGroupsCraftEntitlement(ownerKey)
        if (!consumed) {
          return NextResponse.json(
            { error: 'no_groups_crafts', reason: 'no available Groups craft entitlement' },
            { status: 402 },
          )
        }
        consumedEntitlementId = consumed.entitlementId
        console.log(
          `[groups/generate] entitlement consumed id=${consumed.entitlementId} remaining=${consumed.remaining}`,
        )
      }
    } else if (!isInternal && !ownerKey) {
      return NextResponse.json(
        { error: 'not_signed_in' },
        { status: 401 },
      )
    }

    // Format: '3:2' (landscape, default) or '9:16' (Mobile). Validated
    // by the generator against group count and effect capability.
    const format = body.format === '9:16' ? '9:16' : '3:2'

    const generateRequest: GroupsGenerateRequest = {
      source_images_b64: sources,
      effect_id:         effectId,
      subject_count:     subjectCountHint,
      format,
      // Internal shoots only. A customer render is never unscored.
      skip_scoring:      isInternal,
    }

    console.log(
      `[groups/generate] start effect=${effectId} intake=${effect.intake} ` +
      `hint=${subjectCountHint} sources=${sources.length} format=${format} ` +
      `retry=${isRetry} entitlement=${consumedEntitlementId ?? '-'}`,
    )

    // ── The entitlement, past this point ──
    //
    // Consumed above, before the render, because the render is the
    // expensive part and a client that could skip payment by aborting
    // mid-request is a client that crafts for free. Everything from here
    // restores it on the studio's own failure — the customer is never
    // charged a craft for a piece they did not get, matching what the
    // credits gate always did before entitlements replaced it here.
    let result
    try {
      result = await generateGroupsRender({
        request: generateRequest,
        replicateApiToken,
        openaiApiKey,
        stabilityApiKey,
      })
    } catch (genErr) {
      if (consumedEntitlementId) {
        await restoreGroupsCraftEntitlement(consumedEntitlementId)
      }
      throw genErr
    }

    const durationMs = Date.now() - t0

    console.log(
      `[groups/generate] done in ${durationMs}ms — ok=${result.ok} ` +
      `passed=${result.passed} subjects=${result.subject_count} ` +
      `format=${result.format} ` +
      `attempts=${result.attempts.length} ` +
      `outpainted=${result.outpainted} ` +
      `failure=${result.failure?.kind ?? '-'}`,
    )

    // A render that never happened is a 500. A render that happened and
    // missed the bar is a 200 with passed:false — see the header. Either
    // way nothing was delivered as paid for, so the entitlement goes back.
    if (!result.ok) {
      if (consumedEntitlementId) {
        await restoreGroupsCraftEntitlement(consumedEntitlementId)
      }
      return NextResponse.json(
        { result },
        { status: 500 },
      )
    }

    // ── Missed the likeness gate ──
    //
    // The piece still lands — it is theirs, offered alongside the fact
    // that it did not hold — and the entitlement it would have spent goes
    // back, exactly as a credits refund did for the same outcome. A free
    // retry (below) is a second, separate thing: a changed input earning
    // another attempt. This is the first thing: not being charged for the
    // attempt that missed.
    if (!result.passed && consumedEntitlementId) {
      await restoreGroupsCraftEntitlement(consumedEntitlementId)
    }

    // ── Issue the retry token ──
    //
    // Only for the two failure kinds a changed input can actually fix.
    // face_not_visible fired before any render and cost nothing, so there
    // is nothing to compensate; no_figures and render_failed are not
    // fixable by a better photograph of the same people.
    let retry: { available: boolean; change: string } | null = null

    if (
      !result.passed &&
      result.image_b64 &&
      refId &&
      ownerKey &&
      (result.failure?.kind === 'some_figures' || result.failure?.kind === 'most_figures')
    ) {
      retry = await issueRetryToken({
        ownerKey,
        refId,
        effectId,
        subjectCount: result.subject_count,
        sourceCount:  sources.length,
        reason:       result.failure.kind,
      })
    }

    return NextResponse.json({
      result,
      retry,
      entitlement_consumed: consumedEntitlementId,
      is_retry: isRetry,
    })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    const durationMs = Date.now() - t0
    console.error(`[groups/generate] failed in ${durationMs}ms: ${msg}`)
    return NextResponse.json(
      { error: msg, duration_ms: durationMs },
      { status: 500 },
    )
  }
}

// ─── RETRY TOKEN ────────────────────────────────────────────────
//
// One row per charge, enforced by a unique index on ref_id rather than by
// this function remembering to check. A second failed craft is a second
// ref_id and earns its own token; a second failure on the SAME craft does
// not.

async function issueRetryToken(args: {
  ownerKey:     string
  refId:        string
  effectId:     string
  subjectCount: number
  sourceCount:  number
  reason:       'some_figures' | 'most_figures'
}): Promise<{ available: boolean; change: string } | null> {

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  const db = createClient(url, key, { auth: { persistSession: false } })

  const { error } = await db.from('groups_retry_tokens').insert({
    owner_key:     args.ownerKey,
    ref_id:        args.refId,
    effect_id:     args.effectId,
    subject_count: args.subjectCount,
    source_count:  args.sourceCount,
    reason:        args.reason,
  })

  if (error) {
    // A duplicate is not a fault: this craft already earned its one token.
    // Anything else is logged and the offer is simply not made.
    if (!/duplicate|unique/i.test(error.message)) {
      console.error(`[groups/generate] retry token insert failed ref=${args.refId}: ${error.message}`)
    }
    return null
  }

  console.log(`[groups/generate] retry token issued ref=${args.refId} reason=${args.reason}`)

  // What the customer has to change. The glass turns this into an
  // affordance; the Curator turns it into a sentence.
  return {
    available: true,
    change:    args.reason === 'some_figures' ? 'add_photograph' : 'change_effect',
  }
}

// ─── ENTITLEMENT-BASED AUTHORIZATION ──────────────────────────────
//
// Groups does not use credits. One craft = one entitlement consumed.
// Flat rate, regardless of subject count or intake type.

function svcClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Consume one groups_craft entitlement. Returns the entitlement id
 *  and remaining count, or null if none available. FIFO by created_at. */
async function consumeGroupsCraftEntitlement(
  ownerKey: string,
): Promise<{ entitlementId: string; remaining: number } | null> {

  const db = svcClient()
  if (!db) return null

  // Find the oldest available groups_craft entitlement
  const { data: available, error: findErr } = await db
    .from('entitlements')
    .select('id')
    .eq('user_id', ownerKey)
    .eq('status', 'available')
    .eq('locked_style', GROUPS_CRAFT_STYLE)
    .order('created_at', { ascending: true })
    .limit(1)

  if (findErr || !available?.length) return null

  const entId = available[0].id

  // Consume atomically via the existing function (migration 003).
  // style = GROUPS_CRAFT_STYLE matches the locked_style guard.
  const { data: consumed, error: consumeErr } = await db.rpc(
    'consume_entitlement_atomic',
    {
      p_entitlement_id: entId,
      p_job_id:         null,
      p_style:          GROUPS_CRAFT_STYLE,
      p_variant:        null,
      p_user_id:        ownerKey,
      p_guest_email:    null,
    },
  )

  if (consumeErr || !consumed?.length) return null

  // Count remaining
  const { count } = await db
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ownerKey)
    .eq('status', 'available')
    .eq('locked_style', GROUPS_CRAFT_STYLE)

  return { entitlementId: entId, remaining: count ?? 0 }
}

/** Give back one consumed groups_craft entitlement. Called when the
 *  render it paid for either never happened or did not hold the
 *  likeness — see the header. Flips the same row back to 'available'
 *  rather than minting a new one, so a customer's total never exceeds
 *  what they bought. Failure here is logged, not thrown: the render
 *  already finished (or failed) and the response to the customer must
 *  not hinge on this bookkeeping step. */
async function restoreGroupsCraftEntitlement(entitlementId: string): Promise<void> {
  const db = svcClient()
  if (!db) return

  const { error } = await db
    .from('entitlements')
    .update({ status: 'available', job_id: null, consumed_at: null })
    .eq('id', entitlementId)
    .eq('status', 'consumed')

  if (error) {
    console.error(
      `[groups/generate] FAILED to restore entitlement id=${entitlementId}: ${error.message}`,
    )
  } else {
    console.log(`[groups/generate] entitlement restored id=${entitlementId}`)
  }
}

/** Check whether a valid retry token exists for this craft. A valid
 *  retry skips entitlement consumption entirely. */
async function checkRetryToken(args: {
  ownerKey:    string
  refId:       string
  effectId:    string
  sourceCount: number
}): Promise<{ allowed: boolean; reason: string } | null> {

  const db = svcClient()
  if (!db) return null

  const { data, error } = await db.rpc('redeem_groups_retry', {
    p_owner:        args.ownerKey,
    p_ref_id:       args.refId,
    p_effect_id:    args.effectId,
    p_source_count: args.sourceCount,
  })

  if (error) {
    // Not fatal — the craft proceeds as a paid craft
    console.warn(`[groups/generate] retry check failed: ${error.message}`)
    return null
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return { allowed: row.allowed === true, reason: row.reason ?? '' }
}
