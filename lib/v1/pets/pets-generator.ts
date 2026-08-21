// lib/v1/pets/pets-generator.ts
//
// Orchestrator for the Pets silo. Mirrors portraits-generator.ts but
// scoped to a single animal subject. Pipeline (Realistic, NB2):
//
//   Stage 0  Pre-flight pet-visibility detection
//   Stage 1  NB2 image-to-image generate (pets-prompt.ts)
//   Stage 2  SKIPPED — Pass 2 disabled per pipeline config (gpt-image-1
//            refine reinterprets identity; for pets the failure mode is
//            breed-averaging — same family as the Portraits face-drift)
//   Stage 3  Stability outpaint post-attempt (10% per side, skipped on
//            'fill' scale) — the environments need room to read
//   Stage 4  N/A — face swap is a human-face model; not applicable to
//            animals. swap_skip reports this for result-shape parity.
//   Stage 5  Pet identity scoring with up to 1 retry on threshold fail
//
// Diverges from portraits-generator in these ways:
//   - No upper_body_concept / wardrobe threading (no garments).
//   - EnvironmentId replaces LocationId.
//   - scorePetFidelity replaces scoreSingleFaceFidelity — the scorer
//     checks the same identity checklist the prompt demands (markings
//     as tonal variation, expression, age, pose).
//   - Stage 4 is permanently inert rather than config-gated.

import { buildPetsPrompt } from './pets-prompt'
import { PETS_35 } from './pets-catalog-35'
import { MAIN_ASPECT } from '../shared/render-aspect'
import {
  buildPetExperimentalPrompt,
  isPetExperimentalEffect,
  type PetExperimentalEffectId,
} from './pets-experimental'
import type { PetCoatProfile, PetFeatureProfile } from './pets-refine'
import { expandPetImage } from './pets-expand'
import {
  scorePetFidelity,
  scoreMultiPetFidelity,
  detectPetVisibility,
} from './pets-refine'
import {
  evaluatePetScore,
  evaluateMultiPetScores,
  resolveEnvironment,
  defaultAspectForStyle,
  STYLE_PIPELINE,
  ACTION_LABELS,
  DEFAULT_ACTION,
  MAX_ATTEMPTS,
  MAX_PETS,
  MAX_SOURCE_IMAGES,
  PET_LIKENESS_THRESHOLD,
  type PetsGenerateRequest,
  type PetsGenerateResult,
  type PetsAttempt,
  type PetsStyleId,
  type PetsPresetId,
  type EnvironmentId,
  type ActionId,
  type Scale,
  type PerFigureScore,
} from './pets-shared'

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

// ─── PRIMARY ENTRY POINT ─────────────────────────────────────────

export interface GeneratePetsInput {
  request:           PetsGenerateRequest
  replicateApiToken: string
  openaiApiKey?:     string
  stabilityApiKey?:  string
  refineOverride?:   boolean
}

