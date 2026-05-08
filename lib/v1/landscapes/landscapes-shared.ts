// lib/v1/landscapes/landscapes-shared.ts
//
// Schema source of truth for the Landscapes silo.
//
// Universal { main, optionA, optionB } frame:
//   main     → Surface (realistic path) OR Material (sculpted path)
//   optionA  → Atmosphere
//   optionB  → Environment
//
// Plus per-row: scale, cameraAngle, addBeam.
//
// REVISION HISTORY:
//   • Scene Feel axis REMOVED — quality always equivalent to "dramatic";
//     bake into LIGHTING block as always-on.
//   • Focal Lighting dial REMOVED — strong feature emphasis baked into
//     LIGHTING block as always-on.
//   • Environment "Auto" REMOVED — user picks Desk or In Environment
//     directly. Analyzer still recommends one.
//   • Scale 'zoom_out' (60%) REMOVED — two options now: close_up (75%),
//     fill (90%).
//   • CameraAngle 'low' (Ground) REMOVED — two options now: hero (45°),
//     elevated (60°).
//   • In-Situ label changed to "In Environment" — internal ID stays
//     'in_situ' for code stability and model-facing prompt clarity.

// ── SOURCE IMAGE CAP ──────────────────────────────────────────
export const MAX_SOURCE_IMAGES = 4

// ── SURFACES ──────────────────────────────────────────────────
// Analyzer-internal taxonomy. Not in prompts, not user-pickable.
// Drives Curator material recommendations + compatibility advisory.
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
// Five-ID schema. The 'natural' atmosphere (formerly 'none') means
// "no driven atmospheric mood; natural ambient, scene-appropriate."
// UI surfaces it as "As Is" — semantically: as shown in the source.
export type AtmosphereID =
  | 'natural'
  | 'golden'
  | 'dusk'
  | 'storm'
  | 'night'

export const ATMOSPHERE_LABELS: Record<AtmosphereID, string> = {
  natural: 'As Is',
  golden:  'Golden Hour',
  dusk:    'Dusk',
  storm:   'Storm',
  night:   'Night',
}

export const ATMOSPHERE_TIER: Record<AtmosphereID, 'base' | 'premium' | 'signature'> = {
  natural: 'base',
  golden:  'base',
  dusk:    'base',
  storm:   'premium',
  night:   'premium',
}

// Atmospheres that force in_situ environment mode (override desk).
// Storm and night both imply a sky-driven world that reads dissonant on a desk.
export const FORCED_IN_SITU_ATMOSPHERES: ReadonlySet<AtmosphereID> = new Set(['storm', 'night'])

