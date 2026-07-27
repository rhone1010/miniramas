// app/api/v1/portraits/analyze/route.ts
//
// Source analysis endpoint. Evaluates the uploaded photo(s) BEFORE render
// time to give the user collaborative feedback on the source set — subject
// count, sharpness, lighting, and whether a different photo would help.
//
// IMPORTANT — fixes the bug from the Groups analyze route where the route
// was calling analyzeSourceSet with mismatched parameter names (sourceImageB64
// / additionalImagesB64) while the function expected primaryB64 / auxB64s,
// causing the endpoint to silently return undefined. Portraits aligns both
// sides on sourceImageB64 / additionalImagesB64.

import { NextRequest, NextResponse } from 'next/server'
import { analyzeSourceSet } from '@/lib/v1/portraits/portraits-refine'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()
    const {
      source_image_b64,
      additional_images_b64,
    } = body as {
      source_image_b64:       string
      additional_images_b64?: string[]
    }

    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const auxImages = Array.isArray(additional_images_b64)
      ? additional_images_b64.filter((s): s is string => typeof s === 'string' && s.length > 0)
      : []

    console.log(`[portraits/analyze] photos=${1 + auxImages.length} (primary + ${auxImages.length} aux)`)

    const result = await analyzeSourceSet({
      sourceImageB64:        source_image_b64,
      additionalImagesB64:   auxImages,
      openaiApiKey,
    })

    const elapsed = Date.now() - t0
    console.log(
      `[portraits/analyze] done in ${elapsed}ms — ` +
      `${result.subject_count_estimate} subjects, verdict=${result.quality_verdict}` +
      (result.recommendation ? `, rec="${result.recommendation}"` : ''),
    )

    return NextResponse.json({
      result,
      elapsed_ms: elapsed,
    })
  } catch (e: any) {
    console.error('[portraits/analyze] fatal:', e)
    return NextResponse.json(
      { error: e?.message || 'analyze failed' },
      { status: 500 },
    )
  }
}
