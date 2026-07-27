// lib/v1/groups/groups-shared.ts
//
// Foundational types for the Groups silo. Style-first architecture:
// the user picks a STYLE (Realistic / People Resolving / Tribal Wall Masks /
// Tribal Statue), and the style determines which materials are available
// and which locations apply. Selecting a different style resets the
// material picker.
//
// Pipeline divergence per style:
//   • Realistic + People Resolving — face swap on, per-figure likeness
//     scoring with size-tiered 9+/10 rule.
//   • Tribal Wall Masks + Tribal Statue — face swap OFF, holistic
//     caricature scoring (one score per render, threshold 6+/10).

// ═══════════════════════════════════════════════════════════════
// STYLES — primary axis. Picked first; resets material on change.
// ═══════════════════════════════════════════════════════════════

export type GroupsStyleId =
  | 'realistic'
  | 'people_resolving'
  | 'tribal_wall_masks'
  | 'tribal_statue'

export const STYLE_LABELS: Record<GroupsStyleId, string> = {
  realistic:         'Realistic',
  people_resolving:  'People Resolving',
  tribal_wall_masks: 'Tribal Wall Masks',
  tribal_statue:     'Tribal Statue',
}

export const STYLE_DESCRIPTIONS: Record<GroupsStyleId, string> = {
  realistic:
    'Faces and figures rendered in lifelike detail in the chosen material. The material brings its own character — intact figures on a sculpted base, or transformation across the lower body, depending on material.',
  people_resolving:
    'Subjects emerge gradually from a smooth flowing organic mass — fully resolved at the face and shoulders, abstracting downward into a sculptural base.',
  tribal_wall_masks:
    'Carved face masks mounted as wall art. Likeness is interpreted as caricature — emotional essence over photographic accuracy.',
  tribal_statue:
    'Free-standing carved sculpture of interlocking abstracted faces in mixed wood species. Tribal-modernist gallery aesthetic.',
}

export const STYLE_ORDER: GroupsStyleId[] = [
  'realistic',
  'people_resolving',
  'tribal_wall_masks',
  'tribal_statue',
]

// ═══════════════════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════════════════

export type GroupsPresetId =
  | 'resin'
  | 'plushy'
  | 'bronze'
  | 'iron'
  | 'alabaster'
  | 'wood'
  | 'marble'
  // ── Bucket A: ported from Portraits (2026-07-11) ──
  | 'ebony'
  | 'walnut'
  | 'stone'
  | 'reclaimed_bronze'
  | 'blown_glass'
  | 'amber'
  | 'nebula_resin'
  | 'fantasy_crystal'

export const PRESET_LABELS: Record<GroupsPresetId, string> = {
  resin:        'Resin',
  plushy:       'Plushy',
  bronze:       'Bronze',
  iron:         'Iron',
  alabaster:    'Alabaster',
  wood:         'Wood',
  marble:       'Marble',
  ebony:            'Ebony',
  walnut:           'Walnut',
  stone:            'Stone',
  reclaimed_bronze: 'Reclaimed Bronze',
  blown_glass:      'Blown Glass',
  amber:            'Amber',
  nebula_resin:     'Nebula Resin',
  fantasy_crystal:  'Enchanted Crystal',
}

export type PresetTier = 'base' | 'premium' | 'signature'

export const PRESET_TIER: Record<GroupsPresetId, PresetTier> = {
  resin:        'base',
  plushy:       'base',
  bronze:       'signature',
  alabaster:    'signature',
  iron:         'signature',
  wood:         'premium',
  marble:       'signature',
  ebony:            'premium',
  walnut:           'premium',
  stone:            'signature',
  reclaimed_bronze: 'signature',
  blown_glass:      'signature',
  amber:            'signature',
  nebula_resin:     'signature',
  fantasy_crystal:  'signature',
}

