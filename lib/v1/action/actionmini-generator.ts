// actionmini-generator.ts
// lib/v1/actionmini-generator.ts
//
// Two-stage dispatcher for Action Minis.
//
// Stage 1 — NB2 / google/nano-banana-2 via Replicate. Image-to-image,
// produces a Pass 1 render with figure identity, pose, expression,
// material register, location, and atmospheric character driven by
// the preset registry.
//
// Stage 1.5 — Pass 2 refine (gpt-image-1) via actionmini-pass2.ts.
// Opt-in during pilot rollout (input.refine === true). Refines material
// micro-texture, surface tactility, tiered luminance, and miniature-scale
// credibility — without overriding Pass 1's figure identity, pose, or
// material register. Soft-fails to the Pass 1 output if the refine call
// throws.
//
// No outpaint stage — Action figures don't need the frame margin Houses
// requires (the figure already reads as the centerpiece without external
// padding).

import { ActionMiniPresetId, buildPresetPrompt, ActionMiniRefinements, LocationId, Scale } from './actionmini-presets'
import { resolveLocationId } from './actionmini-blocks'
import { refineActionMini } from './actionmini-pass2'
import { expandActionImage } from './actionmini-expand'
import { swapActionFaces } from './actionmini-faceswap'
import { scoreFaceFidelity } from './actionmini-refine'
import { buildActionPrompt } from './actionmini-prompt'
import type { KineticMedium } from './actionmini-shared'

export type { ActionMiniPresetId, ActionMiniRefinements, LocationId, Scale }
export type { ActionMiniHero, SecondaryFigures, KineticMedium } from './actionmini-shared'

// Aspect ratios — V5 trimmed to 6 to match Landscapes exactly.
// Default is '1:1'. Without this NB2 image-to-image matches the source
// image's aspect ratio, which produces inconsistent dimensions.
export type AspectRatio =
  | '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '16:9'

// ── INPUT ────────────────────────────────────────────────────
export interface ActionMiniInput {
  sourceImageB64:    string
  presetId:          ActionMiniPresetId
  kineticMedium?:    KineticMedium
  locationId?:       LocationId         // user-picked staging; defaults to 'desk'
  scale?:            Scale              // user-picked composition mode; defaults to 'close_up' (Staged)
  aspectRatio?:      AspectRatio        // user-picked output ratio; defaults to '1:1'
  refinements?:      ActionMiniRefinements
  notes?:            string
  refinementTweak?:  string
  replicateApiToken: string
  // Pass 2 controls (opt-in during pilot rollout)
  refine?:           boolean
  openaiApiKey?:     string
  // Outpaint controls — only fires when scale === 'close_up' (Staged).
  // Reads STABILITY_API_KEY from env if not provided.
  stabilityApiKey?:  string
  // ── DEV/POWER-USER OVERRIDES ─────────────────────────────────
  // rawPrompt        → replaces Pass 1 (NB2) prompt entirely. Bypasses
  //                    buildPresetPrompt. preset/location/etc still used
  //                    for non-prompt stages.
  // rawPass2Prompt   → replaces Pass 2 (gpt-image-1) prompt entirely.
  //                    Only meaningful when refine === true.
  // expand           → boolean. false skips Stage 3 outpaint regardless
  //                    of scale. Default true (current behavior).
  // useV7            → true → use buildActionPrompt instead of buildPresetPrompt.
  //                    V7 is the 9-block environment-mode architecture.
  //                    location/scale/kinetic_medium ignored when on.
  // v7Mode           → 'environment' (default) | 'gallery'. Only used
  //                    when useV7 === true.
  rawPrompt?:        string
  rawPass2Prompt?:   string
  expand?:           boolean
  useV7?:            boolean
  v7Mode?:           'environment' | 'gallery'
}

// ── OUTPUT ───────────────────────────────────────────────────
export interface PipelineAttempt {
  attempt:           number     // 1-indexed
  pass1_ms:          number
  pass2_ms:          number | null
  pass2_skipped:     string | null   // reason if skipped
  expand_ms:         number | null
  expand_skipped:    string | null
  swap_ms:           number | null
  swap_skipped:      string | null
  score:             number | null   // face fidelity score (1-10), null if not scored
  score_reason:      string | null
  total_ms:          number
}

