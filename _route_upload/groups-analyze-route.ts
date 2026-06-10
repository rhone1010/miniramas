// app/api/v1/groups/analyze/route.ts
//
// Source analysis endpoint. Evaluates the uploaded photo(s) BEFORE render
// time to give the user collaborative feedback on the source set — subject
// count, sharpness, lighting, and whether more or better photos would help.
//
// Accepts a single primary image (required) and up to N additional images
// (optional). Calls analyzeSourceSet which sends them all to GPT-4o-vision
// in a single multi-image request and returns per-photo quality + an
// aggregate verdict (green / yellow / red) + a one-sentence recommendation
// for the user (or null when the set looks great).

import { NextRequest, NextResponse } from 'next/server'
import { analyzeSourceSet }          from '@/lib/v1/groups/groups-refine'

export const maxDuration = 60   // seconds — vision call typically returns in <15s

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

    console.log(`[groups/analyze] photos=${1 + auxImages.length} (primary + ${auxImages.length} aux)`)

    const result = await analyzeSourceSet({
      sourceImageB64:       source_image_b64,
      additionalImagesB64:  auxImages,
      openaiApiKey,
    })

    const elapsed = Date.now() - t0
    console.log(`[groups/analyze] done in ${elapsed}ms — ${result.subject_count_estimate} subjects, verdict=${result.quality_verdict}${result.recommendation ? `, rec="${result.recommendation}"` : ''}`)

    return NextResponse.json({
      result,
      elapsed_ms: elapsed,
    })
  } catch (e: any) {
    console.error('[groups/analyze] fatal:', e)
    return NextResponse.json(
      { error: e?.message || 'analyze failed' },
      { status: 500 },
    )
  }
}
