// lib/v1/portraits/portraits-shared.ts
//
// Foundational types for the Portraits silo. Mirrors groups-shared.ts but
// scoped to single-subject. Style-first architecture is preserved so the
// frontend pattern lifts cleanly from Groups:
//   - user picks a STYLE first (Realistic / Resolving / Tribal Mask / Statue)
//   - the style determines which materials are available
//   - selecting a different style resets the material picker
//
// Pipeline divergence per style mirrors Groups:
//   • Realistic + Resolving — single-face likeness scoring (≥8 threshold).
//   • Tribal Mask + Tribal Statue — holistic caricature scoring (≥6).
//
// Note: foundation lifted from Groups intentionally. The carryover doc
// flagged that material/location vocabulary may evolve once UI Claude has
// done its pass on the Liten visual register for portrait pieces — bust,
// cameo, glass etching etc. For now we keep the Groups vocabulary so the
// pipeline shape is the only thing under test.

// ═══════════════════════════════════════════════════════════════
// STYLES — primary axis. Picked first; resets material on change.
// ═══════════════════════════════════════════════════════════════

export type PortraitsStyleId =
  | 'realistic'
  | 'people_resolving'
  | 'artists_gallery'

export const STYLE_LABELS: Record<PortraitsStyleId, string> = {
  realistic:         'Realistic',
  people_resolving:  'Person Resolving',
  artists_gallery:   'Artists Gallery',
}

export const STYLE_DESCRIPTIONS: Record<PortraitsStyleId, string> = {
  realistic:
    'A single subject rendered in lifelike detail in the chosen material. Intact bust on a sculpted base, or upper-body transformation, depending on material.',
  people_resolving:
    'The subject emerges gradually from a smooth flowing organic mass — fully resolved at the face and shoulders, abstracting downward into a sculptural base.',
  artists_gallery:
    'Subject reinterpreted in fine-art media — impressionist impasto, torn-paper topography, and other gallery-register artistic treatments. Each material is a complete artistic statement, not a uniform material wrap.',
}

export const STYLE_ORDER: PortraitsStyleId[] = [
  'realistic',
  'people_resolving',
  'artists_gallery',
]

// ═══════════════════════════════════════════════════════════════
// MATERIALS — initial set mirrors Groups. Will evolve to portrait-
// specific vocabulary (bust / cameo / glass-etching / etc.) once UI
// Claude finishes the Liten register pass.
// ═══════════════════════════════════════════════════════════════

export type PortraitsPresetId =
  | 'plushy'
  | 'bronze'
  | 'iron'
  | 'alabaster'
  | 'stone'
  | 'ebony'
  | 'walnut'
  // ── Artists Gallery (separate series; full custom prompts) ─────
  | 'impressionist'
  | 'torn_paper'
  | 'folded_book'
  | 'charcoal_chalk'
  | 'pencil_sketch'
  | 'sheet_music'
  // ── New materials (2026-06) ───────────────────────────────────
  // Realistic register (monolithic, take the TIER-2 hue lock):
  | 'pewter'
  | 'chocolate'
  // Artists Gallery register (polychrome, hue-lock EXEMPT):
  | 'stained_glass'
  | 'driftwood_resin'

export const PRESET_LABELS: Record<PortraitsPresetId, string> = {
  plushy:        'Plushy',
  bronze:        'Bronze',
  iron:          'Iron',
  alabaster:     'Alabaster',
  stone:         'Stone',
  ebony:         'Ebony',
  walnut:        'Walnut',
  impressionist:  'Impressionist',
  torn_paper:     'Torn Paper',
  folded_book:    'Folded Book',
  charcoal_chalk: 'Charcoal & Chalk',
  pencil_sketch:  'Pencil Sketch',
  sheet_music:    'Sheet Music',
  pewter:          'Pewter',
  chocolate:       'Chocolate',
  stained_glass:   'Stained Glass',
  driftwood_resin: 'Driftwood & Resin',
}

export type PresetTier = 'base' | 'premium' | 'signature'

export const PRESET_TIER: Record<PortraitsPresetId, PresetTier> = {
  plushy:        'base',
  ebony:         'premium',
  walnut:        'premium',
  stone:         'signature',
  bronze:        'signature',
  alabaster:     'signature',
  iron:          'signature',
  impressionist:  'signature',
  torn_paper:     'signature',
  folded_book:    'signature',
  charcoal_chalk: 'signature',
  pencil_sketch:  'signature',
  sheet_music:    'signature',
  pewter:          'signature',
  chocolate:       'signature',   // seasonal upsell — confirm intended tier
  stained_glass:   'signature',
  driftwood_resin: 'signature',
}

