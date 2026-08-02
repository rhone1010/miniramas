// lib/v1/portraits/portraits-generator.ts
//
// Orchestrator for the Portraits silo. Mirrors groups-generator.ts but
// scoped to single-subject. Pipeline branches by style:
//
// Realistic + Resolving (NB2):
//   Stage 0  Pre-flight face-visibility detection
//   Stage 1  NB2 image-to-image generate (minimal prompt — portraits-prompt.ts)
//   Stage 2  SKIPPED — Pass 2 disabled per pipeline config
//   Stage 3  SKIPPED — no post-process margin (subject-IS-the-piece silo
//            per the carryover doc; NB2 native framing ships)
//   Stage 4  SKIPPED — face swap disabled per pipeline config
//   Stage 5  Single-face fidelity scoring with up to 1 retry on threshold fail
//
// Tribal Wall Masks + Tribal Statue (gpt-image-1):
//   Stage 0  Pre-flight face-visibility detection
//   Stage 1  gpt-image-1 generate
//   Stage 2  SKIPPED
//   Stage 3  SKIPPED
//   Stage 4  SKIPPED — likeness intentionally abstracted
//   Stage 5  Holistic caricature scoring with up to 1 retry on threshold fail
//
// Diverges from groups-generator in these ways:
//   - No subject_count plumbing (always 1).
//   - No arrangement parameter.
//   - Single-face scoring instead of size-tiered per-figure scoring.
//   - Different evaluator (evaluateSingleFaceScore vs evaluateGroupScores).
//   - The result object preserves shape parity with Groups (per_figure_scores
//     is a length-1 array) for frontend symmetry.

import { buildPortraitsPrompt } from './portraits-prompt'
import sharp from 'sharp'
import {
  scoreSingleFaceFidelity,
  scoreHolisticCaricature,
  detectFaceVisibility,
} from './portraits-refine'
import {
  evaluateSingleFaceScore,
  evaluateCaricatureScore,
  resolveLocation,
  defaultAspectForStyle,
  normalizeFraming,
  outputDimensions,
  STYLE_PIPELINE,
  MAX_ATTEMPTS,
  MAX_SOURCE_IMAGES,
  SINGLE_FACE_THRESHOLD,
  type PortraitsGenerateRequest,
  type PortraitsGenerateResult,
  type PortraitsAttempt,
  type PortraitsStyleId,
  type PortraitsPresetId,
  type LocationId,
  type Scale,
  type ResolutionTier,
  type PerFigureScore,
  type HolisticCaricatureScore,
} from './portraits-shared'

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

// ─── PRIMARY ENTRY POINT ─────────────────────────────────────────

export interface GeneratePortraitsInput {
  request:           PortraitsGenerateRequest
  replicateApiToken: string
  openaiApiKey?:     string
  stabilityApiKey?:  string   // accepted for shape parity with Groups; unused
  refineOverride?:   boolean
}

