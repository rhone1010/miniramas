// lib/v1/landscapes/landscapes-presets.ts
//
// Singular naming. Validators + registry helpers for the Landscapes silo.
// Aligned with landscape-shared.ts schema.

import {
  SurfaceID, AtmosphereID, MaterialID, EnvironmentID, MainKind, AspectRatio,
  ScaleID, SCALE_LABELS, DEFAULT_SCALE,
  CameraAngleID, CAMERA_ANGLE_LABELS, DEFAULT_CAMERA_ANGLE,
  SceneFeelID, SCENE_FEEL_LABELS, DEFAULT_SCENE_FEEL,
  PlaqueMode, PLAQUE_MODE_LABELS, DEFAULT_PLAQUE_MODE,
  ASPECT_RATIOS,
  MATERIAL_COMPATIBILITY,
  SURFACE_LABELS, ATMOSPHERE_LABELS, MATERIAL_LABELS, ENVIRONMENT_LABELS,
  ATMOSPHERE_TIER, MATERIAL_TIER, SURFACE_TIER,
  GenerateRequest, RenderRow, LandscapeParams,
  rowEditorialNotes,
  // New imports for the LITENCO Production Prompt v1 shim:
  EnvironmentMode, DEFAULT_ENVIRONMENT_MODE,
  migrateAtmosphereID, migrateScaleID, migrateEnvironment, migrateSceneFeelID,
} from './landscapes-shared'
import { resolvePlaque } from './landscapes-plaque'

// ── REGISTRY ENTRIES ──────────────────────────────────────────
export const SURFACES = (Object.keys(SURFACE_LABELS) as SurfaceID[]).map(id => ({
  id, label: SURFACE_LABELS[id], tier: SURFACE_TIER[id],
}))

export const ATMOSPHERES = (Object.keys(ATMOSPHERE_LABELS) as AtmosphereID[]).map(id => ({
  id, label: ATMOSPHERE_LABELS[id], tier: ATMOSPHERE_TIER[id],
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

export const CAMERA_ANGLES = (Object.keys(CAMERA_ANGLE_LABELS) as CameraAngleID[]).map(id => ({
  id, label: CAMERA_ANGLE_LABELS[id],
}))

export const SCENE_FEELS = (Object.keys(SCENE_FEEL_LABELS) as SceneFeelID[]).map(id => ({
  id, label: SCENE_FEEL_LABELS[id],
}))

// ── VALIDATE ──────────────────────────────────────────────────
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

  const rows: LandscapeParams[] = []
  const warnings:  Array<{ row_index: number; message: string }> = []
  const editorial: Array<{ row_index: number; notes: string[]; overridden: boolean }> = []

  for (let i = 0; i < body.renders.length; i++) {
    const r = body.renders[i]
    const rowErrors = validateRowStructural(r)

    if (rowErrors.length) {
      warnings.push({ row_index: i, message: `dropped — ${rowErrors.join('; ')}` })
      continue
    }

    // Resolve plaque per row. Plaque mode + text come from the body (per-source).
    // resolvePlaque() handles sanitization and may demote 'user' → 'off' when
    // the supplied text is empty or metadata-shaped.
    const plaqueResolved = resolvePlaque({
      mode:    body.plaque_mode,
      rawText: body.plaque_text,
    })
    if (plaqueResolved.warning) {
      warnings.push({ row_index: i, message: plaqueResolved.warning })
    }

    const params: LandscapeParams = {
      mainKind:        r.mainKind,
      surface:         r.mainKind === 'surface'  ? (r.main as SurfaceID)  : undefined,
      material:        r.mainKind === 'material' ? (r.main as MaterialID) : undefined,
      // Shim boundary — silently rewrite legacy IDs to current schema:
      atmosphere:      migrateAtmosphereID(r.optionA),
      environment:     migrateEnvironment(r.optionB) as EnvironmentID,
      environmentMode: migrateEnvironment(r.optionB),
      scale:           migrateScaleID(r.scale),
      cameraAngle:     r.cameraAngle || DEFAULT_CAMERA_ANGLE,
      sceneFeel:       migrateSceneFeelID(r.sceneFeel || body.scene_feel),
      aspectRatio,
      displayName:     body.display_name,
      primarySurface:  body.primary_surface,
      dominantSubject: body.dominant_subject,
      hasWater:        body.has_water,
      expand:          body.expand !== false,
      refine:          r.refine !== undefined ? r.refine : (body.refine !== false),
      notes:           body.notes,
      plaqueMode:      plaqueResolved.mode,
      plaqueText:      plaqueResolved.text ?? undefined,
      rowIndex:        i,
    }
    rows.push(params)

    const notes = rowEditorialNotes(r, body.primary_surface)
    if (notes.length) {
      editorial.push({ row_index: i, notes, overridden: r.override_curator === true })
    }
  }

  if (!rows.length) {
    return {
      ok:     false,
      errors: ['all rows failed structural validation', ...warnings.map(w => `row ${w.row_index}: ${w.message}`)],
    }
  }

  return { ok: true, rows, aspectRatio, warnings, editorial }
}

function validateRowStructural(row: RenderRow): string[] {
  const errors: string[] = []

  if (row.mainKind !== 'surface' && row.mainKind !== 'material') {
    errors.push('mainKind must be "surface" or "material"')
    return errors
  }
  if (!row.main)    errors.push('main required')
  if (!row.optionA) errors.push('optionA (atmosphere) required')
  if (!row.optionB) errors.push('optionB (environment) required')

  if (row.scale && !(Object.keys(SCALE_LABELS) as string[]).includes(row.scale)) {
    errors.push(`scale "${row.scale}" is not valid`)
  }
  if (row.cameraAngle && !(Object.keys(CAMERA_ANGLE_LABELS) as string[]).includes(row.cameraAngle)) {
    errors.push(`cameraAngle "${row.cameraAngle}" is not valid`)
  }
  if (row.sceneFeel && !(Object.keys(SCENE_FEEL_LABELS) as string[]).includes(row.sceneFeel)) {
    errors.push(`sceneFeel "${row.sceneFeel}" is not valid`)
  }

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

// ── ROW LABEL HELPER (logging) ────────────────────────────────
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
  parts.push(CAMERA_ANGLE_LABELS[params.cameraAngle])
  parts.push(SCENE_FEEL_LABELS[params.sceneFeel])
  return parts.join(' / ')
}
