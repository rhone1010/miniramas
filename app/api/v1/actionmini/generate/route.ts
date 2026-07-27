// app/api/v1/actionmini/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateActionMini, ActionMiniPresetId } from '@/lib/v1/action/actionmini-generator'
import { ACTION_MINI_PRESETS } from '@/lib/v1/action/actionmini-presets'
import type { KineticMedium } from '@/lib/v1/action/actionmini-shared'
import { sanitizeTweak } from '@/lib/v1/action/actionmini-refine'

// V7 single-pass pipeline: NB2 → faceswap → done. The gpt-image-1 Pass 2
// and the Stability outpaint are gone, so the long tail is removed. The
// nodejs runtime is still required for the OpenAI client used by the
// face-fidelity quality gate (Stage 5).
export const runtime     = 'nodejs'
export const maxDuration = 180

// ── PRESET VALIDATION ────────────────────────────────────────
const VALID_PRESET_IDS = new Set(ACTION_MINI_PRESETS.map(p => p.id))

// Legacy aliases — old clients sending obsolete preset names get remapped
// silently to the closest current equivalent. The V7 material set dropped
// resin / wax_bronze / terracotta_cracked / painted_ceramic_cracked and
// renamed bronze_bronze → bronze.
const LEGACY_PRESET_ALIASES: Record<string, ActionMiniPresetId> = {
  'insitu':                  'bronze',
  'museum':                  'bronze',
  'bronze_bronze':           'bronze',
  'resin':                   'bronze',
  'wax_bronze':              'bronze',
  'terracotta_cracked':      'stone',
  'painted_ceramic_cracked': 'stone',
}

function normalizePresetId(raw: unknown): ActionMiniPresetId {
  const s = String(raw || '').trim()
  if (LEGACY_PRESET_ALIASES[s]) return LEGACY_PRESET_ALIASES[s]
  if (VALID_PRESET_IDS.has(s as ActionMiniPresetId)) return s as ActionMiniPresetId
  return 'bronze' // default fallback
}

// ── KINETIC MEDIUM VALIDATION ────────────────────────────────
const VALID_MEDIUMS: KineticMedium[] = [
  'whitewater','surf','snow','skate','bike','climb','run','dance','combat','other'
]
function normalizeMedium(raw: unknown): KineticMedium {
  const s = String(raw || '').trim() as KineticMedium
  return VALID_MEDIUMS.includes(s) ? s : 'other'
}

// LOCATION VALIDATION removed in V7 — there is no location system. One
// hero look with a material-matched backdrop; body.location is ignored.

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
// Pipeline (V7):
//   1. NB2 generate — the single renderer, prompt from buildPresetPrompt
//   2. Face swap (Replicate) for likeness
//   3. Face-fidelity scoring + one retry if below threshold
// Post-generate stages soft-fail to the previous output — non-fatal.
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
    const aspectRatio     = body.aspect_ratio || body.aspectRatio || '1:1'
    const displayName     = String(body.display_name || presetId)
    const refinementTweak = sanitizeTweak(body.refinement_tweak)   // ≤150 chars, single-line, sanitized

    // V7: body.location, body.scale, body.mode, body.use_v7, body.refine,
    // body.expand, body.notes and body.refinements are accepted but ignored
    // — the engine has one hero look and a single prompt system.

    // Pass 2 (gpt-image-1 refine) and its face-visibility auto-detection are
    // removed in V7. The OpenAI key is still read — the face-fidelity quality
    // gate (Stage 5, scoreFaceFidelity) uses it.
    const openaiApiKey = process.env.OPENAI_API_KEY

    // ── DEV/POWER-USER OVERRIDES ────────────────────────────────
    // body.raw_prompt          → string to use as Pass 1 prompt directly
    //                            (bypasses buildPresetPrompt entirely).
    //                            Capped at 30k chars to prevent abuse.
    //                            preset/location/kinetic/etc still used for
    //                            non-prompt stages (face swap, scoring).
    // (raw_pass2_prompt, expand, use_v7 and mode are gone — Pass 2, the
    // outpaint stage and the V7/V6 prompt fork were all removed.)
    const RAW_PROMPT_CAP = 30_000
    const rawPrompt = (typeof body.raw_prompt === 'string' && body.raw_prompt.trim())
      ? body.raw_prompt.trim().slice(0, RAW_PROMPT_CAP)
      : undefined

    console.log(
      `[actionmini] req preset=${presetId} medium=${kineticMedium} ar=${aspectRatio} ` +
      `raw_p1=${rawPrompt ? `${rawPrompt.length}c` : 'no'} ` +
      `hasOpenAIKey=${Boolean(openaiApiKey)}`,
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
        aspectRatio,
        refinementTweak,
        replicateApiToken: replicateToken,
        openaiApiKey,
        rawPrompt,
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
          name:             displayName,
          refinement_tweak: refinementTweak || null,
          // Pass 2 + outpaint removed in V7 — retained as constants so
          // existing clients reading these fields keep working.
          refined:          result.refined,
          refine_ms:        result.refineDurationMs ?? null,
          refine_decision:  'removed in V7',
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
          expand_requested:      false,
          use_v7:                false,
          v7_mode:               null,
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