export async function generatePetsRender(
  input: GeneratePetsInput,
): Promise<PetsGenerateResult> {

  const t0  = Date.now()
  const req = input.request

  const styleId:     PetsStyleId  = req.style_id
  const pipeline                   = STYLE_PIPELINE[styleId]
  const presetId                   = req.preset_id   // undefined for Curiosities
  const experimentalEffect: PetExperimentalEffectId | undefined =
    (typeof req.experimental_effect === 'string' && isPetExperimentalEffect(req.experimental_effect))
      ? req.experimental_effect
      : undefined
  const isExperimental             = !!experimentalEffect
  const actionId:    ActionId     = req.action_id || DEFAULT_ACTION
  const restaged                   = actionId !== 'as_photographed'
  const scale:       Scale        = req.scale || 'close_up'
  // ── THE CATALOG PATH, ADDED 2026-08-20 ───────────────────────────────
  //
  // A third way of getting a prompt, beside the material pipeline and the
  // curiosities. PETS_35 holds thirty-four whole bodies Rich approved
  // against live renders on 20 August; the material pipeline COMPOSES a
  // prompt from a phrase, a universal block, an environment and a tail.
  //
  // Both are kept because they answer different questions. The composed
  // path can express a material the catalog has no body for, and carries
  // the coat and feature notes from Stage 0. The catalog carries effects
  // that are a whole idea rather than a surface - Clown, Persian Court,
  // Ukiyo-e - which no phrase-and-block assembly was ever going to reach.
  //
  // Checked BEFORE the material pipeline, so an id that exists in both
  // resolves to the approved body rather than to the composed one.
  const catalogEffect = !isExperimental && req.preset_id && PETS_35[req.preset_id]
    ? PETS_35[req.preset_id]
    : undefined

  // ── ASPECT ───────────────────────────────────────────────────────────
  //
  // Was defaultAspectForStyle, which ignores its argument and returns
  // '3:4' - a leftover from a style axis that no longer exists. Every
  // Pets craft on main was therefore portrait-shaped while the plates
  // approved on 20 August are square.
  //
  // MAIN_ASPECT comes from lib/v1/shared/render-aspect.ts, which is the
  // one place an aspect lives. When it becomes a customer choice this
  // line does not change: the constant becomes a default and req.aspect_ratio
  // already wins over it.
  const aspectRatio: string       = req.aspect_ratio || MAIN_ASPECT

  // Stage 0: pet-visibility detection. subject_count is informational —
  // we always render one piece — but multi-animal sources are logged so
  // the silo can surface that via the analyze endpoint.
  let detectedPetVisible   = true
  let detectedSubjectCount = 1
  let detectedCoats: PetCoatProfile[] = []
  let detectedFeatures: PetFeatureProfile[] = []
  if (input.openaiApiKey) {
    try {
      const det = await detectPetVisibility({
        sourceImageB64: req.source_image_b64,
        openaiApiKey:   input.openaiApiKey,
      })
      detectedPetVisible   = det.pet_visible
      detectedSubjectCount = det.subject_count_estimate
      detectedCoats        = det.coats || []
      detectedFeatures     = det.features || []
      console.log(
        `[pets] detect: pet_visible=${det.pet_visible} ` +
        `count=${det.subject_count_estimate} reason="${det.reason}"`,
      )
      if (det.subject_count_estimate > 1 && det.subject_count_estimate <= MAX_PETS) {
        console.log(
          `[pets] source has ${det.subject_count_estimate} hero animals — ` +
          `rendering all ${det.subject_count_estimate} as a group piece`,
        )
      } else if (det.subject_count_estimate > MAX_PETS) {
        console.log(
          `[pets] source has ${det.subject_count_estimate} hero animals — ` +
          `above the ${MAX_PETS}-pet limit; prompting for ${MAX_PETS}, ` +
          `NB2 will favor the most prominent`,
        )
      }
    } catch (e: any) {
      console.warn(`[pets] detection failed: ${e?.message}`)
    }
  }

  const environmentId: EnvironmentId = resolveEnvironment(styleId, req.environment_id)

  // Hero-animal count for the prompt + scorer, clamped to MAX_PETS.
  const subjectCount = Math.max(1, Math.min(MAX_PETS, detectedSubjectCount))

  // Photograph-specific coat descriptor — the anti-genre-drift anchor.
  // Undefined coat = NB2 defaults to romantic flowing sculpted fur (the
  // same law as materials: every coat needs an explicit phrase).
  const coatNote = buildCoatNote(detectedCoats, subjectCount)
  if (coatNote) console.log(`[pets] coat note: ${coatNote}`)

  // Distinctive-features note — clouded eyes, notched ears, missing
  // limbs. Unnamed = idealized: NB2's beautification prior erases these
  // unless they are explicitly described and explicitly protected.
  const featureNote = buildFeatureNote(detectedFeatures, subjectCount)
  if (featureNote) console.log(`[pets] feature note: ${featureNote}`)
  if (restaged) {
    console.log(`[pets] action re-staging active: ${actionId} — pose/expression preservation replaced; scorer informed`)
  }

  // Pass 2 decision: explicit override > pipeline config. Kept for shape
  // parity; Pass 2 ships disabled (see pets-shared.ts).
  const refineEnabled = input.refineOverride !== undefined
    ? input.refineOverride
    : pipeline.passTwoEnabled
  const refineDecision = input.refineOverride !== undefined
    ? `explicit (override=${input.refineOverride})`
    : `pipeline: style=${styleId}, passTwoEnabled=${pipeline.passTwoEnabled}, refine=${refineEnabled}`
  if (refineEnabled) {
    console.warn(
      `[pets] Pass 2 requested but no pets-pass2 module is wired — ` +
      `gpt-image-1 refine breed-averages animal identity; skipping`,
    )
  }

  const styleRefs = req.style_reference_b64 ? [req.style_reference_b64] : []

  const attempts: PetsAttempt[] = []
  let finalImageB64: string | null = null
  let finalPromptUsed = ''

  // Telemetry survives across attempts.
  const lastRefined       = false
  const lastRefineMs:     number | null = null
  let lastExpanded        = false
  let lastExpandMs:       number | null = null
  let lastExpandSkip:     string | null = null
  let lastPetsRender      = 0

  // ─── ATTEMPT LOOP ────────────────────────────────────────────
  for (let attemptIdx = 1; attemptIdx <= MAX_ATTEMPTS; attemptIdx++) {

    const attemptT0 = Date.now()
    console.log(
      `[pets] attempt ${attemptIdx}/${MAX_ATTEMPTS} ` +
      `style=${styleId} ${isExperimental ? `curiosity=${experimentalEffect}` : `preset=${presetId} environment=${environmentId}`}`,
    )

    const prompt = catalogEffect
      // Whole body, plus its avoid clause. Nothing appended: the framing,
      // the markings rule and the horse conditional are all inside it,
      // which is what makes any one of these testable on its own in a
      // browser.
      ? catalogEffect.body + (catalogEffect.avoid ? '\n' + catalogEffect.avoid : '')
      : isExperimental
      ? buildPetExperimentalPrompt({ effectId: experimentalEffect!, count: subjectCount })
      : buildPetsPrompt({
          presetId:     presetId!,
          environmentId,
          scale,
          plaqueText:   req.plaque_text,
          advanced:     req.advanced,
          subjectCount,
          actionId,
          coatNote,
          featureNote,
        })
    finalPromptUsed = prompt

    console.log(
      catalogEffect
        ? `[pets/prompt] catalog=${catalogEffect.id} subjects=${subjectCount} chars=${prompt.length}`
        : isExperimental
        ? `[pets/prompt] style=${styleId} curiosity=${experimentalEffect} subjects=${subjectCount} chars=${prompt.length}`
        : `[pets/prompt] style=${styleId} preset=${presetId} environment=${environmentId} ` +
          `action=${actionId} subjects=${subjectCount} chars=${prompt.length} has_advanced=${!!req.advanced}`,
    )

    // ── Stage 1: NB2 generate ──
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
      const msg = e?.message || 'NB2 generate failed'
      console.error(`[pets] attempt ${attemptIdx} NB2 failed: ${msg}`)
      return buildFatalResult({
        msg, prompt, styleId, presetId: presetId!, environmentId, actionId,
        refineDecision, attempts, t0,
      })
    }

    // ── Stage 2: SKIPPED — Pass 2 disabled per pipeline config ──
    // gpt-image-1 refine reinterprets identity (photo-paste /
    // idealization on humans; breed-averaging on animals). Re-enable
    // only if an identity-preserving Stage 2 exists for animals.

    // ── Stage 5: pet identity scoring + evaluate ──
    // 1 animal → single scorer; 2+ → per-animal multi scorer, every
    // animal must clear the threshold.
    let perFigureScores: PerFigureScore[] | undefined
    let evalPassed = false
    let evalReason = 'no scoring performed'

    if (isExperimental) {
      // Curiosities are intentional transformations spanning realistic
      // (Amber, Garden Statue) to fully abstract (Wire, Phoenix, Cubism).
      // Likeness scoring is not a meaningful gate here and wrongly flags
      // excellent renders as fails, triggering the decide prompt. Accept
      // the render, mark it passed, and skip the scorer entirely (no
      // wasted OpenAI call). Per-material gating can be reintroduced later.
      evalPassed = true
      evalReason = `curiosity (${experimentalEffect}) — likeness gate not applied`
    } else if (input.openaiApiKey) {
      try {
        const threshold = pipeline.scoringThreshold || PET_LIKENESS_THRESHOLD
        const actionLabel = restaged ? ACTION_LABELS[actionId] : undefined
        if (subjectCount >= 2) {
          perFigureScores = await scoreMultiPetFidelity({
            sourceImageB64:   req.source_image_b64,
            renderedImageB64: imageB64,
            subjectCount,
            openaiApiKey:     input.openaiApiKey,
            actionLabel,
          })
          const result = evaluateMultiPetScores(perFigureScores, threshold)
          evalPassed = result.passed
          evalReason = result.reason
        } else {
          const single = await scorePetFidelity({
            sourceImageB64:   req.source_image_b64,
            renderedImageB64: imageB64,
            openaiApiKey:     input.openaiApiKey,
            actionLabel,
          })
          perFigureScores = [single]
          const result = evaluatePetScore(single, threshold)
          evalPassed = result.passed
          evalReason = result.reason
        }
        lastPetsRender = perFigureScores.length
      } catch (e: any) {
        console.warn(`[pets] scoring failed: ${e?.message}`)
        evalReason = `scoring error: ${e?.message}`
      }
    }

    const attempt: PetsAttempt = {
      attempt:           attemptIdx,
      prompt_used:       prompt,
      duration_ms:       Date.now() - attemptT0,
      per_figure_scores: perFigureScores,
      passed:            evalPassed,
      pass_reason:       evalReason,
    }
    attempts.push(attempt)

    if (evalPassed || isExperimental || attemptIdx === MAX_ATTEMPTS) {
      finalImageB64 = imageB64
      console.log(`[pets] attempt ${attemptIdx} ${evalPassed ? 'PASSED' : 'EXHAUSTED'} — ${evalReason}`)
      break
    }

    console.log(`[pets] attempt ${attemptIdx} FAILED — ${evalReason}; retrying`)
  }

  // ── Stage 3 (post-attempt): Stability outpaint ──────────────
  // Adds canvas padding so the animal doesn't fill the frame and the
  // environment reads as a scene. Runs only when scale !== 'fill' and
  // the style's pipeline.expandEnabled is true. Non-fatal: if Stability
  // fails, the original final image is kept.
  const expandPercent = pipeline.expandPercent
  if (pipeline.expandEnabled && req.scale !== 'fill' && finalImageB64) {
    if (input.stabilityApiKey) {
      try {
        const r = await expandPetImage({
          imageB64:        finalImageB64,
          expandPercent,
          stabilityApiKey: input.stabilityApiKey,
        })
        finalImageB64 = r.imageB64
        lastExpanded  = r.expanded
        lastExpandMs  = r.durationMs
        if (!r.expanded && r.reason) {
          lastExpandSkip = r.reason
          console.warn(`[pets] expand returned original — ${r.reason}`)
        }
      } catch (e: any) {
        lastExpandSkip = `hard fail: ${e?.message}`
        console.warn(`[pets] expand hard fail (non-fatal): ${e?.message}`)
      }
    } else {
      lastExpandSkip = 'STABILITY_API_KEY missing'
      console.warn(`[pets] expand requested but STABILITY_API_KEY missing — skipping`)
    }
  } else {
    lastExpandSkip = req.scale === 'fill'
      ? `pipeline: scale=fill (no margins)`
      : `pipeline: expandEnabled=false for style=${styleId}`
  }

  return {
    ok:                   true,
    image_b64:            finalImageB64,
    prompt_used:          finalPromptUsed,
    style:                styleId,
    preset:               presetId,
    environment:          environmentId,
    action:               actionId,
    subject_count:        subjectCount,
    refined:              lastRefined,
    refine_ms:            lastRefineMs,
    refine_decision:      refineDecision,
    expanded:             lastExpanded,
    expand_ms:            lastExpandMs,
    expand_skip:          lastExpandSkip,
    swapped:              false,
    swap_ms:              null,
    swap_skip:            'not applicable: face swap is a human-face model; pet identity is held by prompt + scoring',
    pets_detected_source: detectedSubjectCount,
    pets_detected_render: lastPetsRender,
    attempts,
    final_pass:           attempts[attempts.length - 1]?.passed || false,
    final_reason:         attempts[attempts.length - 1]?.pass_reason || 'no attempts',
    fatal_error:          null,
    duration_ms:          Date.now() - t0,
  }
}

