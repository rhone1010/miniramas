// route.ts
// app/api/v1/houses/generate/route.ts
//
// POST /api/v1/houses/generate
// Accepts: GenerateRequest
// Returns: GenerateResult
//
// Single endpoint for the slice. analyze-render endpoint comes in pass 2
// (refine flow), and lives at app/api/v1/houses/analyze-render/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { generateHouse } from '@/lib/v1/houses/houses-generator'
import type { GenerateRequest } from '@/lib/v1/houses/houses-shared'

export const runtime     = 'nodejs'
export const maxDuration = 120  // NB2 25-40s + outpaint 8-12s + headroom

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
    const body = (await req.json()) as Partial<GenerateRequest>

    // ── Validation ──
    if (!body.source_image_b64) {
      return NextResponse.json(
        { error: 'source_image_b64 is required' },
        { status: 400 }
      )
    }
    if (!body.preset_id) {
      return NextResponse.json(
        { error: 'preset_id is required' },
        { status: 400 }
      )
    }
    if (!body.environment_id) {
      return NextResponse.json(
        { error: 'environment_id is required' },
        { status: 400 }
      )
    }

    // ── Auth ──
    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN not configured on server' },
        { status: 500 }
      )
    }

    // ── Generate ──
    const result = await generateHouse({
      request:           body as GenerateRequest,
      replicateApiToken,
    })

    return NextResponse.json(result)

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[houses/generate] Error:', msg)
    return NextResponse.json(
      {
        error:      msg,
        error_type: 'generate_failed',
      },
      { status: 500 }
    )
  }
}