export interface ActionMiniResult {
  imageB64:           string
  promptUsed:         string
  refined:            boolean
  refineDurationMs?:  number
  refinePromptUsed?:  string
  expanded:           boolean
  expandDurationMs?:  number
  expandSkipReason?:  string
  swapped:            boolean
  swapDurationMs?:    number
  swapSkipReason?:    string
  finalScore?:        number      // last attempt's score
  finalScoreReason?:  string
  attempts:           PipelineAttempt[]   // all attempts (1 if no retry)
  // Override telemetry
  rawPromptUsed:      boolean   // true if rawPrompt was supplied
  rawPass2PromptUsed: boolean   // true if rawPass2Prompt was supplied
}

// ── REPLICATE — NANO BANANA 2 ────────────────────────────────
// Uses the synchronous prediction endpoint with `Prefer: wait` so the route
// gets the URL back in one round-trip. Falls back to polling if the wait
// times out (rare on short generations).
//
// Retries automatically on 429 (rate limit / shared-pool saturation). NB2
// is one of the hottest models on Replicate's public pool; transient 429s
// from pool scaling are expected. Three retries with exponential backoff
// covers most transient saturation. Honors Retry-After header when present.

const MAX_RATE_LIMIT_RETRIES = 3
const BASE_RETRY_DELAY_MS    = 2000   // 2s, 4s, 8s

async function fetchWithRateLimitRetry(
  url:     string,
  options: RequestInit,
  context: string,
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const res = await fetch(url, options)

    // Success or non-429 error — return as-is for caller to handle
    if (res.status !== 429) return res

    // Final attempt — return the 429 response so caller can throw with body
    if (attempt === MAX_RATE_LIMIT_RETRIES) return res

    // Compute backoff. Honor Retry-After header (in seconds) if present.
    const retryAfter = res.headers.get('Retry-After')
    let delayMs: number
    if (retryAfter) {
      const seconds = Number(retryAfter)
      delayMs = Number.isFinite(seconds) && seconds > 0
        ? seconds * 1000
        : BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
    } else {
      delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
    }

    console.warn(
      `[${context}] Replicate 429, retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES} ` +
      `after ${delayMs}ms${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ''}`,
    )
    await new Promise(r => setTimeout(r, delayMs))
  }

  // Unreachable — loop returns or throws first
  throw new Error('fetchWithRateLimitRetry exhausted retries')
}

async function callNanoBanana(input: {
  prompt:       string
  sourceB64:    string
  aspectRatio:  AspectRatio
  apiToken:     string
}): Promise<string> {
  const dataUri = `data:image/png;base64,${input.sourceB64}`

  const res = await fetchWithRateLimitRetry(
    'https://api.replicate.com/v1/models/google/nano-banana-2/predictions',
    {
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
          aspect_ratio:  input.aspectRatio,
          output_format: 'png',
        },
      }),
    },
    'actionmini',
  )

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
    // Replicate's prediction object includes a `logs` field with the
    // actual model output / failure reason. Without surfacing this we
    // get the unhelpful "Failed to generate image" string and have no
    // diagnostic path. Tail the last 400 chars (the rest is verbose
    // model boot logs).
    const logs = final.logs
      ? ` | logs: ${String(final.logs).slice(-400).replace(/\s+/g, ' ').trim()}`
      : ''
    throw new Error(`replicate_${final.status}: ${reason}${logs}`)
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

// ── PIPELINE THRESHOLDS ──────────────────────────────────────
const MAX_ATTEMPTS    = 2     // 1 initial + 1 retry max
const PASS_THRESHOLD  = 7     // face fidelity score 7+/10 = pass

