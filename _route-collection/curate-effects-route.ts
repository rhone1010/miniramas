// app/api/v1/portraits/curate-effects/route.ts
//
// POST /api/v1/portraits/curate-effects
//
// The Effect Curator. Reads the source photo and returns 5 style
// recommendations with per-photo quality levels, with the studio's
// strongest pieces forced into the top slots on a deterministic
// rotation (see portraits-effect-curator.ts → applyHeroRotation).
//
// Request:
//   {
//     "source_image_b64":   "...",
//     "upper_body_concept": "..." | null,   // optional, vestigial
//     "rotation_index":      0               // optional; client-persisted counter
//   }
//
// Response (200): { "ok": true, "recommendations": [...5], "duration_ms": n }
// Response (400/500): { "ok": false, "error": "..." }
//
// The UI (portraits.html → curatorEnterEffects) requires ok === true and a
// non-empty recommendations array; anything else shows the "stumbled" state.

import { NextResponse } from 'next/server'
import { curateEffects } from '@/lib/v1/portraits/portraits-effect-curator'

export const runtime     = 'nodejs'
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
  if (!sourceImageB64) {
    return NextResponse.json(
      { ok: false, error: 'source_image_b64 is required' },
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

  const rotationIndex: number | undefined =
    typeof body?.rotation_index === 'number' ? body.rotation_index : undefined

  try {
    const result = await curateEffects({
      sourceImageB64,
      upperBodyConcept: typeof body?.upper_body_concept === 'string' ? body.upper_body_concept : null,
      openaiApiKey,
      rotationIndex,
    })

    console.log(
      `[portraits/curate-effects] route done in ${Date.now() - t0}ms — ` +
      `count=${result.recommendations.length} rotation=${rotationIndex ?? 'module'}`,
    )

    return NextResponse.json({
      ok:              true,
      recommendations: result.recommendations,
      duration_ms:     result.durationMs,
    })
  } catch (e: any) {
    const msg = e?.message || 'effect curator failed'
    console.error(`[portraits/curate-effects] route error: ${msg}`)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
