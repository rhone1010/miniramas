// app/api/v1/landscapes/generate/route.ts
//
// Per-row tolerant batch endpoint for the Landscape silo.
//
// Architecture: Houses-pattern. NB2-driven. One preset (as_itself) for v1.
// The previous Landscapes architecture (universal { main, optionA, optionB }
// frame, plinthless mode, anti-dome blocks) is fully replaced.
//
// Behavior:
//   - Validator only rejects structural failures. Per-row failures become
//     warnings; the route renders what's valid.
//   - Promise.allSettled — one row's failure doesn't kill the batch.
//   - StudioAtCapacityError → 202 deferred response (per UI contract).
//   - Response shapes (from landscape-shared.GenerateResponse):
//       { status: 'ok',  results: RenderResult[], warnings: [...] }
//       { status: 'error', error, errors: [...] }   // request-level only
//       { status: 'deferred', job_id, ... }         // capacity

import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, rowLabel } from '@/lib/v1/landscape-presets'
import { generateLandscape, StudioAtCapacityError } from '@/lib/v1/landscape-generator'
import { expandLandscape } from '@/lib/v1/landscape-expand'
import type {
  GenerateRequest, GenerateResponse, RenderResult, LandscapeParams,
} from '@/lib/v1/landscape-shared'

export const runtime     = 'nodejs'
export const maxDuration = 120  // NB2 25-40s + outpaint 8-12s + headroom × N rows

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

  // ── STRUCTURAL VALIDATION ───────────────────────────────────
  const validation = validateRequest(body)
  if (!validation.ok) {
    return NextResponse.json<GenerateResponse>(
      { status: 'error', error: 'validation_failed', errors: validation.errors },
      { status: 400 },
    )
  }

  const { rows, warnings } = validation

  // ── ENV ─────────────────────────────────────────────────────
  // Generator dispatches to Replicate (google/nano-banana-2).
  // STABILITY_API_KEY is read directly by expandLandscape from env;
  // missing is non-fatal (image returns unexpanded).
  const replicateApiToken = process.env.REPLICATE_API_TOKEN
  if (!replicateApiToken) {
    return NextResponse.json<GenerateResponse>(
      { status: 'error', error: 'REPLICATE_API_TOKEN not set' },
      { status: 500 },
    )
  }

  // ── PER-ROW DISPATCH (tolerant) ─────────────────────────────
  const settled = await Promise.allSettled(
    rows.map(row =>
      renderOneRow(
        row,
        body.source_image_b64,
        body.additional_images_b64 || [],
        replicateApiToken,
      ),
    ),
  )

  // Pack results in original row order.
  const results: RenderResult[] = settled.map((s, i) => {
    const row = rows[i]
    if (s.status === 'fulfilled') return s.value
    return {
      ok:        false,
      row_index: row.rowIndex,
      error:     errString(s.reason),
    }
  })

  // Capacity check — if ANY row hit capacity, surface as deferred.
  // Capacity always wins because it requires retry/queue handling on UI.
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
    { status: 'ok', results, warnings },
    { status: 200 },
  )
}

// ── PER-ROW WORKER ────────────────────────────────────────────
async function renderOneRow(
  row:                LandscapeParams,
  sourceB64:          string,
  additionalImages:   string[],
  replicateApiToken:  string,
): Promise<RenderResult> {
  const t0       = Date.now()
  const rowIndex = row.rowIndex
  const label    = rowLabel(row)

  try {
    console.log(`[landscapes/generate] row=${rowIndex} dispatching: ${label}`)

    // 1) Generate via NB2
    const generated = await generateLandscape({
      params:              row,
      sourceImageB64:      sourceB64,
      additionalImagesB64: additionalImages,
      replicateApiToken,
    })
    let imageB64 = generated.imageB64
    let expanded = false

    // 2) Expand (non-fatal — keeps unexpanded image on any failure)
    if (row.expand !== false) {
      try {
        const exp = await expandLandscape({ imageB64, expand: true })
        imageB64 = exp.imageB64
        expanded = exp.expanded
      } catch (e: any) {
        console.warn(
          `[landscapes/generate] row=${rowIndex} expand failed (non-fatal): ${e.message}`,
        )
      }
    }

    return {
      ok:                true,
      row_index:         rowIndex,
      image_b64:         imageB64,
      prompt_used:       generated.promptUsed,
      preset_id:         row.presetId,
      environment_used:  generated.environmentUsed,
      atmosphere_used:   row.atmosphereId,
      scale_used:        row.scaleId,
      time_of_day_used:  generated.timeOfDayUsed,
      aspect_ratio:      row.aspectRatio,
      expanded,
      duration_ms:       Date.now() - t0,
    }
  } catch (err: any) {
    // StudioAtCapacityError bubbles up so the route returns 202.
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
