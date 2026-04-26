// moments-route.ts
// app/api/v1/moments/generate/route.ts
//
// POST endpoint for the Moments module.
// Accepts source_image_b64 + optional notes, returns the generated diorama.

import { NextRequest, NextResponse } from 'next/server'
import { generateMoments } from '@/lib/v1/moments-generator'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      source_image_b64,
      notes = '',
    } = body

    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const generated = await generateMoments({
      sourceImageB64: source_image_b64,
      notes,
      openaiApiKey,
    })

    return NextResponse.json({
      result: {
        image_b64:   generated.imageB64,
        prompt_used: generated.promptUsed,
        notes,
      }
    })

  } catch (err: any) {
    console.error('[moments-route] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
