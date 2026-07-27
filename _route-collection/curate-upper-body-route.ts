// app/api/v1/portraits/curate-upper-body/route.ts
//
// POST /api/v1/portraits/curate-upper-body
//
// Phase 1 of the Curated Guess Mode — Upper Body Reconstruction flow.
// When analyzeSourceSet returns body_coverage='face_only', the user is
// presented with three Curator-generated upper-body concepts before the
// /generate call fires. This endpoint generates that set of three.
//
// Request:
//   {
//     "source_image_b64": "...",
//     "style_id":         "realistic" | "artists_gallery",
//     "preset_id":        "...",
//     "round":            1 | 2,
//     "rejected_labels":  ["concept_1_label", "concept_2_label", ...]  // optional, round 2 only
//   }
//
// Response (200):
//   {
//     "ok":          true,
//     "concepts":    [{ id, label, description }, ...],
//     "round":       1 | 2,
//     "duration_ms": 2400
//   }
//
// Response (400/500): { "ok": false, "error": "..." }

import { NextResponse } from 'next/server'
import { curateUpperBody } from '@/lib/v1/portraits/portraits-curator'
import type { PortraitsStyleId, PortraitsPresetId } from '@/lib/v1/portraits/portraits-shared'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const t0 = Date.now()
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const sourceImageB64: string = body?.source_image_b64 || ''
  const styleId:        PortraitsStyleId  = body?.style_id
  const presetId:       PortraitsPresetId = body?.preset_id
  const round:          1 | 2 = body?.round === 2 ? 2 : 1
  const rejectedLabels: string[] = Array.isArray(body?.rejected_labels)
    ? body.rejected_labels.filter((s: any) => typeof s === 'string').slice(0, 10)
    : []

  if (!sourceImageB64) {
    return NextResponse.json(
      { ok: false, error: 'source_image_b64 is required' },
      { status: 400 },
    )
  }
  if (!styleId || !presetId) {
    return NextResponse.json(
      { ok: false, error: 'style_id and preset_id are required' },
      { status: 400 },
    )
  }

  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    return NextResponse.json(
      { ok: false, error: 'OPENAI_API_KEY missing on server' },
      { status: 500 },
    )
  }

  try {
    const result = await curateUpperBody({
      sourceImageB64,
      styleId,
      presetId,
      round,
      rejectedLabels,
      openaiApiKey,
    })

    console.log(
      `[portraits/curate] route done in ${Date.now() - t0}ms — ` +
      `style=${styleId} preset=${presetId} round=${round} ` +
      `concepts=${result.concepts.length}`,
    )

    return NextResponse.json({
      ok:          true,
      concepts:    result.concepts,
      round:       result.round,
      duration_ms: result.durationMs,
    })

  } catch (e: any) {
    const msg = e?.message || 'curator failed'
    console.error(`[portraits/curate] route error: ${msg}`)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
