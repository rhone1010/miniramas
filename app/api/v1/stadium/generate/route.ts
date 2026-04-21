// stadium-route.ts
// app/api/v1/stadiums/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { generateStadium } from '@/lib/v1/stadium-generator'
import { applyLevels }  from '@/lib/v1/levels'
import { expandScene }  from '@/lib/v1/expand'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      source_image_b64,
      scene, notes,
    } = body

    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    // Generate
    const generated = await generateStadium({
      sourceImageB64: source_image_b64, scene, notes, openaiApiKey,
    })
    let current = generated.imageB64

    // Levels
    try {
      const leveled = await applyLevels({ imageB64: current, lighting_preset: scene })
      if (leveled.success && leveled.imageB64) current = leveled.imageB64
    } catch (e: any) { console.warn('[stadium-route] levels:', e.message) }

    // Expand
    try {
      const expanded = await expandScene({ imageB64: current, openaiApiKey, expand: true })
      if (expanded.imageB64) current = expanded.imageB64
    } catch (e: any) { console.warn('[stadium-route] expand:', e.message) }

    return NextResponse.json({
      result: { image_b64: current, prompt_used: generated.promptUsed, scene }
    })

  } catch (err: any) {
    console.error('[stadium-route] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
