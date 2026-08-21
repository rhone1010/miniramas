// lib/v1/halloween/halloween-generator.ts
//
// HALLOWEEN ON LITENCO MAIN - orchestrator. NB2, 1:1.
//
// ── WHY THIS IS ITS OWN FILE AND NOT A BRANCH IN PORTRAITS ─────────────
//
// Rich's call, 20 August: own prompts, own route, own generator.
//
// The alternative was a halloween branch inside portraits-generator.ts,
// which is smaller in lines and larger in risk. Portraits is the soft-launch
// path. Adding a third prompt source to it means editing
// PortraitsGenerateRequest, which means preset_id goes optional, which
// ripples through resolvePresetForSubject, loadStyleRefs, the result object
// and buildFatalResult - five edits to a live path, to ship a room that has
// no page yet.
//
// This file touches nothing that already works. If Halloween is wrong,
// Portraits is unaffected.
//
// ── WHAT IT REUSES ─────────────────────────────────────────────────────
//
// The SCORING, not the orchestrator. detectFaceVisibility and
// scoreSingleFaceFidelity come from portraits-refine, and
// evaluateSingleFaceScore from portraits-shared. A Halloween render is a
// human face that has to stay recognisable, which is the same question
// Portraits asks, so it gets the same answer from the same code.
//
// The signatures below were read from their call sites in
// portraits-generator.ts (lines 112-120 and 294-303) rather than from
// portraits-refine.ts, which was not open when this was written. If the
// module disagrees, the module is right.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────
//
// NO STYLE REFERENCE PLATES. Portraits sends up to two plates per effect
// and a plate outranks the prompt. There are no Halloween plates - the 28
// files in public/previews/halloween/ are catalog thumbnails, one per
// effect, not style references. Sending a thumbnail as a style ref would
// pull every render toward the face already in it.
//
// NO POSE PHRASE. Portraits appends one after the body. These bodies stage
// themselves - howling, reaching, riding, bursting from water - and a pose
// appended afterwards is the later instruction on the same axis.
//
// NO PLAQUE, NO SCALE, NO LOCATION, NO OUTPAINT. Each body carries its own
// background. There is nothing to place, nothing to inscribe and no margin
// to add.
//
// NO BUST OR SCULPTURE LANGUAGE ANYWHERE. Rich, 20 August: those words send
// NB2 to classical statuary, which arrives with the arms cut off. The
// framing constant in halloween-catalog.ts says chest to the top of the
// head and says it without either word. Do not reintroduce them here.

import {
  HALLOWEEN_MAIN,
  buildHalloweenPrompt,
  isHalloweenEffect,
} from './halloween-catalog'
import { MAIN_ASPECT } from '../shared/render-aspect'
import {
  detectFaceVisibility,
  scoreSingleFaceFidelity,
} from '../portraits/portraits-refine'
import {
  evaluateSingleFaceScore,
  MAX_ATTEMPTS,
  MAX_SOURCE_IMAGES,
  SINGLE_FACE_THRESHOLD,
  type PerFigureScore,
} from '../portraits/portraits-shared'

const SYNC_WAIT_SECONDS      = 60
const POLL_MAX_ATTEMPTS      = 30
const POLL_DELAY_MS          = 2000
const MAX_RATE_LIMIT_RETRIES = 3
const BASE_RETRY_DELAY_MS    = 2000

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface HalloweenGenerateRequest {
  source_image_b64:       string
  additional_images_b64?: string[]

  /** An id in HALLOWEEN_MAIN. Required - there is no default effect and no
   *  composed fallback. An unknown id is a 400 from the route, not a
   *  render of nothing. */
  effect_id:              string

  /** Overrides MAIN_ASPECT. Present so the bench can shoot a body at
   *  another shape without editing anything; the room itself is 1:1. */
  aspect_ratio?:          string

  is_preview?:            boolean
}

export interface HalloweenAttempt {
  attempt:            number
  prompt_used:        string
  duration_ms:        number
  per_figure_scores?: PerFigureScore[]
  passed:             boolean
  pass_reason:        string
}

export interface HalloweenGenerateResult {
  ok:                    boolean
  image_b64:             string | null
  prompt_used:           string
  effect:                string
  label:                 string
  aspect_ratio:          string

  faces_detected_source: number
  face_visible:          boolean

  attempts:              HalloweenAttempt[]
  final_pass:            boolean
  final_reason:          string

  fatal_error:           string | null
  error_code?:           string
  retryable?:            boolean
  duration_ms:           number
}

export interface GenerateHalloweenInput {
  request:           HalloweenGenerateRequest
  replicateApiToken: string
  openaiApiKey?:     string
}

