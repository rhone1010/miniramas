// app/api/v1/actionmini/analyze-render/route.ts
//
// Compares the source photograph to a rendered miniature and returns a single
// short adjustment instruction (≤150 chars) suitable for refining the next render.
//
// Request body: { source_image_b64: string, rendered_image_b64: string }
// Response:     { suggestion: string, needs_adjustment: boolean, duration_ms: number }
//
// On error, returns 200 with a safe fallback so the UI can still let the user type
// their own tweak — analyze-render failure should never block the refinement flow.

import { NextRequest, NextResponse } from 'next/server'
import { analyzeRender } from '@/lib/v1/actionmini-refine'

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const body = await req.json()
    const sourceImageB64   = body.source_image_b64
    const renderedImageB64 = body.rendered_image_b64

    if (!sourceImageB64 || !renderedImageB64) {
      return NextResponse.json(
        { error: 'source_image_b64 and rendered_image_b64 required' },
        { status: 400 }
      )
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    try {
      const result = await analyzeRender({
        sourceImageB64,
        renderedImageB64,
        openaiApiKey,
      })
      const duration_ms = Date.now() - t0
      console.log(`[analyze-render] ${duration_ms}ms — needsAdjustment=${result.needsAdjustment}`)
      return NextResponse.json({
        suggestion:        result.suggestion,
        needs_adjustment:  result.needsAdjustment,
        duration_ms,
      })
    } catch (e: any) {
      // Soft-fail: return a safe fallback so user can still type their own tweak
      console.error('[analyze-render] failed:', e.message)
      return NextResponse.json({
        suggestion:        '',
        needs_adjustment:  true,   // default to "yes user, please type something"
        duration_ms:       Date.now() - t0,
        error:             e.message,
      })
    }

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, duration_ms: Date.now() - t0 },
      { status: 500 }
    )
  }
}
