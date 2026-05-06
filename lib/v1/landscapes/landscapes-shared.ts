// lib/v1/landscapes/landscapes-shared.ts
//
// Singular naming. Schema source of truth for the Landscapes silo.
//
// Universal { main, optionA, optionB } frame:
//   main     → Surface (realistic path) OR Material (sculpted path)
//   optionA  → Atmosphere
//   optionB  → Environment
//
// Plus per-row: scale, cameraAngle, sceneFeel.

// ── SOURCE IMAGE CAP ──────────────────────────────────────────
export const MAX_SOURCE_IMAGES = 4

// ── SURFACES ──────────────────────────────────────────────────
export type SurfaceID =
  | 'wet_luminous'
  | 'soft_diffused'
  | 'hard_raking'
  | 'layered_atmospheric'
  | 'lush_saturated'

export const SURFACE_LABELS: Record<SurfaceID, string> = {
  wet_luminous:        'Wet & Luminous',
  soft_diffused:       'Soft & Diffused',
  hard_raking:         'Hard & Raking',
  layered_atmospheric: 'Layered & Atmospheric',
  lush_saturated:      'Lush & Saturated',
}

export const SURFACE_TIER: Record<SurfaceID, 'base'> = {
  wet_luminous:        'base',
  soft_diffused:       'base',
  hard_raking:         'base',
  layered_atmospheric: 'base',
  lush_saturated:      'base',
}

// ── ATMOSPHERES (option A) ────────────────────────────────────
// New IDs per LITENCO Production Prompt v1. The 'none' atmosphere is not
// "no light" — it means "no driven atmospheric mood; natural ambient,
// scene-appropriate." It replaces the prior vivid_midday slot.
export type AtmosphereID =
  | 'none'
  | 'golden'
  | 'dusk'
  | 'storm'
  | 'night'

export const ATMOSPHERE_LABELS: Record<AtmosphereID, string> = {
  none:   'Natural',
  golden: 'Golden Hour',
  dusk:   'Dusk',
  storm:  'Storm',
  night:  'Night',
}

export const ATMOSPHERE_TIER: Record<AtmosphereID, 'base' | 'premium' | 'signature'> = {
  none:   'base',
  golden: 'base',
  dusk:   'base',
  storm:  'premium',
  night:  'premium',
}

// Atmospheres that force in_situ environment mode (override controlled/auto).
// Storm and night both imply a sky-driven world that reads dissonant on a desk.
export const FORCED_IN_SITU_ATMOSPHERES: ReadonlySet<AtmosphereID> = new Set(['storm', 'night'])

// Migration shim — accepts any prior atmosphere ID (the original 10, plus the
// 5-ID intermediate) and maps to the current set. Unknown IDs fall back to 'none'.
export function migrateAtmosphereID(raw: string | null | undefined): AtmosphereID {
  if (!raw) return 'none'
  const map: Record<string, AtmosphereID> = {
    // Current IDs pass through.
    none: 'none', golden: 'golden', dusk: 'dusk', storm: 'storm', night: 'night',
    // Intermediate (5-axis) → new.
    golden_hour: 'golden',
    vivid_midday: 'none',
    dusk_blue_hour: 'dusk',
    dramatic_storm: 'storm',
    deep_night: 'night',
    // Original 10-axis cuts → closest match.
    peaceful_dawn: 'golden',
    fog_rolled_in: 'none',
    after_rain: 'none',
    snow_falling: 'none',
    aurora_surreal: 'night',
  }
  return map[raw] ?? 'none'
}

// ── MATERIALS (alternative main) ──────────────────────────────
export type MaterialID =
  | 'bronze'
  | 'museum_quality'
  | 'alabaster'
  | 'glass'
  | 'carved_stone'
  | 'carved_wood'
  | 'watercolor_wood'

