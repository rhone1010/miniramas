// lib/v1/landscapes-generator.ts
// Replicate google/nano-banana-2 dispatcher.
// Surfaces a distinct `busy` signal when Replicate signals queue exhaustion —
// the route handler converts that to the deferred-render response per UI Claude's contract.

import Replicate from 'replicate'
import { LandscapeParams, AspectRatio } from './landscapes-shared'
import { buildLandscapePrompt } from './landscapes-blocks'
import { rowLabel } from './landscapes-presets'

const NB2_MODEL = 'google/nano-banana-2'

// Class so the route can `instanceof` check for busy vs other failures
export class StudioAtCapacityError extends Error {
  estimatedMinutes: number | null
  constructor(estimatedMinutes: number | null = null) {
    super('studio_at_capacity')
    this.name = 'StudioAtCapacityError'
    this.estimatedMinutes = estimatedMinutes
  }
}

export interface GenerateInput {
  sourceImageB64:   string
  extraImages?:     string[]
  params:           LandscapeParams
  aspectRatio:      AspectRatio
  replicateApiKey:  string
}

export interface GenerateOutput {
  imageB64:    string
  promptUsed:  string
}

// Pattern strings used to detect Replicate capacity errors.
// Replicate returns these in error messages when the queue is saturated or rate-limited.
const CAPACITY_PATTERNS = [
  'rate limit',
  'rate-limit',
  'rate_limit',
  'capacity',
  'queue full',
  'queue is full',
  'too many requests',
  '429',
  '503',
]

function isCapacityError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase()
  if (CAPACITY_PATTERNS.some(p => msg.includes(p))) return true
  // Replicate SDK sometimes attaches HTTP status
  if (err?.status === 429 || err?.status === 503) return true
  return false
}

export async function generateLandscape(input: GenerateInput): Promise<GenerateOutput> {
  const { params } = input

  const prompt = buildLandscapePrompt(params)
  console.log(`[landscapes-generator] ${rowLabel(params)} — ${prompt.length} chars`)

  // Build image_input array — primary first, then extras (cap at 4 total).
  const allImages = [input.sourceImageB64, ...(input.extraImages || [])].slice(0, 4)
  const imageInputs = allImages.map(b64 => `data:image/jpeg;base64,${b64}`)

  const replicate = new Replicate({ auth: input.replicateApiKey })

  let output: any
  try {
    output = await replicate.run(NB2_MODEL as any, {
      input: {
        prompt,
        image_input:  imageInputs,
        aspect_ratio: input.aspectRatio,
        output_format: 'jpg',
      },
    })
  } catch (err: any) {
    if (isCapacityError(err)) {
      console.warn('[landscapes-generator] capacity error from Replicate:', err.message)
      throw new StudioAtCapacityError(null)
    }
    throw err
  }

  // NB2 returns a URL or array of URLs depending on version
  const imageUrl = Array.isArray(output) ? output[0] : output
  if (!imageUrl) throw new Error('landscape_generation_no_output')

  // Download the URL into base64
  const res = await fetch(String(imageUrl))
  if (!res.ok) throw new Error(`landscape_generation_fetch_failed_${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const b64 = buf.toString('base64')

  return { imageB64: b64, promptUsed: prompt }
}
