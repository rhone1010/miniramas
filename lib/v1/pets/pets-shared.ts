// lib/v1/pets/pets-shared.ts
//
// Foundational types for the Pets silo. Mirrors portraits-shared.ts but
// scoped to a single animal subject. Conflicts between the Portraits
// human-bust architecture and the Pets spec are resolved in favor of
// the Pets spec (Rich, 2026-06-05):
//
//   • LOCATIONS → ENVIRONMENTS. The Portraits staging vocabulary
//     (mantel / tea house / pedestal / wall mount) is replaced by the
//     four Rich-authored pet environments: Gallery, Natural,
//     Atmospheric, Home. Each environment owns its own lighting.
//   • No wardrobe / upper_body_concept threading — animals have no
//     garments. The field does not exist in the request schema.
//   • Face swap is NOT available — cdingram/face-swap is a human-face
//     model. faceSwapEnabled exists for shape parity but is locked
//     false; the result object still reports swap_skip for frontend
//     symmetry with Portraits.
//   • Styles: 'realistic' only at launch. Artists Gallery prompts are
//     structurally human (busts, garments, hairstyles) and are NOT
//     ported — the style axis is preserved so pet-specific artistic
//     treatments can plug in later without schema churn.

// ═══════════════════════════════════════════════════════════════
// STYLES — primary axis. Single style at launch; axis preserved
// for future pet-specific artistic treatments.
// ═══════════════════════════════════════════════════════════════

export type PetsStyleId = 'realistic'

export const STYLE_LABELS: Record<PetsStyleId, string> = {
  realistic: 'Realistic',
}

export const STYLE_DESCRIPTIONS: Record<PetsStyleId, string> = {
  realistic:
    'Your pet rendered as a complete full-body sculpture in the chosen material — every marking, every quirk of posture, the exact animal in the photograph.',
}

export const STYLE_ORDER: PetsStyleId[] = ['realistic']

// ═══════════════════════════════════════════════════════════════
// MATERIALS — the eight Realistic materials carried over from
// Portraits, with pet-adapted prompt phrases (see pets-prompt.ts).
// Plushy graduates from placeholder to a real offering here.
// ═══════════════════════════════════════════════════════════════

export type PetsPresetId =
  | 'ceramic'
  | 'plushy'
  | 'bronze'
  | 'mixed_metals'
  | 'alabaster'
  | 'stone'
  | 'walnut'

export const PRESET_LABELS: Record<PetsPresetId, string> = {
  ceramic:      'Ceramic',
  plushy:       'Plushy',
  bronze:       'Bronze',
  mixed_metals: 'Metals',
  alabaster:    'Alabaster',
  stone:        'Stone',
  walnut:       'Walnut',
}

export type PresetTier = 'base' | 'premium' | 'signature'

export const PRESET_TIER: Record<PetsPresetId, PresetTier> = {
  ceramic:      'base',
  plushy:       'base',
  walnut:       'premium',
  stone:        'signature',
  bronze:       'signature',
  alabaster:    'signature',
  mixed_metals: 'signature',
}

// Ebony dropped for Pets (2026-06-06): the deep black-brown register
// crushes tonal range, so markings-as-grain stop reading — and markings
// are identity for pets. Felted wool added: needle-felted pet portraiture
// is a native market register and carries true coat colors.
export const STYLE_MATERIALS: Record<PetsStyleId, PetsPresetId[]> = {
  realistic: [
    'ceramic', 'plushy',
    'walnut', 'stone',
    'bronze', 'mixed_metals', 'alabaster',
  ],
}

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENTS — replaces the Portraits LocationId axis entirely.
// Four Rich-authored environments (2026-06-05 spec). Phrases live
// in pets-prompt.ts; each environment carries its own lighting, so
// no universal lighting cue is appended (one concern per block).
// ═══════════════════════════════════════════════════════════════

export type EnvironmentId =
  | 'gallery'
  | 'natural'
  | 'atmospheric'
  | 'home'

export const ENVIRONMENT_LABELS: Record<EnvironmentId, string> = {
  gallery:     'Gallery',
  natural:     'Natural',
  atmospheric: 'Atmospheric',
  home:        'Home',
}

export const ENVIRONMENT_ORDER: EnvironmentId[] = [
  'gallery', 'natural', 'atmospheric', 'home',
]

export const STYLE_ENVIRONMENTS: Record<PetsStyleId, EnvironmentId[]> = {
  realistic: ['gallery', 'natural', 'atmospheric', 'home'],
}

/**
 * Resolve the active environment given style + user pick.
 * Falls back to 'gallery' — the most controlled register and the
 * safest default for an unproven source photo.
 */
