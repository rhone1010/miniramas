// lib/v1/portraits/portraits-presets.ts
//
// Thin adapter over the minimal prompt builder, mirroring groups-presets.ts.
// Exists so callers can import a buildPresetPrompt symbol if they were
// patterned after Groups before the minimal-prompt migration. Internally
// delegates to buildPortraitsPrompt.

import { buildPortraitsPrompt } from './portraits-prompt'
import type {
  PortraitsPresetId,
  LocationId,
  Scale,
} from './portraits-shared'

/**
 * Build the prompt for a Portraits render.
 *
 * Fields other than presetId / locationId / scale are accepted for API
 * stability but ignored — NB2 figures out subject framing, base shape, and
 * surrounding context from the minimal builder.
 */
export function buildPresetPrompt(input: {
  presetId:           PortraitsPresetId
  locationId:         LocationId
  scale:              Scale
  // Accepted for back-compat, all ignored:
  refinements?:       unknown
  notes?:             string
  refinementTweak?:   string
  hasStyleReference?: boolean
  styleId?:           string
  plaqueText?:        string | null
}): string {
  return buildPortraitsPrompt({
    presetId:   input.presetId,
    locationId: input.locationId,
    scale:      input.scale,
    plaqueText: input.plaqueText,
  })
}
