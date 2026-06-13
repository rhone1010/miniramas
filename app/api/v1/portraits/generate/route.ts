// app/api/v1/portraits/generate/route.ts
//
// Single-render endpoint for the Portraits silo (Realistic, Resolving,
// Artists Gallery). Tribal styles have migrated to the Artist Series.
// Pipeline (delegated to generatePortraitsRender):
//   detect → NB2 → single-face likeness score
// Pass 2 and faceswap are off per pipeline config; outpaint runs for
// Realistic/Resolving (10%, now local canvas pad) and is off for Artists Gallery.
//
// QA LAYER (reference implementation for all six silos):
//   Gate 0  subject classify + Series redirect   → may return a redirect offer
//   Gate 1  intake quality score                 → may return a "won't render well" reject
//   Gate 2  aesthetic score on the final render  → logged verdict (does NOT block delivery in v1)
// Every request gets one qa_log row (incoming + outgoing analysis). Strictness
// comes from qa_settings via two 1-10 sliders, read per request.
//
// Fail-open guarantee: the entire QA layer is wrapped so that any failure in
// classification, intake, logging, or aesthetic scoring is swallowed and the
// customer's render proceeds. QA observability can never break a render.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import sharp from 'sharp'

import { generatePortraitsRender } from '@/lib/v1/portraits/portraits-generator'
import { STYLE_PIPELINE, PRESET_LABELS } from '@/lib/v1/portraits/portraits-shared'
import type {
  PortraitsStyleId,
  PortraitsPresetId,
  LocationId,
  Scale,
  PortraitsGenerateRequest,
} from '@/lib/v1/portraits/portraits-shared'

import { classifySubject, decideRedirect } from '@/lib/shared/subject-redirect'
import { loadQaSettings, startQaEntry, type QaEntry } from '@/lib/shared/qa-log'
import { applyQaOverride } from '@/lib/shared/qa-override'
// NOTE: scoreIntake/scoreAesthetic + MIN_LONG_EDGE_PX currently live in
// lib/bench/bench-gates.ts; relocation to lib/shared/quality-gates.ts is the
// noted cleanup. Importing from there short-term is fine.
import { scoreIntake, scoreAesthetic, MIN_LONG_EDGE_PX } from '@/lib/bench/bench-gates'

export const runtime     = 'nodejs'
export const maxDuration = 300

