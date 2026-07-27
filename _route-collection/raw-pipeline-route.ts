// app/api/v1/portraits/raw-pipeline/route.ts
//
// Raw-prompt pipeline: NB2 only. Mirrors the Groups raw-pipeline route.
// No Pass 2 — gpt-image-1 smooths NB2's textural character.
// No outpaint — Stability outpaint adds a white matte that doesn't match
//   NB2's native framing.
// No faceswap — raw mode is for prompt iteration, not identity preservation.
//
// User supplies a single custom prompt. Output is what NB2 returns, untouched.

import { NextRequest, NextResponse } from 'next/server'

export const runtime     = 'nodejs'
export const maxDuration = 120

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'
const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 60
const POLL_DELAY_MS     = 2000
const MAX_SOURCE_IMAGES = 8

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()
    const {
      source_image_b64,
      additional_images_b64,
      prompt,
      aspect_ratio,
    } = body as {
      source_image_b64:       string
      additional_images_b64?: string[]
      prompt:                 string
      aspect_ratio?:          string
    }

    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'prompt required (non-empty string)' }, { status: 400 })
    }

    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 })
    }

    // Portraits default aspect is 3:4 (vertical bust frame). Wide aspects
    // trigger NB2 to compose grand scenes, which fights the portrait product.
    const aspect = aspect_ratio || '3:4'

    console.log(
      `[portraits/raw-pipeline] start aspect=${aspect} ` +
      `prompt_chars=${prompt.length} additional=${(additional_images_b64?.length || 0)}`,
    )
    console.log(`[portraits/raw-pipeline] prompt: ${prompt.slice(0, 400)}${prompt.length > 400 ? '…' : ''}`)

    const imageB64 = await callNB2({
      prompt,
      sourceImageB64:      source_image_b64,
      additionalImagesB64: additional_images_b64 || [],
      aspectRatio:         aspect,
      replicateApiToken,
    })

    const durationMs = Date.now() - t0
    console.log(`[portraits/raw-pipeline] done in ${durationMs}ms`)

    return NextResponse.json({
      image_b64:     imageB64,
      duration_ms:   durationMs,
      prompt_chars:  prompt.length,
      aspect_ratio:  aspect,
      stages_run:    {
        pass1_nb2: true,
        pass2_gpt: false,
        outpaint:  false,
        faceswap:  false,
      },
    })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    const durationMs = Date.now() - t0
    console.error(`[portraits/raw-pipeline] failed in ${durationMs}ms: ${msg}`)
    return NextResponse.json(
      { error: msg, duration_ms: durationMs },
      { status: 500 },
    )
  }
}

// ─────────────────────────────────────────────────────────────
// callNB2 — inlined Replicate call (matches portraits-generator.ts pattern)
// ─────────────────────────────────────────────────────────────

async function callNB2(input: {
  prompt:              string
  sourceImageB64:      string
  additionalImagesB64: string[]
  aspectRatio:         string
  replicateApiToken:   string
}): Promise<string> {

  const sourceUris = [
    input.sourceImageB64,
    ...input.additionalImagesB64,
  ].slice(0, MAX_SOURCE_IMAGES).map(b => `data:image/jpeg;base64,${b}`)

  const body = {
    input: {
      prompt:        input.prompt,
      image_input:   sourceUris,
      aspect_ratio:  input.aspectRatio,
      output_format: 'jpg',
    },
  }

  const res = await fetch(REPLICATE_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Token ${input.replicateApiToken}`,
      'Content-Type':  'application/json',
      'Prefer':        `wait=${SYNC_WAIT_SECONDS}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Replicate POST failed (${res.status}): ${errText.slice(0, 240)}`)
  }

  const prediction = await res.json()

  if (prediction.status === 'succeeded' && prediction.output) {
    return await fetchAndEncode(pickOutputUrl(prediction.output))
  }

  if (prediction.urls?.get) {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_DELAY_MS))
      const pollRes = await fetch(prediction.urls.get, {
        headers: { 'Authorization': `Token ${input.replicateApiToken}` },
      })
      if (!pollRes.ok) throw new Error(`poll failed (${pollRes.status})`)
      const polled = await pollRes.json()
      if (polled.status === 'succeeded' && polled.output) {
        return await fetchAndEncode(pickOutputUrl(polled.output))
      }
      if (polled.status === 'failed' || polled.status === 'canceled') {
        throw new Error(`NB2 prediction ${polled.status}: ${polled.error || ''}`)
      }
    }
  }

  throw new Error(`NB2 timed out — status=${prediction.status}`)
}

function pickOutputUrl(output: any): string {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && output.length > 0) return output[0]
  throw new Error('NB2 output URL not found in prediction response')
}

async function fetchAndEncode(url: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`output fetch failed (${r.status})`)
  return Buffer.from(await r.arrayBuffer()).toString('base64')
}
