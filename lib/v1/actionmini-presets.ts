// lib/v1/actionmini-presets.ts
// Single source of truth for all Action Minis presets.
// Each preset is a single short prompt line in the locked format:
//   "highly accurate highly detailed. Photograph of a real physical 3D sculpture. {action_clause}. Style: {style_clause}"
//
// The 3D sculpture clause locks output as a photographed physical object —
// not a painting, illustration, or 2D render. Card preset is the only exception
// since it IS supposed to be a 2D illustrated trading card.

import { assemblePrompt } from './actionmini-shared'
import type { KineticMedium } from './actionmini-shared'
import { ActionMiniRefinements, getRefinementBlocks, LocationId } from './actionmini-blocks'

export type ActionMiniPresetId =
  | 'resin'
  | 'plushy'
  | 'carved_wood'
  | 'wax_bronze'
  | 'painted_ceramic_cracked'
  | 'terracotta_cracked'
  | 'bronze_bronze'
  | 'mixed_metals'
  | 'alabaster'
  | 'window_sill'
  | 'trophy_shelf'

export type PresetTier = 'base' | 'premium' | 'signature'

export interface ActionMiniPresetDef {
  id:          ActionMiniPresetId
  label:       string
  tier:        PresetTier
  presetLine:  string
}

// ── 3D SCULPTURE CLAUSE ──────────────────────────────────────
// Prepended to every non-card preset. Locks output as a photograph of a real
// physical sculpture, not an illustration.
const SCULPTURE_CLAUSE = 'Photograph of a real physical 3D sculpture, three-dimensional and tangible, lit and shadowed as an actual object in space.'

// ── THE 12 PRESETS ───────────────────────────────────────────
export const ACTION_MINI_PRESETS: ActionMiniPresetDef[] = [
  // ── Base / accessible ──
  {
    id:    'resin',
    label: 'Resin',
    tier:  'base',
    // Reads as a hand-painted miniature, not a photoreal replica.
    // The word "realistic" was producing photographic specularity and skin/leather sheen
    // that broke the miniature illusion — replaced with explicit hobby-collectible language.
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Hand-painted resin miniature with visible brushwork on the surface, slight artistic stylization, hobby-shop collectible quality. Style: painted resin scale model with hand-painted finish — NOT a photographic 1:1 replica, this is a miniature collectible with the soft hand-crafted feel of a painted figurine.`,
  },
  {
    id:    'plushy',
    label: 'Plushy',
    tier:  'base',
    // Plushies are 3D objects — sculpture clause still applies (a plush is a soft sculpture).
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: Plushy, three-dimensional handmade fabric toy.`,
  },

  // ── Premium ──
  {
    id:    'carved_wood',
    label: 'Wood',
    tier:  'premium',
    // No separate plinth — the log IS the base. Figures emerge from the cut surface.
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
    // Same diagnosis as resin: "highly detailed" + no miniature framing produced photoreal output.
    // Push toward hand-painted ceramic figurine quality with visible brushwork and slight stylization.
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
    id:    'mixed_metals',
    label: 'Metals',
    tier:  'signature',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: Mixed metals: copper, brass, bronze, pewter, titanium.`,
  },
  {
    id:    'alabaster',
    label: 'Alabaster',
    tier:  'signature',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: highly detailed alabaster statue.`,
  },

  // ── Staging-led presets ──
  {
    id:    'window_sill',
    label: 'Window Sill',
    tier:  'premium',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: luminous alabaster statue lit by direct sunlight on a wooden window sill.`,
  },
  {
    id:    'trophy_shelf',
    label: 'Trophy Shelf',
    tier:  'premium',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Kinetic energy action shot with environmental effects. Style: realistic painted resin scale model on a child's trophy shelf among ribbons and a worn ball.`,
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
// Single entry point — takes a preset id + optional refinements + optional
// notes + optional refinement tweak, returns the full prompt string ready
// for nano banana.
//
// Refinement tweak goes LAST in the prompt — highest attention weight — so
// the user's correction overrides whatever produced the wrong result the
// first time. The REFINEMENT_GUARD_BLOCK precedes the tweak text to scope
// what the user can change (pose/expression/equipment only).
export function buildPresetPrompt(input: {
  presetId:        ActionMiniPresetId
  kineticMedium?:  KineticMedium
  locationId?:     LocationId          // user-picked global staging; defaults to on_a_desk
  refinements?:    ActionMiniRefinements
  notes?:          string
  refinementTweak?: string
}): string {
  const def = getPresetDef(input.presetId)
  if (!def) throw new Error(`unknown preset: ${input.presetId}`)
  const km = input.kineticMedium || 'other'
  const loc: LocationId = input.locationId || 'on_a_desk'
  const refinementBlocks = getRefinementBlocks(input.presetId, km, loc, input.refinements)
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
export type { ActionMiniRefinements, LocationId } from './actionmini-blocks'
export { LOCATION_LABELS } from './actionmini-blocks'
