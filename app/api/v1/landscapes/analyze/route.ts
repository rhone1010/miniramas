// app/api/v1/landscapes/analyze/route.ts
// Combined analyze + curate endpoint.
// Returns { analyzer, curator } so the UI gets everything in one round-trip
// to seed the workspace.

import { NextRequest, NextResponse } from 'next/server'
import { analyzeLandscape } from '@/lib/v1/landscapes-analyzer'
import { curateLandscape }  from '@/lib/v1/landscapes-curator'
import { AnalyzeResponse }   from '@/lib/v1/landscapes-shared'

export async function POST(req: NextRequest) {
  try {
    const { image_b64 } = await req.json()
    if (!image_b64) {
      return NextResponse.json({ error: 'image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const analyzer = await analyzeLandscape({ sourceImageB64: image_b64, openaiApiKey })
    const curator  = await curateLandscape({ analyzer, openaiApiKey })

    const response: AnalyzeResponse = { analyzer, curator }
    return NextResponse.json(response)

  } catch (err: any) {
    console.error('[landscapes/analyze]', err?.message || err)
    return NextResponse.json(
      { error: err?.message || 'analyze_failed' },
      { status: 500 },
    )
  }
}
