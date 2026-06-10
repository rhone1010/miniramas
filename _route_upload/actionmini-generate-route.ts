// app/api/v1/actionmini/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateActionMini, ActionMiniPresetId, LocationId } from '@/lib/v1/action/actionmini-generator'
import { ACTION_MINI_PRESETS } from '@/lib/v1/action/actionmini-presets'
import type { KineticMedium } from '@/lib/v1/action/actionmini-shared'
import { sanitizeTweak, detectFaceVisibility } from '@/lib/v1/action/actionmini-refine'

// Two-pass pipeline: NB2 (~15-20s) + gpt-image-1 refine (~20-35s).
// Bump maxDuration so Pass 2 has headroom on slow gpt-image-1 turns.
// Pin runtime to nodejs — edge runtime breaks the OpenAI client + binary
// buffer ops in Pass 2.
export const runtime     = 'nodejs'
export const maxDuration = 180

// ── PRESET VALIDATION ────────────────────────────────────────
const VALID_PRESET_IDS = new Set(ACTION_MINI_PRESETS.map(p => p.id))

// Legacy aliases — old clients sending obsolete preset names get remapped
// silently to the closest current equivalent.
const LEGACY_PRESET_ALIASES: Record<string, ActionMiniPresetId> = {
  'insitu':  'resin',
  'museum':  'resin',
}

function normalizePresetId(raw: unknown): ActionMiniPresetId {
  const s = String(raw || '').trim()
  if (LEGACY_PRESET_ALIASES[s]) return LEGACY_PRESET_ALIASES[s]
  if (VALID_PRESET_IDS.has(s as ActionMiniPresetId)) return s as ActionMiniPresetId
  return 'resin' // default fallback
}

// ── KINETIC MEDIUM VALIDATION ────────────────────────────────
const VALID_MEDIUMS: KineticMedium[] = [
  'whitewater','surf','snow','skate','bike','climb','run','dance','combat','other'
]
function normalizeMedium(raw: unknown): KineticMedium {
  const s = String(raw || '').trim() as KineticMedium
  return VALID_MEDIUMS.includes(s) ? s : 'other'
}

// ── LOCATION VALIDATION ──────────────────────────────────────
// V5 schema: 5 locations. Default fallback is 'desk'.
// Legacy V4 IDs (in_context, on_a_desk, on_a_shelf) are accepted for
// back-compat during UI migration — they're remapped to V5 IDs by the
// engine's LEGACY_LOCATION_ID_MAP.
const VALID_LOCATIONS: LocationId[] = ['in_situ', 'desk', 'shelf', 'workshop', 'pedestal']
const LEGACY_LOCATIONS = new Set(['in_context', 'on_a_desk', 'on_a_shelf'])
function normalizeLocation(raw: unknown): LocationId {
  const s = String(raw || '').trim()
  if (VALID_LOCATIONS.includes(s as LocationId)) return s as LocationId
  // Pass through legacy IDs untouched — engine will map them to V5
  if (LEGACY_LOCATIONS.has(s)) return s as LocationId
  return 'desk'  // default fallback
}

// ── ERROR TRANSLATION ────────────────────────────────────────
function translateError(msg: string): { code: string; userMessage: string; retryable: boolean } {
  const m = msg.toLowerCase()
  if (m.includes('safety') || m.includes('moderation') || m.includes('content_policy')) {
    return { code: 'safety', userMessage: 'Content policy declined this image. Try a different photo.', retryable: false }
  }
  if (m.includes('timeout') || m.includes('timed out')) {
    return { code: 'timeout', userMessage: 'Generation took too long. Try again.', retryable: true }
  }
  // IMPORTANT: 'rate' as a bare substring matches 'generate'. Use specific
  // strings to avoid false-positive rate_limit on every NB2 failure.
  if (m.includes('rate limit') || m.includes('rate_limit') || m.includes('rate-limit')
      || m.includes('too many requests') || m.includes('429')) {
    return { code: 'rate_limit', userMessage: 'Rate limit reached. Wait a moment and try again.', retryable: true }
  }
  return { code: 'unknown', userMessage: 'Generation failed. Try again.', retryable: true }
}

