// app/api/v1/houses/curate-effects/route.ts
// Effect Curator endpoint — Houses. POST { source_image_b64, additional_count? }
// → { recommendations: [{ preset_id, collection, label, description, quality_level } x5] }

import { NextRequest, NextResponse } from 'next/server'
import { curateHousesEffects } from '@/lib/v1/houses/houses-effect-curator'

export const maxDuration = 60

export async function POST() {
  /* ROUTE CLOSED - 2026-09-03. Houses is out of soft-launch scope.

     .vercelignore excludes this Series' HTML page but not its endpoints,
     and the matcher in middleware.ts skips /api entirely, so this shipped
     as an ungated serverless function: no session, no entitlement, no
     credit check, spending model credits for anyone who found the URL.

     Closed rather than gated. The handler below is queued for archival and
     does not need entitlement logic written for it.

     410 rather than 404: this endpoint did exist, and saying so plainly
     tells whoever hits it that it was withdrawn on purpose rather than
     mistyped. Change the status here if that ever needs to be quieter.

     The original handler is preserved verbatim below, renamed so Next no
     longer routes to it. To reopen: delete this stub and put `export` back
     on the function under it. Nothing in its body has been altered. */
  return new NextResponse(null, { status: 410 })
}

/* Preserved, unrouted. See the stub above. */
async function POST_CLOSED_2026_09_03(req: NextRequest) {
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
