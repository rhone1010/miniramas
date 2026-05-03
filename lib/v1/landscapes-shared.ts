// lib/v1/landscapes-shared.ts
// Types, IDs, and surface×material compatibility matrix.
// Implements the universal { main, optionA, optionB } frame from UI Claude's sync doc.
// For Landscapes:
//   main     → Surface (realistic path) OR Material (costume path)
//   optionA  → Atmosphere
//   optionB  → Environment

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

// All surfaces are base tier — the realistic path doesn't carry tier distinctions
export const SURFACE_TIER: Record<SurfaceID, 'base'> = {
  wet_luminous:        'base',
  soft_diffused:       'base',
  hard_raking:         'base',
  layered_atmospheric: 'base',
  lush_saturated:      'base',
}

// ── ATMOSPHERES (option A) ────────────────────────────────────
export type AtmosphereID =
  | 'golden'
  | 'peaceful_dawn'
  | 'vivid_midday'
  | 'dusk_blue_hour'
  | 'dramatic_storm'
  | 'deep_night'
  | 'fog_rolled_in'
  | 'after_rain'
  | 'snow_falling'
  | 'aurora_surreal'

export const ATMOSPHERE_LABELS: Record<AtmosphereID, string> = {
  golden:         'Golden Hour',
  peaceful_dawn:  'Peaceful Dawn',
  vivid_midday:   'Vivid Midday',
  dusk_blue_hour: 'Dusk / Blue Hour',
  dramatic_storm: 'Dramatic Storm',
  deep_night:     'Deep Night',
  fog_rolled_in:  'Fog Rolled In',
  after_rain:     'After Rain',
  snow_falling:   'Snow Falling',
  aurora_surreal: 'Aurora / Surreal',
}

export const ATMOSPHERE_TIER: Record<AtmosphereID, 'base' | 'premium' | 'signature'> = {
  golden:         'base',
  peaceful_dawn:  'base',
  vivid_midday:   'base',
  dusk_blue_hour: 'base',
  dramatic_storm: 'premium',
  deep_night:     'premium',
  fog_rolled_in:  'premium',
  after_rain:     'premium',
  snow_falling:   'premium',
  aurora_surreal: 'signature',
}

// Atmospheres that override row-level TOD to night
export const ATMOSPHERE_FORCED_NIGHT: AtmosphereID[] = ['deep_night', 'aurora_surreal']

// ── MATERIALS (alternative main) ──────────────────────────────
// Snow_globe and gingerbread excluded — Houses-specific, don't translate.
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

// ── ENVIRONMENTS (option B) ───────────────────────────────────
export type EnvironmentID = 'in_situ' | 'desk' | 'gallery'

export const ENVIRONMENT_LABELS: Record<EnvironmentID, string> = {
  in_situ: 'In Situ',
  desk:    'On Desk',
  gallery: 'Gallery',
}

// ── SCALE (composition occupancy) ─────────────────────────────
// How much of the plinth the scene fills. Plinth is always fully visible —
// scale governs scene-on-plinth not scene-in-frame.
export type ScaleID = 'composed' | 'generous' | 'edge_to_edge'

export const SCALE_LABELS: Record<ScaleID, string> = {
  composed:     'Composed',
  generous:     'Generous',
  edge_to_edge: 'Edge to Edge',
}

export const SCALE_DESCRIPTIONS: Record<ScaleID, string> = {
  composed:     'scene set within the plinth',
  generous:     'scene fills the plinth',
  edge_to_edge: 'scene fills nearly all the plinth',
}

