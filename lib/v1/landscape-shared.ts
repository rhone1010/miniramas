// landscape-shared.ts
// lib/v1/landscape-shared.ts
//
// Foundational types for the Landscape silo. Mirrors the houses-shared.ts
// and actionmini-shared.ts pattern: minimal interfaces + enums, no logic
// beyond the environment/TOD resolvers.
//
// Architecture: rebuilt on the Houses pattern after the universal
// { main, optionA, optionB } frame proved too dense for NB2 to handle
// without losing instruction-following fidelity. See the carryover for
// the previous architecture's failure modes.
//
// v1 catalog (intentionally minimal):
//   - One preset registered: 'as_itself' (the realistic miniature treatment)
//   - Three environments: in_situ, desk, gallery
//   - Ten atmospheres: golden, peaceful_dawn, vivid_midday, dusk_blue_hour,
//                      dramatic_storm, deep_night, fog_rolled_in, after_rain,
//                      snow_falling, aurora_surreal
//   - Two scales: close_up (~80% canvas width), zoom_out (~65% canvas width)
//   - day/night TOD with forced-night override on deep_night and aurora_surreal
//
// Materials path is intentionally NOT registered for v1. The MaterialId type
// is defined as a placeholder for future presets but no materials register.

// ── PRESET REGISTRY KEYS ──────────────────────────────────────
// Just one preset for v1. Material presets reserved as a future axis.
export type PresetId = 'as_itself'

export type Tier = 'base' | 'premium' | 'signature'

// ── ENVIRONMENT (global selector with preset overrides) ───────
// Mirrors houses LOCATION pattern. Presets can force a specific environment
// via forcedEnvironment, but as_itself accepts user choice.
export type EnvironmentId = 'in_situ' | 'desk' | 'gallery'

export const ENVIRONMENT_LABELS: Record<EnvironmentId, string> = {
  in_situ: 'In Situ',
  desk:    'On Desk',
  gallery: 'Gallery',
}

// ── ATMOSPHERE (global selector) ──────────────────────────────
// The atmospheric character of the scene — light quality, weather, time of
// day mood. Composes into the prompt as a separate block. Some atmospheres
// force time-of-day to night regardless of the user's TOD toggle.
export type AtmosphereId =
  | 'golden'           // warm low-angle late-afternoon sun
  | 'peaceful_dawn'    // first light, mist, contemplative
  | 'vivid_midday'     // peak clarity, saturated, energetic
  | 'dusk_blue_hour'   // warm-cool transition, twilight
  | 'dramatic_storm'   // moody, weather, raw natural power
  | 'deep_night'       // night atmosphere (forced TOD)
  | 'fog_rolled_in'    // heavy diffuse fog, soft falloff
  | 'after_rain'       // wet surfaces, breaking light, freshness
  | 'snow_falling'     // active snowfall, soft luminous
  | 'aurora_surreal'   // night sky aurora (forced TOD)