// ═══════════════════════════════════════════════════════════════
// PRIMARY ENTRY POINT
// ═══════════════════════════════════════════════════════════════

export async function generateHalloweenRender(
  input: GenerateHalloweenInput,
): Promise<HalloweenGenerateResult> {

  const t0  = Date.now()
  const req = input.request

  if (!isHalloweenEffect(req.effect_id)) {
    return buildFatalResult({
      msg:      `unknown halloween effect: ${req.effect_id}`,
      code:     'unknown_effect',
      retry:    false,
      prompt:   '',
      effectId: req.effect_id,
      label:    '',
      aspect:   req.aspect_ratio || MAIN_ASPECT,
      attempts: [],
      t0,
    })
  }

  const effect       = HALLOWEEN_MAIN[req.effect_id]
  const aspectRatio  = req.aspect_ratio || MAIN_ASPECT

  // Body + framing. Assembled once, outside the attempt loop: nothing in
  // the loop varies it, and a retry re-sending the identical prompt is the
  // intended behaviour - the retry exists because NB2 is stochastic, not
  // because the prompt was wrong.
  const prompt = buildHalloweenPrompt(req.effect_id)

  // ── Stage 0: face visibility ─────────────────────────────────
  //
  // Informational. It does NOT gate the render: a Halloween body can be
  // built on a face turned three-quarters away and still be the piece the
  // customer wanted. It is logged so a run of poor scores can be traced to
  // the source rather than to the body.
  let faceVisible  = true
  let facesInSource = 1
  if (input.openaiApiKey) {
    try {
      const det = await detectFaceVisibility({
        sourceImageB64: req.source_image_b64,
        openaiApiKey:   input.openaiApiKey,
      })
      faceVisible   = det.face_visible
      facesInSource = det.subject_count_estimate
      if (!faceVisible) {
        console.warn('[halloween] stage 0: no clear face in source — rendering anyway')
      }
    } catch (e: any) {
      console.warn(`[halloween] stage 0 detection failed (non-fatal): ${e?.message}`)
    }
  }

  const attempts: HalloweenAttempt[] = []
  let finalImageB64: string | null = null

  console.log(
    `[halloween] effect=${effect.id} aspect=${aspectRatio} ` +
    `chars=${prompt.length} sources=${1 + (req.additional_images_b64?.length || 0)} ` +
    `faces_src=${facesInSource}`,
  )

  // ── ATTEMPT LOOP ─────────────────────────────────────────────
  for (let attemptIdx = 1; attemptIdx <= MAX_ATTEMPTS; attemptIdx++) {

    const attemptT0 = Date.now()
    console.log(`[halloween] attempt ${attemptIdx}/${MAX_ATTEMPTS} effect=${effect.id}`)

    let imageB64: string
    try {
      imageB64 = await callNB2({
        prompt,
        sourceImageB64:      req.source_image_b64,
        additionalImagesB64: req.additional_images_b64 || [],
        aspectRatio,
        replicateApiToken:   input.replicateApiToken,
      })
    } catch (e: any) {
      const msg = e?.message || 'nb2 generate failed'
      console.error(`[halloween] attempt ${attemptIdx} NB2 failed: ${msg}`)
      return buildFatalResult({
        msg,
        code:     'nb2_failed',
        retry:    true,
        prompt,
        effectId: effect.id,
        label:    effect.label,
        aspect:   aspectRatio,
        attempts,
        t0,
      })
    }

    // ── Scoring ──
    //
    // Same question Portraits asks: is this still the person in the source.
    // A Halloween body transforms the face on purpose - antlers, porcelain,
    // fur, bone - so the scorer is being asked whether the LIKENESS survived
    // the transformation, not whether the face was left alone.
    //
    // WATCH THIS THRESHOLD. It is Portraits' 8, unchanged, and it has never
    // been run against a Halloween render. If good pieces come back failing,
    // the threshold is wrong for this room and not the bodies. Render
    // strictness above 6 has already refused good work once on the material
    // effects.
    let perFigureScore: PerFigureScore | undefined
    let evalPassed = false
    let evalReason = 'no scoring performed'

    if (input.openaiApiKey) {
      try {
        perFigureScore = await scoreSingleFaceFidelity({
          sourceImageB64:   req.source_image_b64,
          renderedImageB64: imageB64,
          openaiApiKey:     input.openaiApiKey,
        })
        const evaluated = evaluateSingleFaceScore(perFigureScore, SINGLE_FACE_THRESHOLD)
        evalPassed = evaluated.passed
        evalReason = evaluated.reason
      } catch (e: any) {
        console.warn(`[halloween] scoring failed: ${e?.message}`)
        evalReason = `scoring error: ${e?.message}`
      }
    }

    attempts.push({
      attempt:           attemptIdx,
      prompt_used:       prompt,
      duration_ms:       Date.now() - attemptT0,
      per_figure_scores: perFigureScore ? [perFigureScore] : undefined,
      passed:            evalPassed,
      pass_reason:       evalReason,
    })

    if (evalPassed || attemptIdx === MAX_ATTEMPTS) {
      finalImageB64 = imageB64
      console.log(
        `[halloween] attempt ${attemptIdx} ${evalPassed ? 'PASSED' : 'EXHAUSTED'} — ${evalReason}`,
      )
      break
    }

    console.log(`[halloween] attempt ${attemptIdx} FAILED — ${evalReason}; retrying`)
  }

  return {
    ok:                    true,
    image_b64:             finalImageB64,
    prompt_used:           prompt,
    effect:                effect.id,
    label:                 effect.label,
    aspect_ratio:          aspectRatio,
    faces_detected_source: facesInSource,
    face_visible:          faceVisible,
    attempts,
    final_pass:            attempts[attempts.length - 1]?.passed || false,
    final_reason:          attempts[attempts.length - 1]?.pass_reason || 'no attempts',
    fatal_error:           null,
    duration_ms:           Date.now() - t0,
  }
}