export const MATERIAL_LABELS: Record<MaterialID, string> = {
  bronze:          'Bronze',
  museum_quality:  'Museum Quality',
  alabaster:       'Alabaster',
  glass:           'Glass',
  carved_stone:    'Carved Stone',
  carved_wood:     'Carved Wood',
  watercolor_wood: 'Watercolor Wood',
}

export const MATERIAL_TIER: Record<MaterialID, 'base' | 'premium' | 'signature'> = {
  bronze:          'signature',
  museum_quality:  'signature',
  alabaster:       'premium',
  glass:           'premium',
  carved_stone:    'premium',
  carved_wood:     'base',
  watercolor_wood: 'base',
}

// ── ENVIRONMENT MODE ──────────────────────────────────────────
// New axis per LITENCO Production Prompt v1. Replaces the old 3-way
// in_situ/desk/gallery enum. The user picks a mode; auto resolves to
// either 'controlled' or 'in_situ' before prompt assembly. Storm and
// night atmospheres force in_situ regardless of mode.
export type EnvironmentMode = 'auto' | 'controlled' | 'in_situ'

export const ENVIRONMENT_MODE_LABELS: Record<EnvironmentMode, string> = {
  auto:       'Auto',
  controlled: 'Controlled',
  in_situ:    'In-Situ',
}

export const DEFAULT_ENVIRONMENT_MODE: EnvironmentMode = 'auto'

// Resolved environment after applying auto + forced-in-situ rules.
// This is what the prompt builder actually consumes.
export type ResolvedEnvironment = 'controlled' | 'in_situ'

export function resolveEnvironment(
  mode:       EnvironmentMode,
  atmosphere: AtmosphereID,
): ResolvedEnvironment {
  // Storm and night always force in_situ — desk/gallery would read dissonant.
  if (FORCED_IN_SITU_ATMOSPHERES.has(atmosphere)) return 'in_situ'
  // Auto resolves to controlled in the no-weather case.
  if (mode === 'auto') return 'controlled'
  return mode  // explicit 'controlled' or 'in_situ'
}

// Migration shim — old EnvironmentID ('in_situ' | 'desk' | 'gallery') maps
// onto new EnvironmentMode. Desk and gallery both fold into controlled
// (the controlled mode now subsumes both).
export function migrateEnvironment(raw: string | null | undefined): EnvironmentMode {
  if (!raw) return 'auto'
  const map: Record<string, EnvironmentMode> = {
    auto:       'auto',
    controlled: 'controlled',
    in_situ:    'in_situ',
    desk:       'controlled',
    gallery:    'controlled',
  }
  return map[raw] ?? 'auto'
}

// Legacy alias retained so call sites that import EnvironmentID compile during
// the migration window. Resolves to EnvironmentMode going forward.
// TODO(post-stabilization): remove and update all call sites.
export type EnvironmentID = EnvironmentMode

export const ENVIRONMENT_LABELS = ENVIRONMENT_MODE_LABELS

// ── CAMERA ANGLE ──────────────────────────────────────────────
// Three forced viewpoints. Drives the Camera block in landscapes-prompt.ts.
// Default is 'hero' (the natural product 3/4 angle).
export type CameraAngleID = 'low' | 'hero' | 'elevated'

export const CAMERA_ANGLE_LABELS: Record<CameraAngleID, string> = {
  low:      'Ground',
  hero:     '45°',
  elevated: '60°',
}

export const DEFAULT_CAMERA_ANGLE: CameraAngleID = 'hero'

// ── SCALE (canvas occupancy) ──────────────────────────────────
// Diorama occupancy of the frame. Plinth always fully visible.
//   zoom_out → ~50–65% (generous margins)
//   close_up → ~65–80% (default)
//   up_close → ~85–95% (hero emphasis, minimal breathing room)
// Reinstated as three-axis after LITENCO Production Prompt v1 dropped to two.
// Up Close replaces the prior 'subject' scale at a tighter occupancy.
export type ScaleID = 'zoom_out' | 'close_up' | 'up_close'

