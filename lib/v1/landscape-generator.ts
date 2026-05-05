// landscape-generator.ts
// lib/v1/landscape-generator.ts
//
// Single-stage NB2 dispatcher for the Landscape silo. Calls Replicate's
// google/nano-banana-2 model with image-to-image input. Mirrors the
// houses-generator.ts pattern exactly — sync wait with `Prefer: wait=60`,
// polling fallback, no source pre-processing.
//
// Capacity errors from Replicate are surfaced as StudioAtCapacityError
// so the route can map them to the 202 deferred-render response per the
// existing UI contract.

import { buildLandscapePrompt } from './landscape-blocks'
import { getPreset, rowLabel } from './landscape-presets'
import { resolveEnvironment, resolveTimeOfDay, MAX_SOURCE_IMAGES } from './landscape-shared'
import type { LandscapeParams, RenderResult } from './landscape-shared'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT_SECONDS  = 60
const POLL_MAX_ATTEMPTS  = 30
const POLL_DELAY_MS      = 2000

// Replicate capacity-error patterns. Surfaced via StudioAtCapacityError
// so the route can return 202 deferred per the UI contract.
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
  environmentUsed:    LandscapeParams['environmentId']
  timeOfDayUsed:      LandscapeParams['tod']
  sourceImageCount:   number
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────
export async function generateLandscape(input: GenerateInput): Promise<GenerateOutput> {
  const { params } = input
  const preset = getPreset(params.presetId)

  const env = resolveEnvironment(preset, params.environmentId)
  const tod = resolveTimeOfDay(preset, params.atmosphereId, params.tod)

  const prompt = buildLandscapePrompt({
    preset,
    environmentId:   params.environmentId,
    atmosphereId:    params.atmosphereId,
    scaleId:         params.scaleId,
    timeOfDay:       params.tod,
    sourceProfileId: params.sourceProfileId,
  })

  // Build image_input — primary + extras, capped at 4
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

  // POST prediction with sync wait
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

  // Path A — sync wait succeeded
  let outputUrl: string | null = null
  if (prediction.status === 'succeeded' && prediction.output) {
    outputUrl = pickOutputUrl(prediction.output)
  }

  // Path B — sync wait timed out, poll
  if (!outputUrl && prediction.urls?.get) {
    outputUrl = await pollPrediction(prediction.urls.get, input.replicateApiToken)
  }

  // Capacity errors can also appear at the prediction level
  if (!outputUrl) {
    const reason = prediction.error || prediction.status || 'no output'
    if (isCapacityError(reason)) throw new StudioAtCapacityError(null)
    throw new Error(`No output URL returned. status=${prediction.status} error=${prediction.error || 'none'}`)
  }

  // Fetch output image
  const imgRes = await fetch(outputUrl)
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch output image (${imgRes.status})`)
  }
  const buf = Buffer.from(await imgRes.arrayBuffer())

  return {
    imageB64:         buf.toString('base64'),
    promptUsed:       prompt,
    environmentUsed:  env,
    timeOfDayUsed:    tod,
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
      const reason = p.error || p.status
      if (isCapacityError(reason)) throw new StudioAtCapacityError(null)
      throw new Error(`Prediction ${p.status}: ${reason}`)
    }
  }
  return null
}
