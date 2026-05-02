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
import { generateHouse } from '@/lib/v1/houses-generator'
import type { GenerateRequest } from '@/lib/v1/houses-shared'

export const runtime     = 'nodejs'
export const maxDuration = 120  // NB2 25-40s + outpaint 8-12s + headroom

export async function POST(req: NextRequest) {
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
