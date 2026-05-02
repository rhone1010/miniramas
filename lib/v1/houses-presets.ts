// houses-presets.ts
// lib/v1/houses-presets.ts
//
// Registry of all 19 preset definitions (10 materials + 4 seasons + 5 events)
// + the prompt assembler.

import type { Preset, PresetId, EnvironmentId, TimeOfDay } from './houses-shared'
import { resolveEnvironment, resolveTimeOfDay } from './houses-shared'
import {
  // Always-on stack
  COLLECTIBLE_ANCHOR_BLOCK,
  CAMERA_BLOCK,
  COMPOSITION_BLOCK,
  STRUCTURE_FIDELITY_BLOCK,
  ENVIRONMENT_BLOCKS,
  NIGHT_OVERRIDE_BLOCK,
  REFINEMENT_GUARD_BLOCK,

  // Materials (10)
  MATERIAL_BRONZE,            LIGHTING_BRONZE,
  LIGHTING_BRONZE_OUTDOOR_FLARE, LIGHTING_BRONZE_OUTDOOR_RAYS,
  MATERIAL_WAX,               LIGHTING_WAX,
  MATERIAL_ALABASTER,         LIGHTING_ALABASTER,
  MATERIAL_GLASS,             LIGHTING_GLASS,
  MATERIAL_GINGERBREAD,       LIGHTING_GINGERBREAD,
  MATERIAL_WATERCOLOR_WOOD,   LIGHTING_WATERCOLOR_WOOD,
  MATERIAL_CARVED_WOOD,       LIGHTING_CARVED_WOOD,
  MATERIAL_DOLLHOUSE,         LIGHTING_DOLLHOUSE,
  MATERIAL_MUSEUM_QUALITY,    LIGHTING_MUSEUM_QUALITY,
  MATERIAL_SNOW_GLOBE,        LIGHTING_SNOW_GLOBE, LAYER_SNOW_GLOBE,

  // Seasons (4) — share MATERIAL_SUMMER_RESIN as the realistic-mini base
  MATERIAL_SUMMER_RESIN,
  LIGHTING_SPRING,  LAYER_SPRING,
  LIGHTING_SUMMER,  LAYER_SUMMER,
  LIGHTING_FALL,    LAYER_FALL,
  LIGHTING_WINTER,  LAYER_WINTER,

  // Events (5)
  MATERIAL_HAUNTED,    LIGHTING_HAUNTED,    LAYER_HAUNTED,
  MATERIAL_FIRE,       LIGHTING_FIRE,       LAYER_FIRE,
  MATERIAL_EXPLOSION,  LIGHTING_EXPLOSION,  LAYER_EXPLOSION,
  MATERIAL_ALIEN,      LIGHTING_ALIEN,      LAYER_ALIEN,
  MATERIAL_ABANDONED,  LIGHTING_ABANDONED,  LAYER_ABANDONED,
} from './houses-blocks'

// ── SCULPTURE CLAUSE (shared across all presets) ──────────────
const SCULPTURE_CLAUSE =
  'Photograph of a real physical 3D architectural scale model, three-dimensional and tangible, lit and shadowed as an actual object in space.'