export function resolveEnvironment(
  style:     PetsStyleId,
  userPick?: EnvironmentId,
): EnvironmentId {
  const allowed = STYLE_ENVIRONMENTS[style] || []
  if (userPick && allowed.includes(userPick)) return userPick
  return allowed[0] || 'gallery'
}

// ═══════════════════════════════════════════════════════════════
// SCALE / COMPOSITION — carried over unchanged from Portraits.
// Code values are inverted from UI labels (intentional, do not fix).
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ACTIONS — pose re-staging (2026-06-06)
// ═══════════════════════════════════════════════════════════════
// For people with a single photo of one position. 'as_photographed'
// (default) preserves the source pose exactly — current behavior. Any
// other action REPLACES pose + expression preservation with the action
// directive; identity, markings, coat, and age stay locked, and the
// scorer is told the re-staging is deliberate (pets-refine.ts).

export type ActionId =
  | 'as_photographed'
  | 'sleeping'
  | 'jumping'
  | 'running'
  | 'playing'
  | 'sitting_proud'
  | 'funny'

export const ACTION_LABELS: Record<ActionId, string> = {
  as_photographed: 'As Photographed',
  sleeping:        'Sleeping',
  jumping:         'Jumping',
  running:         'Running',
  playing:         'Playing',
  sitting_proud:   'Sitting Proud',
  funny:           'Funny',
}

export const ACTION_ORDER: ActionId[] = [
  'as_photographed', 'sleeping', 'jumping', 'running',
  'playing', 'sitting_proud', 'funny',
]

export const DEFAULT_ACTION: ActionId = 'as_photographed'

export type Scale = 'close_up' | 'fill'