export const ATMOSPHERE_LABELS: Record<AtmosphereId, string> = {
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

export const ATMOSPHERE_TIER: Record<AtmosphereId, Tier> = {
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

// Atmospheres that override the user's TOD toggle to night.
export const ATMOSPHERE_FORCED_NIGHT: AtmosphereId[] = ['deep_night', 'aurora_surreal']

// v1 UI exposure — only golden is shown in the picker for now while the
// general look is being locked. Other atmospheres are registered and have
// blocks ready, but hidden from selection until validated.
export const ATMOSPHERES_EXPOSED_V1: AtmosphereId[] = ['golden']

// ── SCALE (canvas-relative) ───────────────────────────────────
// How much of the IMAGE CANVAS WIDTH the model+plinth occupies.
// Plinth-internal ratios (scene-on-plinth) are left to NB2.
export type ScaleId = 'close_up' | 'zoom_out'

export const SCALE_LABELS: Record<ScaleId, string> = {
  close_up: 'Close Up',
  zoom_out: 'Zoom Out',
}

export const SCALE_DESCRIPTIONS: Record<ScaleId, string> = {
  close_up: 'subject occupies ~80% of canvas width',
  zoom_out: 'subject occupies ~65% of canvas width',
}

// ── SOURCE PROFILE (operator tag) ─────────────────────────────
// Compensation tag the operator applies on upload, describing the source's
// vertical character. Drives camera angle and the framing language.
//
//   standard    — source has vertical elements (trees, buildings, mountains).
//                 Default. Camera 35–50° above plinth.
//
//   low_profile — source is wide and ground-level (road, beach, field, flat
//                 horizon). NB2 image-to-image preserves source proportions
//                 and tends to fill empty upper canvas with a 2D backdrop
//                 reproduction. Compensation: steeper camera (45–60°),
//                 scale locked to close_up, foreground-as-hero language.
//                 See landscape-blocks.ts buildCameraBlock for details.
export type SourceProfileId = 'standard' | 'low_profile'

export const SOURCE_PROFILE_LABELS: Record<SourceProfileId, string> = {
  standard:    'Standard',
  low_profile: 'Low-profile (flat horizon)',
}

// ── TIME OF DAY ───────────────────────────────────────────────
// Global toggle. Some atmospheres force night via ATMOSPHERE_FORCED_NIGHT.
// Some presets could force TOD via forcedTimeOfDay (none currently do).
export type TimeOfDay = 'day' | 'night'

// ── PRESET DEFINITION ─────────────────────────────────────────
// Mirrors houses-shared.ts Preset shape so the prompt builder can remain
// structurally identical to Houses'. Lighting can be a single block or a
// per-environment override (used when in-situ vs. desk need different
// lighting recipes for the same preset).
export type LightingVariant = {
  id:    string
  label: string
  block: string
}

export type LightingForEnv = string | { variants: LightingVariant[] }

export type Preset = {
  id:                     PresetId
  label:                  string
  tier:                   Tier
  forcedEnvironment?:     EnvironmentId
  forcedTimeOfDay?:       TimeOfDay
  sculptureClause:        string
  styleClause:            string
  materialRule:           string                 // the "what is this made of" block
  lighting:               string                 // default lighting recipe
  lightingByEnvironment?: Partial<Record<EnvironmentId, LightingForEnv>>
}

// ── ASPECT RATIOS (NB2-supported) ─────────────────────────────
// Default '1:1'. NB2 in image-to-image otherwise matches the source ratio,
// which produces inconsistent dimensions — explicitly setting overrides that.
export type AspectRatio =
  | '1:1' | '2:3' | '3:2' | '3:4' | '4:3'
  | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'

export const ASPECT_RATIOS: AspectRatio[] = [
  '1:1', '2:3', '3:2', '3:4', '4:3',
  '4:5', '5:4', '9:16', '16:9', '21:9',
]

// ── REQUEST / RESPONSE ────────────────────────────────────────
// Per-row tolerant batch shape (one row at a time renders in v1; the
// route still wraps in Promise.allSettled to preserve the future
// multi-row contract from the previous architecture).

// Each render row in a request batch.
export type RenderRow = {
  preset_id:         PresetId
  environment_id:    EnvironmentId
  atmosphere_id:     AtmosphereId
  scale_id:          ScaleId
  tod?:              TimeOfDay        // defaults to 'day'; forced-night atmospheres override
  aspect_ratio?:     AspectRatio      // defaults to '1:1'
  source_profile_id?: SourceProfileId // defaults to 'standard'; controls camera/framing compensation
}

// Full request body.
// Multi-image input: NB2 supports up to 14, Google's prompting guide
// recommends fewer; we cap at 4 (1 primary + 3 extras).
export type GenerateRequest = {
  source_image_b64:        string
  additional_images_b64?:  string[]      // up to 3 extras (4 total with primary)
  renders:                 RenderRow[]   // one or more rows; capped at 12

  // Optional analyzer context (when /analyze is wired). Absent in v1
  // since analyzer/curator are disabled; the field is reserved.
  display_name?:           string

  // Pipeline
  expand?:                 boolean       // defaults true; set false to skip outpaint
  notes?:                  string

  // Plaque text — reserved for future. Engine accepts the field but
  // does NOT inject it into the prompt yet (deferred to next round).
  plaque_text?:            string
}

// Per-row result in a batch response.
export type RenderResult = {
  ok:                  boolean
  row_index:           number
  image_b64?:          string
  prompt_used?:        string
  preset_id?:          PresetId
  environment_used?:   EnvironmentId
  atmosphere_used?:    AtmosphereId
  scale_used?:         ScaleId
  time_of_day_used?:   TimeOfDay
  aspect_ratio?:       AspectRatio
  expanded?:           boolean
  duration_ms?:        number
  error?:              string
  warnings?:           string[]
}

// Top-level response from /generate.
export type GenerateResponse =
  | {
      status:     'ok'
      results:    RenderResult[]
      warnings:   Array<{ row_index?: number; message: string }>
    }
  | {
      status:    'deferred'
      job_id:    string
      estimated_minutes: number | null
      message:   'studio_at_capacity'
    }
  | {
      status:  'error'
      error:   string
      errors?: string[]
    }

// ── INTERNAL PARAMS (post-validation, pre-prompt-build) ───────
// Each validated row becomes a LandscapeParams the generator consumes.
export type LandscapeParams = {
  presetId:        PresetId
  environmentId:   EnvironmentId
  atmosphereId:    AtmosphereId
  scaleId:         ScaleId
  tod:             TimeOfDay      // resolved, post forced-night
  aspectRatio:     AspectRatio
  sourceProfileId: SourceProfileId
  rowIndex:        number
  expand:          boolean
  notes?:          string
  // plaque_text intentionally NOT carried through to prompt builder yet
}

// Maximum source images NB2 will receive in a single request.
export const MAX_SOURCE_IMAGES = 4

// Maximum render rows per request — keeps batch latency bounded.
export const MAX_RENDER_ROWS = 12

// ── HELPERS ───────────────────────────────────────────────────
// Returns the actual environment honored, considering preset overrides.
export function resolveEnvironment(
  preset:    Preset,
  requested: EnvironmentId,
): EnvironmentId {
  return preset.forcedEnvironment || requested
}

// Returns the actual time of day honored — preset force, then atmosphere force,
// then user choice. Atmosphere force wins over user choice but loses to preset.
export function resolveTimeOfDay(
  preset:      Preset,
  atmosphere:  AtmosphereId,
  requested:   TimeOfDay,
): TimeOfDay {
  if (preset.forcedTimeOfDay) return preset.forcedTimeOfDay
  if (ATMOSPHERE_FORCED_NIGHT.includes(atmosphere)) return 'night'
  return requested
}

// Returns the available lighting variants for a preset+environment combo,
// or null if no variants are registered (single block lighting).
export function listLightingVariants(
  preset: Preset,
  env:    EnvironmentId,
): LightingVariant[] | null {
  const entry = preset.lightingByEnvironment?.[env]
  if (!entry || typeof entry === 'string') return null
  return entry.variants
}
