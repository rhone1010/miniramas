// lib/v1/landscapes-presets.ts
// Registry helpers + per-row validation against the universal contract.
//
// Validator is now PURELY STRUCTURAL — checks types, IDs, required fields.
// Editorial rules (material+in_situ, surface→material compatibility) are
// handled by the Curator and surfaced through UI guidance, not enforced here.
//
// Per-row failures no longer kill the batch. validateRequest returns valid
// rows + warnings for invalid rows, and the route renders what it can.

import {
  SurfaceID, AtmosphereID, MaterialID, EnvironmentID, TimeOfDay, MainKind, AspectRatio,
  ScaleID, SCALE_LABELS,
  ASPECT_RATIOS, ATMOSPHERE_FORCED_NIGHT,
  MATERIAL_COMPATIBILITY,
  SURFACE_LABELS, ATMOSPHERE_LABELS, MATERIAL_LABELS, ENVIRONMENT_LABELS,
  ATMOSPHERE_TIER, MATERIAL_TIER, SURFACE_TIER,
  GenerateRequest, RenderRow, LandscapeParams, resolveTimeOfDay,
  rowEditorialNotes,
} from './landscapes-shared'

// ── REGISTRY ENTRIES (exported for UI consumption) ────────────
export const SURFACES = (Object.keys(SURFACE_LABELS) as SurfaceID[]).map(id => ({
  id, label: SURFACE_LABELS[id], tier: SURFACE_TIER[id],
}))

export const ATMOSPHERES = (Object.keys(ATMOSPHERE_LABELS) as AtmosphereID[]).map(id => ({
  id, label: ATMOSPHERE_LABELS[id], tier: ATMOSPHERE_TIER[id],
  forcedNight: ATMOSPHERE_FORCED_NIGHT.includes(id),
}))

export const MATERIALS = (Object.keys(MATERIAL_LABELS) as MaterialID[]).map(id => ({
  id, label: MATERIAL_LABELS[id], tier: MATERIAL_TIER[id],
  compatibleSurfaces: (Object.keys(MATERIAL_COMPATIBILITY) as SurfaceID[])
    .filter(s => MATERIAL_COMPATIBILITY[s].includes(id)),
}))

export const ENVIRONMENTS = (Object.keys(ENVIRONMENT_LABELS) as EnvironmentID[]).map(id => ({
  id, label: ENVIRONMENT_LABELS[id], tier: 'base' as const,
}))

export const SCALES = (Object.keys(SCALE_LABELS) as ScaleID[]).map(id => ({
  id, label: SCALE_LABELS[id],
}))

// ── VALIDATE ──────────────────────────────────────────────────
// New shape: returns BOTH valid rows AND per-row warnings.
// The route renders the valid rows and includes warnings in the response,
// rather than bailing on the whole request when one row is broken.
//
// Hard errors (returns ok: false) only fire for request-level failures:
//   - missing source_image_b64
//   - missing/empty renders[]
//   - all rows malformed
// Per-row structural failures become warnings; the row is dropped.
export type ValidationResult =
  | {
      ok:          true
      rows:        LandscapeParams[]
      aspectRatio: AspectRatio
      warnings:    Array<{ row_index: number; message: string }>
      editorial:   Array<{ row_index: number; notes: string[]; overridden: boolean }>
    }
  | {
      ok:     false
      errors: string[]
    }

