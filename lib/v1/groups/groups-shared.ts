// lib/v1/groups/groups-shared.ts
//
// Types, limits and scoring for the Groups silo.
//
// ── WHAT THIS FILE NO LONGER CARRIES, 2026-08-10 ───────────────────────
//
// GroupsStyleId, GroupsPresetId, LocationId, Scale, GroupArrangement,
// STYLE_MATERIALS, STYLE_LOCATIONS, STYLE_PIPELINE, PRESET_TIER,
// resolveLocation, defaultMaterialForStyle, defaultAspectForStyle,
// pickDefaultArrangement, DEFAULT_PLAQUE_TEXT, DEFAULT_STYLE, and the
// holistic caricature scoring block.
//
// The style axis is gone — Tribal (the only gpt-image-1 path) is out for
// soft launch, and People Resolving rendered identically to Realistic
// because nothing in the prompt layer ever expressed it. With no styles to
// switch on, the filter tables and their defaults have nothing to do.
//
// Effect ids now live in groups-effects.ts, which is the single source of
// truth for the catalog. This file holds only what the pipeline needs to
// run and score.

import type { GroupsEffectId } from './groups-effects'

// ═══════════════════════════════════════════════════════════════
// SCORING — per-figure likeness, size-tiered
// ═══════════════════════════════════════════════════════════════

export interface PerFigureScore {
  figure_index: number
  score:        number
  reason:       string
}

export interface GroupsAttempt {
  attempt:            number
  prompt_used?:       string
  duration_ms:        number
  per_figure_scores?: PerFigureScore[]
  passed:             boolean
  pass_reason:        string
}

export const SCORE_TOP_TIER     = 9
export const SCORE_RELAXED_TIER = 8
export const MAX_ATTEMPTS       = 2

export interface ScoringRule {
  topTierCount:     number
  relaxedTierCount: number
  totalRequired:    number
}

/**
 * Small groups must be right for everyone. Above five, the back row and the
 * partly-occluded faces are allowed a lower bar than the figures carrying
 * the piece — 70% top tier, the rest relaxed.
 */
export function getScoringRule(N: number): ScoringRule {
  if (N <= 0) return { topTierCount: 0, relaxedTierCount: 0, totalRequired: 0 }
  if (N <= 5) return { topTierCount: N, relaxedTierCount: 0, totalRequired: N }
  const topTier = Math.ceil(N * 0.7)
  return {
    topTierCount:     topTier,
    relaxedTierCount: N - topTier,
    totalRequired:    N,
  }
}

export function evaluateGroupScores(
  scores: PerFigureScore[],
): { passed: boolean; reason: string; rule: ScoringRule } {
  const N = scores.length
  const rule = getScoringRule(N)
  if (N === 0) return { passed: false, reason: 'no figures detected', rule }

  const sorted   = [...scores].sort((a, b) => b.score - a.score)
  const topTier  = sorted.slice(0, rule.topTierCount)
  const restTier = sorted.slice(rule.topTierCount)

  const topPass  = topTier.every(s => s.score >= SCORE_TOP_TIER)
  const restPass = restTier.every(s => s.score >= SCORE_RELAXED_TIER)

  if (topPass && restPass) {
    return {
      passed: true,
      reason: `pass: ${rule.topTierCount} >=${SCORE_TOP_TIER}/10, ${rule.relaxedTierCount} >=${SCORE_RELAXED_TIER}/10`,
      rule,
    }
  }

  const topFails  = topTier.filter(s => s.score < SCORE_TOP_TIER)
  const restFails = restTier.filter(s => s.score < SCORE_RELAXED_TIER)
  const failParts: string[] = []
  if (topFails.length > 0)  failParts.push(`${topFails.length} top-tier below ${SCORE_TOP_TIER}/10`)
  if (restFails.length > 0) failParts.push(`${restFails.length} relaxed-tier below ${SCORE_RELAXED_TIER}/10`)
  return { passed: false, reason: `fail: ${failParts.join('; ')}`, rule }
}

// ═══════════════════════════════════════════════════════════════
// LIMITS
// ═══════════════════════════════════════════════════════════════

/**
 * Images sent to NB2 in one call. NB2's own ceiling is 14 (Rich, 2026-08-10).
 *
 * WAS 4. That silently truncated the multi-photo composites, which take one
 * photograph per person: Family Impressionism composes five, so the fifth
 * reference was dropped in the slice and the render came back with four
 * faces and no error.
 */
export const MAX_SOURCE_IMAGES = 14

export const MIN_SUBJECTS = 2
export const MAX_SUBJECTS = 15
export const TYPICAL_MAX  = 12

