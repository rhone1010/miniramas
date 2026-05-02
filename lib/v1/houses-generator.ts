// houses-generator.ts
// lib/v1/houses-generator.ts
//
// Single-stage dispatcher for the Houses silo. Calls Replicate's
// google/nano-banana-2 model with image-to-image input. NO post-processing —
// no levels modulate, no Stability outpaint, no source brightness lift.
// Whatever the model returns is what the user sees.
//
// (All three were removed from action-minis for actively making output
// worse with NB2. Don't bring them back without re-checking.)

import { buildPresetPrompt, getPreset } from './houses-presets'
import { resolveEnvironment, resolveTimeOfDay, MAX_SOURCE_IMAGES } from './houses-shared'
import { expandHouseImage } from './houses-expand'
import type { GenerateRequest, GenerateResult } from './houses-shared'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

// Sync timeout for Replicate `Prefer: wait` header. NB2 typically returns
// in 25–40s for action-minis; houses should be similar.
const SYNC_WAIT_SECONDS = 60

// Polling fallback config — used only if sync wait times out.
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000

export async function generateHouse(input: {
  request:           GenerateRequest
  replicateApiToken: string
}): Promise<GenerateResult> {

  const t0 = Date.now()

  const preset      = getPreset(input.request.preset_id)
  const environment = resolveEnvironment(preset, input.request.environment_id)

  // Default time of day: 'day'. Some presets (haunted/fire/alien/snow_globe)
  // override to night via forcedTimeOfDay regardless of request.
  const timeOfDay   = resolveTimeOfDay(preset, input.request.time_of_day || 'day')

  const prompt = buildPresetPrompt({
    preset,
    environmentId:      input.request.environment_id,
    timeOfDay,
    lightingVariantId:  input.request.lighting_variant_id,
    refinementTweak:    input.request.refinement_tweak,
  })

  // Default aspect ratio: 1:1. Without this NB2 in image-to-image mode
  // matches the source's aspect, which produced inconsistent dimensions
  // across renders. Override with request.aspect_ratio when needed.
  const aspectRatio = input.request.aspect_ratio || '1:1'

  // Build the image_input array — primary source + any additional.
  // Capped at MAX_SOURCE_IMAGES (4). NB2 supports up to 14 but Google's
  // own prompting guide recommends fewer for stability.
  const allSources = [
    input.request.source_image_b64,
    ...(input.request.additional_images_b64 || []),
  ].slice(0, MAX_SOURCE_IMAGES)
  const imageInput = allSources.map(b64 => `data:image/jpeg;base64,${b64}`)

  console.log(
    `[houses/generate] preset=${preset.id} env=${environment} ` +
    `tod=${timeOfDay} ` +
    `variant=${input.request.lighting_variant_id || '-'} ` +
    `aspect=${aspectRatio} ` +
    `sources=${allSources.length} ` +
    `prompt_chars=${prompt.length}`
  )

  const body = {
    input: {
      prompt,
      image_input:    imageInput,
      aspect_ratio:   aspectRatio,
      output_format:  'jpg',
    },
  }

  const res = await fetch(REPLICATE_URL, {
    method:  'POST',
    headers: {
      'Authorization':  `Token ${input.replicateApiToken}`,
      'Content-Type':   'application/json',
      'Prefer':         `wait=${SYNC_WAIT_SECONDS}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Replicate POST failed (${res.status}): ${errText.slice(0, 240)}`)
  }

  const prediction = await res.json()

  // Path A — sync wait succeeded. Most common path with Prefer: wait=60.
  let outputUrl: string | null = null
  if (prediction.status === 'succeeded' && prediction.output) {
    outputUrl = pickOutputUrl(prediction.output)
  }

  // Path B — sync wait timed out, fall back to polling.
  if (!outputUrl && prediction.urls?.get) {
    outputUrl = await pollPrediction(prediction.urls.get, input.replicateApiToken)
  }

  if (!outputUrl) {
    throw new Error(
      `No output URL returned. status=${prediction.status} ` +
      `error=${prediction.error || 'none'}`
    )
  }

  // Fetch the output image and convert to base64.
  const imgRes = await fetch(outputUrl)
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch output image (${imgRes.status})`)
  }
  const buf = Buffer.from(await imgRes.arrayBuffer())
  let b64 = buf.toString('base64')

  // ── Stage 2: optional outpaint for external (frame) margin ──
  // Defaults to ON; pass expand:false to skip. Soft-fails to the
  // un-expanded image if Stability returns an error.
  let expanded = false
  let expandDurationMs: number | undefined = undefined
  const wantExpand = input.request.expand !== false
  if (wantExpand) {
    try {
      const exp = await expandHouseImage({ imageB64: b64 })
      b64              = exp.imageB64
      expanded         = exp.expanded
      expandDurationMs = exp.durationMs
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown'
      console.error(`[houses/generate] expand failed, returning unexpanded: ${msg}`)
    }
  }

  const result: GenerateResult = {
    image_b64:           b64,
    prompt_used:         prompt,
    preset_id:           input.request.preset_id,
    environment_used:    environment,
    time_of_day_used:    timeOfDay,
    source_image_count:  allSources.length,
    lighting_variant_id: input.request.lighting_variant_id,
    aspect_ratio:        aspectRatio,
    expanded,
    expand_duration_ms:  expandDurationMs,
    duration_ms:         Date.now() - t0,
  }

  console.log(
    `[houses/generate] done preset=${preset.id} ` +
    `expanded=${expanded} duration_ms=${result.duration_ms}`
  )

  return result
}

// ── HELPERS ───────────────────────────────────────────────────

function pickOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0]
  return null
}

async function pollPrediction(
  getUrl: string,
  token:  string
): Promise<string | null> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_DELAY_MS))

    const res = await fetch(getUrl, {
      headers: { 'Authorization': `Token ${token}` },
    })
    if (!res.ok) continue

    const p = await res.json()

    if (p.status === 'succeeded') {
      return pickOutputUrl(p.output)
    }
    if (p.status === 'failed' || p.status === 'canceled') {
      throw new Error(`Prediction ${p.status}: ${p.error || 'unknown'}`)
    }
  }
  return null
}