export function validateRequest(body: GenerateRequest): ValidationResult {
  const errors: string[] = []

  if (!body.source_image_b64) errors.push('source_image_b64 required')
  if (!Array.isArray(body.renders)) errors.push('renders[] required')
  else if (!body.renders.length)    errors.push('renders[] must contain at least one row')
  else if (body.renders.length > 12) errors.push('renders[] capped at 12 rows per request')

  if (errors.length) return { ok: false, errors }

  const aspectRatio: AspectRatio = ASPECT_RATIOS.includes(body.aspect_ratio as AspectRatio)
    ? body.aspect_ratio as AspectRatio
    : '1:1'

  // Per-row validation. Invalid rows become warnings, not fatal errors.
  const rows: LandscapeParams[] = []
  const warnings:  Array<{ row_index: number; message: string }> = []
  const editorial: Array<{ row_index: number; notes: string[]; overridden: boolean }> = []

  for (let i = 0; i < body.renders.length; i++) {
    const r = body.renders[i]
    const rowErrors = validateRowStructural(r)

    if (rowErrors.length) {
      warnings.push({
        row_index: i,
        message:   `dropped — ${rowErrors.join('; ')}`,
      })
      continue
    }

    const params: LandscapeParams = {
      mainKind:        r.mainKind,
      surface:         r.mainKind === 'surface' ? (r.main as SurfaceID) : undefined,
      material:        r.mainKind === 'material' ? (r.main as MaterialID) : undefined,
      atmosphere:      r.optionA,
      environment:     r.optionB,
      tod:             resolveTimeOfDay({ atmosphere: r.optionA, tod: r.tod }),
      scale:           r.scale || 'composed',
      aspectRatio,
      displayName:        body.display_name,
      primarySurface:     body.primary_surface,
      dominantSubject:    body.dominant_subject,
      hasWater:           body.has_water,
      expand:             body.expand !== false,
      notes:              body.notes,
      plaqueText:         body.plaque_text,
      rowIndex:           i,
    }
    rows.push(params)

    // Editorial notes are advisory — included in response, not blocking.
    const notes = rowEditorialNotes(r, body.primary_surface)
    if (notes.length) {
      editorial.push({
        row_index:  i,
        notes,
        overridden: r.override_curator === true,
      })
    }
  }

  // If every row failed structural validation, treat as request-level failure.
  if (!rows.length) {
    return {
      ok:     false,
      errors: ['all rows failed structural validation', ...warnings.map(w => `row ${w.row_index}: ${w.message}`)],
    }
  }

  return { ok: true, rows, aspectRatio, warnings, editorial }
}

// Structural validation only — types, required fields, known IDs.
// Does NOT enforce editorial rules. Editorial guidance is the Curator's job.
function validateRowStructural(row: RenderRow): string[] {
  const errors: string[] = []

  if (row.mainKind !== 'surface' && row.mainKind !== 'material') {
    errors.push('mainKind must be "surface" or "material"')
    return errors
  }
  if (!row.main)    errors.push('main required')
  if (!row.optionA) errors.push('optionA (atmosphere) required')
  if (!row.optionB) errors.push('optionB (environment) required')
  if (!row.tod)     errors.push('tod required')

  // Scale is optional in the wire request — defaults to composed in params assembly.
  if (row.scale && !(Object.keys(SCALE_LABELS) as string[]).includes(row.scale)) {
    errors.push(`scale "${row.scale}" is not valid`)
  }

  // Validate against dictionaries
  if (row.mainKind === 'surface' && !(Object.keys(SURFACE_LABELS) as string[]).includes(row.main as string)) {
    errors.push(`main "${row.main}" is not a valid surface`)
  }
  if (row.mainKind === 'material' && !(Object.keys(MATERIAL_LABELS) as string[]).includes(row.main as string)) {
    errors.push(`main "${row.main}" is not a valid material`)
  }
  if (row.optionA && !(Object.keys(ATMOSPHERE_LABELS) as string[]).includes(row.optionA)) {
    errors.push(`optionA "${row.optionA}" is not a valid atmosphere`)
  }
  if (row.optionB && !(Object.keys(ENVIRONMENT_LABELS) as string[]).includes(row.optionB)) {
    errors.push(`optionB "${row.optionB}" is not a valid environment`)
  }

  return errors
}

// ── PRESET LABEL HELPER ───────────────────────────────────────
// For logging — what's the human-readable name of this row?
export function rowLabel(params: LandscapeParams): string {
  const parts: string[] = []
  if (params.mainKind === 'surface' && params.surface) {
    parts.push(SURFACE_LABELS[params.surface])
  }
  if (params.mainKind === 'material' && params.material) {
    parts.push(MATERIAL_LABELS[params.material])
  }
  parts.push(ATMOSPHERE_LABELS[params.atmosphere])
  parts.push(ENVIRONMENT_LABELS[params.environment])
  parts.push(SCALE_LABELS[params.scale])
  parts.push(params.tod)
  return parts.join(' / ')
}
