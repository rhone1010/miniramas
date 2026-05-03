// app/api/v1/landscapes/generate/route.ts
// Per-row tolerant batch endpoint.
//
// Behavior:
//   - Validator only rejects structural failures. Editorial issues (e.g.
//     material + in_situ) come through as warnings, not errors.
//   - Promise.allSettled — one row's failure doesn't kill the batch.
//   - Response shape:
//       { status: 'ok',  results: [{ ok, row_index, image_b64?, error? }],
//         warnings: [...], is_preview }
//       { status: 'error', error, errors: [...] }     // request-level only
//       { status: 'deferred', job_id, ... }           // capacity
//
// Imports point at ./landscapes-* sibling files; adjust paths if your
// folder layout differs.

import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, rowLabel } from '@/lib/v1/landscapes-presets'
import { buildLandscapePrompt }      from '@/lib/v1/landscapes-blocks'
import { generateLandscape, StudioAtCapacityError } from '@/lib/v1/landscapes-generator'
import { expandLandscape }           from '@/lib/v1/landscapes-expand'
import {
  GenerateRequest, GenerateResponse, RenderResult, LandscapeParams,
} from '@/lib/v1/landscapes-shared'

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

  const { rows, warnings, editorial } = validation
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json<GenerateResponse>(
      { status: 'error', error: 'OPENAI_API_KEY not set' },
      { status: 500 },
    )
  }

  // Convert editorial guidance to warnings for the response.
  // If a row was overridden, the warning notes that explicitly.
  for (const e of editorial) {
    for (const note of e.notes) {
      warnings.push({
        row_index: e.row_index,
        message:   e.overridden ? `${note} (overridden by user)` : note,
      })
    }
  }

  // ── PER-ROW DISPATCH (tolerant) ─────────────────────────────
  const settled = await Promise.allSettled(
    rows.map(row => renderOneRow(row, body.source_image_b64, body.extra_images || [], apiKey))
  )

  // Pack results in original row order (rows[].rowIndex preserved).
  const results: RenderResult[] = settled.map((s, i) => {
    const row = rows[i]
    if (s.status === 'fulfilled') return s.value
    return {
      ok:        false,
      row_index: row.rowIndex ?? i,
      error:     errString(s.reason),
    }
  })

  // Capacity check — if ANY row hit capacity, surface that as the response.
  // Capacity always wins because it requires retry/queue handling on the UI side.
  const capacity = settled.find(
    s => s.status === 'rejected' && s.reason instanceof StudioAtCapacityError
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

// ── PER-ROW WORKER ────────────────────────────────────────────
async function renderOneRow(
  row:           LandscapeParams,
  sourceB64:     string,
  extraImages:   string[],
  openaiApiKey:  string,
): Promise<RenderResult> {
  const rowIndex = row.rowIndex ?? 0
  const label    = rowLabel(row)

  try {
    const prompt = buildLandscapePrompt(row)

    console.log(
      `[landscapes/generate] row=${rowIndex} ${label} prompt_chars=${prompt.length}`
    )

    // 1) Generate
    const generated = await generateLandscape({
      sourceImageB64: sourceB64,
      extraImages,
      prompt,
      aspectRatio:    row.aspectRatio,
      openaiApiKey,
    })
    let imageB64 = generated.imageB64

    // 2) Expand (non-fatal — if it fails we keep the unexpanded image)
    if (row.expand !== false) {
      try {
        const expanded = await expandLandscape({ imageB64, openaiApiKey, expand: true })
        if (expanded.imageB64) imageB64 = expanded.imageB64
      } catch (e: any) {
        console.warn(`[landscapes/generate] row=${rowIndex} expand failed (non-fatal): ${e.message}`)
      }
    }

    return {
      ok:          true,
      row_index:   rowIndex,
      image_b64:   imageB64,
      prompt_used: prompt,
    }

  } catch (err: any) {
    // StudioAtCapacityError bubbles up so the route can return 202.
    if (err instanceof StudioAtCapacityError) throw err

    console.error(`[landscapes/generate] row=${rowIndex} failed: ${err?.message || err}`)
    return {
      ok:        false,
      row_index: rowIndex,
      error:     errString(err),
    }
  }
}

function errString(e: any): string {
  if (!e) return 'unknown_error'
  if (typeof e === 'string') return e
  if (e.message) return String(e.message)
  try { return JSON.stringify(e) } catch { return 'unknown_error' }
}