// ── MAIN ENTRY POINT ─────────────────────────────────────────
export async function generateActionMini(input: ActionMiniInput): Promise<ActionMiniResult> {
  // PROMPT SELECTION — three paths in priority order:
  //   1. rawPrompt — user-supplied, bypasses all assembly
  //   2. V7 builder — buildActionPrompt(preset, mode) when useV7 === true
  //   3. V6.2 builder — buildPresetPrompt(...) default
  // Non-prompt stages (face swap, scoring, retry) run the same way for
  // all three paths.
  const rawPromptUsed = Boolean(input.rawPrompt)
  let prompt: string
  if (rawPromptUsed) {
    prompt = input.rawPrompt as string
  } else if (input.useV7) {
    prompt = buildActionPrompt(input.presetId, input.v7Mode || 'environment')
  } else {
    prompt = buildPresetPrompt({
      presetId:        input.presetId,
      kineticMedium:   input.kineticMedium,
      locationId:      input.locationId,
      scale:           input.scale,
      refinements:     input.refinements,
      notes:           input.notes,
      refinementTweak: input.refinementTweak,
    })
  }

  if (rawPromptUsed) {
    console.log(`[actionmini] RAW MODE — Pass 1 prompt overridden (${prompt.length} chars)`)
  } else if (input.useV7) {
    console.log(`[actionmini] V7 — mode=${input.v7Mode || 'environment'} (${prompt.length} chars)`)
  }

  const rawPass2PromptUsed = Boolean(input.rawPass2Prompt)
  const expandEnabled      = input.expand !== false

  // Default aspect ratio: 1:1. Without this NB2 in image-to-image mode
  // matches the source's aspect ratio, ignoring the user's pick.
  const aspectRatio = input.aspectRatio || '1:1'
  const scaleForExpand: Scale = input.scale || 'close_up'

  // Final result accumulators (overwritten each attempt; last attempt wins)
  let finalImageB64        = ''
  let finalRefined         = false
  let finalRefineMs:        number | undefined
  let finalRefinePrompt:    string | undefined
  let finalExpanded        = false
  let finalExpandMs:        number | undefined
  let finalExpandReason:    string | undefined
  let finalSwapped         = false
  let finalSwapMs:          number | undefined
  let finalSwapReason:      string | undefined
  let finalScore:           number | undefined
  let finalScoreReason:     string | undefined
  const attempts: PipelineAttempt[] = []

  for (let attemptNo = 1; attemptNo <= MAX_ATTEMPTS; attemptNo++) {
    const attemptT0 = Date.now()

    // ── Stage 1: NB2 generate ─────────────────────────────────
    const tPass1 = Date.now()
    let imageB64 = await callNanoBanana({
      prompt,
      sourceB64:   input.sourceImageB64,
      aspectRatio,
      apiToken:    input.replicateApiToken,
    })
    const pass1_ms = Date.now() - tPass1

    // ── Stage 2: Pass 2 refine (gpt-image-1) — opt-in ─────────
    let refined = false
    let refineDurationMs: number | undefined
    let refinePromptUsed: string | undefined
    let pass2_skipped: string | null = 'opt-out'
    if (input.refine === true) {
      if (!input.openaiApiKey) {
        pass2_skipped = 'no openai key'
      } else {
        try {
          const resolvedLocation = resolveLocationId(
            input.presetId,
            input.locationId || 'desk',
          )
          const refineRes = await refineActionMini({
            imageB64,
            sourceImageB64: input.sourceImageB64,
            aspectRatio,
            resolvedLocation,
            presetId:     input.presetId,
            openaiApiKey: input.openaiApiKey,
            customPrompt: input.rawPass2Prompt,  // RAW MODE override
          })
          imageB64         = refineRes.imageB64
          refined          = true
          refineDurationMs = refineRes.durationMs
          refinePromptUsed = refineRes.promptUsed
          pass2_skipped    = null
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'unknown'
          console.error(`[actionmini] refine failed: ${msg}`)
          pass2_skipped = `error: ${msg}`
        }
      }
    }

    // ── Stage 3: Stability outpaint ───────────────────────────
    let expanded = false
    let expandDurationMs: number | undefined
    let expand_skipped: string | null = null
    if (!expandEnabled) {
      expand_skipped = 'disabled by request (body.expand: false)'
    } else {
      try {
        const expandRes = await expandActionImage({
          imageB64,
          scale:           scaleForExpand,
          stabilityApiKey: input.stabilityApiKey,
        })
        if (expandRes.expanded) {
          imageB64         = expandRes.imageB64
          expanded         = true
          expandDurationMs = expandRes.durationMs
        } else {
          expand_skipped = expandRes.reason || 'skipped'
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'unknown'
        console.error(`[actionmini] expand failed: ${msg}`)
        expand_skipped = `error: ${msg}`
      }
    }

    // ── Stage 4: Face swap (Replicate) ────────────────────────
    // Commercial-grade likeness lock. Detects faces in source + render,
    // swaps render's faces for source's. Soft-fails to unswapped.
    let swapped = false
    let swapDurationMs: number | undefined
    let swap_skipped: string | null = null
    try {
      const swapRes = await swapActionFaces({
        renderImageB64:    imageB64,
        sourceImageB64:    input.sourceImageB64,
        replicateApiToken: input.replicateApiToken,
      })
      if (swapRes.swapped) {
        imageB64       = swapRes.imageB64
        swapped        = true
        swapDurationMs = swapRes.durationMs
      } else {
        swap_skipped = swapRes.reason || 'skipped'
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown'
      console.error(`[actionmini] swap failed: ${msg}`)
      swap_skipped = `error: ${msg}`
    }

    // ── Stage 5: Quality gate (face fidelity scoring) ─────────
    // Only runs when openaiApiKey is available. If score < threshold and
    // attempts remain, retry the whole pipeline.
    let score: number | null = null
    let score_reason: string | null = null
    if (input.openaiApiKey) {
      try {
        const scoreRes = await scoreFaceFidelity({
          sourceImageB64:   input.sourceImageB64,
          renderedImageB64: imageB64,
          openaiApiKey:     input.openaiApiKey,
        })
        score = scoreRes.score
        score_reason = scoreRes.reason
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'unknown'
        console.warn(`[actionmini] scoring failed: ${msg}`)
        score_reason = `scoring failed: ${msg}`
      }
    }

    // Record this attempt
    attempts.push({
      attempt:        attemptNo,
      pass1_ms,
      pass2_ms:       refined ? (refineDurationMs ?? null) : null,
      pass2_skipped,
      expand_ms:      expanded ? (expandDurationMs ?? null) : null,
      expand_skipped,
      swap_ms:        swapped ? (swapDurationMs ?? null) : null,
      swap_skipped,
      score,
      score_reason,
      total_ms:       Date.now() - attemptT0,
    })

    // Latest attempt always wins for finals
    finalImageB64     = imageB64
    finalRefined      = refined
    finalRefineMs     = refineDurationMs
    finalRefinePrompt = refinePromptUsed
    finalExpanded     = expanded
    finalExpandMs     = expandDurationMs
    finalExpandReason = expand_skipped ?? undefined
    finalSwapped      = swapped
    finalSwapMs       = swapDurationMs
    finalSwapReason   = swap_skipped ?? undefined
    finalScore        = score ?? undefined
    finalScoreReason  = score_reason ?? undefined

    // Pass / fail check
    const passed = score === null ? true : score >= PASS_THRESHOLD  // no score = no gate
    if (passed) break
    if (attemptNo === MAX_ATTEMPTS) break  // out of retries

    console.warn(
      `[actionmini] attempt ${attemptNo} scored ${score}/10 — retrying ` +
      `(reason: ${score_reason})`,
    )
  }

  const tag = input.refinementTweak ? `${input.presetId} (refined-tweak)` : input.presetId
  console.log(
    `[actionmini] ${tag} done — ${attempts.length} attempt(s) · ` +
    `final score ${finalScore ?? 'n/a'}/10 · ` +
    `pass2 ${finalRefined ? `${finalRefineMs}ms` : 'skipped'} · ` +
    `expand ${finalExpanded ? `${finalExpandMs}ms` : 'skipped'} · ` +
    `swap ${finalSwapped ? `${finalSwapMs}ms` : 'skipped'}`,
  )

  return {
    imageB64:           finalImageB64,
    promptUsed:         prompt,
    refined:            finalRefined,
    refineDurationMs:   finalRefineMs,
    refinePromptUsed:   finalRefinePrompt,
    expanded:           finalExpanded,
    expandDurationMs:   finalExpandMs,
    expandSkipReason:   finalExpandReason,
    swapped:            finalSwapped,
    swapDurationMs:     finalSwapMs,
    swapSkipReason:     finalSwapReason,
    finalScore,
    finalScoreReason,
    attempts,
    rawPromptUsed,
    rawPass2PromptUsed,
  }
}
