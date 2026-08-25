// app/api/v1/groups/analyze/route.ts
//
// ONE GATE, AT ANALYZE. Written 2026-08-19.
//
// Returns everything that has to be known BEFORE money moves: how many
// people are in the photograph, what the craft therefore costs, and
// whether the source is good enough to be worth crafting.
//
// ── WHY THIS ROUTE HAD TO EXIST ────────────────────────────────────────
//
// It did not, while counting was the only job — the generator counts
// subjects in its own pre-flight pass and that number is authoritative.
//
// But the count sets the PRICE, and the pre-flight runs after the credit
// gate has already charged. Quality analysis has the same problem in
// worse form: refusing a photograph the customer has already paid to
// craft is the wrong order of events.
//
// So both move here, ahead of checkout. The glass calls this, shows the
// price and any advisory, and only then gates.
//
// This is the "one gate at analyze" fix noted as the permanent answer in
// portraits.html and never built. Groups gets it first.
//
// ── QUALITY IS ADVISORY, NOT A REFUSAL ─────────────────────────────────
//
// Rich's ruling, carried from Portraits: a sharp 600px photo renders
// better than a blurry 2000px one, so pixel dimensions are the wrong
// signal to refuse on. The hard resolution banner was retired there for
// exactly that reason and it is not reintroduced here.
//
// The real safety net is downstream and already built: four attempts, a
// per-figure likeness gate, and a refund offered when it still misses.
// That catches the photographs a px threshold would only have guessed at,
// and it costs a render rather than a sale.
//
// So this route WARNS. It does not decline. The one exception is a
// photograph with no usable face at all, which is not a quality judgment
// but an absence — there is nothing to craft.
//
// ── TWO THRESHOLD SETS EXISTED AND DISAGREED ───────────────────────────
//
// RESOLUTION-GATE-NOTES.md: face red under 50px, yellow 50-79.
// portraits.html:            face red under 80px, yellow under 140.
//
// Portraits was deliberately stricter so its warning fired before the
// generate gate would decline. Groups does not need that margin, because
// Groups does not hard-decline on face size at all.
//
// The numbers below are the Portraits ones, because they are the ones
// tuned against renders. They are stated ONCE, here, and the glass reads
// them from the response rather than restating them.

import { NextRequest, NextResponse } from 'next/server'
import { analyzeSourceSet } from '@/lib/v1/groups/groups-refine'
import { getUser } from '@/lib/store/auth'
import {
  groupsCreditCost,
  MAX_SOURCE_IMAGES,
  MIN_SUBJECTS,
  MAX_SUBJECTS,
} from '@/lib/v1/groups/groups-shared'

export const runtime     = 'nodejs'
export const maxDuration = 60

/** Face size in pixels on the shorter dimension. Under RED, likeness will
 *  probably soften; under YELLOW it may. Neither refuses. */
const FACE_RED_PX    = 80
const FACE_YELLOW_PX = 140

export async function POST(req: NextRequest) {
  /* THE MOMENT OF INTENT IS THE MOMENT OF CAPTURE. Rich, 25 August.
     Upload is analyze, and analyze is where the account begins - the site
     is public now and this was an open vision-model tap with no account
     behind it. Same answer the money routes give; the glass upload card
     is built on catching exactly this 401. */
  const authedUser = await getUser().catch(() => null)
  if (!authedUser) {
    return NextResponse.json({ ok: false, reason: 'not_signed_in' }, { status: 401 })
  }


  const t0 = Date.now()

  try {
    const body = await req.json()

    // Both shapes accepted, same as generate.
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
      return NextResponse.json(
        { error: `too many source images: ${sources.length}`, max: MAX_SOURCE_IMAGES },
        { status: 400 },
      )
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      // Refused, not defaulted. Without this there is no count, and
      // without a count there is no price.
      console.error('[groups/analyze] OPENAI_API_KEY missing')
      return NextResponse.json(
        { error: 'analysis unavailable', retryable: true },
        { status: 503 },
      )
    }

    const result = await analyzeSourceSet({
      primaryB64:   sources[0],
      auxB64s:      sources.slice(1),
      openaiApiKey,
    })

    // ── The count, and the price that follows ──
    //
    // Clamped to the range the silo actually supports. A zero here means
    // the analyzer found nobody, which is handled below as the one real
    // refusal.
    const subjectCount = Math.max(
      MIN_SUBJECTS,
      Math.min(result.total_subjects || 0, MAX_SUBJECTS),
    )

    const creditCost = groupsCreditCost(subjectCount)

    // ── Advisories ──
    //
    // Every one of these is something to SAY, not something to stop on.
    // The Concierge writes the words; this says what is true.
    const advisories: { kind: string; detail: string }[] = []

    const px = result.smallest_face_min_dim_px

    if (px != null && px < FACE_RED_PX) {
      advisories.push({
        kind:   'faces_small',
        detail: `smallest face about ${px}px`,
      })
    } else if (px != null && px < FACE_YELLOW_PX) {
      advisories.push({
        kind:   'faces_smallish',
        detail: `smallest face about ${px}px`,
      })
    }

    // Sharpness and lighting come per photo. Reported against the photo
    // they belong to, because "one of your five photos is soft" is
    // actionable and "your photos are soft" is not.
    result.per_photo.forEach(p => {
      if (p.sharpness === 'poor') {
        advisories.push({ kind: 'soft_focus',  detail: `photo ${p.photo_index + 1}` })
      }
      if (p.lighting === 'poor') {
        advisories.push({ kind: 'poor_light',  detail: `photo ${p.photo_index + 1}` })
      }
    })

    // ── The one refusal ──
    //
    // No face found anywhere is not a quality verdict, it is an absence.
    // There is nothing to craft and no render can fix it.
    const nothingToCraft =
      result.total_subjects === 0 ||
      result.per_photo.every(p => p.faces.length === 0)

    console.log(
      `[groups/analyze] ${Date.now() - t0}ms — photos=${result.photo_count} ` +
      `subjects=${result.total_subjects} credits=${creditCost} ` +
      `verdict=${result.verdict} smallest_face=${px ?? '-'} ` +
      `advisories=${advisories.map(a => a.kind).join(',') || '-'}`,
    )

    return NextResponse.json({
      ok: !nothingToCraft,

      /** Authoritative for pricing. The generator re-counts during its own
       *  pre-flight and logs any disagreement; the two use the same vision
       *  pass, so they should not differ. */
      subject_count: subjectCount,
      credit_cost:   creditCost,

      /** green | yellow | red, from the analyzer. Advisory in every case
       *  except nothing_to_craft below. */
      verdict:       result.verdict,

      advisories,

      /** Present so the glass can show a number rather than an adjective.
       *  The thresholds are echoed so they live in one place. */
      smallest_face_min_dim_px: px,
      face_thresholds: { red: FACE_RED_PX, yellow: FACE_YELLOW_PX },

      per_photo:   result.per_photo,
      photo_count: result.photo_count,

      /** The only state the glass should treat as a stop. */
      nothing_to_craft: nothingToCraft,
    })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    console.error(`[groups/analyze] failed in ${Date.now() - t0}ms: ${msg}`)
    return NextResponse.json(
      { error: msg, duration_ms: Date.now() - t0 },
      { status: 500 },
    )
  }
}