// ── STYLE → MATERIALS ─────────────────────────────────────────
export const STYLE_MATERIALS: Record<GroupsStyleId, GroupsPresetId[]> = {
  realistic: [
    'resin', 'plushy',
    'bronze', 'iron', 'alabaster', 'wood',
    // Bucket A — ported from Portraits
    'ebony', 'walnut', 'stone',
    'reclaimed_bronze', 'blown_glass', 'amber',
    'nebula_resin', 'fantasy_crystal',
  ],
  people_resolving: [
    'wood', 'bronze', 'alabaster', 'ebony', 'walnut',
  ],
  tribal_wall_masks: [
    'wood', 'marble',
  ],
  tribal_statue: [
    'wood',
  ],
}

// ═══════════════════════════════════════════════════════════════
// ASPECT RATIOS — canonical 8-value set (2026-07-11), shared with
// Houses/Landscapes. Requests still carry aspect_ratio as a loose string
// for back-compat; the route validates against this set. Dropped from the
// full NB2 list: 2:3 and ultrawide 21:9.
// ═══════════════════════════════════════════════════════════════

export type AspectRatio =
  | '1:1' | '3:2' | '4:3' | '3:4' | '4:5' | '5:4' | '9:16' | '16:9'

export const GROUPS_ASPECT_RATIOS: AspectRatio[] = [
  '1:1', '3:2', '4:3', '3:4', '4:5', '5:4', '9:16', '16:9',
]

export function isValidAspectRatio(ar: string): ar is AspectRatio {
  return (GROUPS_ASPECT_RATIOS as string[]).includes(ar)
}

// ═══════════════════════════════════════════════════════════════
// EXPERIMENTAL EFFECTS — custom-scene addon (2026-07-11)
// Own-scene effects ported/adapted from Portraits + Houses. They bypass
// the material / location / base-plaque builder and ship a full custom
// prompt (see groups-experimental.ts). Routed by request.experimental_effect;
// when set, preset_id / location_id are ignored. NB2-native; rides the
// realistic (per-figure-likeness) pipeline.
// ═══════════════════════════════════════════════════════════════

export type GroupsExperimentalEffectId =
  | 'ukiyo_e' | 'art_nouveau' | 'cubism' | 'daguerreotype' | 'film_noir'
  | 'impressionist' | 'charcoal_chalk' | 'pencil_sketch'
  | 'armor' | 'elizabethan' | 'victorian'
  | 'magic_energy'

export const GROUPS_EXPERIMENTAL_LABELS: Record<GroupsExperimentalEffectId, string> = {
  ukiyo_e:        'Ukiyo-e',
  art_nouveau:    'Art Nouveau',
  cubism:         'Cubism',
  daguerreotype:  'Daguerreotype',
  film_noir:      'Film Noir',
  impressionist:  'Impressionist',
  charcoal_chalk: 'Charcoal & Chalk',
  pencil_sketch:  'Pencil Sketch',
  armor:          'Armor',
  elizabethan:    'Elizabethan Portrait',
  victorian:      'Victorian Portrait',
  magic_energy:   'Magic Energy',
}

// ═══════════════════════════════════════════════════════════════
// LOCATIONS
// ═══════════════════════════════════════════════════════════════

export type LocationId =
  | 'mantel'
  | 'tea_house'
  | 'pedestal'
  | 'wall_mount'
  | 'plushy_shelf'

export const LOCATION_LABELS: Record<LocationId, string> = {
  mantel:        'Mantel',
  tea_house:     'Tea House',
  pedestal:      'Pedestal',
  wall_mount:    'Wall Mount',
  plushy_shelf:  'Plushy Shelf',
}

export const LOCATION_ORDER: LocationId[] = [
  'mantel', 'tea_house', 'pedestal', 'wall_mount', 'plushy_shelf',
]

export const STYLE_LOCATIONS: Record<GroupsStyleId, LocationId[]> = {
  realistic:         ['mantel', 'tea_house', 'pedestal'],
  people_resolving:  ['mantel', 'tea_house', 'pedestal'],
  tribal_wall_masks: ['wall_mount'],
  tribal_statue:     ['pedestal'],
}

/**
 * Resolve the active location given style + material + user pick.
 * - material === 'plushy' forces 'plushy_shelf'
 * - otherwise uses user pick if valid for the style; falls back to first allowed.
 */
