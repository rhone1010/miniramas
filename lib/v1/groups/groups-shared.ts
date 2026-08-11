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

export type { GroupsEffectId }