// ── COMPATIBILITY MATRIX (material path only) ─────────────────
// Surface mode is unrestricted — any surface + any atmosphere + any environment is valid.
// Material mode has editorial recommendations against analyzer.primary_surface.
// IMPORTANT: this is now ADVISORY, not enforced by the validator. The Curator
// uses this to mark certain combinations as "not recommended" but the user
// can override. The validator only rejects structurally broken requests.
export const MATERIAL_COMPATIBILITY: Record<SurfaceID, MaterialID[]> = {
  wet_luminous: [
    'museum_quality',
    'alabaster',     // ice/snow case
    'glass',
  ],
  soft_diffused: [
    'museum_quality',
    'alabaster',
    'carved_wood',
    'watercolor_wood',
  ],
  hard_raking: [
    'bronze',
    'museum_quality',
    'carved_stone',
  ],
  layered_atmospheric: [
    'bronze',
    'museum_quality',
    'alabaster',
    'carved_stone',
  ],
  lush_saturated: [
    'museum_quality',
    'carved_wood',
    'watercolor_wood',
  ],
}

export function isMaterialCompatible(surface: SurfaceID, material: MaterialID): boolean {
  return MATERIAL_COMPATIBILITY[surface]?.includes(material) ?? false
}

// ── ENVIRONMENT × MATERIAL EDITORIAL GUIDANCE ─────────────────
// Some environment + path combinations don't render well even though they're
// structurally valid. This is editorial knowledge, surfaced by the Curator
// and used by the UI to grey out tiles. Users can still override.
export interface EditorialGuidance {
  // Combinations the Curator actively recommends AGAINST.
  // Each entry: a predicate describing the combination + a short reason.
  not_recommended: Array<{
    when: {
      mainKind?:    MainKind
      material?:    MaterialID
      surface?:     SurfaceID
      environment?: EnvironmentID
      scale?:       ScaleID
    }
    reason: string  // Short copy shown to user, e.g. "Material renders look better in a curated setting."
  }>
}

// Static editorial rules that apply regardless of source image.
// Image-specific guidance (e.g. "this place is wet, bronze won't carry color")
// is added by the Curator on top of these.
export const STATIC_EDITORIAL_GUIDANCE: EditorialGuidance = {
  not_recommended: [
    {
      when: { mainKind: 'material', environment: 'in_situ' },
      reason: 'Material renders look better in a curated setting — Gallery or Desk.',
    },
  ],
}

// Helper — does a given row violate any editorial guidance?
// Used by Curator to compose its prose; not used by validator.
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

  // Surface→material compatibility check (advisory)
  if (row.mainKind === 'material' && primarySurface) {
    if (!isMaterialCompatible(primarySurface, row.main as MaterialID)) {
      const matLabel = MATERIAL_LABELS[row.main as MaterialID]
      const surfLabel = SURFACE_LABELS[primarySurface]
      notes.push(`${matLabel} doesn't typically suit ${surfLabel.toLowerCase()} places.`)
    }
  }

  return notes
}

// ── ANALYZER OUTPUT ───────────────────────────────────────────
// Trimmed: removed has_sky_dominance, secondary_surface, vegetation_density.
// Kept the fields the Curator actually uses to make decisions.
// Added plaque_candidates — short evocative title/caption options the user
// can apply to a plaque rendering or pick as a name for the rendered place.
export type VegetationDensity = 'none' | 'sparse' | 'moderate' | 'dense'  // kept for backward-compat; no longer in analyzer output

export interface AnalyzerResult {
  display_name:     string
  primary_surface:  SurfaceID
  dominant_subject: string
  has_water:        boolean
  plaque_candidates: string[]  // 2-3 short evocative title options, e.g. ["The Footbridge", "Light Through Birches", "Where We Crossed"]
}

// ── CURATOR OUTPUT ────────────────────────────────────────────
// Restructured to carry editorial guidance the UI uses to grey out tiles.
// The user can override any of these.
export interface CuratorResult {
  // Primary recommendation can be either a material or a surface treatment.
  // (Previously was always a material; mixed-mainKind queues changed that.)
  primary_recommendation: {
    kind: MainKind
    id:   SurfaceID | MaterialID
  }
  alternative: {
    kind: MainKind
    id:   SurfaceID | MaterialID
  }
  recommended_scale:       ScaleID
  recommended_environment: EnvironmentID
  recommended_atmosphere:  AtmosphereID

  // Editorial guidance for the UI to apply: which combinations to grey out
  // and why. The user can override but we tell them clearly.
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

  prose: string  // 2-3 sentences, UI appends "— C."
}