export function resolveLocation(
  style:     GroupsStyleId,
  material:  GroupsPresetId,
  userPick?: LocationId,
): LocationId {
  if (material === 'plushy') return 'plushy_shelf'
  const allowed = STYLE_LOCATIONS[style] || []
  if (userPick && allowed.includes(userPick)) return userPick
  return allowed[0] || 'pedestal'
}

// ═══════════════════════════════════════════════════════════════
// LIGHTING
// ═══════════════════════════════════════════════════════════════

export type LightingMode = 'gallery' | 'collectible'

export const LIGHTING_MODE_BY_LOCATION: Record<LocationId, LightingMode> = {
  mantel:        'collectible',
  tea_house:     'gallery',
  pedestal:      'collectible',
  wall_mount:    'gallery',
  plushy_shelf:  'collectible',
}

// ═══════════════════════════════════════════════════════════════
// SCALE / COMPOSITION
// ═══════════════════════════════════════════════════════════════

export type Scale = 'close_up' | 'fill'

export const SCALE_LABELS: Record<Scale, string> = {
  close_up: 'With Margin',
  fill:     'Filled',
}

export type GroupArrangement =
  | 'cluster' | 'triangle' | 'semicircle' | 'line' | 'tiered'

export type HeightClass = 'adult' | 'teen' | 'child' | 'infant'

export interface PerSubject {
  position?:     string
  height_class?: HeightClass
  notes?:        string
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE CONFIG — per-style branching
// ═══════════════════════════════════════════════════════════════

export type ScoringMode = 'per_figure_likeness' | 'holistic_caricature'

export type GeneratorType = 'nb2' | 'gpt-image-1'

export interface StylePipelineConfig {
  faceSwapEnabled:  boolean
  scoringMode:      ScoringMode
  scoringThreshold: number
  passTwoEnabled:   boolean
  generator:        GeneratorType
}

export const STYLE_PIPELINE: Record<GroupsStyleId, StylePipelineConfig> = {
  realistic: {
    // 2026-05 — faceSwapEnabled flipped to false and passTwoEnabled flipped
    // to false. Both were carry-overs from the gpt-image-1 era where the
    // generator produced generic faces (needed faceswap) and underbaked
    // renders (needed gpt-image-1 refine pass). NB2 produces recognizable
    // faces and finished-looking renders natively, so both stages are dead
    // weight: faceswap adds Replicate latency + intermittent transient
    // failures, Pass 2 adds ~45s and runs its own elaborate 3000+ char
    // prompt that wasn't migrated to the minimal builder. Scoring stays on
    // and now governs the QA gate.
    faceSwapEnabled:  false,
    scoringMode:      'per_figure_likeness',
    scoringThreshold: 9,
    passTwoEnabled:   false,
    generator:        'nb2',
  },
  people_resolving: {
    faceSwapEnabled:  false,
    scoringMode:      'per_figure_likeness',
    scoringThreshold: 9,
    passTwoEnabled:   false,
    generator:        'nb2',
  },
  tribal_wall_masks: {
    faceSwapEnabled:  false,
    scoringMode:      'holistic_caricature',
    scoringThreshold: 6,
    passTwoEnabled:   false,
    generator:        'gpt-image-1',
  },
  tribal_statue: {
    faceSwapEnabled:  false,
    scoringMode:      'holistic_caricature',
    scoringThreshold: 6,
    passTwoEnabled:   false,
    generator:        'gpt-image-1',
  },
}

// ═══════════════════════════════════════════════════════════════
// STYLE REFERENCE ASSETS — curated visual anchors per style.
// These are auto-injected into the model's image_input alongside
// the user's source photo(s). The prompt directive (see
// STYLE_REFERENCE_DIRECTIVE in groups-blocks.ts) disambiguates
// "subjects from source, aesthetic from reference".
//
// Paths are resolved server-side via fs.readFile relative to the
// project root. Adjust paths here if asset locations change.
// ═══════════════════════════════════════════════════════════════

// Style references can vary by subject count. Solo subjects often need a
// different aesthetic than multi-subject groups (e.g. Resolving: a single
// figure shows the cavity/void emergence around one body, whereas a group
// shows multiple figures sharing a merged base). When `solo` is omitted, the
// `default` paths are used for any subject count.
export interface StyleReferenceEntry {
  default: string[]      // multi-subject (and fallback)
  solo?:   string[]      // single subject only (overrides default when count === 1)
}

// 2026-05 — all style reference asset paths emptied. The curated reference
// files (public/style_refs/*.jpg) never existed in this deployment. The
// loader in groups-generator.ts has been removed; this config is preserved
// only so any consumer that imports the symbols (none left in production)
// gets back empty arrays cleanly rather than ENOENT crashes.
export const STYLE_REFERENCE_ASSETS: Record<GroupsStyleId, StyleReferenceEntry> = {
  realistic:        { default: [] },
  people_resolving: { default: [], solo: [] },
  tribal_wall_masks:{ default: [] },
  tribal_statue:    { default: [] },
}

/**
 * Resolve the correct style-reference asset paths for a given style and
 * subject count. Returns the `solo` variant when count === 1 and one is
 * defined; otherwise returns `default`.
 */
export function resolveStyleReferencePaths(
  styleId:      GroupsStyleId,
  subjectCount: number,
): string[] {
  const entry = STYLE_REFERENCE_ASSETS[styleId]
  if (!entry) return []
  if (subjectCount === 1 && entry.solo && entry.solo.length > 0) return entry.solo
  return entry.default
}

// ═══════════════════════════════════════════════════════════════
// REQUEST / RESULT TYPES
// ═══════════════════════════════════════════════════════════════

export interface GroupsRefinements {
  craftDetail?: boolean
  sceneDetail?: boolean
}

export interface GroupsGenerateRequest {
  source_image_b64:        string
  additional_images_b64?:  string[]
  style_reference_b64?:    string

