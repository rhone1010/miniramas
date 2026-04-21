// landscape-route.ts
// app/api/v1/landscapes/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { generateLandscape, generateCollectableCard } from '@/lib/v1/landscape-generator'
import { applyLevels }        from '@/lib/v1/levels'
import { expandScene }        from '@/lib/v1/expand'
import { applyPlaque }    from '@/lib/v1/plaque'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      source_image_b64,
      extra_images          = [],
      scene_description,                 // free-form description from analyze
      viewing_direction,                 // which side of subject; camera orientation
      memory_text,                       // short keepsake caption from analyze
      environment_surface,               // just ground material
      environment_atmosphere,            // just sky/weather/light
      character_source,                  // 'object' | 'atmosphere'
      distinctive_features,              // comma-separated specific features to preserve
      display_name,
      mood              = 'golden',
      presentation      = 'insitu',
      scale_feel        = 'intimate',
      notes,
      plaque_text,                       // optional decorative plate text (≤40 chars)
      plaque_shape      = 'rectangular', // 'rectangular' | 'curved' | 'victorian'
      artwork_style     = 'artwork',     // collectable_card only — 'artwork' | 'miniature'
    } = body

    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    // ── COLLECTABLE CARD — dedicated two-image path (no levels/expand) ──
    if (presentation === 'collectable_card') {
      const { frontB64, backB64 } = await generateCollectableCard({
        sourceImageB64:       source_image_b64,
        sceneDesc:            scene_description || '',
        viewingDirection:     viewing_direction || '',
        distinctiveFeatures:  distinctive_features || '',
        memoryText:           memory_text || '',
        displayName:          display_name || 'Untitled',
        mood,
        plaqueText:     plaque_text || '',
        artworkStyle:   artwork_style === 'miniature' ? 'miniature' : 'artwork',
        openaiApiKey,
      })
      return NextResponse.json({
        result: {
          front_b64:     frontB64,
          back_b64:      backB64,
          scene:         display_name,
          mood,
          presentation:  'collectable_card',
          artwork_style,
          memory_text,
        }
      })
    }

    // ── NORMAL PATH: in-situ / cinematic / museum ──
    const generated = await generateLandscape({
      sourceImageB64:        source_image_b64,
      extraImages:           extra_images,
      sceneDescription:      scene_description,
      viewingDirection:      viewing_direction,
      environmentSurface:    environment_surface,
      environmentAtmosphere: environment_atmosphere,
      characterSource:       character_source,
      distinctiveFeatures:   distinctive_features,
      displayName:           display_name,
      mood,
      presentation,
      scaleFeel:             scale_feel,
      notes,
      openaiApiKey,
    })
    let current = generated.imageB64

    // ── LEVELS ────────────────────────────────────────────────
    try {
      const leveled = await applyLevels({
        imageB64:        current,
        lighting_preset: 'landscape',
      })
      if (leveled.success && leveled.imageB64) current = leveled.imageB64
    } catch (e: any) {
      console.warn('[landscape-route] levels failed:', e.message)
    }

    // ── EXPAND (Stability outpaint) ───────────────────────────
    try {
      const expanded = await expandScene({
        imageB64:     current,
        openaiApiKey,
        expand:       true,
      })
      if (expanded.imageB64) current = expanded.imageB64
    } catch (e: any) {
      console.warn('[landscape-route] expand failed:', e.message)
    }

    // ── PLAQUE (optional) ─────────────────────────────────────
    if (plaque_text && plaque_text.trim()) {
      try {
        current = await applyPlaque({
          imageB64:     current,
          text:         plaque_text,
          shape:        plaque_shape,
          integrate:    true,
          openaiApiKey,
        })
      } catch (e: any) {
        console.warn('[landscape-route] plaque pipeline failed:', e.message)
      }
    }

    return NextResponse.json({
      result: {
        image_b64:        current,
        prompt_used:      generated.promptUsed,
        scene:            display_name,
        character_source,
        mood,
        presentation,
      }
    })

  } catch (err: any) {
    console.error('[landscape-route] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
