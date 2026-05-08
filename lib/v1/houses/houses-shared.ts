// houses-shared.ts
// lib/v1/houses-shared.ts
//
// Foundational types for the Houses silo. Mirrors the action-minis-shared.ts
// pattern: minimal interfaces + enums, no logic beyond the environment resolver.

// ── MODE AXIS ──────────────────────────────────────────────────
// Three independent selectors, not a matrix. User picks ONE per render.
export type Mode = 'materials' | 'seasons' | 'events'

// ── ENVIRONMENT (global selector) ─────────────────────────────
// Two environments. Internal ID 'in_situ' is stable; UI label is
// "In Environment".
//
// All three modes (materials, seasons, events) can use either environment.
// The 'desk' default works universally; 'in_situ' (outdoors on the actual
// lawn of the actual house) works for materials too — a bronze sculpture
// or limestone carving sitting on the real lawn with the real house in the
// background reads beautifully.
//
// 'room_in_house' as a separate selector has been retired — but the
// "diorama's world extends to the surrounding scene" pattern is preserved
// in the per-preset LAYER blocks (the desk's room takes on the diorama's
// mood, the outdoor yard takes on the diorama's mood — bleed-through
// is what makes events feel like events).
//
// Events used to force room_in_house — they now default to whatever the
// user picks. UI should default events to 'desk' (most common case).
export type EnvironmentId = 'in_situ' | 'desk'

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

// ── TIME OF DAY ───────────────────────────────────────────────
// Global toggle. Some presets (haunted, fire, alien, snow_globe) lock
// to night via `forcedTimeOfDay`; the UI hides the toggle for those.
export type TimeOfDay = 'day' | 'night'

// Every preset registers these fields. The optional `layer` carries
// season-vegetation or event-disaster blocks; materials have no layer.
// `forcedEnvironment` is retained on the type but events no longer use
// it (room_in_house retired). Left for future presets that may need it.
// `forcedTimeOfDay` lets a preset lock day or night regardless of toggle.
// `lightingByEnvironment` lets a preset override its default lighting
// recipe based on the resolved environment.
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
// enough for front + back + 2 angles of architectural reference.
//
// `refine` (Pass 2) is opt-IN by default during the rollout. When the
// pilot completes and the lift is validated, default may flip to opt-out.
// Pass 2 requires `openai_api_key` to be passed to generateHouse — when
// refine is true and the key is missing, the stage logs and is skipped.
export type GenerateRequest = {
  source_image_b64:       string
  additional_images_b64?: string[]   // up to 3 extras (4 total with primary)
  preset_id:              PresetId
  environment_id:         EnvironmentId
  lighting_variant_id?:   string
  time_of_day?:           TimeOfDay
  aspect_ratio?:          AspectRatio
  expand?:                boolean
  refine?:                boolean
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
  refined:             boolean
  refine_duration_ms?: number
  refine_prompt_used?: string
  expanded:            boolean
  expand_duration_ms?: number
  duration_ms:         number
}

// Maximum source images NB2 will receive in a single request.
export const MAX_SOURCE_IMAGES = 4

// ── HELPERS ───────────────────────────────────────────────────
// Returns the actual environment honored, considering preset overrides.
//
// Order of precedence:
//   1. preset.forcedEnvironment (snow_globe forces 'desk' to preserve its
//      curated indoor atmosphere; other presets currently free)
//   2. requested (user's pick — both desk and in_situ are valid for
//      every preset that doesn't force)
export function resolveEnvironment(
  preset:    Preset,
  requested: EnvironmentId
): EnvironmentId {
  if (preset.forcedEnvironment) return preset.forcedEnvironment
  return requested
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
