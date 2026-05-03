// houses-shared.ts
// lib/v1/houses-shared.ts
//
// Foundational types for the Houses silo. Mirrors the action-minis-shared.ts
// pattern: minimal interfaces + enums, no logic beyond the environment resolver.

// ── MODE AXIS ──────────────────────────────────────────────────
// Three independent selectors, not a matrix. User picks ONE per render.
export type Mode = 'materials' | 'seasons' | 'events'

// ── ENVIRONMENT (global selector with preset overrides) ───────
// Mirrors action-minis LOCATION pattern. Events all force `room_in_house`.
export type EnvironmentId = 'in_situ' | 'desk' | 'room_in_house'

// ── PRESET REGISTRY KEYS ──────────────────────────────────────
// Full v1 catalog: 11 materials + 4 seasons + 5 events = 20 presets.
export type PresetId =
  // materials (11)
  | 'bronze' | 'wax' | 'alabaster' | 'glass'
  | 'gingerbread' | 'watercolor_wood' | 'carved_wood' | 'carved_stone'
  | 'snow_globe' | 'dollhouse' | 'scaled_architectural'
  // seasons (4)
  | 'spring' | 'summer' | 'fall' | 'winter'
  // events (5)
  | 'haunted' | 'fire' | 'explosion' | 'alien' | 'abandoned'

export type Tier = 'base' | 'premium' | 'signature'

// ── PRESET DEFINITION ─────────────────────────────────────────
// A lighting variant — used when a preset offers multiple lighting recipes
// for the same environment (e.g. bronze outdoors with flare-no-orb vs.
// visible-rays). UI shows a variant picker when more than one is registered.
export type LightingVariant = {
  id:    string
  label: string
  block: string
}

// Lighting for a given environment can be either a single block (string)
// or a variant set. Variant set is `{ variants: [...] }` so future fields
// like `default_variant_id` can be added without changing callers.
export type LightingForEnv = string | { variants: LightingVariant[] }

// Every preset registers these fields. The optional `layer` carries
// season-vegetation or event-disaster blocks; materials have no layer.
// `forcedEnvironment` lets events lock to `room_in_house` regardless
// of the user's environment pick.
// `lightingByEnvironment` lets a preset override its default lighting
// recipe based on the resolved environment — used when indoor/outdoor
// staging needs different light treatments (e.g. bronze gallery-haze
// indoors vs. afternoon-sun outdoors). The value can also be a variant
// set if multiple lighting recipes are offered for the same environment.
// ── TIME OF DAY ───────────────────────────────────────────────
// Global toggle. Some presets (haunted, fire, alien, snow_globe) lock
// to night via `forcedTimeOfDay`; the UI hides the toggle for those.
export type TimeOfDay = 'day' | 'night'

// Every preset registers these fields. The optional `layer` carries
// season-vegetation or event-disaster blocks; materials have no layer.
// `forcedEnvironment` lets events lock to `room_in_house` regardless
// of the user's environment pick.
// `forcedTimeOfDay` lets a preset lock day or night regardless of toggle.
// `lightingByEnvironment` lets a preset override its default lighting
// recipe based on the resolved environment — used when indoor/outdoor
// staging needs different light treatments (e.g. bronze gallery-haze
// indoors vs. afternoon-sun outdoors). The value can also be a variant
// set if multiple lighting recipes are offered for the same environment.
export type Preset = {
  id:                     PresetId
  mode:                   Mode
  label:                  string
  tier:                   Tier
  forcedEnvironment?:     EnvironmentId
  forcedTimeOfDay?:       TimeOfDay
  sculptureClause:        string
  styleClause:            string
  materialRule:           string
  lighting:               string
  lightingByEnvironment?: Partial<Record<EnvironmentId, LightingForEnv>>
  layer?:                 string
}

// NB2-supported aspect ratios per Replicate model page.
// Default is '1:1' — overrides NB2's default of matching source image aspect.
export type AspectRatio =
  | '1:1' | '2:3' | '3:2' | '3:4' | '4:3'
  | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'

// ── REQUEST / RESPONSE ────────────────────────────────────────
// Multi-image input: NB2 supports up to 14 reference images, but Google's
// own prompting guide recommends fewer for better stability. We cap at 4 —
// enough for front + back + 2 angles of architectural reference, well
// within the safe range. The primary source_image_b64 stays separate for
// clarity; additional_images_b64 carries the extras.
export type GenerateRequest = {
  source_image_b64:       string
  additional_images_b64?: string[]   // up to 3 extras (4 total with primary)
  preset_id:              PresetId
  environment_id:         EnvironmentId
  lighting_variant_id?:   string
  time_of_day?:           TimeOfDay
  aspect_ratio?:          AspectRatio
  expand?:                boolean
  refinement_tweak?:      string
}

export type GenerateResult = {
  image_b64:           string
  prompt_used:         string
  preset_id:           PresetId
  environment_used:    EnvironmentId
  time_of_day_used:    TimeOfDay
  source_image_count:  number          // count of sources passed to NB2
  lighting_variant_id?: string
  aspect_ratio:        AspectRatio
  expanded:            boolean
  expand_duration_ms?: number
  duration_ms:         number
}

// Maximum source images NB2 will receive in a single request.
export const MAX_SOURCE_IMAGES = 4

// ── HELPERS ───────────────────────────────────────────────────
// Returns the actual environment honored, considering preset overrides.
// Events with a forcedEnvironment will always return that, regardless
// of what the user picked in the UI.
export function resolveEnvironment(
  preset:    Preset,
  requested: EnvironmentId
): EnvironmentId {
  return preset.forcedEnvironment || requested
}

// Returns the actual time of day honored, considering preset overrides.
// Haunted/Fire/Alien/SnowGlobe lock to night regardless of toggle.
export function resolveTimeOfDay(
  preset:    Preset,
  requested: TimeOfDay
): TimeOfDay {
  return preset.forcedTimeOfDay || requested
}

// Returns the available lighting variants for a preset+environment
// combination, or null if no variants are registered (single block).
// UI uses this to decide whether to show a variant picker.
export function listLightingVariants(
  preset: Preset,
  env:    EnvironmentId
): LightingVariant[] | null {
  const entry = preset.lightingByEnvironment?.[env]
  if (!entry || typeof entry === 'string') return null
  return entry.variants
}