// ── REGISTRY ──────────────────────────────────────────────────
// All 19 presets registered. UI lists them grouped by mode.
//
// `forcedEnvironment` — events lock to room_in_house (their room IS the scene).
// `forcedTimeOfDay`   — haunted/fire/alien/snow_globe always night.
//                       Day/Night toggle is hidden for those in the UI.
//
// Tiers (cosmetic, for UI emphasis):
//   signature: most distinctive, hero-treatment renders
//   premium  : strong but not flagship
//   base     : everyday
export const PRESETS: Record<PresetId, Preset> = {

  // ───────────────────────────────────────────────────────
  // MATERIALS (10)
  // ───────────────────────────────────────────────────────
  bronze: {
    id:                    'bronze',
    mode:                  'materials',
    label:                 'Bronze',
    tier:                  'signature',
    sculptureClause:       SCULPTURE_CLAUSE,
    styleClause:           'Solid cast bronze sculpture of the building — monochrome bronze throughout with verdigris patina detail in recesses.',
    materialRule:          MATERIAL_BRONZE,
    lighting:              LIGHTING_BRONZE,
    lightingByEnvironment: {
      in_situ: {
        variants: [
          { id: 'flare', label: 'Flare (no orb)',     block: LIGHTING_BRONZE_OUTDOOR_FLARE },
          { id: 'rays',  label: 'Visible warm rays',  block: LIGHTING_BRONZE_OUTDOOR_RAYS  },
        ],
      },
    },
  },

  wax: {
    id:               'wax',
    mode:             'materials',
    label:            'Wax',
    tier:             'base',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Honey-cream wax sculpture of the building — monochrome wax throughout with subtle subsurface translucency.',
    materialRule:     MATERIAL_WAX,
    lighting:         LIGHTING_WAX,
  },

  alabaster: {
    id:               'alabaster',
    mode:             'materials',
    label:            'Alabaster',
    tier:             'premium',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Veined white alabaster carving of the building — translucent stone, glowing softly from within.',
    materialRule:     MATERIAL_ALABASTER,
    lighting:         LIGHTING_ALABASTER,
  },

  glass: {
    id:               'glass',
    mode:             'materials',
    label:            'Glass',
    tier:             'premium',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Translucent art-glass rendering of the building — uniform tinted glass throughout, refracting light from within.',
    materialRule:     MATERIAL_GLASS,
    lighting:         LIGHTING_GLASS,
  },

  gingerbread: {
    id:               'gingerbread',
    mode:             'materials',
    label:            'Gingerbread',
    tier:             'base',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Edible gingerbread version of the building — baked gingerbread walls, royal-icing trim, candy detailing.',
    materialRule:     MATERIAL_GINGERBREAD,
    lighting:         LIGHTING_GINGERBREAD,
  },

  watercolor_wood: {
    id:               'watercolor_wood',
    mode:             'materials',
    label:            'Watercolor Wood',
    tier:             'base',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Hand-painted wooden scale model with visible grain and watercolor washes.',
    materialRule:     MATERIAL_WATERCOLOR_WOOD,
    lighting:         LIGHTING_WATERCOLOR_WOOD,
  },

  carved_wood: {
    id:               'carved_wood',
    mode:             'materials',
    label:            'Carved Wood',
    tier:             'premium',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Single-block carving of the building from richly figured hardwood — natural finish, hand-carved facets.',
    materialRule:     MATERIAL_CARVED_WOOD,
    lighting:         LIGHTING_CARVED_WOOD,
  },

  dollhouse: {
    id:               'dollhouse',
    mode:             'materials',
    label:            'Dollhouse',
    tier:             'base',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Hobby-shop dollhouse version of the building — painted resin, charming-toy register, never museum.',
    materialRule:     MATERIAL_DOLLHOUSE,
    lighting:         LIGHTING_DOLLHOUSE,
  },

  scaled_architectural: {
    id:               'scaled_architectural',
    mode:             'materials',
    label:            'Museum Quality',
    tier:             'signature',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Museum-quality collectible scale model of the building — apex craft, every micro-detail rendered.',
    materialRule:     MATERIAL_MUSEUM_QUALITY,
    lighting:         LIGHTING_MUSEUM_QUALITY,
  },

  snow_globe: {
    id:                'snow_globe',
    mode:              'materials',
    label:             'Snow Globe',
    tier:              'signature',
    forcedTimeOfDay:   'night',  // night-only by spec
    sculptureClause:   SCULPTURE_CLAUSE,
    styleClause:       'Snow-covered scale model inside a transparent snow globe with frosted-rim glass — wintered night scene.',
    materialRule:      MATERIAL_SNOW_GLOBE,
    lighting:          LIGHTING_SNOW_GLOBE,
    layer:             LAYER_SNOW_GLOBE,
  },

  // ───────────────────────────────────────────────────────
  // SEASONS (4)
  // ───────────────────────────────────────────────────────
  spring: {
    id:               'spring',
    mode:             'seasons',
    label:            'Spring',
    tier:             'base',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Hand-crafted scale model home in fresh spring landscape — realistic miniature materials, source colors carried through.',
    materialRule:     MATERIAL_SUMMER_RESIN,
    lighting:         LIGHTING_SPRING,
    layer:            LAYER_SPRING,
  },

  summer: {
    id:               'summer',
    mode:             'seasons',
    label:            'Summer',
    tier:             'base',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Hand-crafted scale model home in full summer landscape — realistic miniature materials, source colors carried through.',
    materialRule:     MATERIAL_SUMMER_RESIN,
    lighting:         LIGHTING_SUMMER,
    layer:            LAYER_SUMMER,
  },

  fall: {
    id:               'fall',
    mode:             'seasons',
    label:            'Fall',
    tier:             'base',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Hand-crafted scale model home in peak autumn landscape — realistic miniature materials, source colors carried through.',
    materialRule:     MATERIAL_SUMMER_RESIN,
    lighting:         LIGHTING_FALL,
    layer:            LAYER_FALL,
  },

  winter: {
    id:               'winter',
    mode:             'seasons',
    label:            'Winter',
    tier:             'premium',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'Hand-crafted scale model home in winter landscape — realistic miniature materials, snow-dusted, source colors carried through.',
    materialRule:     MATERIAL_SUMMER_RESIN,
    lighting:         LIGHTING_WINTER,
    layer:            LAYER_WINTER,
  },

  // ───────────────────────────────────────────────────────
  // EVENTS (5) — all forcedEnvironment: 'room_in_house'
  // ───────────────────────────────────────────────────────
  haunted: {
    id:                'haunted',
    mode:              'events',
    label:             'Haunted',
    tier:              'signature',
    forcedEnvironment: 'room_in_house',
    forcedTimeOfDay:   'night',
    sculptureClause:   SCULPTURE_CLAUSE,
    styleClause:       'Hand-crafted scale model of a haunted version of the building, sitting in a haunted room of itself.',
    materialRule:      MATERIAL_HAUNTED,
    lighting:          LIGHTING_HAUNTED,
    layer:             LAYER_HAUNTED,
  },

  fire: {
    id:                'fire',
    mode:              'events',
    label:             'Fire',
    tier:              'signature',
    forcedEnvironment: 'room_in_house',
    forcedTimeOfDay:   'night',
    sculptureClause:   SCULPTURE_CLAUSE,
    styleClause:       'Hand-crafted scale model of the building consumed by fire, sitting in a room sharing the disaster.',
    materialRule:      MATERIAL_FIRE,
    lighting:          LIGHTING_FIRE,
    layer:             LAYER_FIRE,
  },

  explosion: {
    id:                'explosion',
    mode:              'events',
    label:             'Explosion',
    tier:              'premium',
    forcedEnvironment: 'room_in_house',
    sculptureClause:   SCULPTURE_CLAUSE,
    styleClause:       'Hand-crafted scale model of the building struck by an explosion, sitting in a room blown open by the same blast.',
    materialRule:      MATERIAL_EXPLOSION,
    lighting:          LIGHTING_EXPLOSION,
    layer:             LAYER_EXPLOSION,
  },

  alien: {
    id:                'alien',
    mode:              'events',
    label:             'Alien',
    tier:              'signature',
    forcedEnvironment: 'room_in_house',
    forcedTimeOfDay:   'night',
    sculptureClause:   SCULPTURE_CLAUSE,
    styleClause:       'Hand-crafted scale model of the building transplanted to an alien world, sitting in an alien research facility.',
    materialRule:      MATERIAL_ALIEN,
    lighting:          LIGHTING_ALIEN,
    layer:             LAYER_ALIEN,
  },

  abandoned: {
    id:                'abandoned',
    mode:              'events',
    label:             'Abandoned',
    tier:              'premium',
    forcedEnvironment: 'room_in_house',
    sculptureClause:   SCULPTURE_CLAUSE,
    styleClause:       'Hand-crafted scale model of the building abandoned for decades, sitting in a forgotten room sharing the decay.',
    materialRule:      MATERIAL_ABANDONED,
    lighting:          LIGHTING_ABANDONED,
    layer:             LAYER_ABANDONED,
  },

}

