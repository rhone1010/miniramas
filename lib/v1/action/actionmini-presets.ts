// lib/v1/actionmini-presets.ts
// Single source of truth for all Action Minis presets.
//
// V6 changes vs V5:
//   • window_sill and trophy_shelf removed. They were locations
//     masquerading as materials. Users wanting that look now pick
//     In Environment / Shelf with any material.
//   • Preset lines no longer hint at "log base" or "bronze base" — base
//     architecture is owned by COMPLEMENTARY_BASE in actionmini-blocks.ts
//     (per-preset material × per-location shape). Exception: carved_wood
//     keeps its "log IS the base" line because that's a structural call,
//     not a staging assumption.

import { assemblePrompt } from './actionmini-shared'
import type { KineticMedium } from './actionmini-shared'
import { ActionMiniRefinements, getRefinementBlocks, LocationId, Scale } from './actionmini-blocks'

export type ActionMiniPresetId =
  | 'resin'
  | 'plushy'
  | 'carved_wood'
  | 'wax_bronze'
  | 'painted_ceramic_cracked'
  | 'terracotta_cracked'
  | 'bronze_bronze'
  | 'iron'
  | 'alabaster'

export type PresetTier = 'base' | 'premium' | 'signature'

export interface ActionMiniPresetDef {
  id:          ActionMiniPresetId
  label:       string
  tier:        PresetTier
  presetLine:  string
}

// ── 3D SCULPTURE CLAUSE ──────────────────────────────────────
// Prepended to every preset. Locks output as a photograph of a real
// physical sculpture, not an illustration.
const SCULPTURE_CLAUSE = 'Photograph of a real physical 3D sculpture, three-dimensional and tangible, lit and shadowed as an actual object in space.'

// ── THE 9 PRESETS ────────────────────────────────────────────
export const ACTION_MINI_PRESETS: ActionMiniPresetDef[] = [
  // ── Base ──
  {
    id:    'resin',
    label: 'Resin',
    tier:  'base',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Hand-painted resin miniature with visible brushwork on the surface, slight artistic stylization, hobby-shop collectible quality. Style: painted resin scale model with hand-painted finish — NOT a photographic 1:1 replica, this is a miniature collectible with the soft hand-crafted feel of a painted figurine.`,
  },
  {
    id:    'plushy',
    label: 'Plushy',
    tier:  'base',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: Plushy, three-dimensional handmade fabric toy.`,
  },

  // ── Premium ──
  {
    id:    'carved_wood',
    label: 'Wood',
    tier:  'premium',
    // No separate plinth — the log IS the base. COMPLEMENTARY_BASE block
    // recognizes this preset and emits the log-as-base treatment.
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: carved from wooden log as if emerging through the struggle or action in the scene. The log itself is the base — flat-cut on the bottom, raw bark on the sides, no additional plinth beneath.`,
  },
  {
    id:    'wax_bronze',
    label: 'Wax',
    tier:  'premium',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: wax miniature on a bronze base.`,
  },
  {
    id:    'painted_ceramic_cracked',
    label: 'Ceramic',
    tier:  'premium',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Hand-painted glazed ceramic miniature with visible brushwork on the surface, slight artistic stylization, hobby-collectible quality. Style: painted ceramic figurine with hand-painted finish and visible craquelure crack lines across the glaze — NOT a photographic 1:1 replica, this is a miniature collectible with the soft hand-crafted feel of a painted ceramic piece.`,
  },

  // ── Signature ──
  {
    id:    'terracotta_cracked',
    label: 'Terracotta',
    tier:  'signature',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: terra cotta sculpture with cracks and pieces missing.`,
  },
  {
    id:    'bronze_bronze',
    label: 'Bronze',
    tier:  'signature',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: bronze miniature on a bronze base.`,
  },
  {
    id:    'iron',
    label: 'Iron',
    tier:  'signature',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: hand-forged iron miniature, deep charcoal-black with a gunmetal sheen.`,
  },
  {
    id:    'alabaster',
    label: 'Alabaster',
    tier:  'signature',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: highly detailed alabaster statue.`,
  },
]

// ── HELPERS ──────────────────────────────────────────────────
export function getPresetDef(id: string): ActionMiniPresetDef | undefined {
  return ACTION_MINI_PRESETS.find(p => p.id === id)
}

export function listGridPresets(): ActionMiniPresetDef[] {
  return ACTION_MINI_PRESETS
}

// ── PROMPT BUILDER ───────────────────────────────────────────
export function buildPresetPrompt(input: {
  presetId:        ActionMiniPresetId
  kineticMedium?:  KineticMedium
  locationId?:     LocationId
  scale?:          Scale
  refinements?:    ActionMiniRefinements
  notes?:          string
  refinementTweak?: string
}): string {
  const def = getPresetDef(input.presetId)
  if (!def) throw new Error(`unknown preset: ${input.presetId}`)
  const km    = input.kineticMedium || 'other'
  const loc:  LocationId = input.locationId || 'desk'
  const scale: Scale     = input.scale      || 'close_up'
  const refinementBlocks = getRefinementBlocks(input.presetId, km, loc, scale, input.refinements)
  const parts = [def.presetLine, ...refinementBlocks]

  // Tweak appended last under guard block — highest attention.
  if (input.refinementTweak?.trim()) {
    const { REFINEMENT_GUARD_BLOCK } = require('./actionmini-refine')
    parts.push(REFINEMENT_GUARD_BLOCK)
    parts.push(`ADJUSTMENT: ${input.refinementTweak.trim()}`)
  }

  const fullLine = parts.join('\n\n')
  return assemblePrompt({
    presetLine: fullLine,
    notes:      input.notes,
  })
}

// Re-export refinement types for downstream consumers (route, generator)
export type { ActionMiniRefinements, LocationId, Scale } from './actionmini-blocks'
export { LOCATION_LABELS, SCALE_LABELS } from './actionmini-blocks'