export const SCALE_LABELS: Record<ScaleID, string> = {
  zoom_out: 'Zoom Out',
  close_up: 'Close Up',
  up_close: 'Up Close',
}

export const SCALE_DESCRIPTIONS: Record<ScaleID, string> = {
  zoom_out: '~50–65% canvas — generous margins around the plinth',
  close_up: '~65–80% canvas — tighter composition, base fully visible',
  up_close: '~85–95% canvas — hero emphasis, plinth fully visible with minimal margin',
}

export const DEFAULT_SCALE: ScaleID = 'close_up'

// Migration shim — old 'subject' scale was hero-emphasis at ~75–85%; it maps
// to the new 'up_close' (which is the closer relative). Anything unknown
// falls back to the close_up default.
export function migrateScaleID(raw: string | null | undefined): ScaleID {
  if (raw === 'zoom_out') return 'zoom_out'
  if (raw === 'close_up') return 'close_up'
  if (raw === 'up_close') return 'up_close'
  if (raw === 'subject')  return 'up_close'  // legacy hero scale → new tightest
  return DEFAULT_SCALE
}

// ── SCENE FEEL ────────────────────────────────────────────────
// Lighting expression intensity. Amplifies atmosphere — does not replace it.
//   as_is     → natural, balanced, restrained
//   cinematic → shaped light, filmic contrast, controlled mood (kept; safe/flat)
//   dramatic  → richer materials, stronger micro-contrast, sharper form definition,
//               more dimensional lighting (default per LITENCO Production Prompt v1 —
//               object-quality only, NOT weather mood)
//   dramatic  → stronger contrast, deeper shadows, more directional lighting
//
// Replaced the prior Fidelity axis. Source-preservation philosophy now lives
// permanently in the CORE block ("feels like the same place, elevated into
// a cinematic miniature, rather than a literal copy") instead of being a
// user-controllable knob.
export type SceneFeelID = 'as_is' | 'cinematic' | 'dramatic'

export const SCENE_FEEL_LABELS: Record<SceneFeelID, string> = {
  as_is:     'As Is',
  cinematic: 'Cinematic',
  dramatic:  'Dramatic',
}

export const DEFAULT_SCENE_FEEL: SceneFeelID = 'dramatic'

// Migration shim — pass valid IDs through, fall back to the new default
// for unknown/missing values. This preserves Cinematic as a valid explicit
// pick (per "Keep it, but don't default to it"). The default flip only
// affects net-new state where no explicit pick was made.
export function migrateSceneFeelID(raw: string | null | undefined): SceneFeelID {
  if (raw === 'as_is' || raw === 'cinematic' || raw === 'dramatic') return raw
  return DEFAULT_SCENE_FEEL
}

// ── PLAQUE MODE ───────────────────────────────────────────────
// Three modes governing the small brass plaque on the front rim of the plinth.
//   off  → no plaque rendered
//   user → render the user's exact text (sanitized first against metadata)
//   ai   → NB2 composes a refined title at render time per the spec rules
// Resolution + sanitization logic lives in landscapes-plaque.ts.
export type PlaqueMode = 'off' | 'user' | 'ai'

export const PLAQUE_MODE_LABELS: Record<PlaqueMode, string> = {
  off:  'Off',
  user: 'Custom',
  ai:   'Auto',
}

export const DEFAULT_PLAQUE_MODE: PlaqueMode = 'off'

// ── COMPATIBILITY MATRIX (advisory only) ──────────────────────
export const MATERIAL_COMPATIBILITY: Record<SurfaceID, MaterialID[]> = {
  wet_luminous:        ['museum_quality', 'alabaster', 'glass'],
  soft_diffused:       ['museum_quality', 'alabaster', 'carved_wood', 'watercolor_wood'],
  hard_raking:         ['bronze', 'museum_quality', 'carved_stone'],
  layered_atmospheric: ['bronze', 'museum_quality', 'alabaster', 'carved_stone'],
  lush_saturated:      ['museum_quality', 'carved_wood', 'watercolor_wood'],
}