export function migrateAtmosphereID(raw: string | null | undefined): AtmosphereID {
  if (!raw) return 'natural'
  const map: Record<string, AtmosphereID> = {
    natural: 'natural', golden: 'golden', dusk: 'dusk', storm: 'storm', night: 'night',
    none: 'natural',
    golden_hour: 'golden',
    vivid_midday: 'natural',
    dusk_blue_hour: 'dusk',
    dramatic_storm: 'storm',
    deep_night: 'night',
    peaceful_dawn: 'golden',
    fog_rolled_in: 'natural',
    after_rain: 'natural',
    snow_falling: 'natural',
    aurora_surreal: 'night',
  }
  return map[raw] ?? 'natural'
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
// Two options now (Auto removed). Storm and night atmospheres still force
// in_situ even when Desk is selected — engine resolves transparently.
//
// Internal ID 'in_situ' stays for code stability. User-facing label is
// "In Environment" — never "In-Situ" or "In Situ" in UI copy.
export type EnvironmentMode = 'controlled' | 'in_situ'

export const ENVIRONMENT_MODE_LABELS: Record<EnvironmentMode, string> = {
  controlled: 'Desk',
  in_situ:    'In Environment',
}

export const DEFAULT_ENVIRONMENT_MODE: EnvironmentMode = 'controlled'

// Resolved environment is now the same as EnvironmentMode (no auto step).
// Kept as a separate type for forward compatibility and prompt clarity.
export type ResolvedEnvironment = 'controlled' | 'in_situ'

export function resolveEnvironment(
  mode:       EnvironmentMode,
  atmosphere: AtmosphereID,
): ResolvedEnvironment {
  // Storm and night always force in_situ — desk would read dissonant.
  if (FORCED_IN_SITU_ATMOSPHERES.has(atmosphere)) return 'in_situ'
  return mode
}

// Migration shim — old values including 'auto', 'desk', 'gallery' map to
// the current set. 'auto' folds to 'controlled' (the new default).
export function migrateEnvironment(raw: string | null | undefined): EnvironmentMode {
  if (!raw) return DEFAULT_ENVIRONMENT_MODE
  const map: Record<string, EnvironmentMode> = {
    controlled: 'controlled',
    in_situ:    'in_situ',
    auto:       'controlled',
    desk:       'controlled',
    gallery:    'controlled',
  }
  return map[raw] ?? DEFAULT_ENVIRONMENT_MODE
}

// Legacy alias retained so old call sites still compile.
// TODO(post-stabilization): remove and update call sites.
export type EnvironmentID = EnvironmentMode
export const ENVIRONMENT_LABELS = ENVIRONMENT_MODE_LABELS

// ── CAMERA ANGLE ──────────────────────────────────────────────
// Two options now. 'low' (Ground) removed — wasn't producing a
// distinctive enough result to justify the option.
export type CameraAngleID = 'hero' | 'elevated'

export const CAMERA_ANGLE_LABELS: Record<CameraAngleID, string> = {
  hero:     '45°',
  elevated: '60°',
}

export const DEFAULT_CAMERA_ANGLE: CameraAngleID = 'hero'

export function migrateCameraAngleID(raw: string | null | undefined): CameraAngleID {
  if (raw === 'hero' || raw === 'elevated') return raw
  if (raw === 'low') return 'hero'   // legacy ground angle → 45° default
  return DEFAULT_CAMERA_ANGLE
}

// ── SCALE (canvas occupancy) ──────────────────────────────────
// Two options now. 'zoom_out' (60%) removed — wasn't being used and the
// LOW_VERTICAL_BLOCK now handles the open-frame compositions naturally.
//
// HEADS UP — ID/LABEL SEMANTIC MISMATCH:
//   Internal IDs and user-facing labels do not align by name. This is
//   intentional — internal IDs stay stable for code stability; UI
//   labels evolve as the product matures. Current mapping:
//
//     ID 'close_up' (75% canvas) → label "Staged"
//     ID 'fill'     (90% canvas) → label "Close Up"
//
//   When reading code that references scale by ID, treat the ID as a
//   stable identifier — not a description of the rendered output. The
//   user-facing semantic is in SCALE_LABELS below.
export type ScaleID = 'close_up' | 'fill'

export const SCALE_LABELS: Record<ScaleID, string> = {
  close_up: 'Staged',
  fill:     'Close Up',
}

export const SCALE_DESCRIPTIONS: Record<ScaleID, string> = {
  close_up: '~65–80% canvas — staged composition with environmental breathing room around the diorama',
  fill:     '~85–95% canvas — diorama dominates the frame, plinth fully visible with minimal margin',
}

export const DEFAULT_SCALE: ScaleID = 'close_up'

export function migrateScaleID(raw: string | null | undefined): ScaleID {
  if (raw === 'close_up') return 'close_up'
  if (raw === 'fill')     return 'fill'
  if (raw === 'up_close') return 'fill'      // 5-axis intermediate → fill
  if (raw === 'subject')  return 'fill'      // legacy hero scale → fill
  if (raw === 'zoom_out') return 'close_up'  // dropped 60% scale → close_up
  return DEFAULT_SCALE
}

// ── PLAQUE MODE ───────────────────────────────────────────────
export type PlaqueMode = 'off' | 'user' | 'ai'

export const PLAQUE_MODE_LABELS: Record<PlaqueMode, string> = {
  off:  'Off',
  user: 'Custom',
  ai:   'Auto',
}

export const DEFAULT_PLAQUE_MODE: PlaqueMode = 'off'

// ── ADD BEAM TOGGLE ───────────────────────────────────────────
// Single boolean. Applies to both Desk AND In-Environment renders.
// false → 3-point lighting only (default)
// true  → 3-point + accent volumetric beam from above
// The 3-point base is the consistent lighting model for every render;
// beam is the optional dramatic accent.
export const DEFAULT_ADD_BEAM = false

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
      reason: 'Material renders look better in a curated setting — Desk environment recommended.',
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

// ── ASPECT RATIOS ─────────────────────────────────────────────
export const ASPECT_RATIOS = [
  '1:1', '4:3', '3:4', '16:9', '9:16',
  '3:2', '2:3', '5:4', '4:5', '21:9',
] as const
export type AspectRatio = typeof ASPECT_RATIOS[number]

// ── UNIVERSAL RENDER REQUEST ──────────────────────────────────
export type MainKind = 'surface' | 'material'

export interface RenderRow {
  main:           SurfaceID | MaterialID
  mainKind:       MainKind
  optionA:        AtmosphereID
  optionB:        EnvironmentID
  scale:          ScaleID
  cameraAngle?:   CameraAngleID
  add_beam?:      boolean
  refine?:        boolean
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
  refine?:           boolean
  add_beam?:         boolean
  plaque_mode?:      PlaqueMode
  notes?:            string
  plaque_text?:      string
  is_preview?:       boolean
}

// ── INTERNAL PARAMS (post-validation) ─────────────────────────
export interface LandscapeParams {
  mainKind:         MainKind
  surface?:         SurfaceID
  material?:        MaterialID
  atmosphere:       AtmosphereID
  environment:      EnvironmentID
  environmentMode?: EnvironmentMode
  scale:            ScaleID
  cameraAngle:      CameraAngleID
  addBeam:          boolean
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

  main_kind?:           MainKind
  main_id?:             SurfaceID | MaterialID
  atmosphere_used?:     AtmosphereID
  environment_used?:    EnvironmentID
  scale_used?:          ScaleID
  camera_angle_used?:   CameraAngleID
  add_beam_used?:       boolean
  plaque_mode_used?:    PlaqueMode
  plaque_text_used?:    string
  aspect_ratio?:        AspectRatio
  refined?:             boolean
  expanded?:            boolean
  duration_ms?:         number
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
