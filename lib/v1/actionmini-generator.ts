// lib/v1/actionmini-generator.ts
// Dispatcher for Action Minis. Builds the prompt from the registry and calls
// nano-banana-2 on Replicate. No source pre-processing — nano banana exposes
// correctly on its own.

import { ActionMiniPresetId, buildPresetPrompt, ActionMiniRefinements, LocationId } from './actionmini-presets'
import type { KineticMedium } from './actionmini-shared'

export type { ActionMiniPresetId, ActionMiniRefinements, LocationId }
export type { ActionMiniHero, SecondaryFigures, KineticMedium } from './actionmini-shared'

// ── INPUT ────────────────────────────────────────────────────
export interface ActionMiniInput {
  sourceImageB64:    string
  presetId:          ActionMiniPresetId
  kineticMedium?:    KineticMedium
  locationId?:       LocationId         // user-picked staging; defaults to on_a_desk
  refinements?:      ActionMiniRefinements
  notes?:            string
  refinementTweak?:  string
  replicateApiToken: string
}

// ── OUTPUT ───────────────────────────────────────────────────
export interface ActionMiniResult {
  imageB64:    string
  promptUsed:  string
}

// ── REPLICATE — NANO BANANA 2 ────────────────────────────────
// Uses the synchronous prediction endpoint with `Prefer: wait` so the route
// gets the URL back in one round-trip. Falls back to polling if the wait
// times out (rare on short generations).
async function callNanoBanana(input: {
  prompt:    string
  sourceB64: string
  apiToken:  string
}): Promise<string> {
  const dataUri = `data:image/png;base64,${input.sourceB64}`

  const res = await fetch('https://api.replicate.com/v1/models/google/nano-banana-2/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${input.apiToken}`,
      'Content-Type':  'application/json',
      'Prefer':        'wait=60',
    },
    body: JSON.stringify({
      input: {
        prompt:        input.prompt,
        image_input:   [dataUri],
        output_format: 'png',
      },
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`replicate_failed: ${res.status} — ${errBody.slice(0, 300)}`)
  }

  const prediction: any = await res.json()

  // If still running, poll until terminal
  let final = prediction
  while (final.status === 'starting' || final.status === 'processing') {
    await new Promise(r => setTimeout(r, 1500))
    const pollRes = await fetch(final.urls.get, {
      headers: { 'Authorization': `Bearer ${input.apiToken}` },
    })
    if (!pollRes.ok) throw new Error(`replicate_poll_failed: ${pollRes.status}`)
    final = await pollRes.json()
  }

  if (final.status !== 'succeeded') {
    const reason = final.error || final.status
    throw new Error(`replicate_${final.status}: ${reason}`)
  }

  // nano-banana-2 returns either a string URL or array — handle both
  const outputUrl: string = Array.isArray(final.output) ? final.output[0] : final.output
  if (!outputUrl) throw new Error('replicate_no_output')

  // Download the image and return as base64
  const imgRes = await fetch(outputUrl)
  if (!imgRes.ok) throw new Error(`output_fetch_failed: ${imgRes.status}`)
  const imgBuf = Buffer.from(await imgRes.arrayBuffer())
  return imgBuf.toString('base64')
}

// ── MAIN ENTRY POINT ─────────────────────────────────────────
export async function generateActionMini(input: ActionMiniInput): Promise<ActionMiniResult> {
  const prompt = buildPresetPrompt({
    presetId:        input.presetId,
    kineticMedium:   input.kineticMedium,
    locationId:      input.locationId,
    refinements:     input.refinements,
    notes:           input.notes,
    refinementTweak: input.refinementTweak,
  })

  const imageB64 = await callNanoBanana({
    prompt,
    sourceB64: input.sourceImageB64,
    apiToken:  input.replicateApiToken,
  })

  const tag = input.refinementTweak ? `${input.presetId} (refined)` : input.presetId
  console.log(`[actionmini] ${tag} done — prompt ${prompt.length} chars`)
  return { imageB64, promptUsed: prompt }
}
