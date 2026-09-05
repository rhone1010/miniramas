// app/api/v1/pets/analyze/route.ts
//
// Analyzer endpoint for the Pets silo. Mirrors the Portraits analyze
// route. Returns the full PetSourceSetAnalysisResult including
// pet_coverage, which drives the frontend photo advisory:
//   head_only             → show advisory ("a full-body photo would
//                           help capture proportions, markings, and
//                           tail") — non-blocking, Curator rule applies:
//                           guide, not restrict
//   head_and_body_partial → proceed (optionally soft note)
//   full_body             → proceed

import { NextRequest, NextResponse } from 'next/server'
import { analyzePetSourceSet } from '@/lib/v1/pets/pets-refine'
import { getUser } from '@/lib/store/auth'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  /* THE MOMENT OF INTENT IS THE MOMENT OF CAPTURE. Rich, 25 August.
     Upload is analyze, and analyze is where the account begins - the site
     is public now and this was an open vision-model tap with no account
     behind it. Same answer the money routes give; the glass upload card
     is built on catching exactly this 401. */
  const authedUser = await getUser().catch(() => null)
  if (!authedUser) {
    return NextResponse.json({ ok: false, reason: 'not_signed_in' }, { status: 401 })
  }


  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const sourceImageB64 = typeof body.source_image_b64 === 'string' ? body.source_image_b64 : ''
  if (!sourceImageB64) {
    return NextResponse.json(
      { ok: false, error: 'source_image_b64 required' },
      { status: 400 },
    )
  }

  const additionalImagesB64: string[] = Array.isArray(body.additional_images_b64)
    ? body.additional_images_b64.filter((s: any) => typeof s === 'string').slice(0, 3)
    : []

  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    return NextResponse.json(
      { ok: false, error: 'OPENAI_API_KEY not set' },
      { status: 500 },
    )
  }

  try {
    const result = await analyzePetSourceSet({
      sourceImageB64,
      additionalImagesB64,
      openaiApiKey,
    })

    console.log(
      `[pets/analyze] photos=${result.photo_count} ` +
      `count=${result.subject_count_estimate} verdict=${result.quality_verdict} ` +
      `coverage=${result.pet_coverage} species=${result.species} ` +
      `smallest_head_px=${result.smallest_head_min_dim_px ?? 'n/a'}`,
    )

    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (err: any) {
    console.error(`[pets/analyze] failed: ${err?.message || err}`)
    return NextResponse.json(
      { ok: false, error: err?.message || 'unknown_error' },
      { status: 500 },
    )
  }
}