export function isMaterialCompatible(surface: SurfaceID, material: MaterialID): boolean {
  return MATERIAL_COMPATIBILITY[surface]?.includes(material) ?? false
}

// ── EDITORIAL GUIDANCE ────────────────────────────────────────
export interface EditorialGuidance {
  not_recommended: Array<{
    when: {
      mainKind?:    MainKind
      material?:    MaterialID
      surface?:     SurfaceID
      environment?: EnvironmentID
      scale?:       ScaleID
    }
    reason: string
  }>
}

export const STATIC_EDITORIAL_GUIDANCE: EditorialGuidance = {
  not_recommended: [
    {
      when: { mainKind: 'material', environment: 'in_situ' },
      reason: 'Material renders look better in a curated setting — Gallery or Desk.',
    },
  ],
}

export function rowEditorialNotes(
  row: { mainKind: MainKind; main: SurfaceID | MaterialID; optionB: EnvironmentID; scale: ScaleID },
  primarySurface?: SurfaceID,
  guidance: EditorialGuidance = STATIC_EDITORIAL_GUIDANCE,
): string[] {
  const notes: string[] = []

  for (const rule of guidance.not_recommended) {
    const w = rule.when
    let matches = true
    if (w.mainKind    && w.mainKind    !== row.mainKind)    matches = false
    if (w.environment && w.environment !== row.optionB)     matches = false
    if (w.scale       && w.scale       !== row.scale)       matches = false
    if (w.material    && (row.mainKind !== 'material' || w.material !== row.main)) matches = false
    if (w.surface     && (row.mainKind !== 'surface'  || w.surface  !== row.main)) matches = false
    if (matches) notes.push(rule.reason)
  }

  if (row.mainKind === 'material' && primarySurface) {
    if (!isMaterialCompatible(primarySurface, row.main as MaterialID)) {
      const matLabel  = MATERIAL_LABELS[row.main as MaterialID]
      const surfLabel = SURFACE_LABELS[primarySurface]
      notes.push(`${matLabel} doesn't typically suit ${surfLabel.toLowerCase()} places.`)
    }
  }

  return notes
}

// ── ANALYZER OUTPUT ───────────────────────────────────────────
export interface AnalyzerResult {
  display_name:      string
  primary_surface:   SurfaceID
  dominant_subject:  string
  has_water:         boolean
  plaque_candidates: string[]
}

// ── CURATOR OUTPUT ────────────────────────────────────────────
export interface CuratorResult {
  primary_recommendation:    { kind: MainKind; id: SurfaceID | MaterialID }
  alternative:               { kind: MainKind; id: SurfaceID | MaterialID }
  recommended_scale:         ScaleID
  recommended_environment:   EnvironmentID
  recommended_atmosphere:    AtmosphereID
  recommended_camera_angle?: CameraAngleID
  not_recommended: Array<{
    when: {
      mainKind?:    MainKind
      material?:    MaterialID
      surface?:     SurfaceID
      environment?: EnvironmentID
      scale?:       ScaleID
      atmosphere?:  AtmosphereID
      cameraAngle?: CameraAngleID
    }
    reason: string
  }>
  prose: string
}

export interface AnalyzeResponse {
  analyzer: AnalyzerResult
  curator:  CuratorResult
}

// Note: TIME OF DAY axis was removed. Atmospheres now carry intrinsic TOD
// (deep_night = night; others = day). No separate user-facing knob.

// ── ASPECT RATIOS ─────────────────────────────────────────────
export const ASPECT_RATIOS = [
  '1:1', '4:3', '3:4', '16:9', '9:16',
  '3:2', '2:3', '5:4', '4:5', '21:9',
] as const
export type AspectRatio = typeof ASPECT_RATIOS[number]