// Combined response from /api/v1/landscapes/analyze
export interface AnalyzeResponse {
  analyzer: AnalyzerResult
  curator:  CuratorResult
}

// ── TIME OF DAY ───────────────────────────────────────────────
export type TimeOfDay = 'day' | 'night'

// ── ASPECT RATIOS (NB2-supported) ─────────────────────────────
export const ASPECT_RATIOS = [
  '1:1', '4:3', '3:4', '16:9', '9:16',
  '3:2', '2:3', '5:4', '4:5', '21:9',
] as const
export type AspectRatio = typeof ASPECT_RATIOS[number]

// ── UNIVERSAL RENDER REQUEST (per UI Claude's contract) ───────
// Each render row in the queue. Engine receives a fully resolved request —
// doesn't need to know whether UI was in apply-to-all or individual mode.
export type MainKind = 'surface' | 'material'

export interface RenderRow {
  main:       SurfaceID | MaterialID  // the path's chosen direction
  mainKind:   MainKind                // disambiguates which dictionary
  optionA:    AtmosphereID            // atmosphere
  optionB:    EnvironmentID           // environment
  tod:        TimeOfDay               // day/night (overridden by forced-night atmospheres)
  scale:      ScaleID                 // composition occupancy on plinth
  override_curator?: boolean          // user explicitly overrode Curator's not-recommended guidance for this row
}

// Full request body to /api/v1/landscapes/generate
export interface GenerateRequest {
  silo:              'landscapes'
  source_image_b64:  string
  extra_images?:     string[]            // up to 3 additional, total 4 max
  renders:           RenderRow[]         // one or more rows to render in parallel

  // Analyzer context — passed back so engine doesn't need to re-analyze
  display_name?:        string
  primary_surface?:     SurfaceID
  dominant_subject?:    string
  has_water?:           boolean

  // Render-level options
  aspect_ratio?:     AspectRatio
  expand?:           boolean
  notes?:            string
  plaque_text?:      string              // optional plaque caption to render on the plinth
  is_preview?:       boolean             // upstream auth/billing decides; engine stamps response
}

// ── INTERNAL PARAMS (per-render, post-validation) ─────────────
export interface LandscapeParams {
  // Resolved row
  mainKind:        MainKind
  surface?:        SurfaceID         // when mainKind = surface, OR carried as fidelity baseline on material path
  material?:       MaterialID        // when mainKind = material
  atmosphere:      AtmosphereID
  environment:     EnvironmentID
  tod:             TimeOfDay
  scale:           ScaleID
  aspectRatio:     AspectRatio

  // Place context
  displayName?:        string
  primarySurface?:     SurfaceID     // analyzer baseline (used when material path overrides surface)
  dominantSubject?:    string
  hasWater?:           boolean

  // Pipeline
  expand?:             boolean
  notes?:              string
  plaqueText?:         string

  // Index in the original request batch — used for warnings/per-row logging
  rowIndex?:           number
}

// ── PER-ROW RESULT (in batch responses) ───────────────────────
export interface RenderResult {
  ok:          boolean
  row_index:   number
  image_b64?:  string
  prompt_used?: string
  error?:      string
  warnings?:   string[]   // non-fatal notes (e.g. user overrode Curator)
}

// ── BUSY / DEFERRED / BATCH RESPONSE TYPES ────────────────────
// New shape: status: 'ok' returns results[] with per-row success/failure,
// not a single image. One bad row no longer kills the batch.
export type GenerateResponse =
  | {
      status:   'ok'
      results:  RenderResult[]      // one entry per renders[] row, in order
      warnings: Array<{             // non-fatal request-level notes
        row_index?: number
        message:    string
      }>
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
      errors?: string[]             // structural validation errors
    }

// ── RESOLVED TOD HELPER ───────────────────────────────────────
export function resolveTimeOfDay(row: { atmosphere: AtmosphereID; tod: TimeOfDay }): TimeOfDay {
  if (ATMOSPHERE_FORCED_NIGHT.includes(row.atmosphere)) return 'night'
  return row.tod
}
