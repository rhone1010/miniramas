// app/api/v1/landscapes/generate/route.ts
//
// Per-row tolerant batch endpoint for the Landscape silo.
// Pipeline: NB2 generate → GPT-image-1 refine → expand (Stability outpaint).
// Each post-stage is non-fatal — if refine or expand throws, the row keeps
// the previous stage's image and continues.

import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, rowLabel }                from '@/lib/v1/landscapes/landscape-presets'
import { generateLandscape, StudioAtCapacityError } from '@/lib/v1/landscapes/landscape-generator'
import { refineLandscape }                          from '@/lib/v1/landscapes/landscape-refine'
import { expandLandscape }                          from '@/lib/v1/landscapes/landscape-expand'
import type {
  GenerateRequest, GenerateResponse, RenderResult, LandscapeParams,
} from '@/lib/v1/landscapes/landscape-shared'

export const runtime     = 'nodejs'
export const maxDuration = 180   // raised: 2-pass pipeline (NB2 ~30-60s + GPT-image-1 ~15-30s + expand ~10s)

export async function POST(req: NextRequest) {
  let body: GenerateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json<GenerateResponse>(
      { status: 'error', error: 'invalid_json' },
      { status: 400 },
    )
  }

  const validation = validateRequest(body)
  if (!validation.ok) {
    return NextResponse.json<GenerateResponse>(
      { status: 'error', error: 'validation_failed', errors: validation.errors },
      { status: 400 },
    )
  }

  const { rows, warnings } = validation

  const replicateApiToken = process.env.REPLICATE_API_TOKEN
  if (!replicateApiToken) {
    return NextResponse.json<GenerateResponse>(
      { status: 'error', error: 'REPLICATE_API_TOKEN not set' },
      { status: 500 },
    )
  }

  // OPENAI_API_KEY is needed for Pass 2 refine.
  // If absent, refine is skipped per-row (warning logged, NB2 output used).
  const openaiApiKey = process.env.OPENAI_API_KEY || ''
  if (!openaiApiKey) {
    console.warn('[landscapes/generate] OPENAI_API_KEY not set — Pass 2 refine will be skipped for all rows')
  }

  // Refine flag — default true. Set body.refine === false to skip Pass 2 globally.
  const globalRefine = body.refine !== false

  const settled = await Promise.allSettled(
    rows.map(row =>
      renderOneRow(
        row,
        body.source_image_b64,
        body.extra_images || [],
        replicateApiToken,
        openaiApiKey,
        globalRefine,
      ),
    ),
  )

  const results: RenderResult[] = settled.map((s, i) => {
    const row = rows[i]
    if (s.status === 'fulfilled') return s.value
    return {
      ok:        false,
      row_index: row.rowIndex ?? i,
      error:     errString(s.reason),
    }
  })

  const capacity = settled.find(
    s => s.status === 'rejected' && s.reason instanceof StudioAtCapacityError,
  )
  if (capacity) {
    const job_id = `defer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    return NextResponse.json<GenerateResponse>(
      { status: 'deferred', job_id, estimated_minutes: null, message: 'studio_at_capacity' },
      { status: 202 },
    )
  }

  return NextResponse.json<GenerateResponse>(
    {
      status:     'ok',
      results,
      warnings,
      is_preview: body.is_preview === true,
    },
    { status: 200 },
  )
}

async function renderOneRow(
  row:                LandscapeParams,
  sourceB64:          string,
  additionalImages:   string[],
  replicateApiToken:  string,
  openaiApiKey:       string,
  globalRefine:       boolean,
): Promise<RenderResult> {
  const t0       = Date.now()
  const rowIndex = row.rowIndex ?? 0
  const label    = rowLabel(row)

  try {
    console.log(`[landscapes/generate] row=${rowIndex} dispatching: ${label}`)

    // ── PASS 1 — NB2 generate (structure/composition) ──────
    const generated = await generateLandscape({
      params:              row,
      sourceImageB64:      sourceB64,
      additionalImagesB64: additionalImages,
      replicateApiToken,
    })
    let imageB64 = generated.imageB64
    let refined  = false
    let expanded = false

    // ── PASS 2 — GPT-image-1 refine (realism/material) ─────
    // Non-fatal: if it fails, keep Pass 1 output and continue to expand.
    const wantRefine = globalRefine && row.refine !== false && Boolean(openaiApiKey)
    if (wantRefine) {
      try {
        const r = await refineLandscape({
          imageB64,
          aspectRatio:  row.aspectRatio,
          plaqueMode:   row.plaqueMode,
          plaqueText:   row.plaqueText,
          openaiApiKey,
        })
        imageB64 = r.imageB64
        refined  = true
      } catch (e: any) {
        console.warn(
          `[landscapes/generate] row=${rowIndex} refine failed (non-fatal, keeping Pass 1 output): ${e?.message || e}`,
        )
      }
    } else if (globalRefine && !openaiApiKey) {
      // Already warned at request-level; per-row warn helps diagnostic.
      console.warn(`[landscapes/generate] row=${rowIndex} refine skipped: no OPENAI_API_KEY`)
    }

    // ── EXPAND — Stability outpaint ────────────────────────
    if (row.expand !== false) {
      try {
        const exp = await expandLandscape({
          imageB64,
          expand: true,
          scale:  row.scale,
        })
        imageB64 = exp.imageB64
        expanded = exp.expanded
      } catch (e: any) {
        console.warn(
          `[landscapes/generate] row=${rowIndex} expand failed (non-fatal): ${e.message}`,
        )
      }
    }

    return {
      ok:                 true,
      row_index:          rowIndex,
      image_b64:          imageB64,
      prompt_used:        generated.promptUsed,
      main_kind:          row.mainKind,
      main_id:            row.mainKind === 'surface' ? row.surface : row.material,
      atmosphere_used:    row.atmosphere,
      environment_used:   row.environment,
      scale_used:         row.scale,
      camera_angle_used:  row.cameraAngle,
      fidelity_used:      row.fidelity,
      plaque_mode_used:   row.plaqueMode,
      plaque_text_used:   row.plaqueText,
      time_of_day_used:   row.tod,
      aspect_ratio:       row.aspectRatio,
      refined,
      expanded,
      duration_ms:        Date.now() - t0,
    }
  } catch (err: any) {
    if (err instanceof StudioAtCapacityError) throw err

    console.error(
      `[landscapes/generate] row=${rowIndex} failed: ${err?.message || err}`,
    )
    return {
      ok:          false,
      row_index:   rowIndex,
      error:       errString(err),
      duration_ms: Date.now() - t0,
    }
  }
}

function errString(e: any): string {
  if (!e) return 'unknown_error'
  if (typeof e === 'string') return e
  if (e.message) return String(e.message)
  try { return JSON.stringify(e) } catch { return 'unknown_error' }
}
