// lib/v1/action/actionmini-presets.ts
// Single source of truth for all Action Minis presets.
//
// V7 rewrite (single-material hero):
//   • Material set 9 → 13. Removed: resin, wax_bronze, terracotta_cracked,
//     painted_ceramic_cracked. Renamed: bronze_bronze → bronze.
//     Added: pewter, stone, ebony, walnut, chocolate, charcoal_chalk,
//     stained_glass, driftwood_resin.
//   • Each def now carries its own materialColorRule — the per-preset
//     MATERIAL_COLOR lookup in actionmini-blocks.ts is gone.
//   • buildPresetPrompt takes only { presetId, refinementTweak? }.
//     Location, scale, kineticMedium, refinements and notes are gone —
//     one hero look, no scene reconstruction.
//   • Tiers are a default grouping only; they do not affect prompts.

import {
  FIGURE_FIDELITY_BLOCK, ACTION_DYNAMICS_BLOCK, CAMERA_BLOCK,
  PRESENTATION_BLOCK, COLLECTIBLE_ANCHOR_BLOCK, CRAFTSMANSHIP_BLOCK,
} from './actionmini-blocks'

export type ActionMiniPresetId =
  | 'bronze'
  | 'iron'
  | 'pewter'
  | 'alabaster'
  | 'stone'
  | 'ebony'
  | 'walnut'
  | 'carved_wood'
  | 'plushy'
  | 'chocolate'
  | 'charcoal_chalk'
  | 'stained_glass'
  | 'driftwood_resin'

export type PresetTier = 'base' | 'premium' | 'signature'

export interface ActionMiniPresetDef {
  id:                ActionMiniPresetId
  label:             string
  tier:              PresetTier
  presetLine:        string
  materialColorRule: string
}

// ── 3D SCULPTURE CLAUSE ──────────────────────────────────────
// Prepended to every preset. Locks output as a photograph of a real
// physical sculpture, not an illustration.
const SCULPTURE_CLAUSE = 'Photograph of a real physical 3D sculpture, three-dimensional and tangible, lit and shadowed as an actual object in space.'