  style_id:                GroupsStyleId
  preset_id:               GroupsPresetId
  location_id?:            LocationId
  scale?:                  Scale
  aspect_ratio?:           string
  arrangement?:            GroupArrangement
  subjects?:               PerSubject[]
  subject_count?:          number
  refinements?:            GroupsRefinements
  notes?:                  string
  refinement_tweak?:       string
  refine?:                 boolean
  is_preview?:             boolean

  // Plaque text shown on the sculpture's base. The minimal prompt builder
  // (groups-prompt.ts) consumes this:
  //   undefined / empty → DEFAULT_PLAQUE_TEXT ("Liten & Co · 2025")
  //   string            → inscribed verbatim
  //   null              → no plaque ("clean unmarked base")
  // Without this, NB2 confabulates plausible-but-fictional surnames.
  plaque_text?:            string | null

  // Experimental custom-scene effect. When set, the generator ignores
  // preset_id / location_id and builds a full custom prompt via
  // groups-experimental.ts (buildGroupsExperimentalPrompt). NB2-native.
  experimental_effect?:    GroupsExperimentalEffectId | null

  // Advanced lighting bundle — frontend "Advanced lighting" popover.
  // Any non-default flag appends short clauses to the minimal prompt.
  // Backend ignores keys it doesn't recognize, so adding new flags is
  // safe without coordinating a frontend/backend deploy.
  advanced?:               GroupsAdvanced
}

// ─── ADVANCED LIGHTING BUNDLE ────────────────────────────────────
// Mirrors state.advanced on the frontend. Each flag is a string union
// rather than a boolean so brightness can have multiple steps.
export interface GroupsAdvanced {
  beam?:       'off' | 'on'
  threePoint?: 'off' | 'on'
  brightness?: '0' | '5' | '10' | '15'
  enhanced?:   'off' | 'on'
}

// ─── DEFAULT PLAQUE TEXT ─────────────────────────────────────────
// Used by buildGroupsPrompt when the user doesn't specify a plaque
// inscription. The frontend's "No plaque" checkbox sends null to
// suppress entirely; a user-typed inscription sends the string verbatim;
// undefined/empty falls back to this default.
export const DEFAULT_PLAQUE_TEXT = 'Liten & Co · 2025'

export interface PerFigureScore {
  figure_index: number
  score:        number
  reason:       string
}

export interface HolisticCaricatureScore {
  overall_score:     number
  emotional_capture: number
  craft_quality:     number
  composition:       number
  reason:            string
}

export interface GroupsAttempt {
  attempt:                  number
  prompt_used?:             string
  duration_ms:              number
  per_figure_scores?:       PerFigureScore[]
  caricature_score?:        HolisticCaricatureScore
  passed:                   boolean
  pass_reason:              string
}

export interface GroupsGenerateResult {
  ok:                    boolean
  image_b64:             string | null
  prompt_used:           string
  style:                 GroupsStyleId
  preset:                GroupsPresetId
  location:              LocationId
  arrangement:           GroupArrangement
  subject_count:         number

