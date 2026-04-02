// lib/structure/debug.ts
// Debug object builder — exposes what the system thinks, what failed, and why.
// Attached to every run-pass response when debug_mode = true.

import { AnchorBlueprint, GeometryObject } from './extractBlueprint'
import { AnchorScorecard }                  from './scoreImage'

export interface DebugFailure {
  type:     string
  issue:    string
  expected: string
  observed: string
  impact:   'identity_failure' | 'major' | 'minor' | 'penalty'
}

export interface DebugAnchorResult {
  id:        string
  type:      string
  identity:  boolean
  preserved: boolean
  confidence: number
  evidence:  string
  impact:    'none' | 'minor' | 'major'
}

export interface DebugObject {
  geometry:        GeometryObject
  validation:      Record<string, boolean | null>
  anchor_results:  DebugAnchorResult[]
  failure_summary: DebugFailure[]
  score_breakdown: {
    structure:  number
    layout:     number
    miniature:  number
    aesthetic:  number
    raw_total:  number
    final_score: number
    identity_pass: boolean
    hard_cap:   string | null
  }
}

export function buildDebugObject(
  blueprint: AnchorBlueprint,
  scorecard: AnchorScorecard
): DebugObject {
  const sv = scorecard.structural_validation

  // Anchor results
  const anchor_results: DebugAnchorResult[] = scorecard.anchor_scores.map(as => ({
    id:         as.anchor_id,
    type:       as.type,
    identity:   as.identity,
    preserved:  as.preserved,
    confidence: typeof (as as any).confidence === 'number' ? (as as any).confidence : (as.preserved ? 0.9 : 0.3),
    evidence:   as.evidence || '',
    impact:     as.identity && !as.preserved ? 'major'
              : !as.preserved && as.importance >= 7 ? 'minor'
              : 'none',
  }))

  // Failure summary
  const failure_summary: DebugFailure[] = []

  if (!sv.main_mass_correct) {
    failure_summary.push({
      type: 'structure', issue: 'main_mass_incorrect',
      expected: blueprint.geometry?.main_mass
        ? `mass extending toward ${blueprint.geometry.main_mass.extends_toward?.join('/')}`
        : 'correct main mass',
      observed: 'main mass position or shape incorrect',
      impact: 'identity_failure',
    })
  }
  if (sv.porch_wrap_direction_correct === false) {
    const expected = blueprint.geometry?.porch?.wrap_direction || 'correct wrap direction'
    failure_summary.push({
      type: 'structure', issue: 'porch_wrap_direction_incorrect',
      expected: `porch wraps toward ${expected}`,
      observed: 'porch wrap direction does not match source',
      impact: 'identity_failure',
    })
  }
  if (sv.porch_type_correct === false) {
    failure_summary.push({
      type: 'structure', issue: 'porch_type_incorrect',
      expected: blueprint.geometry?.porch?.footprint_type || 'correct porch type',
      observed: 'porch footprint type does not match source',
      impact: 'identity_failure',
    })
  }
  if (sv.side_extension_present === false) {
    failure_summary.push({
      type: 'structure', issue: 'side_extension_missing',
      expected: `side extension present`,
      observed: 'secondary volume not visible',
      impact: 'identity_failure',
    })
  }
  if (sv.stairs_invented) {
    failure_summary.push({
      type: 'structure', issue: 'stairs_invented',
      expected: 'no stairs (not visible in source)',
      observed: 'stairs present in output',
      impact: 'penalty',
    })
  }
  if (!sv.roof_orientation_correct) {
    failure_summary.push({
      type: 'structure', issue: 'roof_orientation_incorrect',
      expected: `roof ridge ${blueprint.geometry?.roof?.primary_orientation || 'correct orientation'}`,
      observed: 'roof orientation does not match source',
      impact: 'major',
    })
  }

  return {
    geometry:   blueprint.geometry,
    validation: {
      main_mass_correct:            sv.main_mass_correct,
      porch_type_correct:           sv.porch_type_correct,
      porch_wrap_direction_correct: sv.porch_wrap_direction_correct,
      side_extension_present:       sv.side_extension_present,
      roof_orientation_correct:     sv.roof_orientation_correct,
      stairs_invented:              sv.stairs_invented,
    },
    anchor_results,
    failure_summary,
    score_breakdown: {
      structure:    scorecard.structure_score,
      layout:       scorecard.layout_score,
      miniature:    scorecard.miniature_score,
      aesthetic:    scorecard.aesthetic_score,
      raw_total:    scorecard.raw_total,
      final_score:  scorecard.final_score,
      identity_pass: scorecard.identity_pass,
      hard_cap:     scorecard.hard_cap_reason,
    },
  }
}