// ═══════════════════════════════════════════════════════════════
// AGE GATING — RULE AGREED, NOT BUILT
// ═══════════════════════════════════════════════════════════════
//
// Portraits refuses any minor. Groups cannot use that rule: a family
// portrait with children in it is the product, and refusing it refuses the
// silo. Rich's ruling, 2026-08-10:
//
//   refuse when the set is a lone minor, or all minors
//   allow when an adult is present
//
// This needs PER-FACE age from analyze. The existing `age_group` field
// describes the hero subject only, so a group with an adult in front reads
// `adult` and passes regardless of who else is in the frame — and a photo
// of one child would also need to be caught by the same detection.
//
// PARKED PENDING LEGAL REVIEW, which Rich is initiating. The consent
// question sits with the uploading adult and is not an engine decision.
// Do not build this gate until that comes back.

// ═══════════════════════════════════════════════════════════════
// REQUEST AND RESULT
// ═══════════════════════════════════════════════════════════════
//
// Added back 2026-08-11. The flat-catalog rewrite removed these along with
// the style axis and nothing replaced them, so groups-generator.ts imported
// two types that did not exist and the silo did not compile.
//
// These carry NO style, preset, location, scale or arrangement. An effect
// id and a subject count are the whole request now.

export interface GroupsGenerateRequest {
  /** Every source photograph, base64. One for a group_photo effect; one
   *  per person for a multi_photo composite. */
  source_images_b64: string[]
  effect_id:         GroupsEffectId
  /** From analyze. Drives the framing clause AND the scoring rule, so a
   *  wrong count here is a wrong piece scored against the wrong bar. */
  subject_count:     number
  /** Skips scoring and retries. Internal shoots only — never a customer
   *  path, because an unscored group render is exactly what the gate
   *  exists to catch. */
  skip_scoring?:     boolean
}

/**
 * Why a craft failed, in a shape the Concierge can speak from.
 *
 * NOT a message. The Concierge writes the words; this says what is true.
 * The distinction matters because "one figure was turned away from the
 * camera" and "every figure came back wrong" want different advice — the
 * first is a better photograph, the second is a different effect — and
 * only the engine knows which happened.
 */
export interface GroupsFailure {
  kind:
    | 'some_figures'      // a minority failed; usually a source-photo problem
    | 'most_figures'      // the render is wrong, not the photograph
    | 'face_not_visible'  // caught pre-flight, before a render was paid for
    | 'no_figures'        // the scorer found nobody in the render
    | 'render_failed'     // NB2 never returned an image
  /** Figure indices below the bar on the best attempt. */
  failed_figures: number[]
  /** The scorer's own words for those figures, deduplicated. Describes the
   *  picture, never a person. */
  reasons: string[]
  attempts: number
}

export interface GroupsGenerateResult {
  ok:             boolean
  image_b64:      string | null
  prompt_used:    string
  effect:         GroupsEffectId
  subject_count:  number
  /** Every attempt in order. The last is the one returned. */
  attempts:       GroupsAttempt[]
  /** True when a render passed the gate. False WITH an image present means
   *  the best of four is being offered rather than shipped — see failure. */
  passed:         boolean
  failure:        GroupsFailure | null
  outpainted:     boolean
  outpaint_skip:  string | null
  fatal_error:    string | null
  error_code?:    string
  retryable?:     boolean
  duration_ms:    number
}

// ═══════════════════════════════════════════════════════════════
// PRICE AND ATTEMPTS
// ═══════════════════════════════════════════════════════════════
//
// Rich, 2026-08-11. Groups is banded by subject count because the COST is
// banded by subject count: every figure is another face the gate has to
// pass, and up to four attempts with a vision call per attempt. A
// twelve-person composite was never the same craft as a two-person one.
//
// THE CREDIT GATE DOES NOT KNOW THIS YET. app/api/v1/credits/gate/route.ts
// validates cost_per against a flat CREDITS_PER_IMAGE of 10 and refuses
// anything else, so a Groups craft above the first band is refused today.
// Flagged rather than patched — that route is the money path and belongs
// to CUI.

export function groupsCreditCost(subjectCount: number): number {
  if (subjectCount >= 10) return 40
  if (subjectCount >= 7)  return 25
  if (subjectCount >= 4)  return 15
  return 10
}

/**
 * Attempts before the gate gives up, raised from two.
 *
 * Two attempts on a five-person composite where every figure must reach
 * 9/10 is a gate that mostly fails, and a failed craft that still charged
 * is worse than an expensive one.
 *
 * MAX_ATTEMPTS above is left at 2 and is now unused by Groups. It is not
 * deleted here because nothing in this file can prove what else imports
 * it — grep before removing.
 */
export const MAX_ATTEMPTS_GROUPS = 4

export type { GroupsEffectId }