// ── STYLE → MATERIALS ─────────────────────────────────────────
export const STYLE_MATERIALS: Record<PortraitsStyleId, PortraitsPresetId[]> = {
  realistic: [
    'plushy',
    'ebony', 'walnut', 'stone',
    'bronze', 'iron', 'alabaster', 'pewter',
    'chocolate',
  ],
  people_resolving: [
    'ebony', 'walnut', 'bronze', 'alabaster',
  ],
  artists_gallery: [
    'impressionist', 'torn_paper', 'folded_book', 'charcoal_chalk',
    'pencil_sketch', 'sheet_music',
    'stained_glass', 'driftwood_resin',
  ],
}

// ═══════════════════════════════════════════════════════════════
// LOCATIONS
// ═══════════════════════════════════════════════════════════════

export type LocationId =
  | 'mantel'
  | 'tea_house'
  | 'pedestal'
  | 'gradient'
  | 'wall_mount'
  | 'plushy_shelf'

export const LOCATION_LABELS: Record<LocationId, string> = {
  mantel:        'Mantel',
  tea_house:     'Tea House',
  pedestal:      'Pedestal',
  gradient:      'Gradient',
  wall_mount:    'Wall Mount',
  plushy_shelf:  'Plushy Shelf',
}

export const LOCATION_ORDER: LocationId[] = [
  'mantel', 'pedestal', 'gradient', 'tea_house', 'wall_mount', 'plushy_shelf',
]

export const STYLE_LOCATIONS: Record<PortraitsStyleId, LocationId[]> = {
  realistic:         ['mantel', 'pedestal', 'gradient'],
  people_resolving:  ['mantel', 'pedestal', 'gradient'],
  // Artists Gallery prompts bake in their own museum/gallery location —
  // pedestal is the conceptual match. UI can hide the location picker
  // for this style since the prompt overrides it anyway.
  artists_gallery:   ['pedestal'],
}

/**
 * Resolve the active location given style + material + user pick.
 * - material === 'plushy' forces 'plushy_shelf'
 * - otherwise uses user pick if valid for the style; falls back to first allowed.
 */
