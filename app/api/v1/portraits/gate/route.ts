// app/api/v1/portraits/gate/route.ts
//
// 4b — Gate precheck. Runs Gate 0 (subject classify + Series redirect) and
// Gate 1 (intake quality) the moment a source photo is added to the queue,
// BEFORE the customer presses Craft. Uses the SAME classifySubject +
// scoreIntake + qa_settings thresholds as the generate route, so precheck and
// enforcement agree exactly. The generate-time gates remain the enforcement
// backstop — this route only speaks; it never spends.
//
// Honors the 8b qa_override (internal traffic only) so the QA drawer's sliders
// drive this precheck per-request during calibration.
//
// FAIL-OPEN: any failure returns { status: 'passed' }. A precheck hiccup must
// never hard-block the customer from proceeding — the generate-time gate still
// guards the actual spend.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

import { classifySubject, decideRedirect } from '@/lib/shared/subject-redirect'
import { loadQaSettings } from '@/lib/shared/qa-log'
import { scoreIntake, MIN_LONG_EDGE_PX } from '@/lib/bench/bench-gates'
import { applyQaOverride, qaOverrideAllowed } from '@/lib/shared/qa-override'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()

    const sourceImageB64: string = body.source_image_b64
    if (!sourceImageB64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }
    // additional_images_b64 is accepted but, like the generate-time intake, the
    // precheck scores the PRIMARY source — that is the face the gate is about.

    const sb = supaOrNull()
    const openaiApiKey = process.env.OPENAI_API_KEY || undefined

    // No QA infra configured → don't block. Generate-time gate still guards.
    if (!sb || !openaiApiKey) {
      return NextResponse.json({ status: 'passed', intake: null, note: 'qa_unconfigured' })
    }

    let settings = await loadQaSettings(sb, 'portraits')

    // QA disabled for the series → nothing to precheck.
    if (!settings.qaEnabled) {
      return NextResponse.json({ status: 'passed', intake: null, note: 'qa_disabled' })
    }

    // 8b — per-request strictness override, internal callers only.
    const ovr = applyQaOverride(settings, 'portraits', body, qaOverrideAllowed(req))
    settings = ovr.settings

    // Same resolution signal generate feeds into Gate 1.
    const sourceBuf = Buffer.from(sourceImageB64, 'base64')
    const meta = await sharp(sourceBuf).metadata()
    const resolutionOk = Math.max(meta.width ?? 0, meta.height ?? 0) >= MIN_LONG_EDGE_PX

    // ── Gate 0 — classify + redirect ──────────────────────────────
    const classification = await classifySubject({ sourceImageB64, openaiApiKey })
    const decision = decideRedirect({ classification, currentSeries: 'portraits' })

    if (!decision.match && decision.redirectSeries) {
      console.log(
        `[portraits/gate] redirected→${decision.redirectSeries} in ${Date.now() - t0}ms`,
      )
      return NextResponse.json({
        status: 'redirected',
        redirect: {
          series:    decision.redirectSeries,
          message:   decision.userMessage,
          ctaLabel:  decision.ctaLabel,
          stayLabel: decision.stayLabel,
        },
      })
    }

    // ── Gate 1 — intake quality ───────────────────────────────────
    const intake = await scoreIntake({
      sourceImageB64,
      mode:       'subject',
      threshold:  settings.intakeThreshold,
      openaiApiKey,
      resolutionOk,
    })

    /* Three outcomes now, not two. `intake_rejected` is reserved for the
       six hard faults; an advisory is a usable photograph with a note,
       and the customer is shown a choice rather than a wall. A caller
       that has not been taught 'advisory' reads it as not-rejected,
       which is the safe direction. */
    const status =
      intake.verdict === 'fail'     ? 'intake_rejected' :
      intake.verdict === 'advisory' ? 'advisory' : 'passed'

    console.log(
      `[portraits/gate] ${status} in ${Date.now() - t0}ms ` +
      `intake=${intake.score} src_strict=${settings.sourceStrictness}` +
      (ovr.overridden ? ' (override)' : ''),
    )

    return NextResponse.json({
      status,
      intake: {
        score:   intake.score,
        reasons: intake.reasons,
        verdict: intake.verdict,
        signals: intake.signals,
      },
    })

  } catch (e: any) {
    // Fail-open — never hard-block the customer on a precheck error.
    console.warn(`[portraits/gate] precheck skipped: ${e?.message || 'unknown'}`)
    return NextResponse.json({ status: 'passed', intake: null, note: 'precheck_error' })
  }
}

// ── helpers ──────────────────────────────────────────────────────

function supaOrNull() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
