// app/api/v1/houses/curate-effects/route.ts
// Effect Curator endpoint — Houses. POST { source_image_b64, additional_count? }
// → { recommendations: [{ preset_id, collection, label, description, quality_level } x5] }

import { NextRequest, NextResponse } from 'next/server'
import { curateHousesEffects } from '@/lib/v1/houses/houses-effect-curator'

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
    const recommendations = await curateHousesEffects({
      sourceImageB64:  source,
      additionalCount: typeof body?.additional_count === 'number' ? body.additional_count : 0,
      openaiApiKey,
    })
    console.log(`[houses/curate-effects] picks=${recommendations.map(r => r.preset_id).join(',')}`)
    return NextResponse.json({ recommendations })
  } catch (e: any) {
    console.error('[houses/curate-effects] error', e)
    return NextResponse.json({ error: e?.message || 'curate failed' }, { status: 500 })
  }
}
