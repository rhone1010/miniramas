// ─────────────────────────────────────────────────────────────
// V1 PIPELINE
// app/api/v1/generate/route.ts
//
// POST /api/v1/generate
//
// Input:  { source_image_b64: string }
// Output: { image_b64: string }   (final JPEG, base64)
//
// Chains three modules in strict order:
//   1. generate  — AI produces diorama object
//   2. place     — normalize margins on canvas
//   3. composite — add background, shadow, reflection
//
// No scoring. No iteration. No branching. One pass.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { generateDiorama } from '@/lib/v1/generate'
import { placeDiorama }    from '@/lib/v1/place'
import { compositeFinal }  from '@/lib/v1/composite'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sourceImageB64: string = body.source_image_b64

    if (!sourceImageB64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    // ── STAGE 1: GENERATION ─────────────────────────────────
    console.log('[pipeline] Stage 1 — generate')
    const generated = await generateDiorama({ sourceImageB64, openaiApiKey })

    // ── STAGE 2: PLACEMENT ──────────────────────────────────
    console.log('[pipeline] Stage 2 — place')
    const placed = await placeDiorama({ imagePngB64: generated.imagePngB64 })

    // ── STAGE 3: COMPOSITE ──────────────────────────────────
    console.log('[pipeline] Stage 3 — composite')
    const final = await compositeFinal({
      placedPngB64:   placed.placedPngB64,
      visibleBottomY: placed.visibleBottomY,
      dioramaLeft:    placed.dioramaLeft,
      dioramaW:       placed.dioramaW,
    })

    console.log('[pipeline] Complete')
    return NextResponse.json({ image_b64: final.jpegB64 })

  } catch (err: any) {
    console.error('[pipeline] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
