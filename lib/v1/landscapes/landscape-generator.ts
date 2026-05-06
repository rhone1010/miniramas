// lib/v1/landscapes/landscape-generator.ts
//
// Single-stage NB2 dispatcher for the Landscape silo. Calls Replicate's
// google/nano-banana-2 model with image-to-image input.
//
// Updated to use the new substitution-based prompt builder
// (landscapes-prompt.ts) and the current schema field names from
// landscapes-shared.ts. The previous presetId / sourceProfileId / per-preset
// resolveEnvironment scaffolding is gone.
//
// Capacity errors from Replicate are surfaced as StudioAtCapacityError so the
// route can map them to the 202 deferred-render response per the UI contract.

import { buildLandscapePrompt } from './landscape-prompt'
import { rowLabel } from './landscape-presets'
import { MAX_SOURCE_IMAGES } from './landscape-shared'
import type { LandscapeParams } from './landscape-shared'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000

const CAPACITY_PATTERNS = [
  'rate limit', 'rate-limit', 'rate_limit',
  'capacity', 'queue full', 'queue is full',
  'too many requests', '429', '503',
]

export class StudioAtCapacityError extends Error {
  estimatedMinutes: number | null
  constructor(estimatedMinutes: number | null = null) {
    super('studio_at_capacity')
    this.name = 'StudioAtCapacityError'
    this.estimatedMinutes = estimatedMinutes
  }
}

function isCapacityError(err: any, statusCode?: number): boolean {
  if (statusCode === 429 || statusCode === 503) return true
  const msg = String(err?.message || err || '').toLowerCase()
  return CAPACITY_PATTERNS.some(p => msg.includes(p))
}

// ── INPUT/OUTPUT ──────────────────────────────────────────────
export interface GenerateInput {
  params:                LandscapeParams
  sourceImageB64:        string
  additionalImagesB64?:  string[]
  replicateApiToken:     string
}

export interface GenerateOutput {
  imageB64:           string
  promptUsed:         string
  sourceImageCount:   number
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────
export async function generateLandscape(input: GenerateInput): Promise<GenerateOutput> {
  const { params } = input

  const prompt = buildLandscapePrompt(params)

  const allSources = [
    input.sourceImageB64,
    ...(input.additionalImagesB64 || []),
  ].slice(0, MAX_SOURCE_IMAGES)
  const imageInput = allSources.map(b64 => `data:image/jpeg;base64,${b64}`)

  console.log(
    `[landscape/generate] ${rowLabel(params)} ` +
    `aspect=${params.aspectRatio} sources=${allSources.length} ` +
    `prompt_chars=${prompt.length}`
  )

  const body = {
    input: {
      prompt,
      image_input:    imageInput,
      aspect_ratio:   params.aspectRatio,
      output_format:  'jpg',
    },
  }

  let res: Response
  try {
    res = await fetch(REPLICATE_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Token ${input.replicateApiToken}`,
        'Content-Type':  'application/json',
        'Prefer':        `wait=${SYNC_WAIT_SECONDS}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err: any) {
    if (isCapacityError(err)) throw new StudioAtCapacityError(null)
    throw err
  }

  if (!res.ok) {
    const errText = await res.text()
    if (isCapacityError(errText, res.status)) throw new StudioAtCapacityError(null)
    throw new Error(`Replicate POST failed (${res.status}): ${errText.slice(0, 240)}`)
  }

  const prediction: any = await res.json()

  let outputUrl: string | null = null
  if (prediction.status === 'succeeded' && prediction.output) {
    outputUrl = pickOutputUrl(prediction.output)
  }

  if (!outputUrl && prediction.status === 'failed') {
    if (isCapacityError(prediction.error || prediction.logs)) throw new StudioAtCapacityError(null)
    throw new Error(formatPredictionError(prediction))
  }

  if (!outputUrl && prediction.urls?.get) {
    outputUrl = await pollPrediction(prediction.urls.get, input.replicateApiToken)
  }

  if (!outputUrl) {
    if (isCapacityError(prediction.error || prediction.logs)) throw new StudioAtCapacityError(null)
    throw new Error(formatPredictionError(prediction))
  }

  const imgRes = await fetch(outputUrl)
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch output image (${imgRes.status})`)
  }
  const buf = Buffer.from(await imgRes.arrayBuffer())

  return {
    imageB64:         buf.toString('base64'),
    promptUsed:       prompt,
    sourceImageCount: allSources.length,
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function pickOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0]
  return null
}

async function pollPrediction(
  getUrl: string,
  token:  string,
): Promise<string | null> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_DELAY_MS))

    const res = await fetch(getUrl, {
      headers: { 'Authorization': `Token ${token}` },
    })
    if (!res.ok) {
      if (isCapacityError(await res.text().catch(() => ''), res.status)) {
        throw new StudioAtCapacityError(null)
      }
      continue
    }

    const p: any = await res.json()

    if (p.status === 'succeeded') return pickOutputUrl(p.output)
    if (p.status === 'failed' || p.status === 'canceled') {
      if (isCapacityError(p.error || p.logs)) throw new StudioAtCapacityError(null)
      throw new Error(formatPredictionError(p))
    }
  }
  return null
}

// Build a rich error string from a Replicate prediction object.
// Surfaces: error field, last few lines of logs, model status, prediction id.
// This is what shows up in the UI error log + per-card "what went wrong" text.
function formatPredictionError(p: any): string {
  const parts: string[] = []

  // Header — status + prediction id (so the user can find it in Replicate dashboard)
  const status = p.status || 'unknown'
  const id     = p.id ? ` [${p.id}]` : ''
  parts.push(`NB2 prediction ${status}${id}`)

  // Replicate's structured error string, if present
  if (p.error && String(p.error).trim() && String(p.error).trim() !== status) {
    parts.push(`error: ${String(p.error).trim()}`)
  }

  // Model logs — last ~6 non-empty lines, where the real reason usually lives
  if (p.logs && typeof p.logs === 'string') {
    const lines = p.logs
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0)
    const tail = lines.slice(-6)
    if (tail.length) parts.push(`logs:\n  ${tail.join('\n  ')}`)
  }

  return parts.join(' · ')
}
