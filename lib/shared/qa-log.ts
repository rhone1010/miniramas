// lib/shared/qa-log.ts
//
// Production QA layer shared by all six working silos (portraits,
// groups, actionmini, pets, houses, landscapes).
//
// Responsibilities:
//   1. Load per-Series strictness settings (two 1-10 sliders) and
//      resolve them to concrete thresholds via lookup tables.
//   2. Give each image ONE qa_log row, cradle to grave: the route
//      opens the entry with the incoming analysis, the same entry is
//      finished with the outgoing analysis. Settings used are
//      snapshotted onto the row.
//
// What this module deliberately does NOT do: call any models. The
// classify/intake/aesthetic scorers stay where they are (subject-
// redirect.ts beside this file; scoreIntake/scoreAesthetic currently
// in lib/bench/bench-gates.ts — relocation to lib/shared is a noted
// cleanup, not a blocker). This module is settings + persistence only,
// so wiring it into a silo route is additive and can't change render
// behavior by accident.
//
// SLIDER SEMANTICS — two sliders per Series, 1 = least strict,
// 10 = most strict, position 5 = today's calibrated defaults:
//
//   source_strictness → intake threshold + whether the small-face
//   rule is a hard reject or a score penalty
//     pos:        1  2  3  4  5  6  7  8  9  10
//     intake:     3  4  4  5  6  6  7  7  8  9
//     faceHard:   no no no yes yes yes yes yes yes yes
//
//   render_strictness → fidelity / aesthetic / floor together
//     pos:        1  2  3  4  5  6  7  8  9  10
//     fidelity:   6  6  7  7  8  8  8  9  9  10
//     aesthetic:  5  5  6  6  7  7  8  8  9  9
//     floor:      3  3  4  4  5  5  5  6  6  7
//
// Tables are deliberately explicit so a future tuning session edits
// numbers, not formulas.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type QaSeriesId =
  | 'portraits' | 'groups' | 'actionmini' | 'pets' | 'houses' | 'landscapes'

// ─── SLIDER LOOKUP TABLES (index = slider position - 1) ──────────

const INTAKE_LUT     = [3, 4, 4, 5, 6, 6, 7, 7, 8, 9] as const
const FACE_HARD_LUT  = [false, false, false, true, true, true, true, true, true, true] as const
const FIDELITY_LUT   = [6, 6, 7, 7, 8, 8, 8, 9, 9, 10] as const
const AESTHETIC_LUT  = [5, 5, 6, 6, 7, 7, 8, 8, 9, 9] as const
const FLOOR_LUT      = [3, 3, 4, 4, 5, 5, 5, 6, 6, 7] as const

export interface ResolvedQaSettings {
  series:             QaSeriesId
  qaEnabled:          boolean
  sourceStrictness:   number   // 1-10
  renderStrictness:   number   // 1-10
  intakeThreshold:    number
  faceSizeHard:       boolean
  fidelityThreshold:  number
  aestheticThreshold: number
  aestheticFloor:     number
}

export function resolveSliders(input: {
  series: QaSeriesId
  sourceStrictness: number
  renderStrictness: number
  qaEnabled: boolean
}): ResolvedQaSettings {
  const s = clampSlider(input.sourceStrictness)
  const r = clampSlider(input.renderStrictness)
  return {
    series:             input.series,
    qaEnabled:          input.qaEnabled,
    sourceStrictness:   s,
    renderStrictness:   r,
    intakeThreshold:    INTAKE_LUT[s - 1],
    faceSizeHard:       FACE_HARD_LUT[s - 1],
    fidelityThreshold:  FIDELITY_LUT[r - 1],
    aestheticThreshold: AESTHETIC_LUT[r - 1],
    aestheticFloor:     FLOOR_LUT[r - 1],
  }
}

function clampSlider(x: number): number {
  return Math.max(1, Math.min(10, Math.round(Number(x) || 5)))
}

// ─── SETTINGS LOADER ─────────────────────────────────────────────
// Reads qa_settings for the Series on every request (one tiny indexed
// select), so a slider move in the admin applies to the next upload
// with no deploy. Falls back to defaults (5/5, enabled) if the row is
// missing — QA must never be the reason a render fails to run.

