// app/api/v1/houses/analyze/route.ts
// Source analyzer endpoint — Houses. POST { source_image_b64 }
// → { quality_verdict, facade_coverage, reason }

import { NextRequest, NextResponse } from 'next/server'
import { analyzeHousesSource } from '@/lib/v1/houses/houses-analyze'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const source = body?.source_image_b64
    if (!source || typeof source !== 'string') {
      return NextResponse.json({ error: 'source_image_b64 is required' }, { status: 400 })
    }
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }
    const result = await analyzeHousesSource({ sourceImageB64: source, openaiApiKey })
    console.log(`[houses/analyze] verdict=${result.quality_verdict} coverage=${result.facade_coverage}`)
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[houses/analyze] error', e)
    return NextResponse.json({ error: e?.message || 'analyze failed' }, { status: 500 })
  }
}
