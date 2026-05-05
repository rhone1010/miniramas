// landscape-presets.ts
// lib/v1/landscape-presets.ts
//
// Registry of all preset definitions + structural validator.
//
// v1 catalog: just one preset registered (as_itself). Material presets
// reserved as a future axis. The architecture supports adding them later
// without changing the prompt builder or the route.

import type {
  Preset, PresetId, EnvironmentId, AtmosphereId, ScaleId, TimeOfDay,
  AspectRatio, RenderRow, GenerateRequest, LandscapeParams,
} from './landscape-shared'
import {
  ENVIRONMENT_LABELS, ATMOSPHERE_LABELS, SCALE_LABELS,
  ASPECT_RATIOS, ATMOSPHERE_FORCED_NIGHT, MAX_RENDER_ROWS,
  resolveTimeOfDay,
} from './landscape-shared'
import {
  MATERIAL_AS_ITSELF, LIGHTING_AS_ITSELF,
} from './landscape-blocks'

// ── SCULPTURE CLAUSE (shared across all presets) ──────────────
// Locks output as a photographed physical object — not a painting,
// illustration, or 2D render. Same pattern as Houses and Action Minis.
const SCULPTURE_CLAUSE =
  'Photograph of a real physical 3D scale model landscape, three-dimensional and tangible, lit and shadowed as an actual object in space.'

// ── REGISTRY ──────────────────────────────────────────────────
// Single preset registered for v1.
//
// `forcedEnvironment` — none for v1; as_itself accepts user choice
// `forcedTimeOfDay`   — none for v1; TOD resolved from atmosphere + user
//
// Tiers (cosmetic, for UI emphasis):
//   signature: most distinctive, hero-treatment renders
//   premium  : strong but not flagship
//   base     : everyday
export const PRESETS: Record<PresetId, Preset> = {
  as_itself: {
    id:               'as_itself',
    label:            'As Itself',
    tier:             'base',
    sculptureClause:  SCULPTURE_CLAUSE,
    styleClause:      'A handcrafted miniature of this specific place using realistic miniature materials — sculpted resin, miniature foliage, scale water, painted terrain — preserving the place\'s defining surfaces, colors, and character.',
    materialRule:     MATERIAL_AS_ITSELF,
    lighting:         LIGHTING_AS_ITSELF,
  },
}

// ── REGISTRY HELPERS ──────────────────────────────────────────
export function getPreset(id: PresetId): Preset {
  const p = PRESETS[id]
  if (!p) throw new Error(`unknown preset: ${id}`)
  return p
}

export function listPresets(): Preset[] {
  return Object.values(PRESETS)
}

// Set of valid preset IDs for validator lookup.
const VALID_PRESET_IDS = new Set<string>(Object.keys(PRESETS))

// ── VALIDATOR ─────────────────────────────────────────────────
// Structural validation only. No editorial rules. Per-row failures become
// warnings; the route renders what's valid and reports what was dropped.
//
// Returns:
//   - { ok: true, rows: LandscapeParams[], warnings: [...] } when at
//     least one row passes structural validation
//   - { ok: false, errors: [...] } when the request is malformed at
//     the request level OR every row fails structural validation

export type ValidationResult =
  | {
      ok:        true
      rows:      LandscapeParams[]
      warnings:  Array<{ row_index: number; message: string }>
    }
  | {
      ok:     false
      errors: string[]
    }

export function validateRequest(body: GenerateRequest): ValidationResult {
  const errors: string[] = []

  // Request-level validation
  if (!body.source_image_b64)         errors.push('source_image_b64 required')
  if (!Array.isArray(body.renders))   errors.push('renders[] required')
  else if (!body.renders.length)      errors.push('renders[] must contain at least one row')
  else if (body.renders.length > MAX_RENDER_ROWS) {
    errors.push(`renders[] capped at ${MAX_RENDER_ROWS} rows per request`)
  }

  if (errors.length) return { ok: false, errors }

  // Per-row validation
  const rows: LandscapeParams[] = []
  const warnings: Array<{ row_index: number; message: string }> = []

  for (let i = 0; i < body.renders.length; i++) {
    const r = body.renders[i]
    const rowErrors = validateRow(r)

    if (rowErrors.length) {
      warnings.push({ row_index: i, message: `dropped — ${rowErrors.join('; ')}` })
      continue
    }

    const preset       = getPreset(r.preset_id)
    const requestedTod = r.tod || 'day'
    const resolvedTod  = resolveTimeOfDay(preset, r.atmosphere_id, requestedTod)
    const aspectRatio: AspectRatio = (r.aspect_ratio && ASPECT_RATIOS.includes(r.aspect_ratio))
      ? r.aspect_ratio
      : '1:1'
    const sourceProfileId = (r.source_profile_id === 'low_profile') ? 'low_profile' : 'standard'

    rows.push({
      presetId:        r.preset_id,
      environmentId:   r.environment_id,
      atmosphereId:    r.atmosphere_id,
      scaleId:         r.scale_id,
      tod:             resolvedTod,
      aspectRatio,
      sourceProfileId,
      rowIndex:        i,
      expand:          body.expand !== false,
      notes:           body.notes,
    })
  }

  // Every row failed structural validation → request-level failure
  if (!rows.length) {
    return {
      ok:     false,
      errors: ['all rows failed structural validation', ...warnings.map(w => `row ${w.row_index}: ${w.message}`)],
    }
  }

  return { ok: true, rows, warnings }
}

// Structural row validation — types, required fields, known IDs.
function validateRow(row: RenderRow): string[] {
  const errs: string[] = []

  if (!row.preset_id) {
    errs.push('preset_id required')
  } else if (!VALID_PRESET_IDS.has(row.preset_id)) {
    errs.push(`preset_id "${row.preset_id}" is not registered`)
  }

  if (!row.environment_id) {
    errs.push('environment_id required')
  } else if (!(Object.keys(ENVIRONMENT_LABELS) as string[]).includes(row.environment_id)) {
    errs.push(`environment_id "${row.environment_id}" is not valid`)
  }

  if (!row.atmosphere_id) {
    errs.push('atmosphere_id required')
  } else if (!(Object.keys(ATMOSPHERE_LABELS) as string[]).includes(row.atmosphere_id)) {
    errs.push(`atmosphere_id "${row.atmosphere_id}" is not valid`)
  }

  if (!row.scale_id) {
    errs.push('scale_id required')
  } else if (!(Object.keys(SCALE_LABELS) as string[]).includes(row.scale_id)) {
    errs.push(`scale_id "${row.scale_id}" is not valid`)
  }

  if (row.tod && row.tod !== 'day' && row.tod !== 'night') {
    errs.push(`tod "${row.tod}" must be "day" or "night"`)
  }

  if (row.aspect_ratio && !ASPECT_RATIOS.includes(row.aspect_ratio)) {
    errs.push(`aspect_ratio "${row.aspect_ratio}" is not valid`)
  }

  return errs
}

// ── ROW LABEL — for logging ───────────────────────────────────
export function rowLabel(params: LandscapeParams): string {
  const preset      = getPreset(params.presetId)
  const parts: string[] = [
    preset.label,
    ATMOSPHERE_LABELS[params.atmosphereId],
    ENVIRONMENT_LABELS[params.environmentId],
    SCALE_LABELS[params.scaleId],
    params.tod,
  ]
  return parts.join(' / ')
}