  refined:               boolean
  refine_ms:             number | null
  refine_decision:       string
  expanded:              boolean
  expand_ms:             number | null
  expand_skip:           string | null
  swapped:               boolean
  swap_ms:               number | null
  swap_skip:             string | null

  faces_detected_source: number
  faces_detected_render: number
  face_match_strategy:   'embedding' | 'positional' | 'manual' | 'fallback'

  attempts:              GroupsAttempt[]
  final_pass:            boolean
  final_reason:          string

  fatal_error:           string | null
  error_code?:           string
  retryable?:            boolean
  duration_ms:           number
}

// ═══════════════════════════════════════════════════════════════
// SCORING — Realistic + People Resolving (per-figure size-tiered)
// ═══════════════════════════════════════════════════════════════

export const SCORE_TOP_TIER     = 9
export const SCORE_RELAXED_TIER = 8
export const MAX_ATTEMPTS       = 2

export interface ScoringRule {
  topTierCount:     number
  relaxedTierCount: number
  totalRequired:    number
}

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
      reason: `pass: ${rule.topTierCount} ≥${SCORE_TOP_TIER}/10, ${rule.relaxedTierCount} ≥${SCORE_RELAXED_TIER}/10`,
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
// SCORING — Tribal styles (holistic caricature)
// ═══════════════════════════════════════════════════════════════

export const CARICATURE_THRESHOLD = 6

export function evaluateCaricatureScore(
  s: HolisticCaricatureScore,
): { passed: boolean; reason: string } {
  const avg = (s.emotional_capture + s.craft_quality + s.composition) / 3
  const rounded = Math.round(avg * 10) / 10
  if (s.overall_score >= CARICATURE_THRESHOLD && avg >= CARICATURE_THRESHOLD) {
    return {
      passed: true,
      reason: `pass: overall ${s.overall_score}/10, sub-avg ${rounded}/10 (essence ${s.emotional_capture}, craft ${s.craft_quality}, composition ${s.composition})`,
    }
  }
  return {
    passed: false,
    reason: `fail: overall ${s.overall_score}/10, sub-avg ${rounded}/10 — threshold ${CARICATURE_THRESHOLD}/10`,
  }
}

// ═══════════════════════════════════════════════════════════════
// LIMITS / DEFAULTS
// ═══════════════════════════════════════════════════════════════

export const MAX_SOURCE_IMAGES = 4
export const MIN_SUBJECTS      = 2
export const MAX_SUBJECTS      = 15
export const TYPICAL_MAX       = 12

export const DEFAULT_STYLE: GroupsStyleId = 'realistic'

export function defaultMaterialForStyle(style: GroupsStyleId): GroupsPresetId {
  const list = STYLE_MATERIALS[style]
  const bySignature = list.find(m => PRESET_TIER[m] === 'signature')
  if (bySignature) return bySignature
  const byPremium = list.find(m => PRESET_TIER[m] === 'premium')
  if (byPremium) return byPremium
  return list[0]
}

export function defaultAspectForStyle(style: GroupsStyleId): string {
  if (style === 'tribal_wall_masks') return '4:3'
  return '3:2'
}
