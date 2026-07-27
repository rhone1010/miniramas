// lib/v1/groups/groups-generator.ts
//
// Orchestrator for the Groups silo. Pipeline branches by style.
//
// Realistic + People Resolving pipeline (NB2):
//   Stage 0  Pre-flight face-visibility detection
//   Stage 1  NB2 image-to-image generate (minimal prompt — groups-prompt.ts)
//   Stage 2  SKIPPED — Pass 2 (gpt-image-1 refine) disabled per pipeline config
//   Stage 3  SKIPPED — post-process expand/crop removed; NB2 native framing ships
//   Stage 4  SKIPPED — multi-face swap disabled per pipeline config
//   Stage 5  Per-figure likeness scoring with up to 1 retry on threshold fail
//
// Tribal Wall Masks + Tribal Statue pipeline (gpt-image-1):
//   Stage 0  Pre-flight face-visibility detection (subject count only)
//   Stage 1  gpt-image-1 generate
//   Stage 2  SKIPPED — Pass 2 disabled
//   Stage 3  SKIPPED
//   Stage 4  SKIPPED — likeness intentionally abstracted, no swap
//   Stage 5  Holistic caricature scoring (one composite + 3 sub-scores)
//            with up to 1 retry on threshold fail
//
// 2026-05 prompt migration: this generator now uses buildGroupsPrompt from
// groups-prompt.ts (the minimal 11-17 word builder) instead of the older
// buildPresetPrompt from groups-presets.ts. The older path is preserved on
// disk for reference but no longer called. The minimal prompt produces
// tighter piece-focused framing because NB2 is no longer drowning in
// directorial language about staging, camera, and luminance. Subject
// count, child-vs-adult proportions, plinth shape, and lighting are
// inferred by NB2 from just the material name + location phrase.

import { buildGroupsPrompt } from './groups-prompt'
import { buildGroupsExperimentalPrompt } from './groups-experimental'
import { pickDefaultArrangement } from './groups-presets'  // still used for result fields
import { refineGroupsImage } from './groups-pass2'
import { swapGroupFaces } from './groups-faceswap'
import { callGptImage1 } from './groups-gpt-image'
import {
  scorePerFigureFidelity,
  scoreHolisticCaricature,
  detectFaceVisibility,
} from './groups-refine'
import {
  evaluateGroupScores,
  evaluateCaricatureScore,
  resolveLocation,
  defaultAspectForStyle,
  STYLE_PIPELINE,
  MAX_ATTEMPTS,
  MAX_SOURCE_IMAGES,
  type GroupsGenerateRequest,
  type GroupsGenerateResult,
  type GroupsAttempt,
  type GroupsStyleId,
  type GroupsPresetId,
  type LocationId,
  type Scale,
  type GroupArrangement,
  type PerFigureScore,
  type HolisticCaricatureScore,
} from './groups-shared'

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

// ─── PRIMARY ENTRY POINT ─────────────────────────────────────────

export interface GenerateGroupsInput {
  request:           GroupsGenerateRequest
  replicateApiToken: string
  openaiApiKey?:     string
  stabilityApiKey?:  string
  refineOverride?:   boolean
}

