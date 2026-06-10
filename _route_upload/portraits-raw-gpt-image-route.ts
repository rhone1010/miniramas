// app/api/v1/portraits/raw-gpt-image/route.ts
//
// Direct gpt-image-1 test pipeline. Bypasses all block assembly, style/preset
// logic, scoring, Pass 2, faceswap, and outpaint. The user's raw prompt goes
// straight to gpt-image-1 alongside the source image (and optional style ref).
//
// Use this when iterating on a prompt and you want to know what gpt-image-1
// produces with minimal interference. Mirrors the Groups raw-gpt-image route.

import { NextRequest, NextResponse } from 'next/server'
import fs        from 'node:fs/promises'
import path      from 'node:path'
import { callGptImage1 } from '@/lib/v1/portraits/portraits-gpt-image'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()
    const {
      source_image_b64,
      additional_images_b64,
      prompt,
      aspect_ratio,
      quality,
      style_reference_path,
    } = body as {
      source_image_b64:       string
      additional_images_b64?: string[]
      prompt:                 string
      aspect_ratio?:          string
      quality?:               'low' | 'medium' | 'high'
      style_reference_path?:  string
    }

    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'prompt required (non-empty string)' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    // Load curated style reference from public/style_refs/ if requested.
    // Validates the path stays under that directory (no traversal).
    let styleRefB64s: string[] = []
    if (style_reference_path) {
      const cleaned = style_reference_path.replace(/^\/+/, '').trim()
      if (!cleaned.startsWith('public/style_refs/')) {
        return NextResponse.json(
          { error: 'style_reference_path must start with public/style_refs/' },
          { status: 400 },
        )
      }
      if (cleaned.includes('..')) {
        return NextResponse.json({ error: 'style_reference_path may not contain ..' }, { status: 400 })
      }
      try {
        const absPath = path.join(process.cwd(), cleaned)
        const buf     = await fs.readFile(absPath)
        styleRefB64s  = [buf.toString('base64')]
        console.log(`[portraits/raw-gpt-image] loaded style ref: ${cleaned} (${buf.length} bytes)`)
      } catch (e: any) {
        console.warn(`[portraits/raw-gpt-image] style ref load failed (${cleaned}): ${e?.message}`)
        // Continue without the ref — degrade gracefully.
      }
    }

    console.log(
      `[portraits/raw-gpt-image] start aspect=${aspect_ratio || '3:4'} ` +
      `quality=${quality || 'medium'} ` +
      `style_refs=${styleRefB64s.length} ` +
      `prompt_chars=${prompt.length}`,
    )
    console.log(`[portraits/raw-gpt-image] prompt: ${prompt.slice(0, 400)}${prompt.length > 400 ? '…' : ''}`)

    const imageB64 = await callGptImage1({
      prompt,
      sourceImageB64:      source_image_b64,
      additionalImagesB64: additional_images_b64 || [],
      styleReferenceB64s:  styleRefB64s,
      aspectRatio:         aspect_ratio || '3:4',
      openaiApiKey,
      quality:             quality || 'medium',
    })

    const durationMs = Date.now() - t0
    console.log(`[portraits/raw-gpt-image] done in ${durationMs}ms`)

    return NextResponse.json({
      image_b64:    imageB64,
      duration_ms:  durationMs,
      prompt_chars: prompt.length,
      style_refs:   styleRefB64s.length,
      aspect_ratio: aspect_ratio || '3:4',
      quality:      quality || 'medium',
    })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    const durationMs = Date.now() - t0
    console.error(`[portraits/raw-gpt-image] failed in ${durationMs}ms: ${msg}`)
    return NextResponse.json(
      { error: msg, duration_ms: durationMs },
      { status: 500 },
    )
  }
}