export const SCALE_LABELS: Record<Scale, string> = {
  close_up: 'With Margin',
  fill:     'Filled',
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE CONFIG — per-style branching, mirrors Portraits shape
// ═══════════════════════════════════════════════════════════════

export type ScoringMode = 'pet_likeness'

export type GeneratorType = 'nb2'

export interface StylePipelineConfig {
  // Locked false for Pets — cdingram/face-swap is a human-face model
  // and does not work on animals. Kept in the config shape so the
  // generator and result objects stay symmetric with Portraits.
  faceSwapEnabled:  boolean
  scoringMode:      ScoringMode
  scoringThreshold: number
  passTwoEnabled:   boolean
  generator:        GeneratorType
  // Stability outpaint after Stage 1. Same mechanism as Portraits —
  // NB2 ignores prompt-based margin directives; outpaint is the real
  // margin mechanism. 10% per side, matching Portraits realistic.
  expandEnabled:    boolean
  expandPercent:    number
}

export const STYLE_PIPELINE: Record<PetsStyleId, StylePipelineConfig> = {
  realistic: {
    faceSwapEnabled:  false,
    scoringMode:      'pet_likeness',
    scoringThreshold: 8,
    // Pass 2 off, mirroring Portraits: gpt-image-1 refine reinterprets
    // identity. For pets the photo-paste / idealization failure modes
    // become breed-averaging. NB2 Pass 1 with the identity-reinforced
    // prompt holds the specific animal better on its own.
    passTwoEnabled:   false,
    generator:        'nb2',
    expandEnabled:    true,
    expandPercent:    10,
  },
}

// ═══════════════════════════════════════════════════════════════
// REQUEST / RESULT TYPES
// ═══════════════════════════════════════════════════════════════

export interface PetsRefinements {
  craftDetail?: boolean
  sceneDetail?: boolean
}

export interface PetsGenerateRequest {
  source_image_b64:       string
  additional_images_b64?: string[]
  style_reference_b64?:   string

  style_id:               PetsStyleId
  preset_id:              PetsPresetId
  environment_id?:        EnvironmentId
  // Pose re-staging. Omitted / 'as_photographed' → source pose preserved.
  action_id?:             ActionId
  scale?:                 Scale
  aspect_ratio?:          string
  refinements?:           PetsRefinements
  notes?:                 string
  refinement_tweak?:      string
  refine?:                boolean
  is_preview?:            boolean

  // Plaque text shown at the sculpture's base. Same contract as
  // Portraits/Groups — NB2 confabulates plausible-but-fictional
  // names (pet names included) if you don't pass explicit text:
  //   undefined / empty → DEFAULT_PLAQUE_TEXT ("Liten & Co · 2025")
  //   string            → inscribed verbatim
  //   null              → no plaque ("clean unmarked base")
  plaque_text?:           string | null

  // Advanced lighting bundle — layers on top of the environment's
  // own baked-in lighting. See PetsAdvanced below.
  advanced?:              PetsAdvanced
}

// Mirrors state.advanced on the frontend (lifted from Portraits).
export interface PetsAdvanced {
  beam?:       'off' | 'on'
  threePoint?: 'off' | 'on'
  brightness?: '0' | '5' | '10' | '15'
  enhanced?:   'off' | 'on'
}

export const DEFAULT_PLAQUE_TEXT = 'Liten & Co · 2025'

// ─── SCORING SHAPES ────────────────────────────────────────────
// PerFigureScore re-used from the Groups/Portraits naming so the
// result shape stays compatible with downstream consumers. For Pets
// the array always has length 1.

export interface PerFigureScore {
  figure_index: number
  score:        number
  reason:       string
}

export interface PetsAttempt {
  attempt:            number
  prompt_used?:       string
  duration_ms:        number
  per_figure_scores?: PerFigureScore[]
  passed:             boolean
  pass_reason:        string
}

export interface PetsGenerateResult {
  ok:                    boolean
  image_b64:             string | null
  prompt_used:           string
  style:                 PetsStyleId
  preset:                PetsPresetId
  environment:           EnvironmentId
  action:                ActionId
  subject_count:         number   // detected hero animals rendered (1–5)

  refined:               boolean
  refine_ms:             number | null
  refine_decision:       string
  expanded:              boolean
  expand_ms:             number | null
  expand_skip:           string | null
  swapped:               boolean        // always false for Pets
  swap_ms:               number | null  // always null for Pets
  swap_skip:             string | null

  pets_detected_source:  number
  pets_detected_render:  number

  attempts:              PetsAttempt[]
  final_pass:            boolean
  final_reason:          string

  fatal_error:           string | null
  error_code?:           string
  retryable?:            boolean
  duration_ms:           number
}

// ═══════════════════════════════════════════════════════════════
// SCORING — pet identity (flat threshold, mirrors Portraits)
// ═══════════════════════════════════════════════════════════════
//
// One animal; either the render reads as that specific pet or it
// doesn't. Default threshold ≥8 (Portraits parity). Below threshold
// retries once.

export const PET_LIKENESS_THRESHOLD = 8
export const MAX_ATTEMPTS           = 2

// Multi-pet support: up to 5 hero animals render as a single group piece.
// Detection counts; NB2 renders the group from the source; scoring is
// per-animal with a flat threshold — every animal must clear it.
export const MAX_PETS = 5

export function evaluatePetScore(
  s: PerFigureScore,
  threshold: number = PET_LIKENESS_THRESHOLD,
): { passed: boolean; reason: string } {
  if (s.score >= threshold) {
    return {
      passed: true,
      reason: `pass: ${s.score}/10 ≥ ${threshold}/10`,
    }
  }
  return {
    passed: false,
    reason: `fail: ${s.score}/10 < ${threshold}/10 — "${s.reason}"`,
  }
}

// Multi-pet evaluator — flat threshold across every animal. No size
// tiers (Groups-style tiering can come later if small background pets
// prove too strict at 8).
export function evaluateMultiPetScores(
  scores: PerFigureScore[],
  threshold: number = PET_LIKENESS_THRESHOLD,
): { passed: boolean; reason: string } {
  if (scores.length === 0) {
    return { passed: false, reason: 'no animal scores returned' }
  }
  const failing = scores.filter(s => s.score < threshold)
  const summary = scores.map(s => `#${s.figure_index}:${s.score}`).join(' ')
  if (failing.length === 0) {
    return {
      passed: true,
      reason: `pass: all ${scores.length} animals ≥ ${threshold}/10 (${summary})`,
    }
  }
  const worst = failing.reduce((a, b) => (a.score <= b.score ? a : b))
  return {
    passed: false,
    reason: `fail: ${failing.length}/${scores.length} animals < ${threshold}/10 (${summary}) — worst #${worst.figure_index}: "${worst.reason}"`,
  }
}

// ═══════════════════════════════════════════════════════════════
// LIMITS / DEFAULTS
// ═══════════════════════════════════════════════════════════════

export const MAX_SOURCE_IMAGES = 4

export const DEFAULT_STYLE: PetsStyleId = 'realistic'

export function defaultMaterialForStyle(style: PetsStyleId): PetsPresetId {
  const list = STYLE_MATERIALS[style]
  const bySignature = list.find(m => PRESET_TIER[m] === 'signature')
  if (bySignature) return bySignature
  const byPremium = list.find(m => PRESET_TIER[m] === 'premium')
  if (byPremium) return byPremium
  return list[0]
}

// Pets defaults vertical like Portraits — 3:4 reads best on mobile
// portrait-first display and keeps NB2 from composing grand wide
// scenes around a single animal. The full-body subject sits naturally
// in 3:4 whether sitting, standing, or lying.
export function defaultAspectForStyle(_style: PetsStyleId): string {
  return '3:4'
}
