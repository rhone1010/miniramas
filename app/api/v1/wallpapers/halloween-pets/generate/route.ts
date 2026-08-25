// app/api/v1/wallpapers/halloween-pets/generate/route.ts
//
// HALLOWEEN PETS WALLPAPER - generate route.
//
//   POST { source_image_b64, effect_id, additional_images_b64? }
//   ok  -> { ok:true, image_b64, prompt_used, effect, aspect_ratio,
//            outpainted, duration_ms }
//   !ok -> { ok:false, reason, retryable? }
//
// Twin of the pets route, halloween catalogue. Same story: the engine
// (wallpapers-pets-halloween.ts) existed with nothing in front of it, the
// room was wired to this path, and the route was the only missing piece of
// the section. Thin front door; every decision about prompts, aspect,
// outpainting and retries lives in generateWallpaper() and is not repeated
// here.
//
// NO CREDIT CHARGE IN THIS ROUTE. Same shape as every other craft: the
// glass spends at /api/v1/credits/gate first, then renders here. A pets
// wallpaper is a render, so it prices as a craft - the gate's flat rate -
// not as a store download. The 3-credit bundle price belongs to the
// pre-generated studio files only.
//
// EFFECT IDS ARE VALIDATED AGAINST THE HALLOWEEN-PETS SET SPECIFICALLY,
// not the whole wallpaper registry - getWallpaperEffect spans all rooms,
// and a halloween page quietly rendering a plain pets body because two ids
// collided is the kind of wrongness nobody reports, they just leave.

import { NextRequest, NextResponse } from 'next/server'
import { generateWallpaper } from '@/lib/v1/wallpapers/wallpapers-generator'
import { PETS_HALLOWEEN_WALLPAPERS, PETS_HALLOWEEN_IDS } from '@/lib/v1/wallpapers/wallpapers-pets-halloween'
import { WALLPAPER_ASPECT } from '@/lib/v1/shared/render-aspect'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // The page historically sends compact names; accept either, prefer the
    // canonical. Same tolerance the groups route extends.
    const effectId: string =
      typeof body.effect_id === 'string' ? body.effect_id :
      typeof body.effect    === 'string' ? body.effect    : ''

    if (!effectId) {
      return NextResponse.json({ ok: false, reason: 'effect_required' }, { status: 400 })
    }
    if (!PETS_HALLOWEEN_WALLPAPERS[effectId]) {
      return NextResponse.json({
        ok: false,
        reason: 'unknown_effect',
        detail: `not a pets wallpaper effect: ${effectId}`,
        // The list is small and public - it is painted on the page - so
        // returning it costs nothing and saves a round trip when the glass
        // and the engine disagree about the catalogue.
        accepted: PETS_HALLOWEEN_IDS,
      }, { status: 400 })
    }

    const source: string =
      typeof body.source_image_b64 === 'string' ? body.source_image_b64 : ''
    if (!source) {
      return NextResponse.json({ ok: false, reason: 'source_image_required' }, { status: 400 })
    }

    const additional: string[] = Array.isArray(body.additional_images_b64)
      ? body.additional_images_b64.filter((s: unknown): s is string => typeof s === 'string')
      : []

    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
    }

    const result = await generateWallpaper({
      request: {
        source_image_b64:      source,
        additional_images_b64: additional,
        effect_id:             effectId,
      },
      replicateApiToken,
      // Optional by the engine's own contract: absent means the render
      // ships un-outpainted with the reason on the result, never a failure.
      stabilityApiKey: process.env.STABILITY_API_KEY || undefined,
    })

    if (!result.ok || !result.image_b64) {
      console.error(
        `[wallpapers/halloween-pets] failed effect=${effectId} ` +
        `code=${result.error_code || '-'} ${result.fatal_error || ''}`,
      )
      return NextResponse.json({
        ok: false,
        reason: result.error_code || 'generate_failed',
        detail: result.fatal_error,
        retryable: result.retryable ?? false,
      }, { status: 502 })
    }

    return NextResponse.json({
      ok:           true,
      image_b64:    result.image_b64,
      prompt_used:  result.prompt_used,
      effect:       result.effect,
      aspect_ratio: WALLPAPER_ASPECT,
      outpainted:   result.outpainted,
      duration_ms:  result.duration_ms,
    })
  } catch (e) {
    console.error('[wallpapers/halloween-pets] threw:', (e as Error).message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
}