// ── ACCESSORS ─────────────────────────────────────────────────

export function getPreset(id: PresetId): Preset {
  const p = PRESETS[id]
  if (!p) throw new Error(`Preset not registered: ${id}`)
  return p
}

export function listPresetsByMode(mode: Preset['mode']): Preset[] {
  return Object.values(PRESETS).filter(p => p.mode === mode)
}

// ── NIGHT OVERRIDE GATE ───────────────────────────────────────
// Some presets carry their own night-specific lighting (haunted/fire/
// alien/snow_globe) and would conflict with the universal NIGHT_OVERRIDE_BLOCK.
// These IDs SKIP the override.
const NIGHT_OVERRIDE_SKIP: ReadonlySet<PresetId> = new Set<PresetId>([
  'haunted',     // multi-source moonlight + lampost already in lighting
  'fire',        // fire IS the light source
  'alien',       // alien moons + bioluminescence purpose-built
  'snow_globe',  // self-contained two-lamp + moonlight recipe
])

// ── PROMPT BUILDER ────────────────────────────────────────────
export function buildPresetPrompt(input: {
  preset:             Preset
  environmentId:      EnvironmentId
  timeOfDay:          TimeOfDay
  lightingVariantId?: string
  refinementTweak?:   string
}): string {

  const env       = resolveEnvironment(input.preset, input.environmentId)
  const tod       = resolveTimeOfDay(input.preset, input.timeOfDay)
  const envBlock  = ENVIRONMENT_BLOCKS[env]

  // Resolve the lighting block. Three cases:
  //   - env-specific entry is a string → use it directly
  //   - env-specific entry is a variants set → pick by ID, fall back to first
  //   - no env-specific entry → use the default `lighting` field
  let lightingBlock: string
  const envLighting = input.preset.lightingByEnvironment?.[env]
  if (typeof envLighting === 'string') {
    lightingBlock = envLighting
  } else if (envLighting?.variants?.length) {
    const variant =
      envLighting.variants.find(v => v.id === input.lightingVariantId)
      || envLighting.variants[0]
    lightingBlock = variant.block
  } else {
    lightingBlock = input.preset.lighting
  }

  // The short preset framing line — mirrors action-minis nano-banana format.
  const presetLine =
    `highly accurate highly detailed. ${input.preset.sculptureClause} ${input.preset.styleClause} Style: premium collectible architectural miniature.`

  const blocks: string[] = [
    COLLECTIBLE_ANCHOR_BLOCK,
    CAMERA_BLOCK,
    COMPOSITION_BLOCK,
    STRUCTURE_FIDELITY_BLOCK,
    input.preset.materialRule,
    envBlock,
    lightingBlock,
  ]

  // Night override — added when tod resolves to 'night' AND the preset
  // doesn't carry its own night-specific lighting (skip set above).
  if (tod === 'night' && !NIGHT_OVERRIDE_SKIP.has(input.preset.id)) {
    blocks.push(NIGHT_OVERRIDE_BLOCK)
  }

  if (input.preset.layer) blocks.push(input.preset.layer)
  blocks.push(presetLine)

  let prompt = blocks.join('\n\n')

  if (input.refinementTweak?.trim()) {
    prompt += `\n\n${REFINEMENT_GUARD_BLOCK}\n\nADJUSTMENT: ${input.refinementTweak.trim()}`
  }

  return prompt
}
