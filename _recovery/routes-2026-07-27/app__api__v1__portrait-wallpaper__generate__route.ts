// app/api/v1/portrait-wallpaper/generate/route.ts
//
// PORTRAIT WALLPAPER — generate route. Self-contained (drop-in).
//
// Reuses the existing Portraits engine for the EFFECT + LIKENESS
// (buildPortraitsPrompt — no reinvented effect blocks), and wraps it
// with a WALLPAPER COMPOSITION block that is the only output-specific
// tuning: phone-vertical framing, the chosen backdrop, and the negative
// space a lock-screen wallpaper needs. NB2 renders at 9:16 (tallest NB2
// ratio; final phone fit is a device-size step at download).
//
// Request:  { source_image_b64, effect, backdrop, framing }
// Response: { image_b64, prompt_used, aspect_ratio }
//
// NOTE (CENG tuning): "gradient" backdrop maps cleanly today. "blurred_room"
// and "dark_shelf" are stated in the wallpaper block and work, but a proper
// backdrop LocationId in the Portraits engine would render them cleaner —
// flagged, not blocking.

import { NextRequest, NextResponse } from 'next/server'
// repo path: lib/v1/portraits/portraits-prompt.ts
import { buildPortraitsPrompt } from '@/lib/v1/portraits/portraits-prompt'
import type { PortraitsPresetId } from '@/lib/v1/portraits/portraits-shared'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'
const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000
const MAX_RATE_LIMIT_RETRIES = 3
const BASE_RETRY_DELAY_MS    = 2000

type Backdrop = 'gradient' | 'blurred_room' | 'dark_shelf'
type Framing  = 'bust' | 'signature' | 'statuesque'

// ── WALLPAPER COMPOSITION (the output-specific tuning) ────────
const BACKDROP_PHRASE: Record<Backdrop, string> = {
  gradient:
    'a clean seamless studio gradient backdrop, softly darker toward the edges so the subject glows against it',
  blurred_room:
    'a softly blurred, tastefully lit interior room far behind the subject, shallow depth of field, the room reduced to gentle bokeh',
  dark_shelf:
    'a dark, moody shelf-and-wall setting deep in shadow behind the subject, quiet and understated',
}

// Framing = how much of the figure is in the vertical frame.
const FRAMING_PHRASE: Record<Framing, string> = {
  bust:       'framed from the chest up, the head in the upper-center third',
  signature:  'framed from the waist up in a relaxed signature pose',
  statuesque: 'framed as a full upright figure, standing tall in the vertical frame',
}

function wallpaperComposition(backdrop: Backdrop, framing: Framing): string {
  return [
    'PHONE WALLPAPER COMPOSITION — vertical 9:16 portrait orientation, composed as a premium mobile wallpaper.',
    `The subject is ${FRAMING_PHRASE[framing]}, placed with deliberate negative space: generous clear headroom at the top and calm, uncluttered space toward the lower third so the composition reads well behind a phone's clock and app icons.`,
    `Behind the subject: ${BACKDROP_PHRASE[backdrop]}.`,
    'The subject is the clear focal point, never filling the frame edge-to-edge — the breathing room around it is intentional and part of the design.',
  ].join(' ')
}

// ── NB2 dispatch (pattern mirrors houses-generator.ts) ────────
async function fetchWithRateLimitRetry(url: string, options: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const res = await fetch(url, options)
    if (res.status !== 429) return res
    if (attempt === MAX_RATE_LIMIT_RETRIES) return res
    const retryAfter = res.headers.get('Retry-After')
    const seconds = retryAfter ? Number(retryAfter) : NaN
    const delayMs = Number.isFinite(seconds) && seconds > 0
      ? seconds * 1000 : BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
    await new Promise(r => setTimeout(r, delayMs))
  }
  throw new Error('rate-limit retries exhausted')
}

function pickOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0]
  return null
}

async function pollPrediction(getUrl: string, token: string): Promise<string | null> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_DELAY_MS))
    const res = await fetch(getUrl, { headers: { Authorization: `Token ${token}` } })
    if (!res.ok) continue
    const p = await res.json()
    if (p.status === 'succeeded') return pickOutputUrl(p.output)
    if (p.status === 'failed' || p.status === 'canceled')
      throw new Error(`prediction ${p.status}: ${p.error || 'unknown'}`)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sourceImageB64: string = body.source_image_b64
    const effect: PortraitsPresetId = body.effect
    const backdrop: Backdrop = (body.backdrop || 'gradient')
    const framing: Framing   = (body.framing  || 'bust')

    if (!sourceImageB64 || !effect) {
      return NextResponse.json({ error: 'source_image_b64 and effect are required' }, { status: 400 })
    }

    const token = process.env.REPLICATE_API_TOKEN
    if (!token) return NextResponse.json({ error: 'REPLICATE_API_TOKEN not set' }, { status: 500 })

    // Effect + likeness from the existing Portraits engine (reused, not reauthored).
    // Backdrop is carried by the wallpaper block; pass 'gradient' as the neutral base
    // and scale 'fill' so the material renders strong. plaqueText null (plaque cut).
    const core = buildPortraitsPrompt({
      presetId:   effect,
      locationId: 'gradient' as never,
      scale:      'fill' as never,
      plaqueText: null,
    })

    // Wallpaper composition LEADS (NB2 weights early tokens), effect/likeness follows.
    const prompt = `${wallpaperComposition(backdrop, framing)}\n\n${core}`

    const aspectRatio = '9:16'
    const res = await fetchWithRateLimitRetry(REPLICATE_URL, {
      method:  'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        Prefer: `wait=${SYNC_WAIT_SECONDS}`,
      },
      body: JSON.stringify({
        input: {
          prompt,
          image_input:   [`data:image/jpeg;base64,${sourceImageB64}`],
          aspect_ratio:  aspectRatio,
          output_format: 'jpg',
        },
      }),
    })

    if (!res.ok) {
      const t = await res.text()
      return NextResponse.json({ error: `Replicate ${res.status}: ${t.slice(0, 240)}` }, { status: 502 })
    }

    const prediction = await res.json()
    let outputUrl: string | null =
      prediction.status === 'succeeded' && prediction.output ? pickOutputUrl(prediction.output) : null
    if (!outputUrl && prediction.urls?.get) outputUrl = await pollPrediction(prediction.urls.get, token)
    if (!outputUrl) return NextResponse.json({ error: 'no output url' }, { status: 502 })

    const imgRes = await fetch(outputUrl)
    if (!imgRes.ok) return NextResponse.json({ error: 'failed to fetch output image' }, { status: 502 })
    const b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')

    return NextResponse.json({ image_b64: b64, prompt_used: prompt, aspect_ratio: aspectRatio })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