// ─── HELPERS ────────────────────────────────────────────────────

// Turn detect's constrained coat vocabulary into a positive prompt
// sentence. One register-level negative is retained for short/medium
// coats ("not a longer or more flowing interpretation") — genre drift
// toward luxuriant carved fur is a register problem, same precedent as
// "no gears, no clockwork".
const COAT_LENGTH_PHRASE: Record<string, string> = {
  short:  'short',
  medium: 'medium-length',
  long:   'long',
}
const COAT_TEXTURE_PHRASE: Record<string, string> = {
  sleek:  'sleek and close-lying',
  dense:  'dense and close-lying',
  plush:  'plush and even',
  wiry:   'wiry and textured',
  curly:  'curly',
  fluffy: 'fluffy and full',
}
const TAIL_PHRASE: Record<string, string> = {
  slim:   'a slim tail',
  brush:  'a moderately furred brush tail',
  plumed: 'a long plumed tail',
  bobbed: 'a bobbed tail',
  curled: 'a curled tail',
}

function describeCoat(c: PetCoatProfile): string {
  const len = COAT_LENGTH_PHRASE[c.coat_length] || 'short'
  const tex = COAT_TEXTURE_PHRASE[c.coat_texture] || 'dense and close-lying'
  const tail = TAIL_PHRASE[c.tail] // undefined for not_visible — omit
  return `${len} fur, ${tex}${tail ? `, with ${tail}` : ''}`
}

