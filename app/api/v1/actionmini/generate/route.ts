// app/api/v1/actionmini/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateActionMini, ActionMiniPresetId, LocationId } from '@/lib/v1/action/actionmini-generator'
import { ACTION_MINI_PRESETS } from '@/lib/v1/action/actionmini-presets'
import type { KineticMedium } from '@/lib/v1/action/actionmini-shared'
import { sanitizeTweak } from '@/lib/v1/action/actionmini-refine'

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
const VALID_LOCATIONS: LocationId[] = ['in_context', 'on_a_desk', 'on_a_shelf']
function normalizeLocation(raw: unknown): LocationId {
  const s = String(raw || '').trim() as LocationId
  return VALID_LOCATIONS.includes(s) ? s : 'on_a_desk'  // default fallback
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
  if (m.includes('rate') || m.includes('429')) {
    return { code: 'rate_limit', userMessage: 'Rate limit reached. Wait a moment and try again.', retryable: true }
  }
  return { code: 'unknown', userMessage: 'Generation failed. Try again.', retryable: true }
}

// ── HANDLER ──────────────────────────────────────────────────
// Single-stage pipeline: generate via nano banana → return.
// No post-processing — nano banana output is final.
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
    const notes           = typeof body.notes === 'string' ? body.notes : undefined
    const displayName     = String(body.display_name || presetId)
    const refinementTweak = sanitizeTweak(body.refinement_tweak)   // ≤150 chars, single-line, sanitized

    // Refinements — six toggleable blocks. Default all-on.
    // Body shape: { refinements: { craftDetail, sceneDetail, kineticEffects, sceneEnvironment, dramaticLighting, margins } }
    // Backwards-compat: old clients may still send sceneComplement; map it to sceneEnvironment.
    const r = (body.refinements && typeof body.refinements === 'object') ? body.refinements : {}
    const sceneEnvironmentRaw = r.sceneEnvironment !== undefined ? r.sceneEnvironment : r.sceneComplement
    const refinements = {
      craftDetail:       r.craftDetail       !== false,
      sceneDetail:       r.sceneDetail       !== false,
      kineticEffects:    r.kineticEffects    !== false,
      sceneEnvironment:  sceneEnvironmentRaw !== false,
      dramaticLighting:  r.dramaticLighting  !== false,
      margins:           r.margins           !== false,
    }

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
        refinements,
        notes,
        refinementTweak,
        replicateApiToken: replicateToken,
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
