// app/api/v1/halloween/generate/route.ts
//
// HALLOWEEN ON LITENCO MAIN - generate endpoint. 1:1, NB2.
//
// Field extraction is EXPLICIT, field-by-field. The Groups/Portraits
// route-schema drift bug - a route silently dropping fields the engine
// expected - is the reason. If a field is added to
// HalloweenGenerateRequest it must be added HERE too.
//
// ── THE ROOM IS SMALL ON PURPOSE ───────────────────────────────────────
//
// One required field beyond the photograph: effect_id. There is no
// material, no environment, no pose, no scale, no plaque and no framing
// choice, because each of the 28 bodies already carries its own background
// and staging and the framing is one appended constant.
//
// If a control is ever added here, add it to the engine first and let it
// arrive on a named field. A route that quietly reshapes a request is how
// the drift bug happened.
//
// ── NOT WIRED TO THE WALLPAPER REGISTRY, DELIBERATELY ──────────────────
//
// wallpapers-registry.ts merges 103 ids across four rooms and owns
// buildWallpaperPrompt. Verified 20 August: nothing calls it - app/api/v1/
// wallpapers holds only bundles and studio. The one route that renders a
// wallpaper, app/api/v1/portrait-wallpaper/generate, predates the registry
// and builds its own composition.
//
// This route does not touch either. Halloween main is its own catalog at
// its own aspect, and the wallpaper Halloween room stays exactly as it is.

import { NextRequest, NextResponse } from 'next/server'
import { generateHalloweenRender } from '@/lib/v1/halloween/halloween-generator'
import type { HalloweenGenerateRequest } from '@/lib/v1/halloween/halloween-generator'
import {
  HALLOWEEN_MAIN_ORDER,
  isHalloweenEffect,
} from '@/lib/v1/halloween/halloween-catalog'

export const runtime     = 'nodejs'
export const maxDuration = 180   // NB2 ~30-60s, plus detection, scoring and one retry

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  // ── Required ─────────────────────────────────────────────────
  const sourceImageB64 =
    typeof body.source_image_b64 === 'string' ? body.source_image_b64 : ''
  if (!sourceImageB64) {
    return NextResponse.json(
      { ok: false, error: 'source_image_b64 required' },
      { status: 400 },
    )
  }

  // Canonical key is effect_id; 'effect' and 'preset_id' are accepted as
  // aliases because the queue dispatch on the glass uses its own key per
  // room and this one has no page yet to settle it. Alias tolerance plus
  // explicit extraction means no silent drop either way.
  const rawEffect = body.effect_id ?? body.effect ?? body.preset_id
  if (!isHalloweenEffect(rawEffect)) {
    return NextResponse.json(
      {
        ok:      false,
        error:   'unknown effect_id',
        effects: HALLOWEEN_MAIN_ORDER,
      },
      { status: 400 },
    )
  }

  const request: HalloweenGenerateRequest = {
    source_image_b64:      sourceImageB64,
    additional_images_b64: Array.isArray(body.additional_images_b64)
      ? body.additional_images_b64.filter((s: any) => typeof s === 'string').slice(0, 3)
      : undefined,
    effect_id:             rawEffect,
    // Absent leaves MAIN_ASPECT. A client that sends one is the bench.
    aspect_ratio:          typeof body.aspect_ratio === 'string' ? body.aspect_ratio : undefined,
    is_preview:            body.is_preview === true,
  }

  const replicateApiToken = process.env.REPLICATE_API_TOKEN
  if (!replicateApiToken) {
    return NextResponse.json(
      { ok: false, error: 'REPLICATE_API_TOKEN not set' },
      { status: 500 },
    )
  }

  const openaiApiKey = process.env.OPENAI_API_KEY || undefined
  if (!openaiApiKey) {
    console.warn('[halloween/generate] OPENAI_API_KEY not set — detection and scoring will be skipped')
  }

  console.log(
    `[halloween/generate] effect=${request.effect_id} ` +
    `sources=${1 + (request.additional_images_b64?.length || 0)} ` +
    `aspect=${request.aspect_ratio || '(default)'}`,
  )

  try {
    const result = await generateHalloweenRender({
      request,
      replicateApiToken,
      openaiApiKey,
    })

    // Answers "the backend says it worked but the stage is empty" in one
    // line. Non-zero image_kb here means the problem is on the glass.
    const imageKb = result.image_b64
      ? Math.round(result.image_b64.length * 0.75 / 1024)
      : 0
    console.log(
      `[halloween/generate] respond ok=${result.ok} image=${imageKb}KB ` +
      `pass=${result.final_pass} duration=${result.duration_ms}ms`,
    )

    // Wrapped as { ok, result } — the queue dispatch reads data.result.
    // Returning the result flat made the frontend see no image while the
    // backend logged success. Keep the wrapper.
    return NextResponse.json(
      { ok: result.ok, result },
      { status: result.ok ? 200 : 502 },
    )
  } catch (err: any) {
    console.error(`[halloween/generate] unhandled: ${err?.message || err}`)
    return NextResponse.json(
      { ok: false, error: err?.message || 'unknown_error' },
      { status: 500 },
    )
  }
}
