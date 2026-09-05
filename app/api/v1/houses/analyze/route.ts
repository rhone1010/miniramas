// app/api/v1/houses/analyze/route.ts
// Source analyzer endpoint — Houses. POST { source_image_b64 }
// → { quality_verdict, facade_coverage, reason }

import { NextRequest, NextResponse } from 'next/server'
import { analyzeHousesSource } from '@/lib/v1/houses/houses-analyze'

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
    const result = await analyzeHousesSource({ sourceImageB64: source, openaiApiKey })
    console.log(`[houses/analyze] verdict=${result.quality_verdict} coverage=${result.facade_coverage}`)
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[houses/analyze] error', e)
    return NextResponse.json({ error: e?.message || 'analyze failed' }, { status: 500 })
  }
}
