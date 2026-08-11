// app/api/v1/wallpapers/generate/route.ts
//
// Single-render endpoint for Mobile Wallpapers. 9:16, download only, no
// print path — the Print Shop does not list this silo.
//
// Pipeline (delegated to generateWallpaper):
//   NB2 generate at 9:16 -> Stability outpaint only if the render is short
//
// No scoring and no retry. See the note at the head of the generator.

import { NextRequest, NextResponse } from 'next/server'
import { generateWallpaper } from '@/lib/v1/wallpapers/wallpapers-generator'
import {
  isWallpaperEffectId,
  WALLPAPER_EFFECT_IDS,
} from '@/lib/v1/wallpapers/wallpapers-registry'
import type { WallpaperGenerateRequest } from '@/lib/v1/wallpapers/wallpapers-generator'

export const runtime     = 'nodejs'
export const maxDuration = 120   // one NB2 call, sometimes one Stability call

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()

    const effectId: string | undefined = body.effect_id ?? body.effect
    const freeform: string | undefined = body.freeform_prompt

    if (!effectId && !freeform) {
      return NextResponse.json(
        { error: 'effect_id or freeform_prompt required' },
        { status: 400 },
      )
    }

    // Catalog effects must exist. Freeform skips this — Open Studio sends
    // its own text and no catalog id.
    if (effectId && !freeform && !isWallpaperEffectId(effectId)) {
      return NextResponse.json(
        { error: `unknown effect: ${effectId}`, known: WALLPAPER_EFFECT_IDS },
        { status: 400 },
      )
    }

    // OPEN, FOR RICH: freeform text reaches NB2 from here with nothing
    // between. The prompt builder is meant to be the moderation surface and
    // does not exist yet. Flagged in wallpapers-shared.ts; not built,
    // because what it refuses is a ruling, not an engine decision.
    if (freeform) {
      console.warn(
        `[wallpapers/generate] freeform prompt, unmoderated, ` +
        `chars=${freeform.length}`,
      )
    }

    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN not configured' },
        { status: 500 },
      )
    }

    const stabilityApiKey = process.env.STABILITY_API_KEY || undefined

    const generateRequest: WallpaperGenerateRequest = {
      source_image_b64:      body.source_image_b64 || undefined,
      additional_images_b64: body.additional_images_b64 || [],
      effect_id:             effectId || 'open_studio',
      freeform_prompt:       freeform || undefined,
      is_preview:            typeof body.is_preview === 'boolean' ? body.is_preview : undefined,
    }

    const result = await generateWallpaper({
      request: generateRequest,
      replicateApiToken,
      stabilityApiKey,
    })

    console.log(
      `[wallpapers/generate] done in ${Date.now() - t0}ms — ` +
      `ok=${result.ok} effect=${result.effect} outpainted=${result.outpainted}`,
    )

    return NextResponse.json({ result })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    console.error(`[wallpapers/generate] failed in ${Date.now() - t0}ms: ${msg}`)
    return NextResponse.json(
      { error: msg, duration_ms: Date.now() - t0 },
      { status: 500 },
    )
  }
}
