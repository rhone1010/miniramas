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
  groupsCreditCost,
  MAX_SOURCE_IMAGES,
  MIN_SUBJECTS,
  MAX_SUBJECTS,
  type GroupsGenerateRequest,
} from '@/lib/v1/groups/groups-shared'

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

    if (sources.length > MAX_SOURCE_IMAGES) {
      // Refused rather than sliced. The old ceiling silently truncated
      // multi-photo composites and the render came back missing a person
      // with no error at all — the customer paid for five faces and got
      // four. Better to say no.
      return NextResponse.json(
        {
          error: `too many source images: ${sources.length}`,
          max:   MAX_SOURCE_IMAGES,
        },
        { status: 400 },
      )
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

    // Who this craft belongs to, and which charge. The ref_id is minted by
    // the credit gate and passed through so a retry — and later a refund —
    // can name the charge it answers to. Without one, no token: an
    // unnameable free render is one nothing can reconcile.
    const user     = await getUser().catch(() => null)
    const ownerKey = user?.id ?? null
    const refId    = typeof body.ref_id === 'string' ? body.ref_id.trim().slice(0, 64) : null

    const generateRequest: GroupsGenerateRequest = {
      source_images_b64: sources,
      effect_id:         effectId,
      subject_count:     subjectCountHint,
      // Internal shoots only. A customer render is never unscored.
      skip_scoring:      body.skip_scoring === true && body.internal === true,
    }

    console.log(
      `[groups/generate] start effect=${effectId} intake=${effect.intake} ` +
      `hint=${subjectCountHint} sources=${sources.length}`,
    )

    const result = await generateGroupsRender({
      request: generateRequest,
      replicateApiToken,
      openaiApiKey,
      stabilityApiKey,
    })

    const durationMs = Date.now() - t0

    // The count the engine settled on, and the price that follows from it.
    // Echoed so a mismatch with what the credit gate charged shows up in a
    // log rather than in the ledger.
    const creditCost = groupsCreditCost(result.subject_count)

    console.log(
      `[groups/generate] done in ${durationMs}ms — ok=${result.ok} ` +
      `passed=${result.passed} subjects=${result.subject_count} ` +
      `credits=${creditCost} attempts=${result.attempts.length} ` +
      `outpainted=${result.outpainted} ` +
      `failure=${result.failure?.kind ?? '-'}`,
    )

    // A render that never happened is a 500. A render that happened and
    // missed the bar is a 200 with passed:false — see the header.
    if (!result.ok) {
      return NextResponse.json(
        { result, credit_cost: creditCost },
        { status: 500 },
      )
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

    return NextResponse.json({ result, credit_cost: creditCost, retry })

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
