// app/api/v1/pets/generate/route.ts
//
// Public generate endpoint for the Pets silo. Mirrors the Portraits
// generate route. Field extraction is EXPLICIT, field-by-field, with
// every engine-schema field read from the body — the Groups/Portraits
// route-schema drift bug (route silently dropping fields the engine
// expected) must not recur here. If a field is added to
// PetsGenerateRequest, it must be added HERE too.

import { NextRequest, NextResponse } from 'next/server'
import { generatePetsRender } from '@/lib/v1/pets/pets-generator'
import { isPetExperimentalEffect } from '@/lib/v1/pets/pets-experimental'
import { PETS_35 } from '@/lib/v1/pets/pets-catalog-35'
import {
  STYLE_MATERIALS,
  STYLE_ENVIRONMENTS,
  ACTION_ORDER,
  type PetsGenerateRequest,
  type PetsStyleId,
  type PetsPresetId,
  type EnvironmentId,
  type ActionId,
  type Scale,
} from '@/lib/v1/pets/pets-shared'

export const runtime     = 'nodejs'
export const maxDuration = 180   // NB2 ~30-60s + scoring + retry + outpaint ~10s

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 },
    )
  }

  // ── Required fields ──────────────────────────────────────────
  const sourceImageB64 = typeof body.source_image_b64 === 'string' ? body.source_image_b64 : ''
  if (!sourceImageB64) {
    return NextResponse.json(
      { ok: false, error: 'source_image_b64 required' },
      { status: 400 },
    )
  }

  // Single style at launch — any style_id coerces to 'realistic'. When
  // pet-specific artistic styles land, validate against STYLE_ORDER here.
  const styleId: PetsStyleId = 'realistic'

  // Curiosities path: a valid experimental_effect bypasses the material
  // pipeline entirely. Detected here so the preset requirement can be
  // skipped for these renders (the effect carries its own staging).
  const rawExperimental = typeof body.experimental_effect === 'string' ? body.experimental_effect : ''
  const experimentalEffect = isPetExperimentalEffect(rawExperimental) ? rawExperimental : undefined

  // ── THE CATALOG IS A THIRD SOURCE OF VALID IDS ───────────────────────
  //
  // PETS_35 holds the thirty-four whole bodies approved on 20 August. They
  // arrive on preset_id like a material does, and the generator resolves
  // the catalog first.
  //
  // Validated here rather than waved through, for the same reason
  // STYLE_MATERIALS is: an unknown id should be a 400 that names what is
  // allowed, not a render of nothing.
  const allowedMaterials = STYLE_MATERIALS[styleId]
  const catalogIds       = Object.keys(PETS_35)
  // Canonical key is preset_id; 'preset' accepted as an alias (the queue
  // UI's internal key). Same below for environment_id / 'environment' /
  // 'location'. Alias tolerance + explicit extraction = no silent drops.
  const rawPreset = body.preset_id ?? body.preset
  const presetId: PetsPresetId | undefined =
    (allowedMaterials.includes(rawPreset) || catalogIds.includes(rawPreset))
      ? rawPreset
      : undefined
  if (!experimentalEffect && !presetId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'unknown preset_id',
        materials: allowedMaterials,
        catalog:   catalogIds,
      },
      { status: 400 },
    )
  }

  // ── Optional fields — read EVERY engine field explicitly ─────
  const allowedEnvs = STYLE_ENVIRONMENTS[styleId]
  const rawEnv = body.environment_id ?? body.environment ?? body.location
  const environmentId: EnvironmentId | undefined =
    allowedEnvs.includes(rawEnv) ? rawEnv : undefined

  // Pose re-staging — validated against the action registry; anything
  // unknown falls through to undefined → engine default (as photographed).
  const actionId: ActionId | undefined =
    ACTION_ORDER.includes(body.action_id) ? body.action_id : undefined

  // 'auto_85' is the frontend's retired-scale marker (UI has no scale
  // control; every render ships with margins). Map it to 'close_up' so
  // the outpaint stage runs.
  const scale: Scale | undefined =
    body.scale === 'fill' ? 'fill'
    : (body.scale === 'close_up' || body.scale === 'auto_85') ? 'close_up'
    : undefined

  const request: PetsGenerateRequest = {
    source_image_b64:      sourceImageB64,
    additional_images_b64: Array.isArray(body.additional_images_b64)
      ? body.additional_images_b64.filter((s: any) => typeof s === 'string').slice(0, 3)
      : undefined,
    style_reference_b64:   typeof body.style_reference_b64 === 'string' ? body.style_reference_b64 : undefined,
    style_id:              styleId,
    preset_id:             presetId,
    experimental_effect:   experimentalEffect,
    environment_id:        environmentId,
    action_id:             actionId,
    scale,
    aspect_ratio:          typeof body.aspect_ratio === 'string' ? body.aspect_ratio : undefined,
    refinements:           body.refinements,
    notes:                 typeof body.notes === 'string' ? body.notes : undefined,
    refinement_tweak:      typeof body.refinement_tweak === 'string' ? body.refinement_tweak : undefined,
    refine:                typeof body.refine === 'boolean' ? body.refine : undefined,
    is_preview:            body.is_preview === true,
    // Plaque contract: undefined → default text, string → verbatim,
    // null → clean unmarked base. Preserve null vs undefined exactly.
    plaque_text:           body.plaque_text === null
      ? null
      : (typeof body.plaque_text === 'string' ? body.plaque_text : undefined),
    advanced:              body.advanced,
  }

  console.log(
    `[pets/generate] style=${request.style_id} ` +
    (request.preset_id && catalogIds.includes(request.preset_id) ? `catalog ` : '') +
    (request.experimental_effect
      ? `curiosity=${request.experimental_effect} `
      : `preset=${request.preset_id} ` +
        `environment=${request.environment_id || '(default)'} action=${request.action_id || 'as_photographed'} scale=${request.scale || '(default)'} `) +
    `sources=${1 + (request.additional_images_b64?.length || 0)} ` +
    (request.experimental_effect ? '' : `plaque=${request.plaque_text === null ? 'none' : request.plaque_text ? 'custom' : 'default'}`),
  )

  const replicateApiToken = process.env.REPLICATE_API_TOKEN
  if (!replicateApiToken) {
    return NextResponse.json(
      { ok: false, error: 'REPLICATE_API_TOKEN not set' },
      { status: 500 },
    )
  }

  const openaiApiKey    = process.env.OPENAI_API_KEY    || undefined
  const stabilityApiKey = process.env.STABILITY_API_KEY || undefined
  if (!openaiApiKey) {
    console.warn('[pets/generate] OPENAI_API_KEY not set — detection and scoring will be skipped')
  }
  if (!stabilityApiKey) {
    console.warn('[pets/generate] STABILITY_API_KEY not set — outpaint margins will be skipped')
  }

  try {
    const result = await generatePetsRender({
      request,
      replicateApiToken,
      openaiApiKey,
      stabilityApiKey,
      refineOverride: typeof body.refine === 'boolean' ? body.refine : undefined,
    })

    // Response log — answers "the backend says it worked but nothing
    // showed on the stage" in one line. If image_kb is non-zero here
    // and the stage is empty, the problem is frontend-side.
    const imageKb = result.image_b64 ? Math.round(result.image_b64.length * 0.75 / 1024) : 0
    console.log(
      `[pets/generate] respond ok=${result.ok} image=${imageKb}KB ` +
      `subjects=${result.subject_count} pass=${result.final_pass} ` +
      `expanded=${result.expanded} duration=${result.duration_ms}ms`,
    )

    // Wrapped as { ok, result } — the queue dispatch reads data.result
    // (Portraits response shape). Keep this wrapper; returning the result
    // flat made the frontend see no image while the backend logged success.
    return NextResponse.json(
      { ok: result.ok, result },
      { status: result.ok ? 200 : 502 },
    )
  } catch (err: any) {
    console.error(`[pets/generate] unhandled: ${err?.message || err}`)
    return NextResponse.json(
      { ok: false, error: err?.message || 'unknown_error' },
      { status: 500 },
    )
  }
}