// ═══════════════════════════════════════════════════════════════
// NB2
// ═══════════════════════════════════════════════════════════════

async function callNB2(args: {
  prompt:              string
  sourceImageB64:      string
  additionalImagesB64: string[]
  aspectRatio:         string
  replicateApiToken:   string
}): Promise<string> {

  // MAX_SOURCE_IMAGES is 4 here, well under NB2's ceiling of 14. The cap is
  // a product decision rather than a model limit.
  const images = [args.sourceImageB64, ...args.additionalImagesB64]
    .slice(0, MAX_SOURCE_IMAGES)
    .map(b64 => `data:image/jpeg;base64,${b64}`)

  const res = await fetchWithRateLimitRetry(REPLICATE_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Token ${args.replicateApiToken}`,
      'Content-Type': 'application/json',
      Prefer:         `wait=${SYNC_WAIT_SECONDS}`,
    },
    body: JSON.stringify({
      input: {
        prompt:        args.prompt,
        image_input:   images,
        aspect_ratio:  args.aspectRatio,
        output_format: 'jpg',
      },
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Replicate ${res.status}: ${t.slice(0, 240)}`)
  }

  const prediction = await res.json()
  let outputUrl: string | null =
    prediction.status === 'succeeded' && prediction.output
      ? pickOutputUrl(prediction.output)
      : null
  if (!outputUrl && prediction.urls?.get) {
    outputUrl = await pollPrediction(prediction.urls.get, args.replicateApiToken)
  }
  if (!outputUrl) throw new Error('no output url from NB2')

  const imgRes = await fetch(outputUrl)
  if (!imgRes.ok) throw new Error('failed to fetch output image')
  return Buffer.from(await imgRes.arrayBuffer()).toString('base64')
}

async function fetchWithRateLimitRetry(
  url: string,
  options: RequestInit,
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const res = await fetch(url, options)
    if (res.status !== 429) return res
    if (attempt === MAX_RATE_LIMIT_RETRIES) return res
    const retryAfter = res.headers.get('Retry-After')
    const seconds = retryAfter ? Number(retryAfter) : NaN
    const delayMs = Number.isFinite(seconds) && seconds > 0
      ? seconds * 1000
      : BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
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
    if (p.status === 'failed' || p.status === 'canceled') {
      throw new Error(`prediction ${p.status}: ${p.error || 'unknown'}`)
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function buildFatalResult(args: {
  msg:      string
  code:     string
  retry:    boolean
  prompt:   string
  effectId: string
  label:    string
  aspect:   string
  attempts: HalloweenAttempt[]
  t0:       number
}): HalloweenGenerateResult {
  return {
    ok:                    false,
    image_b64:             null,
    prompt_used:           args.prompt,
    effect:                args.effectId,
    label:                 args.label,
    aspect_ratio:          args.aspect,
    faces_detected_source: 0,
    face_visible:          false,
    attempts:              args.attempts,
    final_pass:            false,
    final_reason:          `failure: ${args.msg}`,
    fatal_error:           args.msg,
    error_code:            args.code,
    retryable:             args.retry,
    duration_ms:           Date.now() - args.t0,
  }
}
