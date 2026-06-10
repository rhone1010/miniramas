// app/api/v1/groups/generate/route.ts
//
// Single-render endpoint for the Groups silo (Realistic, People Resolving,
// Tribal Wall Masks, Tribal Statue).
// Pipeline (delegated to generateGroupsRender):
//   Pass 1 (NB2 or gpt-image-1 per style) → Pass 2 refine (Realistic / Resolving)
//   → faceswap (non-Tribal) → Stability outpaint (when scale = close_up).
// Each post-stage is non-fatal — if a stage fails the result keeps the prior
// stage's image and continues.

import { NextRequest, NextResponse } from 'next/server'
import { generateGroupsRender } from '@/lib/v1/groups/groups-generator'
import type {
  GroupsStyleId,
  GroupsPresetId,
  LocationId,
  Scale,
  GroupArrangement,
  GroupsGenerateRequest,
} from '@/lib/v1/groups/groups-shared'

export const runtime     = 'nodejs'
export const maxDuration = 300   // seconds — full Groups pipeline can take a few minutes

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()

    // ── Field mapping ─────────────────────────────────────────
    // Frontend sends compact names (preset, location). Internal Generator
    // expects the canonical names (preset_id, location_id). Accept either.
    const sourceImageB64: string =
      body.source_image_b64

    if (!sourceImageB64) {
      return NextResponse.json(
        { error: 'source_image_b64 required' },
        { status: 400 },
      )
    }

    const styleId:  GroupsStyleId  = body.style_id
    const presetId: GroupsPresetId = body.preset_id ?? body.preset
    const location: LocationId | undefined =
      body.location_id ?? body.location

    if (!styleId)  return NextResponse.json({ error: 'style_id required'  }, { status: 400 })
    if (!presetId) return NextResponse.json({ error: 'preset_id required' }, { status: 400 })

    const generateRequest: GroupsGenerateRequest = {
      source_image_b64:       sourceImageB64,
      additional_images_b64:  body.additional_images_b64 || [],
      style_reference_b64:    body.style_reference_b64 || undefined,
      style_id:               styleId,
      preset_id:              presetId,
      location_id:            location,
      scale:                  (body.scale as Scale) || 'close_up',
      aspect_ratio:           body.aspect_ratio || undefined,
      arrangement:            body.arrangement as GroupArrangement | undefined,
      subjects:               body.subjects || undefined,
      subject_count:          body.subject_count || undefined,
      refinements:            body.refinements || undefined,
      notes:                  body.notes || undefined,
      refinement_tweak:       body.refinement_tweak || undefined,
      refine:                 typeof body.refine === 'boolean' ? body.refine : undefined,
      is_preview:             typeof body.is_preview === 'boolean' ? body.is_preview : undefined,
    }

    // ── Env ────────────────────────────────────────────────────
    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN not configured' },
        { status: 500 },
      )
    }
    const openaiApiKey    = process.env.OPENAI_API_KEY    || undefined
    const stabilityApiKey = process.env.STABILITY_API_KEY || undefined

    console.log(
      `[groups/generate] start style=${styleId} preset=${presetId} ` +
      `location=${location || 'auto'} scale=${generateRequest.scale} ` +
      `aspect=${generateRequest.aspect_ratio || 'default'} ` +
      `subjects=${generateRequest.subject_count || 'auto'}` +
      (generateRequest.refinement_tweak ? ` tweak="${generateRequest.refinement_tweak.slice(0, 60)}…"` : ''),
    )

    // ── Run the pipeline ─────────────────────────────────────
    const result = await generateGroupsRender({
      request:           generateRequest,
      replicateApiToken,
      openaiApiKey,
      stabilityApiKey,
      refineOverride:    typeof body.refine === 'boolean' ? body.refine : undefined,
    })

    const durationMs = Date.now() - t0
    console.log(
      `[groups/generate] done in ${durationMs}ms — ` +
      `ok=${result.ok} final_pass=${result.final_pass} ` +
      `attempts=${result.attempts?.length || 0} ` +
      `refined=${result.refined} expanded=${result.expanded} swapped=${result.swapped}`,
    )

    return NextResponse.json({ result })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    const durationMs = Date.now() - t0
    console.error(`[groups/generate] failed in ${durationMs}ms: ${msg}`)
    return NextResponse.json(
      { error: msg, duration_ms: durationMs },
      { status: 500 },
    )
  }
}