// ── HANDLER ──────────────────────────────────────────────────
// Pipeline:
//   1. NB2 generate (always — Pass 1 is the primary renderer for Action)
//   2. gpt-image-1 refine (DEFAULT OFF for Action silo, opt-in via
//      body.refine === true). gpt-image-1 degrades facial likeness; for
//      a face-visible silo like Action, NB2 alone is the better default.
//   3. Stability outpaint (default on when scale === 'close_up'/Staged)
// All post-Pass-1 stages soft-fail to the previous output on any error —
// non-fatal.
export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const body = await req.json()

    const sourceImageB64 = body.source_image_b64
    if (!sourceImageB64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const presetId        = normalizePresetId(body.preset || body.preset_id)
    const kineticMedium   = normalizeMedium(body.kinetic_medium)
    const locationId      = normalizeLocation(body.location)
    const scale           = (body.scale === 'fill' || body.scale === 'close_up') ? body.scale : 'close_up'
    const aspectRatio     = body.aspect_ratio || body.aspectRatio || '1:1'
    const notes           = typeof body.notes === 'string' ? body.notes : undefined
    const displayName     = String(body.display_name || presetId)
    const refinementTweak = sanitizeTweak(body.refinement_tweak)   // ≤150 chars, single-line, sanitized

    // Refinements — V5 collapsed to a single toggle (kineticEffects).
    // Other V4 toggles (craftDetail, sceneDetail, dramaticLighting,
    // sceneEnvironment, margins) are now permanent in the engine and
    // ignored from the request body.
    const r = (body.refinements && typeof body.refinements === 'object') ? body.refinements : {}
    const refinements = {
      kineticEffects: r.kineticEffects !== false,
    }

    // Pass 2 controls — face-visibility-aware auto-detection.
    //
    // body.refine === true   → opt-in, run Pass 2 regardless
    // body.refine === false  → opt-out, skip Pass 2 regardless
    // body.refine undefined  → preflight gpt-4o-mini detects face on source.
    //                          Face visible → Pass 1 only (skip Pass 2 to avoid
    //                          gpt-image-1 face drift).
    //                          No face visible → run Pass 2 for material polish.
    //
    // Detection adds ~1-2s and ~$0.001 per render but only when refine is
    // not explicitly set. Surfaces decision rationale on the response.
    const openaiApiKey  = process.env.OPENAI_API_KEY
    let refine: boolean
    let refineDecision: string

    if (typeof body.refine === 'boolean') {
      refine = body.refine
      refineDecision = `explicit (body.refine=${body.refine})`
    } else if (openaiApiKey) {
      try {
        const det = await detectFaceVisibility({ sourceImageB64, openaiApiKey })
        refine = !det.face_visible
        refineDecision = `auto: face_visible=${det.face_visible} — ${det.reason}`
      } catch (e: any) {
        // Detection failure → default to Pass 1 only (safer for face-visible silo)
        refine = false
        refineDecision = `auto: detection failed (${String(e?.message).slice(0, 80)}), Pass 1 only`
      }
    } else {
      refine = false
      refineDecision = 'no openai key, Pass 2 unavailable'
    }

    // Stability outpaint key. Generator only fires expand when scale ===
    // 'close_up' (Staged); Close Up scale stays tight regardless.
    const stabilityApiKey = process.env.STABILITY_API_KEY

    // ── DEV/POWER-USER OVERRIDES ────────────────────────────────
    // body.raw_prompt          → string to use as Pass 1 prompt directly
    //                            (bypasses buildPresetPrompt entirely).
    //                            Capped at 30k chars to prevent abuse.
    //                            preset/location/kinetic/etc still used for
    //                            non-prompt stages (face swap, scoring).
    // body.raw_pass2_prompt    → string to use as Pass 2 prompt directly
    //                            (only meaningful when refine === true).
    //                            Capped at 30k chars.
    // body.expand              → boolean. Explicit false skips Stage 3
    //                            outpaint regardless of scale. Default true
    //                            (current behavior — fires on close_up).
    // body.use_v7              → true → use V7 prompt system (buildV7Prompt,
    //                            9-block environment-mode architecture with
    //                            action-aware kinetics and scene-aware
    //                            environment). Schema simplifies — location,
    //                            scale, kinetic_medium ignored when V7 on.
    // body.mode                → 'environment' (default) | 'gallery'.
    //                            Only meaningful when use_v7 === true.
    //
    // Precedence: rawPrompt > use_v7 → buildV7Prompt > buildPresetPrompt.
    const RAW_PROMPT_CAP = 30_000
    const useV7   = body.use_v7 === true
    const v7Mode: 'environment' | 'gallery' =
      body.mode === 'gallery' ? 'gallery' : 'environment'
    const rawPrompt = (typeof body.raw_prompt === 'string' && body.raw_prompt.trim())
      ? body.raw_prompt.trim().slice(0, RAW_PROMPT_CAP)
      : undefined
    const rawPass2Prompt = (typeof body.raw_pass2_prompt === 'string' && body.raw_pass2_prompt.trim())
      ? body.raw_pass2_prompt.trim().slice(0, RAW_PROMPT_CAP)
      : undefined
    const expandEnabled = body.expand !== false

    // Diagnostic line — surfaces the auto-detection decision so future
    // debugging doesn't need to guess. The "why Pass 2 ran/skipped"
    // question is answered right here.
    console.log(
      `[actionmini] req preset=${presetId} loc=${locationId} scale=${scale} ` +
      `ar=${aspectRatio} refine=${refine} (${refineDecision}) ` +
      `expand=${expandEnabled} raw_p1=${rawPrompt ? `${rawPrompt.length}c` : 'no'} ` +
      `raw_p2=${rawPass2Prompt ? `${rawPass2Prompt.length}c` : 'no'} ` +
      `use_v7=${useV7}${useV7 ? ` mode=${v7Mode}` : ''} ` +
      `hasOpenAIKey=${Boolean(openaiApiKey)} hasStabilityKey=${Boolean(stabilityApiKey)}`,
    )

    const replicateToken = process.env.REPLICATE_API_TOKEN
    if (!replicateToken) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not set' }, { status: 500 })
    }

    const system_log: any[] = []
    const render_log: any[] = []
    const timings: { generate_ms?: number; total_ms?: number } = {}

    // ── GENERATE ───────────────────────────────────────────────
    const tGen = Date.now()
    try {
      const result = await generateActionMini({
        sourceImageB64,
        presetId,
        kineticMedium,
        locationId,
        scale,
        aspectRatio,
        refinements,
        notes,
        refinementTweak,
        replicateApiToken: replicateToken,
        refine,
        openaiApiKey,
        stabilityApiKey,
        rawPrompt,
        rawPass2Prompt,
        expand: expandEnabled,
        useV7,
        v7Mode,
      })
      timings.generate_ms = Date.now() - tGen
      timings.total_ms    = Date.now() - t0
      const stageLabel = refinementTweak ? 'generate-refined' : 'generate'
      system_log.push({ code: 200, stage: stageLabel, ms: timings.generate_ms })
      render_log.push({ ok: true, msg: refinementTweak ? 'refined render complete' : 'render complete' })

      return NextResponse.json({
        result: {
          image_b64:        result.imageB64,
          prompt_used:      result.promptUsed,
          preset:           presetId,
          location:         locationId,
          name:             displayName,
          refinement_tweak: refinementTweak || null,
          // Pass 2 telemetry
          refined:          result.refined,
          refine_ms:        result.refineDurationMs ?? null,
          refine_decision:  refineDecision,
          // Outpaint telemetry — fires only when scale === 'close_up' (Staged).
          expanded:         result.expanded,
          expand_ms:        result.expandDurationMs ?? null,
          expand_skip:      result.expandSkipReason ?? null,
          // Stage 4 face swap telemetry
          swapped:          result.swapped,
          swap_ms:          result.swapDurationMs ?? null,
          swap_skip:        result.swapSkipReason ?? null,
          // Multipass telemetry
          final_score:      result.finalScore ?? null,
          final_score_reason: result.finalScoreReason ?? null,
          attempts:         result.attempts,
          // Dev/power-user override flags
          raw_prompt_used:       result.rawPromptUsed,
          raw_pass2_prompt_used: result.rawPass2PromptUsed,
          expand_requested:      expandEnabled,
          use_v7:                useV7,
          v7_mode:               useV7 ? v7Mode : null,
          render_log,
          system_log,
          fatal_error:      null,
          timings,
          duration_ms:      timings.total_ms,
        },
      })

    } catch (e: any) {
      timings.generate_ms = Date.now() - tGen
      timings.total_ms    = Date.now() - t0
      const tr = translateError(e.message)
      console.error(`[actionmini] ${presetId} FAILED — ${e.message}`)
      system_log.push({ code: 500, stage: 'generate', err: e.message, ms: timings.generate_ms })
      return NextResponse.json({
        result: {
          image_b64:    null,
          prompt_used:  '',
          preset:       presetId,
          name:         displayName,
          fatal_error:  tr.userMessage,
          error_code:   tr.code,
          raw_error:    e.message,         // unfiltered upstream error for diagnostics
          retryable:    tr.retryable,
          render_log:   [{ ok: false, msg: tr.userMessage }],
          system_log,
          timings,
          duration_ms:  timings.total_ms,
        },
      })
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message, fatal_error: true, duration_ms: Date.now() - t0 }, { status: 500 })
  }
}
