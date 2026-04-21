// moments-route.ts
// app/api/v1/moments/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { generateMoments }  from '@/lib/v1/moments-generator'
import { applyLevels }      from '@/lib/v1/levels'
import { expandScene }      from '@/lib/v1/expand'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      source_image_b64,
      scene             = 'family',
      notes,
      // These may be sent by the frontend after calling /api/v1/moments/analyze,
      // OR may be omitted — the generator has reasonable fallbacks either way.
      group_description,
      people,
      emotional_tone,
      setting_hint,
    } = body

    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    // ── GENERATE ──────────────────────────────────────────────
    const generated = await generateMoments({
      sourceImageB64:    source_image_b64,
      scene,
      notes,
      groupDescription:  group_description,
      people,
      emotionalTone:     emotional_tone,
      settingHint:       setting_hint,
      openaiApiKey,
    })
    let current = generated.imageB64

    // ── LEVELS ────────────────────────────────────────────────
    try {
      const leveled = await applyLevels({
        imageB64:        current,
        lighting_preset: 'moments',
      })
      if (leveled.success && leveled.imageB64) current = leveled.imageB64
    } catch (e: any) {
      console.warn('[moments-route] levels failed:', e.message)
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
      console.warn('[moments-route] expand failed:', e.message)
    }

    return NextResponse.json({
      result: {
        image_b64:    current,
        prompt_used:  generated.promptUsed,
        scene,
        people_count: people?.length ?? 0,
      }
    })

  } catch (err: any) {
    console.error('[moments-route] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
