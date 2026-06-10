// lib/v1/groups/groups-presets.ts
//
// Thin adapter over the minimal prompt builder. Historically this file
// orchestrated the 700+ line groups-blocks machine; that machine fought
// NB2's native understanding rather than helping it, and has been retired.
//
// What remains:
//   • `buildPresetPrompt` — back-compat alias for `buildGroupsPrompt` so
//     groups-generator.ts callers don't have to change.
//   • `pickDefaultArrangement` — kept for request-validator compatibility
//     even though the value is no longer fed into the prompt.

import { buildGroupsPrompt } from './groups-prompt'
import type {
  GroupsPresetId,
  LocationId,
  Scale,
  GroupArrangement,
} from './groups-shared'

/**
 * Build the prompt for a Groups render.
 *
 * All fields except `presetId`, `locationId`, `scale` are accepted for
 * API stability but ignored — NB2 figures out subject count, per-figure
 * likeness, arrangement, base shape, and surrounding context from the
 * source photograph and the noun phrases the minimal builder produces.
 */
export function buildPresetPrompt(input: {
  presetId:           GroupsPresetId
  locationId:         LocationId
  scale:              Scale
  // Accepted for back-compat, all ignored:
  subjectCount?:      number
  subjects?:          unknown
  refinements?:       unknown
  notes?:             string
  refinementTweak?:   string
  hasStyleReference?: boolean
  arrangement?:       GroupArrangement
  styleId?:           string
}): string {
  return buildGroupsPrompt({
    presetId:   input.presetId,
    locationId: input.locationId,
    scale:      input.scale,
  })
}

/**
 * Default arrangement is still surfaced by some request validators but is
 * no longer used by the prompt builder. Kept here for API compatibility.
 */
export function pickDefaultArrangement(N: number): GroupArrangement {
  if (N <= 2) return 'cluster'
  if (N <= 4) return 'triangle'
  if (N <= 7) return 'semicircle'
  return 'tiered'
}