export async function generatePortraitsRender(
  input: GeneratePortraitsInput,
): Promise<PortraitsGenerateResult> {

  const t0  = Date.now()
  const req = input.request

  const styleId:    PortraitsStyleId  = req.style_id
  const pipeline                       = STYLE_PIPELINE[styleId]
  const presetId:   PortraitsPresetId = req.preset_id
  const scale:      Scale             = req.scale || 'close_up'
  const aspectRatio:string            = req.aspect_ratio || defaultAspectForStyle(styleId)

  // Stage 0: face-visibility detection. For Portraits subject_count is
  // informational only — we always render one piece. But we still log
  // when the source has more than one hero subject so the silo can
  // surface that to the user via the analyze endpoint.
  let detectedFaceVisible = true
  let detectedSubjectCount = 1
  if (input.openaiApiKey) {
    try {
      const det = await detectFaceVisibility({
        sourceImageB64: req.source_image_b64,
        openaiApiKey:   input.openaiApiKey,
      })
      detectedFaceVisible  = det.face_visible
      detectedSubjectCount = det.subject_count_estimate
      console.log(
        `[portraits] detect: face_visible=${det.face_visible} ` +
        `count=${det.subject_count_estimate} reason="${det.reason}"`,
      )
      if (det.subject_count_estimate > 1) {
        console.log(
          `[portraits] source has ${det.subject_count_estimate} hero subjects — ` +
          `NB2 will render whichever is most prominent`,
        )
      }
    } catch (e: any) {
      console.warn(`[portraits] detection failed: ${e?.message}`)
    }
  }

  // Locations resolved AFTER detection so we have everything in one place.
  const locationId: LocationId = resolveLocation(styleId, presetId, req.location_id)

  // Pass 2 decision: explicit override > pipeline config.
  const refineEnabled = input.refineOverride !== undefined
    ? input.refineOverride
    : pipeline.passTwoEnabled
  const refineDecision = input.refineOverride !== undefined
    ? `explicit (override=${input.refineOverride})`
    : `pipeline: style=${styleId}, passTwoEnabled=${pipeline.passTwoEnabled}, refine=${refineEnabled}`

  // Style references — Portraits ships with the loader removed. User-
  // supplied refs still flow through.
  const styleRefs = req.style_reference_b64 ? [req.style_reference_b64] : []

  const attempts: PortraitsAttempt[] = []
  let finalImageB64: string | null = null
  let finalPromptUsed = ''

  // Telemetry survives across attempts.
  let lastRefined        = false
  let lastRefineMs:      number | null = null
  let lastExpanded       = false
  let lastExpandMs:      number | null = null
  let lastExpandSkip:    string | null = null
  const lastSwapped      = false
  const lastSwapMs:      number | null = null
  let lastSwapSkip:      string | null = null
  let lastFacesSrc       = detectedSubjectCount
  let lastFacesRender    = 0
  const lastMatchStrategy: 'embedding' | 'positional' | 'manual' | 'fallback' = 'fallback'

  // ─── ATTEMPT LOOP ────────────────────────────────────────────
  for (let attemptIdx = 1; attemptIdx <= MAX_ATTEMPTS; attemptIdx++) {

    const attemptT0 = Date.now()
    console.log(
      `[portraits] attempt ${attemptIdx}/${MAX_ATTEMPTS} ` +
      `style=${styleId} preset=${presetId} location=${locationId}`,
    )

    // Build prompt — minimal 11–17 word builder, led by the framing block.
    const prompt = buildPortraitsPrompt({
      presetId,
      locationId,
      scale,
      framing:          req.framing,
      plaqueText:       req.plaque_text,
      advanced:         req.advanced,
      upperBodyConcept: req.upper_body_concept,
    })
    finalPromptUsed = prompt

    console.log(
      `[portraits/prompt] style=${styleId} preset=${presetId} location=${locationId} ` +
      `chars=${prompt.length} has_advanced=${!!req.advanced} ` +
      `has_concept=${!!req.upper_body_concept}`,
    )

    // ── Stage 1: generate (branches on pipeline.generator) ──
    let imageB64: string
    try {
      imageB64 = await callNB2({
        prompt,
        sourceImageB64:      req.source_image_b64,
        additionalImagesB64: req.additional_images_b64 || [],
        styleReferenceB64:   styleRefs[0],
        aspectRatio,
        replicateApiToken:   input.replicateApiToken,
      })
    } catch (e: any) {
      const msg = e?.message || `${pipeline.generator} generate failed`
      console.error(`[portraits] attempt ${attemptIdx} ${pipeline.generator} failed: ${msg}`)
      return buildFatalResult({
        msg, prompt, styleId, presetId, locationId,
        refineDecision, attempts, t0,
      })
    }


    // ── Stage 2: REMOVED 2026-08-01 ──
    // gpt-image-1 Pass 2 deleted. It was dead in every STYLE_PIPELINE
    // (passTwoEnabled=false) and could not hold face identity against
    // gpt-image-1's regen prior. lastRefined stays false; the `refined`
    // and `refine_ms` response fields are retained for shape parity.

    // ── Stage 3: SKIPPED (no post-process margin) ──
    // Subject-IS-the-piece silo. Empty Stage 3 is intentional per the
    // carryover doc — Groups proved NB2 native framing is good with the
    // minimal prompt. Adding outpaint/crop here would fight the model.

    // ── Stage 4: face swap (off by default per pipeline config) ──
    if (pipeline.faceSwapEnabled) {
      // Mirrors Groups: portraits-faceswap module not lifted; if/when
      // needed, port and wire here.
      lastSwapSkip = 'portraits-faceswap not wired'
      console.warn(`[portraits] face swap requested but no portraits-faceswap module wired yet — skipping`)
    } else {
      lastSwapSkip = `pipeline: faceSwapEnabled=false for style=${styleId}`
    }

    // ── Stage 5: scoring + evaluate (branches by style) ──
    let perFigureScore:  PerFigureScore | undefined
    let caricatureScore: HolisticCaricatureScore | undefined
    let evalPassed = false
    let evalReason = 'no scoring performed'

    if (input.openaiApiKey) {
      try {
        if (pipeline.scoringMode === 'single_face_likeness') {
          perFigureScore = await scoreSingleFaceFidelity({
            sourceImageB64:   req.source_image_b64,
            renderedImageB64: imageB64,
            openaiApiKey:     input.openaiApiKey,
          })
          const result = evaluateSingleFaceScore(perFigureScore, pipeline.scoringThreshold || SINGLE_FACE_THRESHOLD)
          evalPassed = result.passed
          evalReason = result.reason
          lastFacesRender = 1
        } else {
          caricatureScore = await scoreHolisticCaricature({
            sourceImageB64:   req.source_image_b64,
            renderedImageB64: imageB64,
            openaiApiKey:     input.openaiApiKey,
          })
          const result = evaluateCaricatureScore(caricatureScore)
          evalPassed = result.passed
          evalReason = result.reason
        }
      } catch (e: any) {
        console.warn(`[portraits] scoring failed: ${e?.message}`)
        evalReason = `scoring error: ${e?.message}`
      }
    }

    const attempt: PortraitsAttempt = {
      attempt:           attemptIdx,
      prompt_used:       prompt,
      duration_ms:       Date.now() - attemptT0,
      per_figure_scores: perFigureScore ? [perFigureScore] : undefined,
      caricature_score:  caricatureScore,
      passed:            evalPassed,
      pass_reason:       evalReason,
    }
    attempts.push(attempt)

    if (evalPassed || attemptIdx === MAX_ATTEMPTS) {
      finalImageB64 = imageB64
      console.log(`[portraits] attempt ${attemptIdx} ${evalPassed ? 'PASSED' : 'EXHAUSTED'} — ${evalReason}`)
      break
    }

    console.log(`[portraits] attempt ${attemptIdx} FAILED — ${evalReason}; retrying`)
  }


  // ── Stage 3: REMOVED 2026-08-01 ──
  // Local canvas-pad outpaint deleted. expandEnabled was false on every
  // style — the mirrored blurred margin read as a defect. The `expanded`,
  // `expand_ms` and `expand_skip` response fields are retained.
  lastExpandSkip = 'stage removed 2026-08-01'

  // ── Stage 4 (post-attempt): resolution → output dimensions ───
  // NB2 has no pixel control (it renders at the aspect_ratio string), so
  // the resolution tier is realized here as a resize to exact dimensions
  // for the framing's aspect. Only runs when resolution is set — legacy
  // callers without it keep NB2's native size. Aspect already matches the
  // framing (route derives aspect_ratio from framing), so this is a clean
  // scale, not a crop. Non-fatal: on failure the un-resized image ships.
  if (finalImageB64 && req.resolution) {
    try {
      const framing = normalizeFraming(req.framing)
      const { width, height } = outputDimensions(framing, req.resolution as ResolutionTier)
      finalImageB64 = (
        await sharp(Buffer.from(finalImageB64, 'base64'))
          .resize(width, height, { fit: 'cover', kernel: 'lanczos3' })
          .jpeg({ quality: 95 })
          .toBuffer()
      ).toString('base64')
      console.log(`[portraits] resized → ${width}×${height} (${req.resolution} @ ${framing})`)
    } catch (e: any) {
      console.warn(`[portraits] resize failed (non-fatal): ${e?.message}`)
    }
  }

  return {
    ok:                    true,
    image_b64:             finalImageB64,
    prompt_used:           finalPromptUsed,
    style:                 styleId,
    preset:                presetId,
    location:              locationId,
    subject_count:         1,
    refined:               lastRefined,
    refine_ms:             lastRefineMs,
    refine_decision:       refineDecision,
    expanded:              lastExpanded,
    expand_ms:             lastExpandMs,
    expand_skip:           lastExpandSkip,
    swapped:               lastSwapped,
    swap_ms:               lastSwapMs,
    swap_skip:             lastSwapSkip,
    faces_detected_source: lastFacesSrc,
    faces_detected_render: lastFacesRender,
    face_match_strategy:   lastMatchStrategy,
    attempts,
    final_pass:            attempts[attempts.length - 1]?.passed || false,
    final_reason:          attempts[attempts.length - 1]?.pass_reason || 'no attempts',
    fatal_error:           null,
    duration_ms:           Date.now() - t0,
  }
}

