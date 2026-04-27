// app/api/v1/groups/analyze/route.ts
//
// Pre-flight tier check. Called by the UI on upload to decide whether
// the photo can proceed to generation. Does NOT run any generation.
//
// Returns:
//   { tier, message, warnings, subjects: [...] }   on success
//   { error: '...' }                                 on bad input

import { NextRequest, NextResponse } from 'next/server'
import { analyzeTier } from '@/lib/v1/face-tier'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sourceImageB64: string = body.image_b64 || body.source_image_b64

    if (!sourceImageB64) {
      return NextResponse.json(
        { error: 'image_b64 required' },
        { status: 400 },
      )
    }

    const replicateApiKey = process.env.REPLICATE_API_TOKEN
    if (!replicateApiKey) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN not set' },
        { status: 500 },
      )
    }

    const tier = await analyzeTier({
      imageB64:        sourceImageB64,
      replicateApiKey,
    })

    return NextResponse.json({
      tier:             tier.tier,
      proceedable:      tier.tier === 'figurine',
      message:          tier.message,
      warnings:         tier.warnings,
      subject_count:    tier.subjects.length,
      background_faces: tier.backgroundFaces,
    })

  } catch (err: any) {
    console.error('[groups/analyze]', err.message)
    return NextResponse.json(
      { error: err.message },
      { status: 500 },
    )
  }
}