// ── THE 13 PRESETS ───────────────────────────────────────────
export const ACTION_MINI_PRESETS: ActionMiniPresetDef[] = [
  {
    id: 'bronze', label: 'Bronze', tier: 'base',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: bronze miniature — polished patinated bronze with green-grey verdigris in the recesses.`,
    materialColorRule: `MATERIAL COLOR — BRONZE: The entire figure, all clothing, equipment, the reacting environment, and the base are one single polished patinated bronze — warm bronze tone with polished highlights and green-grey verdigris settling into the recesses. Do not retain any of the source's original colors; every surface is this same bronze.`,
  },
  {
    id: 'iron', label: 'Iron', tier: 'base',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: hand-forged iron miniature, deep charcoal-black with a gunmetal sheen.`,
    materialColorRule: `MATERIAL COLOR — FORGED IRON: The entire figure, clothing, equipment, reacting environment, and base are one single hand-forged iron — deep charcoal-black with a cool gunmetal sheen, hammered and solid. No source colors retained; every surface is this same iron.`,
  },
  {
    id: 'pewter', label: 'Pewter', tier: 'premium',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: cast pewter miniature — soft matte silver-grey metal with a gentle sheen.`,
    materialColorRule: `MATERIAL COLOR — PEWTER: The entire figure, clothing, equipment, reacting environment, and base are one single cast pewter — soft matte silver-grey metal with a gentle low sheen and a subtle darker tone in the recesses. No source colors retained; every surface is this same pewter.`,
  },
  {
    id: 'alabaster', label: 'Alabaster', tier: 'base',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: carved translucent alabaster with warm subsurface glow and faint amber veining.`,
    materialColorRule: `MATERIAL COLOR — ALABASTER: The entire figure, clothing, equipment, reacting environment, and base are one single carved translucent alabaster — warm subsurface scattering, milky stone depth, soft glowing edges, faint amber veining. Hair and clothing are also alabaster, not their source colors; every surface is this same translucent stone.`,
  },
  {
    id: 'stone', label: 'Stone', tier: 'base',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: polished Taj Mahal quartzite — creamy-beige with gold, amber, and charcoal veining.`,
    materialColorRule: `MATERIAL COLOR — QUARTZITE STONE: The entire figure, clothing, equipment, reacting environment, and base are one single polished Taj Mahal quartzite — creamy-beige base tones with warm gold and amber veining, smoky brown ribbons, and occasional charcoal-grey mineral threads. The mineral palette is cream, gold, brown, and charcoal only — avoid any pink, peach, rose, or flesh-toned veining anywhere. Hair and clothing are also quartzite, not their source colors.`,
  },
  {
    id: 'ebony', label: 'Ebony', tier: 'premium',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: carved ebony wood, deep black-brown with fine visible grain.`,
    materialColorRule: `MATERIAL COLOR — EBONY WOOD: The entire figure, clothing, equipment, reacting environment, and base are one single carved ebony wood — deep black-brown with fine visible grain and subtle natural color variation. No source colors retained; every surface is this same ebony.`,
  },
  {
    id: 'walnut', label: 'Walnut', tier: 'premium',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: carved walnut wood — flowing grain from honey-amber through chocolate, soft satin finish.`,
    materialColorRule: `MATERIAL COLOR — WALNUT WOOD: The entire figure, clothing, equipment, reacting environment, and base are one single carved walnut — rich flowing grain shifting from warm honey-amber through chestnut to deep chocolate, occasional figured knots and ribbon grain, finished in soft satin lacquer (semi-gloss, not wet high-gloss). No source colors retained.`,
  },
  {
    id: 'carved_wood', label: 'Carved Wood', tier: 'base',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: carved from a raw wooden log emerging through the action — the log itself is the base, flat-cut bottom, raw bark sides, no separate plinth.`,
    materialColorRule: `MATERIAL COLOR — RAW CARVED LOG: The entire figure is carved from a single raw wooden log as if emerging through the action — warm natural wood tone with visible tool marks and grain. The log itself is the base: flat-cut on the bottom, raw bark on the sides, no separate plinth beneath. No source colors retained.`,
  },
  {
    id: 'plushy', label: 'Plushy', tier: 'base',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: soft handmade plushy figure — three-dimensional fabric toy.`,
    materialColorRule: `MATERIAL COLOR — PLUSHY: The entire figure, clothing, equipment, and base are one soft handmade plush fabric toy — stitched seams, soft stuffed volumes, visible fabric nap. Source colors may carry through as dyed fabric, but the whole piece reads unmistakably as a soft fabric plush, not skin or hard material.`,
  },
  {
    id: 'chocolate', label: 'Chocolate', tier: 'premium',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: sculpted chocolate — rich glossy cocoa-brown with a smooth tempered sheen.`,
    materialColorRule: `MATERIAL COLOR — CHOCOLATE: The entire figure, clothing, equipment, reacting environment, and base are one single sculpted tempered chocolate — rich glossy cocoa-brown with a smooth tempered sheen and a subtle darker tone in the recesses. No source colors retained; every surface is this same chocolate.`,
  },
  {
    id: 'charcoal_chalk', label: 'Charcoal & Chalk', tier: 'signature',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: sculpted from compressed charcoal and white Conté chalk — chisel marks, fractured edges, floating charcoal dust.`,
    materialColorRule: `MATERIAL COLOR — CHARCOAL & CHALK: The entire figure, clothing, equipment, reacting environment, and base are sculpted from compressed charcoal, broken charcoal sticks, and white Conté chalk — deep matte black charcoal with bright white chalk highlights, visible chisel marks, fractured edges, and layered charcoal fragments. Any frozen airborne debris from the action is charcoal dust and chalk powder. True sculptural mass, never a flat drawing.`,
  },
  {
    id: 'stained_glass', label: 'Stained Glass', tier: 'signature',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: leaded cathedral stained glass — glowing translucent jewel-toned panels bound by dark lead came.`,
    materialColorRule: `MATERIAL COLOR — STAINED GLASS: The entire figure, clothing, equipment, reacting environment, and base are one dimensional leaded cathedral stained glass — glowing translucent jewel-toned colored glass panels bound by dark lead came, light passing through the glass. A three-dimensional stained-glass sculpture, never a flat window pane.`,
  },
  {
    id: 'driftwood_resin', label: 'Driftwood & Resin', tier: 'premium',
    presetLine: `highly accurate highly detailed. ${SCULPTURE_CLAUSE} Style: weathered silvery driftwood fused with clear amber resin flowing between the grain.`,
    materialColorRule: `MATERIAL COLOR — DRIFTWOOD & RESIN: The entire figure, clothing, equipment, reacting environment, and base are one material of weathered silvery-grey driftwood fused with pours of clear amber resin — smooth glassy resin flowing between the worn, cracked wood grain. No colors beyond the natural driftwood and amber-resin palette.`,
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
// Single hero look — no mode, no location, no scale.
export function buildPresetPrompt(input: {
  presetId:        ActionMiniPresetId
  refinementTweak?: string
}): { fullLine: string } {
  const def = getPresetDef(input.presetId)
  if (!def) throw new Error(`Unknown Action preset: ${input.presetId}`)

  const parts = [
    def.presetLine,            // SCULPTURE_CLAUSE is already embedded here — do NOT prepend it again
    FIGURE_FIDELITY_BLOCK,
    def.materialColorRule,
    ACTION_DYNAMICS_BLOCK,
    CAMERA_BLOCK,
    PRESENTATION_BLOCK,
    COLLECTIBLE_ANCHOR_BLOCK,
    CRAFTSMANSHIP_BLOCK,
  ]

  if (input.refinementTweak?.trim()) {
    const { REFINEMENT_GUARD_BLOCK } = require('./actionmini-refine')
    parts.push(REFINEMENT_GUARD_BLOCK)
    parts.push(`ADJUSTMENT: ${input.refinementTweak.trim()}`)
  }

  return { fullLine: parts.join('\n\n') }
}