// ─── HELPERS ────────────────────────────────────────────────────

function buildFatalResult(args: {
  msg:             string
  prompt:          string
  styleId:         PortraitsStyleId
  presetId:        PortraitsPresetId
  locationId:      LocationId
  refineDecision:  string
  attempts:        PortraitsAttempt[]
  t0:              number
}): PortraitsGenerateResult {
  return {
    ok:                    false,
    image_b64:             null,
    prompt_used:           args.prompt,
    style:                 args.styleId,
    preset:                args.presetId,
    location:              args.locationId,
    subject_count:         1,
    refined:               false,
    refine_ms:             null,
    refine_decision:       args.refineDecision,
    expanded:              false,
    expand_ms:             null,
    expand_skip:           null,
    swapped:               false,
    swap_ms:               null,
    swap_skip:             null,
    faces_detected_source: 0,
    faces_detected_render: 0,
    face_match_strategy:   'fallback',
    attempts:              args.attempts,
    final_pass:            false,
    final_reason:          `Stage 1 failure: ${args.msg}`,
    fatal_error:           args.msg,
    error_code:            'nb2_failed',
    retryable:             true,
    duration_ms:           Date.now() - args.t0,
  }
}

// ─── NB2 CALL ───────────────────────────────────────────────────

export async function callNB2(input: {
  prompt:              string
  sourceImageB64:      string
  additionalImagesB64: string[]
  styleReferenceB64?:  string
  aspectRatio:         string
  replicateApiToken:   string
}): Promise<string> {

  const sourceUris = [
    input.sourceImageB64,
    ...input.additionalImagesB64,
  ].slice(0, MAX_SOURCE_IMAGES).map(b => `data:image/jpeg;base64,${b}`)

  // Style ref appended as the LAST input image.
  const imageInput = input.styleReferenceB64
    ? [...sourceUris, `data:image/jpeg;base64,${input.styleReferenceB64}`]
    : sourceUris

  console.log(
    `[portraits/generate] NB2 aspect=${input.aspectRatio} ` +
    `sources=${sourceUris.length}${input.styleReferenceB64 ? ' +1 style_ref' : ''} ` +
    `prompt_chars=${input.prompt.length}`,
  )

  const body = {
    input: {
      prompt:        input.prompt,
      image_input:   imageInput,
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
        throw new Error(`prediction ${polled.status}: ${polled.error || ''}`)
      }
    }
  }

  throw new Error(`NB2 timed out — status=${prediction.status}`)
}

function pickOutputUrl(output: any): string {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && output.length > 0) return output[0]
  throw new Error('NB2 output URL not found')
}

async function fetchAndEncode(url: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`output fetch failed (${r.status})`)
  return Buffer.from(await r.arrayBuffer()).toString('base64')
}