// Distinctive features → prompt block. The closing directive carries
// one register-level negative ("never corrected, healed, or idealized")
// — beautification is register drift, same precedent as the coat guard.
function buildFeatureNote(features: PetFeatureProfile[], subjectCount: number): string {
  if (!features || features.length === 0) return ''
  const used = features.filter(f => f.animal_index < subjectCount)
  if (used.length === 0) return ''
  const guard =
    ' These traits are part of this animal\'s identity — sculpt each one exactly as photographed, never corrected, healed, brightened, or idealized.'
  if (subjectCount === 1) {
    const traits = used[0].traits.join('; ')
    return `This animal's distinguishing features, as photographed: ${traits}.${guard}`
  }
  const lines = used
    .map(f => `Animal ${f.animal_index + 1} (in order of prominence): ${f.traits.join('; ')}`)
    .join('. ')
  return `The animals' distinguishing features, as photographed: ${lines}.${guard}`
}

function buildCoatNote(coats: PetCoatProfile[], subjectCount: number): string {
  if (!coats || coats.length === 0) return ''
  const used = coats.slice(0, subjectCount)
  const anyShortOrMedium = used.some(c => c.coat_length !== 'long')
  const guard = anyShortOrMedium
    ? ' Sculpt the fur at exactly this length and volume, faithful to the photograph — not a longer or more flowing interpretation.'
    : ' Sculpt the fur at exactly this length and volume, faithful to the photograph.'
  if (used.length === 1) {
    return `This animal's coat, as photographed: ${describeCoat(used[0])}.${guard}`
  }
  const lines = used
    .map((c, i) => `Animal ${i + 1} (in order of prominence): ${describeCoat(c)}`)
    .join('. ')
  return `The animals' coats, as photographed: ${lines}.${guard}`
}

