// sportsmem-route.ts
// app/api/v1/sportsmem/generate/route.ts
//
// sportsmem → mode = 'memory' (memory diorama).
// Margin is handled by PRE-processing (padding the source in sportsmem-generator.ts),
// NOT post-process outpaint. Expand-style outpaint invents stadium content at the
// edges of a memory-mode image; pre-padding gives the model the breathing room up front.

import { NextRequest, NextResponse } from 'next/server'
import { generateStadiumTableau } from '@/lib/v1/sportsmem-generator'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      source_image_b64,
      plaque_text = '',
    } = body

    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const generated = await generateStadiumTableau({
      sourceImageB64: source_image_b64,
      mode:           'memory',
      plaqueText:     plaque_text,
      openaiApiKey,
    })

    return NextResponse.json({
      result: {
        image_b64:   generated.imageB64,
        prompt_used: generated.promptUsed,
        plaque_text,
        mode:        'memory',
      }
    })

  } catch (err: any) {
    console.error('[sportsmem-route] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
