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
//
// 2026-08-03 — GENDER AND AGE.
// `result.detected_gender` comes from analyzeSourceSet, which reports on the
// whole source set and has been returning null in practice. The card needs a
// value it can rely on, so this route also runs detectFaceVisibility — the
// same single-image call the generator makes at Stage 0, measured at 11/11
// on the test set — and surfaces it as `gender` and `age_group` at the top
// level of the response.
//
// The two calls run in parallel; the detection adds no wall-clock time.
// Detection failing never fails the endpoint: gender comes back null and the
// card falls back to the man plate.
//
// FOR THE CLIENT:
//   gender === 'f'  ->  /previews/effects/<effect_id>/2_woman.jpg
//   gender === 'm'  ->  /previews/effects/<effect_id>/1_man.jpg
//   gender === null ->  /previews/effects/<effect_id>/1_man.jpg
// Every effect has both files. Pass `subject` ('man' | 'woman') on the
// generate request to keep the render consistent with what was shown.

import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeSourceSet,
  detectFaceVisibility,
} from '@/lib/v1/portraits/portraits-refine'

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

    // Both calls in parallel. Detection is the reliable gender source and
    // must never take the endpoint down, so it is caught independently.
    const [result, detection] = await Promise.all([
      analyzeSourceSet({
        sourceImageB64:      source_image_b64,
        additionalImagesB64: auxImages,
        openaiApiKey,
      }),
      detectFaceVisibility({
        sourceImageB64: source_image_b64,
        openaiApiKey,
      }).catch((e: any) => {
        console.warn(`[portraits/analyze] detection failed: ${e?.message}`)
        return null
      }),
    ])

    // 'f' | 'm' | null. Detection wins; analyzeSourceSet is the fallback.
    const gender: 'f' | 'm' | null =
      detection?.gender ??
      (result.detected_gender === 'f' || result.detected_gender === 'm'
        ? result.detected_gender
        : null)

    const ageGroup: string | null = detection?.age_group ?? null

    // 'man' | 'woman' | null — the value to send straight back on generate.
    const subject: 'man' | 'woman' | null =
      gender === 'f' ? 'woman' : gender === 'm' ? 'man' : null

    const elapsed = Date.now() - t0
    console.log(
      `[portraits/analyze] done in ${elapsed}ms — ` +
      `${result.subject_count_estimate} subjects, verdict=${result.quality_verdict}, ` +
      `gender=${gender || 'none'}, age=${ageGroup || 'none'}` +
      (result.recommendation ? `, rec="${result.recommendation}"` : ''),
    )

    return NextResponse.json({
      result,

      // Top level so the card does not have to reach into `result`, and so
      // the field is unaffected by anything analyzeSourceSet does or does
      // not return.
      gender,
      age_group: ageGroup,
      subject,

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