export async function generateGroupsRender(
  input: GenerateGroupsInput,
): Promise<GroupsGenerateResult> {

  const t0  = Date.now()
  const req = input.request

  const styleId:    GroupsStyleId  = req.style_id
  const pipeline                   = STYLE_PIPELINE[styleId]
  const presetId:   GroupsPresetId = req.preset_id
  const scale:      Scale          = req.scale || 'close_up'
  const aspectRatio:string         = req.aspect_ratio || defaultAspectForStyle(styleId)

  // Stage 0: subject count + face visibility detection
  //
  // Subject count resolution: PREFER the detected count over req.subject_count.
  // Reason: req.subject_count comes from the frontend's state.subjectCount,
  // which is supposed to mirror the /analyze endpoint's response — but when
  // /analyze returns undefined (as it has been doing), the frontend silently
  // falls back to its default of 2 and sends that. Then scoring's
  // expectedSubjectCount=2 fails any render with more than 2 figures.
  //
  // The detect call here examines the actual source image and is the most
  // reliable count. Override the request value when detect gives us a number.
  // If detect fails or finds 0, fall back to req.subject_count, then to a
  // safety default of 2.
  let detectedFaceVisible = true
  let subjectCount        = 0
  const reqSubjectCount   = req.subject_count || 0

  if (input.openaiApiKey) {
    try {
      const det = await detectFaceVisibility({
        sourceImageB64: req.source_image_b64,
        openaiApiKey:   input.openaiApiKey,
      })
      detectedFaceVisible = det.face_visible
      console.log(`[groups] detect: face_visible=${det.face_visible} count=${det.subject_count_estimate} reason="${det.reason}"`)
      // Detect's count wins when it has data
      if (det.subject_count_estimate >= 1) {
        subjectCount = det.subject_count_estimate
        if (reqSubjectCount && reqSubjectCount !== det.subject_count_estimate) {
          console.log(
            `[groups] subject count: request=${reqSubjectCount}, detect=${det.subject_count_estimate} — using detect`,
          )
        }
      }
    } catch (e: any) {
      console.warn(`[groups] detection failed: ${e?.message}`)
    }
  }

  // Fallback chain: detect → request → 2 (safety)
  if (!subjectCount || subjectCount < 1) subjectCount = reqSubjectCount
  if (!subjectCount || subjectCount < 1) subjectCount = 2

  // Locations resolved AFTER subject count is known.
  const locationId: LocationId = resolveLocation(styleId, presetId, req.location_id)

  // Pass 2 decision — explicit override > pipeline config.
  // (Previously we auto-bypassed Pass 2 when faces were visible. With Pass 2
  // re-enabled for portrait styles, that bypass would defeat the purpose —
  // every portrait has visible faces. The pipeline config is now authoritative.)
  const refineEnabled = input.refineOverride !== undefined
    ? input.refineOverride
    : pipeline.passTwoEnabled
  const refineDecision = input.refineOverride !== undefined
    ? `explicit (override=${input.refineOverride})`
    : `pipeline: style=${styleId}, passTwoEnabled=${pipeline.passTwoEnabled}, refine=${refineEnabled}`

  const arrangement: GroupArrangement = req.arrangement || pickDefaultArrangement(subjectCount)

  // Style references: previously the silo loaded curated reference images
  // from disk (public/style-refs/<style>_<n>.jpg) and prepended them to any
  // user-supplied style_reference_b64. Those disk assets never existed in
  // this deployment, so the loader was producing repeated ENOENT warnings.
  // Removed 2026-05. User-supplied refs still flow through; the silo now
  // relies entirely on the minimal prompt to convey style.
  const styleRefs = req.style_reference_b64 ? [req.style_reference_b64] : []
  const hasStyleReference = styleRefs.length > 0

  const attempts: GroupsAttempt[] = []
  let finalImageB64: string | null = null
  let finalPromptUsed = ''

  // Telemetry survives across attempts.
  let lastRefined        = false
  let lastRefineMs:      number | null = null
  let lastExpanded       = false
  let lastExpandMs:      number | null = null
  let lastExpandSkip:    string | null = null
  let lastSwapped        = false
  let lastSwapMs:        number | null = null
  let lastSwapSkip:      string | null = null
  let lastFacesSrc       = 0
  let lastFacesRender    = 0
  let lastMatchStrategy: 'embedding' | 'positional' | 'manual' | 'fallback' = 'fallback'

  // ─── ATTEMPT LOOP ────────────────────────────────────────────
  for (let attemptIdx = 1; attemptIdx <= MAX_ATTEMPTS; attemptIdx++) {

    const attemptT0 = Date.now()
    console.log(`[groups] attempt ${attemptIdx}/${MAX_ATTEMPTS} style=${styleId} preset=${presetId} location=${locationId}`)

    // Build prompt. Two paths:
    //   • experimental_effect set → full custom own-scene prompt
    //     (groups-experimental.ts); preset_id / location_id ignored.
    //   • otherwise → minimal 11–17 word builder (groups-prompt.ts).
    let prompt: string
    if (req.experimental_effect) {
      prompt = buildGroupsExperimentalPrompt({
        effectId: req.experimental_effect,
      })
    } else {
      prompt = buildGroupsPrompt({
        presetId:    presetId,
        locationId:  locationId,
        scale:       scale,
        plaqueText:  req.plaque_text,
        advanced:    req.advanced,
      })
    }
    finalPromptUsed = prompt

    // Prompt fingerprint — log size so we can spot regressions or unintended
    // bloat reintroducing the elaborate pipeline. Expected: ~120-260 chars.
    console.log(
      `[groups/prompt] style=${styleId} preset=${presetId} location=${locationId} ` +
      `subj=${subjectCount} chars=${prompt.length} has_advanced=${!!req.advanced}`,
    )

    // ── Stage 1: generate (branches on pipeline.generator) ──
    let imageB64: string
    try {
      if (pipeline.generator === 'gpt-image-1') {
        if (!input.openaiApiKey) {
          throw new Error('OPENAI_API_KEY required for gpt-image-1 path')
        }
        imageB64 = await callGptImage1({
          prompt,
          sourceImageB64:      req.source_image_b64,
          additionalImagesB64: req.additional_images_b64 || [],
          styleReferenceB64s:  styleRefs,
          aspectRatio,
          openaiApiKey:        input.openaiApiKey,
        })
      } else {
        // NB2 path — only supports a single trailing style reference.
        // Use the FIRST style ref in the combined list (curated if present,
        // else user-supplied) so the model still gets a visual anchor.
        imageB64 = await callNB2({
          prompt,
          sourceImageB64:      req.source_image_b64,
          additionalImagesB64: req.additional_images_b64 || [],
          styleReferenceB64:   styleRefs[0],
          aspectRatio,
          replicateApiToken:   input.replicateApiToken,
        })
      }
    } catch (e: any) {
      const msg = e?.message || `${pipeline.generator} generate failed`
      console.error(`[groups] attempt ${attemptIdx} ${pipeline.generator} failed: ${msg}`)
      return buildFatalResult({
        msg, prompt, styleId, presetId, locationId, arrangement, subjectCount,
        refineDecision, attempts, t0,
      })
    }

    // ── Stage 2: gpt-image-1 refine (per style config) ──
    if (refineEnabled && input.openaiApiKey) {
      try {
        const r = await refineGroupsImage({
          imageB64,
          presetId,
          locationId,
          aspectRatio,
          openaiApiKey: input.openaiApiKey,
        })
        imageB64     = r.imageB64
        lastRefined  = r.refined
        lastRefineMs = r.durationMs
      } catch (e: any) {
        console.warn(`[groups] Pass 2 hard fail (non-fatal): ${e?.message}`)
      }
    }

    // ── Stage 3: REMOVED ──────────────────────────────────────────
    // The post-process expand/crop step has been retired. The original
    // Stability outpaint added 100-180px per side to compensate for
    // gpt-image-1's tight framing; the inward-crop replacement was added
    // for over-environmental NB2 renders driven by the old elaborate
    // prompt. With the minimal prompt now active, NB2 produces tighter
    // framing natively — no post-process is needed. If renders trend
    // loose, the right fix is in the prompt (location phrase) or a new
    // crop step rather than reviving this one.
    //
    // expandGroupsImage and groups-expand.ts are preserved on disk for
    // reference but no longer called.

    // ── Stage 4: multi-face swap (Realistic + People Resolving only) ──
    if (pipeline.faceSwapEnabled && input.openaiApiKey) {
      try {
        const swapped = await swapGroupFaces({
          renderImageB64:        imageB64,
          sourceImageB64:        req.source_image_b64,
          additionalSourcesB64:  req.additional_images_b64,
          replicateApiToken:     input.replicateApiToken,
          openaiApiKey:          input.openaiApiKey,
        })
        imageB64          = swapped.imageB64
        lastSwapped       = swapped.swapped
        lastSwapMs        = swapped.durationMs
        lastSwapSkip      = swapped.reason || null
        lastFacesSrc      = swapped.faces_detected_source
        lastFacesRender   = swapped.faces_detected_render
        lastMatchStrategy = swapped.match_strategy_used
      } catch (e: any) {
        console.warn(`[groups] face swap hard fail (non-fatal): ${e?.message}`)
        lastSwapSkip = `error: ${e?.message}`
      }
    } else if (!pipeline.faceSwapEnabled) {
      lastSwapSkip = `style=${styleId} skips face swap (caricature register)`
    } else {
      lastSwapSkip = 'OPENAI_API_KEY not set'
    }

    // ── Stage 5: scoring + evaluate (branches by style) ──
    let perFigureScores:  PerFigureScore[] | undefined
    let caricatureScore:  HolisticCaricatureScore | undefined
    let evalPassed = false
    let evalReason = 'no scoring performed'

    if (input.openaiApiKey) {
      try {
        if (pipeline.scoringMode === 'per_figure_likeness') {
          perFigureScores = await scorePerFigureFidelity({
            sourceImageB64:       req.source_image_b64,
            renderedImageB64:     imageB64,
            openaiApiKey:         input.openaiApiKey,
            expectedSubjectCount: subjectCount,
          })
          const result = evaluateGroupScores(perFigureScores)
          evalPassed = result.passed
          evalReason = result.reason
        } else {
          // holistic_caricature
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
        console.warn(`[groups] scoring failed: ${e?.message}`)
        evalReason = `scoring error: ${e?.message}`
      }
    }

    const attempt: GroupsAttempt = {
      attempt:           attemptIdx,
      prompt_used:       prompt,
      duration_ms:       Date.now() - attemptT0,
      per_figure_scores: perFigureScores,
      caricature_score:  caricatureScore,
      passed:            evalPassed,
      pass_reason:       evalReason,
    }
    attempts.push(attempt)

    if (evalPassed || attemptIdx === MAX_ATTEMPTS) {
      finalImageB64 = imageB64
      console.log(`[groups] attempt ${attemptIdx} ${evalPassed ? 'PASSED' : 'EXHAUSTED'} — ${evalReason}`)
      break
    }

    console.log(`[groups] attempt ${attemptIdx} FAILED — ${evalReason}; retrying`)
  }

  return {
    ok:                    true,
    image_b64:             finalImageB64,
    prompt_used:           finalPromptUsed,
    style:                 styleId,
    preset:                presetId,
    location:              locationId,
    arrangement,
    subject_count:         subjectCount,
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
  styleId:         GroupsStyleId
  presetId:        GroupsPresetId
  locationId:      LocationId
  arrangement:     GroupArrangement
  subjectCount:    number
  refineDecision:  string
  attempts:        GroupsAttempt[]
  t0:              number
}): GroupsGenerateResult {
  return {
    ok:                    false,
    image_b64:             null,
    prompt_used:           args.prompt,
    style:                 args.styleId,
    preset:                args.presetId,
    location:              args.locationId,
    arrangement:           args.arrangement,
    subject_count:         args.subjectCount,
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

async function callNB2(input: {
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

  // Style ref appended as the LAST input image — prompt directive
  // disambiguates its role.
  const imageInput = input.styleReferenceB64
    ? [...sourceUris, `data:image/jpeg;base64,${input.styleReferenceB64}`]
    : sourceUris

  console.log(
    `[groups/generate] NB2 aspect=${input.aspectRatio} ` +
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