// Rough per-stage cost (cents) for qa_log observability only — not billing.
const QA_COST = { gate: 1, nb2: 5, canvasPad: 0, gptImage: 8 } as const

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()

    // ── Internal-traffic guard ──────────────────────────────────
    const internal = (() => {
      const key = process.env.LITEN_INTERNAL_KEY
      return !!key && req.headers.get('x-liten-internal') === key
    })()

    // ── Item 11 — preview bake gate ─────────────────────────────
    const isPreviewBake = body.is_preview_bake === true
    const previewBakePath: string | undefined = body.preview_bake_path
    if (isPreviewBake && !internal) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
    }
    if (isPreviewBake && !previewBakePath) {
      return NextResponse.json({ error: 'preview_bake_path required when is_preview_bake is true' }, { status: 400 })
    }

    // ── Field mapping ─────────────────────────────────────────
    const sourceImageB64: string = body.source_image_b64
    if (!sourceImageB64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const styleId:  PortraitsStyleId  = body.style_id
    const presetId: PortraitsPresetId = body.preset_id ?? body.preset
    const location: LocationId | undefined = body.location_id ?? body.location

    if (!styleId)  return NextResponse.json({ error: 'style_id required'  }, { status: 400 })
    if (!presetId) return NextResponse.json({ error: 'preset_id required' }, { status: 400 })

    // ── Runtime guards ────────────────────────────────────────
    if (!(styleId in STYLE_PIPELINE)) {
      return NextResponse.json(
        { error: `unknown style_id "${styleId}" — refresh the page for the current style list` },
        { status: 400 },
      )
    }
    if (!(presetId in PRESET_LABELS)) {
      return NextResponse.json(
        { error: `unknown preset_id "${presetId}" — refresh the page for the current treatment list` },
        { status: 400 },
      )
    }

    const upperBodyConcept: string | null | undefined =
      typeof body.upper_body_concept === 'string'
        ? body.upper_body_concept
        : (body.upper_body_concept === null ? null : undefined)

    const scale: Scale = (body.scale as Scale) || 'close_up'

    const generateRequest: PortraitsGenerateRequest = {
      source_image_b64:       sourceImageB64,
      additional_images_b64:  body.additional_images_b64 || [],
      style_reference_b64:    body.style_reference_b64 || undefined,
      style_id:               styleId,
      preset_id:              presetId,
      location_id:            location,
      scale,
      aspect_ratio:           body.aspect_ratio || undefined,
      refinements:            body.refinements || undefined,
      notes:                  body.notes || undefined,
      refinement_tweak:       body.refinement_tweak || undefined,
      refine:                 typeof body.refine === 'boolean' ? body.refine : undefined,
      is_preview:             typeof body.is_preview === 'boolean' ? body.is_preview : undefined,
      plaque_text:            body.plaque_text,
      upper_body_concept:     upperBodyConcept,
      advanced:               body.advanced || undefined,
    }

    // ── Env ────────────────────────────────────────────────────
    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 })
    }
    const openaiApiKey    = process.env.OPENAI_API_KEY    || undefined
    const stabilityApiKey = process.env.STABILITY_API_KEY || undefined

    // ════════════════════════════════════════════════════════════
    // QA LAYER — Gate 0 + Gate 1 (incoming analysis)
    // Fully fail-open: any throw here is caught and the render proceeds.
    // ════════════════════════════════════════════════════════════
    const sb = supaOrNull()
    let qa: QaEntry | null = null
    let qaSettings: Awaited<ReturnType<typeof loadQaSettings>> | null = null
    let costCents = 0

    if (sb && openaiApiKey) {
      try {
        qaSettings = await loadQaSettings(sb, 'portraits')
        // Item 8b — apply per-request qa_override (internal only; silently ignored otherwise)
        const { settings: effective } = applyQaOverride(qaSettings, 'portraits', body, internal)
        qaSettings = effective

        if (qaSettings.qaEnabled) {
          const sourceBuf  = Buffer.from(sourceImageB64, 'base64')
          const sourceHash = createHash('sha256').update(sourceBuf).digest('hex')
          const meta       = await sharp(sourceBuf).metadata()
          const resolutionOk = Math.max(meta.width ?? 0, meta.height ?? 0) >= MIN_LONG_EDGE_PX

          // Gate 0 — classify + redirect
          const classification = await classifySubject({ sourceImageB64, openaiApiKey })
          costCents += QA_COST.gate
          const decision = decideRedirect({ classification, currentSeries: 'portraits' })

          const incomingBase = {
            series: 'portraits' as const,
            settings: qaSettings,
            presetId, styleId, locationId: location, scale, sourceHash,
            sessionId: isPreviewBake ? undefined : (typeof body.session_id === 'string' ? body.session_id : undefined),
            userRef:   isPreviewBake ? undefined : (typeof body.user_ref   === 'string' ? body.user_ref   : undefined),
            detectedSubject:    classification.subjectType,
            subjectConfidence:  classification.confidence,
            subjectDescription: classification.description,
            activityDetected:   classification.activityDetected,
            seriesMatch:        decision.match,
            redirectSeries:     decision.redirectSeries,
            redirectMessage:    decision.userMessage,
          }

          // Redirect path — offer the right Series, do NOT generate.
          if (!decision.match && decision.redirectSeries) {
            qa = await startQaEntry(sb, incomingBase)
            await qa.finish({ status: 'redirected', costCents, durationMs: Date.now() - t0 })
            return NextResponse.json({
              status: 'redirected',
              redirect: {
                series:    decision.redirectSeries,
                message:   decision.userMessage,
                ctaLabel:  decision.ctaLabel,
                stayLabel: decision.stayLabel,
              },
            })
          }

          // Gate 1 — intake quality
          const intake = await scoreIntake({
            sourceImageB64,
            mode:         'subject',
            threshold:    qaSettings.intakeThreshold,
            openaiApiKey,
            resolutionOk,
          })
          costCents += QA_COST.gate

          const incoming = {
            ...incomingBase,
            intakeScore:   intake.score,
            intakeSignals: intake.signals,
            intakeReasons: intake.reasons,
            intakePassed:  intake.passed,
          }

          // Intake reject — tell the customer why, do NOT generate.
          if (!intake.passed) {
            qa = await startQaEntry(sb, incoming)
            await qa.finish({ status: 'intake_rejected', costCents, durationMs: Date.now() - t0 })
            return NextResponse.json({
              status:  'intake_rejected',
              intake:  { score: intake.score, reasons: intake.reasons },
            })
          }

          // Proceed — open the entry; it will be finished after the render.
          qa = await startQaEntry(sb, incoming)
        }
      } catch (e: any) {
        // Fail-open: QA hiccup must never block a render.
        console.warn(`[portraits/generate] QA incoming skipped: ${e?.message || 'unknown'}`)
      }
    }

    console.log(
      `[portraits/generate] start style=${styleId} preset=${presetId} ` +
      `location=${location || 'auto'} scale=${scale} ` +
      `has_concept=${!!upperBodyConcept}` +
      (qaSettings ? ` qa[src=${qaSettings.sourceStrictness} rnd=${qaSettings.renderStrictness}]` : ' qa[off]'),
    )

    // ── Run the pipeline ─────────────────────────────────────
    const result = await generatePortraitsRender({
      request:           generateRequest,
      replicateApiToken,
      openaiApiKey,
      stabilityApiKey,
      refineOverride:    typeof body.refine === 'boolean' ? body.refine : undefined,
    })

    const durationMs = Date.now() - t0
    console.log(
      `[portraits/generate] done in ${durationMs}ms — ` +
      `ok=${result.ok} final_pass=${result.final_pass} ` +
      `attempts=${result.attempts?.length || 0} ` +
      `refined=${result.refined} expanded=${result.expanded} swapped=${result.swapped}`,
    )

    // ════════════════════════════════════════════════════════════
    // QA LAYER — Gate 2 (outgoing analysis) + finish the entry
    // Verdict uses the live render-strictness thresholds. A 'failed'
    // verdict is LOGGED ONLY — the render still ships in v1 and feeds
    // the review / re-craft queue.
    // ════════════════════════════════════════════════════════════
    if (qa && qaSettings) {
      try {
        const attempts = (result.attempts as any[]) || []
        const attemptCount = attempts.length || 1
        costCents += attemptCount * QA_COST.nb2 + QA_COST.gate          // nb2 ×attempts + detection
        if (result.refined) costCents += QA_COST.gptImage

        const { fidelityScore, fidelityReason } = extractFidelity(attempts, result)
        const firstPass = attempts[0]?.passed === true

        let aestheticScore: number | null = null
        let aestheticReason: string | null = null
        if (result.ok && result.image_b64 && openaiApiKey) {
          const aes = await scoreAesthetic({ renderedImageB64: result.image_b64, openaiApiKey })
          aestheticScore  = aes.score
          aestheticReason = aes.reason
          costCents += QA_COST.gate
        }

        const fidelityOk  = fidelityScore == null || fidelityScore >= qaSettings.fidelityThreshold
        const aestheticOk = aestheticScore == null ||
          (aestheticScore >= qaSettings.aestheticThreshold && aestheticScore >= qaSettings.aestheticFloor)
        const outputPassed = Boolean(result.ok && result.image_b64) && fidelityOk && aestheticOk

        await qa.finish({
          status: !result.ok || !result.image_b64
            ? 'errored'
            : (outputPassed ? 'passed' : 'failed'),
          attempts:        attemptCount,
          firstPass,
          fidelityScore,
          fidelityReason,
          aestheticScore,
          aestheticReason,
          outputPassed,
          renderRef:       typeof body.render_ref === 'string' ? body.render_ref : null,
          errorNote:       result.ok ? null : (result.fatal_error || 'generator returned not-ok'),
          durationMs,
          costCents,
        })
      } catch (e: any) {
        console.warn(`[portraits/generate] QA outgoing skipped: ${e?.message || 'unknown'}`)
        try { await qa.finish({ status: result.ok ? 'passed' : 'errored', durationMs, costCents }) } catch {}
      }
    }

    // ── Item 11 — preview bake: write JPEG to storage ─────────
    if (isPreviewBake && sb && result.ok && result.image_b64) {
      try {
        const jpegBuf = await sharp(Buffer.from(result.image_b64, 'base64'))
          .jpeg({ quality: 90 })
          .toBuffer()

        const { error: uploadErr } = await sb.storage
          .from('previews')
          .upload(previewBakePath!, jpegBuf, {
            contentType: 'image/jpeg',
            upsert: true,
          })
        if (uploadErr) throw uploadErr

        return NextResponse.json({
          status: 'baked',
          storage_path: previewBakePath,
          qa_log_id: qa?.id ?? null,
        })
      } catch (e: any) {
        return NextResponse.json({ error: `bake upload failed: ${e?.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ result })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    const durationMs = Date.now() - t0
    console.error(`[portraits/generate] failed in ${durationMs}ms: ${msg}`)
    return NextResponse.json({ error: msg, duration_ms: durationMs }, { status: 500 })
  }
}

// ── helpers ──────────────────────────────────────────────────────

function supaOrNull() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// Score lives on the LAST attempt: realistic/resolving carry per_figure_scores[0];
// tribal/caricature styles carry caricature_score.overall_score.
function extractFidelity(attempts: any[], result: any): {
  fidelityScore: number | null; fidelityReason: string | null
} {
  const last = attempts[attempts.length - 1]
  if (last?.per_figure_scores?.[0]) {
    return {
      fidelityScore:  Number(last.per_figure_scores[0].score),
      fidelityReason: String(last.per_figure_scores[0].reason ?? ''),
    }
  }
  if (last?.caricature_score) {
    return {
      fidelityScore:  Number(last.caricature_score.overall_score),
      fidelityReason: String(last.caricature_score.reason ?? ''),
    }
  }
  return { fidelityScore: null, fidelityReason: result?.final_reason ?? null }
}
