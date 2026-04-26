// group-analyze-route.ts
// app/api/v1/groups/analyze/route.ts
//
// Standalone Phase 1 endpoint. Useful for:
// - showing the UI a per-person identity preview before generation
// - caching analysis client-side to avoid re-running it on retries

import { NextRequest, NextResponse } from 'next/server'
import { analyzeGroup } from '@/lib/v1/group-analyzer'

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

    const analysis = await analyzeGroup({
      sourceImageB64: image_b64,
      openaiApiKey,
    })

    return NextResponse.json({ analysis })

  } catch (err: any) {
    console.error('[groups-analyze]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
