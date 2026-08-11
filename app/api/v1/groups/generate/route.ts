// app/api/v1/groups/generate/route.ts
//
// Single-render endpoint for the Groups silo.
//
// Pipeline (delegated to generateGroupsRender):
//   NB2 generate -> Stability outpaint (8% margin) -> per-figure scoring
//
// The outpaint stage is non-fatal: a failure ships the un-padded image and
// logs the reason.
//
// ── CHANGED 2026-08-10 ─────────────────────────────────────────────────
// style_id is no longer required, or accepted. So are location_id, scale,
// arrangement, subjects, refinements, notes, refinement_tweak, plaque_text
// and experimental_effect — all of which the old route threaded through to
// a prompt builder that ignored most of them.
//
// The request is now: a photograph, an effect, and optionally how many
// people are in it.
//
// preset_id and experimental_effect are still READ, mapped onto effect_id,
// and warned about, so a frontend mid-deploy does not 400. Remove that
// shim once the glass is sending effect_id.

import { NextRequest, NextResponse } from 'next/server'
import { generateGroupsRender } from '@/lib/v1/groups/groups-generator'
import { isGroupsEffectId, GROUPS_EFFECT_IDS } from '@/lib/v1/groups/groups-effects'
import type { GroupsGenerateRequest } from '@/lib/v1/groups/groups-generator'

export const runtime     = 'nodejs'
export const maxDuration = 300   // NB2 + outpaint + scoring, with one retry

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()

    const sourceImageB64: string = body.source_image_b64
    if (!sourceImageB64) {
      return NextResponse.json(
        { error: 'source_image_b64 required' },
        { status: 400 },
      )
    }

    // Legacy field shim — see header.
    const rawEffect =
      body.effect_id ?? body.effect ?? body.experimental_effect ?? body.preset_id ?? body.preset

    if (!rawEffect) {
      return NextResponse.json({ error: 'effect_id required' }, { status: 400 })
    }

    if (!isGroupsEffectId(rawEffect)) {
      return NextResponse.json(
        {
          error: `unknown effect: ${rawEffect}`,
          known: GROUPS_EFFECT_IDS,
        },
        { status: 400 },
      )
    }

    if (!body.effect_id) {
      console.warn(
        `[groups/generate] legacy field used for effect (${rawEffect}) — ` +
        `frontend should send effect_id`,
      )
    }

    const generateRequest: GroupsGenerateRequest = {
      source_image_b64:      sourceImageB64,
      additional_images_b64: body.additional_images_b64 || [],
      effect_id:             rawEffect,
      subject_count:         body.subject_count || undefined,
      aspect_ratio:          body.aspect_ratio || undefined,
      is_preview:            typeof body.is_preview === 'boolean' ? body.is_preview : undefined,
    }

    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN not configured' },
        { status: 500 },
      )
    }

    const openaiApiKey    = process.env.OPENAI_API_KEY    || undefined
    const stabilityApiKey = process.env.STABILITY_API_KEY || undefined

    if (!stabilityApiKey) {
      console.warn('[groups/generate] STABILITY_API_KEY not set — renders will ship without margin')
    }

    console.log(
      `[groups/generate] start effect=${generateRequest.effect_id} ` +
      `aspect=${generateRequest.aspect_ratio || 'auto'} ` +
      `subjects=${generateRequest.subject_count || 'auto'} ` +
      `sources=${1 + (generateRequest.additional_images_b64?.length || 0)}`,
    )

    const result = await generateGroupsRender({
      request: generateRequest,
      replicateApiToken,
      openaiApiKey,
      stabilityApiKey,
    })

    const durationMs = Date.now() - t0
    console.log(
      `[groups/generate] done in ${durationMs}ms — ` +
      `ok=${result.ok} pass=${result.final_pass} ` +
      `attempts=${result.attempts?.length || 0} ` +
      `outpainted=${result.outpainted}` +
      (result.outpaint_skip ? ` outpaint_skip="${result.outpaint_skip}"` : ''),
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