function buildFatalResult(args: {
  msg:            string
  prompt:         string
  styleId:        PetsStyleId
  presetId:       PetsPresetId
  environmentId:  EnvironmentId
  actionId:       ActionId
  refineDecision: string
  attempts:       PetsAttempt[]
  t0:             number
}): PetsGenerateResult {
  return {
    ok:                   false,
    image_b64:            null,
    prompt_used:          args.prompt,
    style:                args.styleId,
    preset:               args.presetId,
    environment:          args.environmentId,
    action:               args.actionId,
    subject_count:        1,
    refined:              false,
    refine_ms:            null,
    refine_decision:      args.refineDecision,
    expanded:             false,
    expand_ms:            null,
    expand_skip:          null,
    swapped:              false,
    swap_ms:              null,
    swap_skip:            null,
    pets_detected_source: 0,
    pets_detected_render: 0,
    attempts:             args.attempts,
    final_pass:           false,
    final_reason:         `Stage 1 failure: ${args.msg}`,
    fatal_error:          args.msg,
    error_code:           'nb2_failed',
    retryable:            true,
    duration_ms:          Date.now() - args.t0,
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

  // Style ref appended as the LAST input image.
  const imageInput = input.styleReferenceB64
    ? [...sourceUris, `data:image/jpeg;base64,${input.styleReferenceB64}`]
    : sourceUris

  console.log(
    `[pets/generate] NB2 aspect=${input.aspectRatio} ` +
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