export function resolveLocation(
  style:     PortraitsStyleId,
  material:  PortraitsPresetId,
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
  gradient:      'gallery',
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

// ═══════════════════════════════════════════════════════════════
// FRAMING — the three locked customer framings (S1.1).
// Replaces the old single hardcoded bust. Framing selects the lead
// composition block in the prompt builder AND implies the aspect —
// the customer no longer picks aspect separately. Framing is the
// source of truth; a conflicting client `aspect` is ignored.
// ═══════════════════════════════════════════════════════════════

export type Framing = 'bust' | 'signature' | 'statuesque'

export const FRAMING_LABELS: Record<Framing, string> = {
  bust:       'Bust',
  signature:  'Signature Pose',
  statuesque: 'Three-Quarter',
}

// Signature Pose is the new default and the house piece.
export const DEFAULT_FRAMING: Framing = 'signature'

// framing → aspect (authoritative; framing wins over any client aspect).
export const ASPECT_FOR_FRAMING: Record<Framing, string> = {
  bust:       '1:1',
  signature:  '1:1',
  statuesque: '3:4',
}

// Legacy bridge: the old engine vocabulary never reached the prompt
// builder, but the UI's pre-trio data used `full_body`. Anything still
// carrying it maps to Statuesque.
export function normalizeFraming(v: unknown): Framing {
  if (v === 'bust' || v === 'signature' || v === 'statuesque') return v
  if (v === 'full_body') return 'statuesque'
  return DEFAULT_FRAMING
}

// ── Resolution → output dimensions (per aspect) ────────────────
// NB2 renders at an aspect_ratio string with no pixel control, so the
// resolution tier is realized as a post-render resize to these exact
// dimensions. The long edge is the tier; the short edge follows the
// framing's aspect. 2K @ 1:1 = 2048×2048; 2K @ 3:4 = 1536×2048.
export type ResolutionTier = '1k' | '2k' | '4k'

const LONG_EDGE_PX: Record<ResolutionTier, number> = {
  '1k': 1024,
  '2k': 2048,
  '4k': 4096,
}

export function isResolutionTier(v: unknown): v is ResolutionTier {
  return v === '1k' || v === '2k' || v === '4k'
}

export function outputDimensions(
  framing: Framing,
  resolution: ResolutionTier,
): { width: number; height: number } {
  const long = LONG_EDGE_PX[resolution]
  // 3:4 → width is three-quarters of the (long-edge) height; 1:1 → square.
  return ASPECT_FOR_FRAMING[framing] === '3:4'
    ? { width: Math.round((long * 3) / 4), height: long }
    : { width: long, height: long }
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE CONFIG — per-style branching
// ═══════════════════════════════════════════════════════════════

export type ScoringMode = 'single_face_likeness' | 'holistic_caricature'

export type GeneratorType = 'nb2' | 'gpt-image-1'

export interface StylePipelineConfig {
  faceSwapEnabled:  boolean
  scoringMode:      ScoringMode
  scoringThreshold: number
  passTwoEnabled:   boolean
  generator:        GeneratorType
  // Stability outpaint after Stage 1. Adds canvas padding around the
  // rendered bust so the subject doesn't fill the frame. NB2 ignored
  // prompt-based margin directives; outpaint is the real mechanism.
  expandEnabled:    boolean
  expandPercent:    number    // % of original dimension added to each side
}

export const STYLE_PIPELINE: Record<PortraitsStyleId, StylePipelineConfig> = {
  realistic: {
    // 2026-05 — Pass 2 (gpt-image-1 refine) flipped OFF. The v2 sculpture-
    // only Pass 2 fixed the photo-paste failure but couldn't hold face
    // identity against gpt-image-1's regen prior. Pass 1 NB2 with the
    // likeness-reinforcement tail (see portraits-prompt.ts) preserves
    // identity better on its own. Re-enable only if a face-preserving
    // step is wired into Stage 2 (face swap, not prompt-only refine).
    //
    // Outpaint enabled — 10% padding per side. 20% stranded the bust;
    // 5% wasn't enough room; 10% sits in the middle. The original
    // tight crop was the wrong reference point — what we want is the
    // bust feeling intentionally placed in a scene, not crammed.
    faceSwapEnabled:  false,
    scoringMode:      'single_face_likeness',
    scoringThreshold: 8,
    passTwoEnabled:   false,
    generator:        'nb2',
    expandEnabled:    false,   // outpaint removed — cost + blurry mirrored margin
    expandPercent:    0,
  },
  people_resolving: {
    faceSwapEnabled:  false,
    scoringMode:      'single_face_likeness',
    scoringThreshold: 8,
    passTwoEnabled:   false,
    generator:        'nb2',
    expandEnabled:    false,   // outpaint removed — cost + blurry mirrored margin
    expandPercent:    0,
  },
  // Artists Gallery — full custom prompts per material (impressionist
  // impasto, torn-paper topography). Each prompt bakes in its own
  // composition, location, lighting, and DoF — outpaint disabled so we
  // don't fight the in-prompt confinement. NB2 with source-conditioned
  // input handles identity.
  artists_gallery: {
    faceSwapEnabled:  false,
    scoringMode:      'single_face_likeness',
    scoringThreshold: 8,
    passTwoEnabled:   false,
    generator:        'nb2',
    expandEnabled:    false,
    expandPercent:    0,
  },
}

// ═══════════════════════════════════════════════════════════════
// STYLE REFERENCE ASSETS — kept as empty stubs for API surface parity
// with Groups. The original Groups loader was producing repeated ENOENT
// warnings because public/style_refs/*.jpg never existed in deployment.
// Portraits ships from day one with the stub empty.
// ═══════════════════════════════════════════════════════════════

export interface StyleReferenceEntry {
  default: string[]
  solo?:   string[]
}

export const STYLE_REFERENCE_ASSETS: Record<PortraitsStyleId, StyleReferenceEntry> = {
  realistic:         { default: [] },
  people_resolving:  { default: [] },
  artists_gallery:   { default: [] },
}

export function resolveStyleReferencePaths(
  styleId:      PortraitsStyleId,
  _unused?:     number,
): string[] {
  const entry = STYLE_REFERENCE_ASSETS[styleId]
  return entry?.default || []
}

// ═══════════════════════════════════════════════════════════════
// REQUEST / RESULT TYPES
// ═══════════════════════════════════════════════════════════════

export interface PortraitsRefinements {
  craftDetail?: boolean
  sceneDetail?: boolean
}

export interface PortraitsGenerateRequest {
  source_image_b64:        string
  additional_images_b64?:  string[]
  style_reference_b64?:    string

  style_id:                PortraitsStyleId
  preset_id:               PortraitsPresetId
  location_id?:            LocationId
  scale?:                  Scale
  aspect_ratio?:           string

  // Three-framings (S1.1). framing selects the lead composition block and
  // implies the aspect (see ASPECT_FOR_FRAMING). The route derives aspect
  // from framing and sets aspect_ratio accordingly; a client aspect that
  // disagrees is ignored. Absent → DEFAULT_FRAMING ('signature').
  framing?:                Framing
  // Resolution tier → realized as a post-render resize to outputDimensions().
  // Absent → no resize (native NB2 size; preserves legacy caller behavior).
  resolution?:             ResolutionTier

  refinements?:            PortraitsRefinements
  notes?:                  string
  refinement_tweak?:       string
  refine?:                 boolean
  is_preview?:             boolean

  // Plaque text shown on the sculpture's base. See groups-prompt.ts notes —
  // NB2 confabulates plausible-but-fictional surnames if you don't pass
  // explicit plaque text. Behaviour:
  //   undefined / empty → DEFAULT_PLAQUE_TEXT ("Liten & Co · 2025")
  //   string            → inscribed verbatim
  //   null              → no plaque ("clean unmarked base")
  plaque_text?:            string | null

  // Curator-curated upper-body concept (see portraits-curator.ts). Set when
  // the user picked one of three Curator-generated interpretations after
  // analyzeSourceSet flagged body_coverage as 'face_only'. The description
  // is woven into the prompt to give NB2 an explicit bust silhouette to
  // render around the face — prevents the model from inventing hats,
  // hands, full torsos, or producing severed-head failures.
  //   undefined → no concept selected (normal flow)
  //   string    → concept description, injected into prompt
  upper_body_concept?:     string | null

  // Advanced lighting bundle. See PortraitsAdvanced below.
  advanced?:               PortraitsAdvanced
}

// Mirrors state.advanced on the frontend (lifted from Groups).
export interface PortraitsAdvanced {
  beam?:       'off' | 'on'
  threePoint?: 'off' | 'on'
  brightness?: '0' | '5' | '10' | '15'
  enhanced?:   'off' | 'on'
}

export const DEFAULT_PLAQUE_TEXT = 'Liten & Co · 2025'

// ─── SCORING SHAPES ────────────────────────────────────────────

// We re-use PerFigureScore so the result shape stays compatible with any
// downstream consumer expecting the Groups field name. For Portraits the
// array always has length 1.
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

export interface PortraitsAttempt {
  attempt:                  number
  prompt_used?:             string
  duration_ms:              number
  per_figure_scores?:       PerFigureScore[]
  caricature_score?:        HolisticCaricatureScore
  passed:                   boolean
  pass_reason:              string
}

export interface PortraitsGenerateResult {
  ok:                    boolean
  image_b64:             string | null
  prompt_used:           string
  style:                 PortraitsStyleId
  preset:                PortraitsPresetId
  location:              LocationId
  subject_count:         number   // always 1; preserved for shape parity with Groups

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

  attempts:              PortraitsAttempt[]
  final_pass:            boolean
  final_reason:          string

  fatal_error:           string | null
  error_code?:           string
  retryable?:            boolean
  duration_ms:           number
}

// ═══════════════════════════════════════════════════════════════
// SCORING — Realistic + Resolving (single-face threshold)
// ═══════════════════════════════════════════════════════════════
//
// Portraits uses a flat threshold rather than the size-tiered evaluator
// Groups needs. There is one subject; either the face matches or it doesn't.
// Default threshold ≥8 (carryover spec). Anything less retries once.

export const SINGLE_FACE_THRESHOLD = 8
export const MAX_ATTEMPTS          = 2

export function evaluateSingleFaceScore(
  s: PerFigureScore,
  threshold: number = SINGLE_FACE_THRESHOLD,
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

// ═══════════════════════════════════════════════════════════════
// SCORING — Tribal styles (holistic caricature) — same as Groups
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

export const DEFAULT_STYLE: PortraitsStyleId = 'realistic'

export function defaultMaterialForStyle(style: PortraitsStyleId): PortraitsPresetId {
  const list = STYLE_MATERIALS[style]
  const bySignature = list.find(m => PRESET_TIER[m] === 'signature')
  if (bySignature) return bySignature
  const byPremium = list.find(m => PRESET_TIER[m] === 'premium')
  if (byPremium) return byPremium
  return list[0]
}

// Portraits skews vertical by default — a bust reads best in 3:4 or 2:3.
// Wide aspects (16:9, 3:2) trigger NB2 to compose grand scenes around a
// single bust, which fights the product. Carryover spec: vertical defaults
// only, no 16:9.
export function defaultAspectForStyle(_style: PortraitsStyleId): string {
  return '3:4'
}