// ── UNIVERSAL RENDER REQUEST ──────────────────────────────────
export type MainKind = 'surface' | 'material'

export interface RenderRow {
  main:         SurfaceID | MaterialID
  mainKind:     MainKind
  optionA:      AtmosphereID
  optionB:      EnvironmentID
  scale:        ScaleID
  cameraAngle?: CameraAngleID    // optional in wire — defaults to DEFAULT_CAMERA_ANGLE
  sceneFeel?:   SceneFeelID      // optional in wire — defaults to DEFAULT_SCENE_FEEL
  refine?:      boolean          // per-row override; defaults to GenerateRequest.refine (true)
  override_curator?: boolean
}

export interface GenerateRequest {
  silo:              'landscapes'
  source_image_b64:  string
  extra_images?:     string[]
  renders:           RenderRow[]

  display_name?:        string
  primary_surface?:     SurfaceID
  dominant_subject?:    string
  has_water?:           boolean

  aspect_ratio?:     AspectRatio
  expand?:           boolean
  refine?:           boolean       // global Pass 2 toggle; default true. Per-row can override.
  scene_feel?:       SceneFeelID   // global default; per-row can override
  plaque_mode?:      PlaqueMode    // global default; default 'off'
  notes?:            string
  plaque_text?:      string        // only used when plaque_mode === 'user'
  is_preview?:       boolean
}

// ── INTERNAL PARAMS (post-validation) ─────────────────────────
export interface LandscapeParams {
  mainKind:         MainKind
  surface?:         SurfaceID
  material?:        MaterialID
  atmosphere:       AtmosphereID
  environment:      EnvironmentID    // legacy alias of EnvironmentMode during shim phase
  environmentMode?: EnvironmentMode  // new — preferred. Resolved at prompt-build time.
  scale:            ScaleID
  cameraAngle:      CameraAngleID
  sceneFeel:        SceneFeelID
  aspectRatio:      AspectRatio

  displayName?:     string
  primarySurface?:  SurfaceID
  dominantSubject?: string
  hasWater?:        boolean

  expand?:          boolean
  refine?:          boolean
  notes?:           string
  plaqueMode:       PlaqueMode
  plaqueText?:      string

  rowIndex?:        number
}

// ── PER-ROW RESULT ────────────────────────────────────────────
export interface RenderResult {
  ok:               boolean
  row_index:        number
  image_b64?:       string
  prompt_used?:     string
  error?:           string
  warnings?:        string[]

  // Echo-back context for UI / persistence
  main_kind?:         MainKind
  main_id?:           SurfaceID | MaterialID
  atmosphere_used?:   AtmosphereID
  environment_used?:  EnvironmentID
  scale_used?:        ScaleID
  camera_angle_used?: CameraAngleID
  scene_feel_used?:   SceneFeelID
  plaque_mode_used?:  PlaqueMode    // effective mode after sanitization (may differ from requested)
  plaque_text_used?:  string         // resolved text for 'user' mode after sanitization
  aspect_ratio?:      AspectRatio
  refined?:           boolean   // true if Pass 2 (GPT-image-1) ran successfully
  expanded?:          boolean
  duration_ms?:       number
}

// ── BATCH RESPONSE ────────────────────────────────────────────
export type GenerateResponse =
  | {
      status:   'ok'
      results:  RenderResult[]
      warnings: Array<{ row_index?: number; message: string }>
      is_preview: boolean
    }
  | {
      status: 'deferred'
      job_id: string
      estimated_minutes: number | null
      message: 'studio_at_capacity'
    }
  | {
      status: 'error'
      error:  string
      errors?: string[]
    }

// NOTE: resolveTimeOfDay() and autoPlaqueText() were removed.
// - TOD axis: atmospheres carry intrinsic TOD via their own lighting copy.
// - Plaque text: resolved through three-mode system in landscapes-plaque.ts.
