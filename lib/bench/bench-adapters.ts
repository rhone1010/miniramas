// lib/bench/bench-adapters.ts
//
// Series adapter registry. Each adapter wraps an existing silo
// generator and normalizes its result to AdapterResult. The bench
// never reimplements pipeline logic — if a silo's behavior changes,
// the bench tests the new behavior automatically.
//
// v1.2 — Portraits adapter verified against portraits-shared.ts:
//   * scores live on attempts[], not the result top level
//   * realistic/resolving → last attempt's per_figure_scores[0]
//   * tribal styles       → last attempt's caricature_score.overall_score
//   * first_pass = attempts[0].passed (a lone failed attempt is NOT
//     a first-pass success)
//   * ok:false / image_b64:null throws → item lands at 'errored'
//
// NOTE on thresholds: the silo retries internally at its own bar
// (Portraits: SINGLE_FACE_THRESHOLD = 8). The bench's fidelityThreshold
// is applied to the SURFACED score at Gate 2. Set fidelityThreshold: 8
// in Portraits run configs so the two gates agree.

import {
  COST_CENTS,
  type SeriesAdapter, type SeriesId, type AdapterResult,
} from './bench-shared'

import { generatePortraitsRender } from '../v1/portraits/portraits-generator'
import type {
  PortraitsGenerateRequest, PortraitsStyleId, PortraitsPresetId,
  PortraitsAttempt,
} from '../v1/portraits/portraits-shared'

// ─── PORTRAITS ───────────────────────────────────────────────────

const portraitsAdapter: SeriesAdapter = {
  series: 'portraits',
  intakeMode: 'subject',

  async generate(input): Promise<AdapterResult> {
    const t0 = Date.now()

    const request: PortraitsGenerateRequest = {
      source_image_b64: input.sourceImageB64,
      style_id:         (input.styleId ?? 'realistic') as PortraitsStyleId,
      preset_id:        input.presetId as PortraitsPresetId,
      location_id:      input.locationId as PortraitsGenerateRequest['location_id'],
      scale:            input.scale as PortraitsGenerateRequest['scale'],
    }

    const result = await generatePortraitsRender({
      request,
      replicateApiToken: input.keys.replicateApiToken,
      openaiApiKey:      input.keys.openaiApiKey,
      stabilityApiKey:   input.keys.stabilityApiKey,
    })

    // Hard failure → throw; the runner marks the item 'errored' with
    // the message. A null image must never flow into Gate 2.
    if (!result.ok || !result.image_b64) {
      throw new Error(result.fatal_error || 'portraits generator returned no image')
    }

    const attempts: PortraitsAttempt[] = result.attempts ?? []
    const attemptCount = attempts.length || 1
    const last = attempts[attempts.length - 1]

    // Score lives on the LAST attempt. Realistic/Resolving styles carry
    // per_figure_scores (length 1); tribal styles carry caricature_score.
    let fidelityScore:  number | null = null
    let fidelityReason: string | null = null
    if (last?.per_figure_scores?.[0]) {
      fidelityScore  = Number(last.per_figure_scores[0].score)
      fidelityReason = String(last.per_figure_scores[0].reason ?? '')
    } else if (last?.caricature_score) {
      fidelityScore  = Number(last.caricature_score.overall_score)
      fidelityReason = String(last.caricature_score.reason ?? '')
    }
    if (!fidelityReason && result.final_reason) fidelityReason = result.final_reason

    // First-pass = the FIRST attempt passed the silo's own gate.
    const firstPass = attempts[0]?.passed === true

    // Cost: NB2 per attempt + detection + per-attempt scoring, plus
    // optional stages the result says actually ran.
    const costCents =
      attemptCount * COST_CENTS.nb2_generation +
      COST_CENTS.gpt4o_mini_score +                    // detection
      attemptCount * COST_CENTS.gpt4o_mini_score +     // fidelity per attempt
      (result.refined  ? COST_CENTS.gpt_image_1        : 0) +
      (result.expanded ? COST_CENTS.stability_outpaint : 0) +
      (result.swapped  ? COST_CENTS.face_swap          : 0)

    return {
      imageB64:       result.image_b64,
      fidelityScore,
      fidelityReason,
      attempts:       attemptCount,
      firstPass,
      attemptLog:     attempts,
      costCents,
      durationMs:     Date.now() - t0,
    }
  },
}

// ─── REGISTRY ────────────────────────────────────────────────────
// Wire remaining Series one at a time, validating each against a
// 10-item smoke run before committing it to large batches. Pattern
// is identical: map item fields → silo request, normalize result
// FROM THE LAST ATTEMPT, estimate cost from the silo's stage list:
//
//   groups      nb2 ×attempts + detection + per-figure scoring + face swap + outpaint(scale-dependent)
//   actionmini  nb2 ×attempts + detection + outpaint(close_up) + face swap + scoring
//   houses      nb2 + outpaint (always — environment-IS-the-piece)
//   landscapes  nb2 + outpaint (always)
//   pets        per its pipeline config
//   forfun      per its pipeline config
//   artist      gpt-image-1 styles where applicable
//
// Critical invariant when wiring houses/landscapes: outpaint is a
// locked dependency for place Series. An adapter must never expose a
// toggle that lets a bench run skip it — that would test a pipeline
// that doesn't exist in production.

export const ADAPTERS: Partial<Record<SeriesId, SeriesAdapter>> = {
  portraits: portraitsAdapter,
}