export async function loadQaSettings(
  sb: SupabaseClient, series: QaSeriesId,
): Promise<ResolvedQaSettings> {
  try {
    const { data } = await sb.from('qa_settings')
      .select('source_strictness, render_strictness, qa_enabled')
      .eq('series', series).single()
    return resolveSliders({
      series,
      sourceStrictness: data?.source_strictness ?? 5,
      renderStrictness: data?.render_strictness ?? 5,
      qaEnabled:        data?.qa_enabled ?? true,
    })
  } catch {
    return resolveSliders({ series, sourceStrictness: 5, renderStrictness: 5, qaEnabled: true })
  }
}

// ─── LOG ENTRY LIFECYCLE ─────────────────────────────────────────
// One row per image. Open it as soon as the incoming analysis exists;
// finish it when the pipeline resolves. Both calls are fire-safe:
// logging failures are swallowed (console.warn) — QA observability
// must never break a customer render.

export interface QaIncoming {
  series:    QaSeriesId
  settings:  ResolvedQaSettings
  // request context (fill what the route knows)
  sessionId?:  string
  userRef?:    string
  presetId?:   string
  styleId?:    string
  locationId?: string
  scale?:      string
  sourceHash?: string
  // classification (from classifySubject/decideRedirect)
  detectedSubject?:    string
  subjectConfidence?:  number
  subjectDescription?: string
  activityDetected?:   boolean
  seriesMatch?:        boolean
  redirectSeries?:     string | null
  redirectMessage?:    string | null
  // intake (from scoreIntake)
  intakeScore?:   number
  intakeSignals?: unknown
  intakeReasons?: string[]
  intakePassed?:  boolean
}

export interface QaOutgoing {
  status:           'redirected' | 'intake_rejected' | 'passed' | 'failed' | 'errored'
  attempts?:        number
  firstPass?:       boolean
  fidelityScore?:   number | null
  fidelityReason?:  string | null
  aestheticScore?:  number | null
  aestheticReason?: string | null
  outputPassed?:    boolean
  renderRef?:       string | null
  errorNote?:       string | null
  durationMs?:      number
  costCents?:       number
}

export interface QaEntry {
  id: string | null
  finish(out: QaOutgoing): Promise<void>
}

export async function startQaEntry(
  sb: SupabaseClient, inc: QaIncoming,
): Promise<QaEntry> {
  let id: string | null = null
  try {
    const { data, error } = await sb.from('qa_log').insert({
      series:              inc.series,
      status:              'in_progress',
      session_id:          inc.sessionId ?? null,
      user_ref:            inc.userRef ?? null,
      preset_id:           inc.presetId ?? null,
      style_id:            inc.styleId ?? null,
      location_id:         inc.locationId ?? null,
      scale:               inc.scale ?? null,
      source_hash:         inc.sourceHash ?? null,
      settings:            inc.settings,
      detected_subject:    inc.detectedSubject ?? null,
      subject_confidence:  inc.subjectConfidence ?? null,
      subject_description: inc.subjectDescription ?? null,
      activity_detected:   inc.activityDetected ?? null,
      series_match:        inc.seriesMatch ?? null,
      redirect_series:     inc.redirectSeries ?? null,
      redirect_message:    inc.redirectMessage ?? null,
      intake_score:        inc.intakeScore ?? null,
      intake_signals:      inc.intakeSignals ?? null,
      intake_reasons:      inc.intakeReasons ?? null,
      intake_passed:       inc.intakePassed ?? null,
    }).select('id').single()
    if (error) console.warn(`[qa-log] open failed: ${error.message}`)
    id = data?.id ?? null
  } catch (e: unknown) {
    console.warn(`[qa-log] open failed: ${e instanceof Error ? e.message : 'unknown'}`)
  }

  return {
    id,
    async finish(out: QaOutgoing): Promise<void> {
      if (!id) return
      try {
        const { error } = await sb.from('qa_log').update({
          status:           out.status,
          attempts:         out.attempts ?? null,
          first_pass:       out.firstPass ?? null,
          fidelity_score:   out.fidelityScore ?? null,
          fidelity_reason:  out.fidelityReason ?? null,
          aesthetic_score:  out.aestheticScore ?? null,
          aesthetic_reason: out.aestheticReason ?? null,
          output_passed:    out.outputPassed ?? null,
          render_ref:       out.renderRef ?? null,
          error_note:       out.errorNote ?? null,
          duration_ms:      out.durationMs ?? null,
          cost_cents:       out.costCents ?? 0,
          finished_at:      new Date().toISOString(),
        }).eq('id', id)
        if (error) console.warn(`[qa-log] finish failed: ${error.message}`)
      } catch (e: unknown) {
        console.warn(`[qa-log] finish failed: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    },
  }
}
