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
import { getUser } from '@/lib/store/auth'
import { checkInternalAuth } from '@/lib/store/internal-auth'
import {
  decideGenerateAccess, openGrant, persistAndConsume, releaseGrant, type ClaimedGrant,
} from '@/lib/store/generation-grants'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'crypto'
import sharp from 'sharp'

import {
  normalizeEmail, clientIpHash, checkPreviewAllowed,
  recordPreview, storeCleanOriginal, bakeWatermark,
} from '@/lib/store/preview'

import { generatePortraitsRender, callNB2 } from '@/lib/v1/portraits/portraits-generator'
import { detectFaceVisibility } from '@/lib/v1/portraits/portraits-refine'
import {
  isExperimentalEffect, buildExperimentalPrompt,
} from '@/lib/v1/portraits/portraits-experimental'
import {
  STYLE_PIPELINE, PRESET_LABELS, isPoseId,
  isSubject, subjectFromDetectedGender,
  isAgeGroup,
} from '@/lib/v1/portraits/portraits-shared'
import type {
  PortraitsStyleId,
  PortraitsPresetId,
  LocationId,
  Scale,
  Framing,
  ResolutionTier,
  PortraitsGenerateRequest,
  PortraitsSubject,
  PortraitsAgeGroup,
} from '@/lib/v1/portraits/portraits-shared'
import {
  normalizeFraming, ASPECT_FOR_FRAMING, isResolutionTier,
  isPortraitOutputAspect, PORTRAIT_OUTPUT_ASPECTS,
} from '@/lib/v1/portraits/portraits-shared'

import { classifySubject, decideRedirect } from '@/lib/shared/subject-redirect'
import { loadQaSettings, startQaEntry, type QaEntry } from '@/lib/shared/qa-log'
import { applyQaOverride, qaOverrideAllowed } from '@/lib/shared/qa-override'
// NOTE: scoreIntake/scoreAesthetic + MIN_LONG_EDGE_PX currently live in
// lib/bench/bench-gates.ts; relocation to lib/shared/quality-gates.ts is the
// noted cleanup. Importing from there short-term is fine.
import { scoreIntake, scoreAesthetic, MIN_LONG_EDGE_PX } from '@/lib/bench/bench-gates'

export const runtime     = 'nodejs'
export const maxDuration = 300

// ── FOCAL SUBJECT-PICK (Source Control v5, §4/§6) ────────────────────
// focal {x,y,zoom,subjectId} is the single source of truth for framing. We
// server-crop the source to the chosen 3:4 region BEFORE the QA gates and the
// generator, so the picked subject fills the frame everything downstream sees
// (and QA scores likeness against THAT face, not the most prominent one).
interface Focal { x: number; y: number; zoom: number; subjectId: string | null }

function parseFocal(raw: any): Focal | null {
  if (!raw || typeof raw !== 'object') return null
  const num = (v: any, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d)
  return {
    x:    Math.min(Math.max(num(raw.x, 0.5), 0), 1),
    y:    Math.min(Math.max(num(raw.y, 0.5), 0), 1),
    zoom: Math.min(Math.max(num(raw.zoom, 1), 1), 3),
    subjectId: typeof raw.subjectId === 'string' ? raw.subjectId : null,
  }
}

// Only re-crop when the customer actually framed (picked a subject, zoomed, or
// panned). An untouched single-subject source is left alone so the common path
// never regresses.
function focalIsMeaningful(f: Focal): boolean {
  return f.subjectId !== null || f.zoom > 1.02 ||
         Math.abs(f.x - 0.5) > 0.02 || Math.abs(f.y - 0.5) > 0.02
}

// Crop the source to the 3:4 focal region (mirrors the client's cover-fit +
// zoom math). Fail-open: any error returns the original source untouched.
async function cropSourceToFocal(b64: string, f: Focal): Promise<string> {
  try {
    const buf  = Buffer.from(b64, 'base64')
    const meta = await sharp(buf).metadata()
    const W = meta.width || 0, H = meta.height || 0
    if (!W || !H) return b64
    const VW = 3, VH = 4                                   // 3:4 viewport
    const coverBase = Math.max(VW / W, VH / H)             // source covers viewport
    const cw = VW / (coverBase * f.zoom)
    const ch = VH / (coverBase * f.zoom)
    let width  = Math.min(Math.round(cw), W)
    let height = Math.min(Math.round(ch), H)
    let left = Math.min(Math.max(Math.round(f.x * W - width  / 2), 0), W - width)
    let top  = Math.min(Math.max(Math.round(f.y * H - height / 2), 0), H - height)
    if (width < 8 || height < 8) return b64
    let pipeline = sharp(buf).extract({ left, top, width, height })
    // A tight crop can land below the intake resolution gate (MIN_LONG_EDGE_PX),
    // which would bounce the piece before it ever renders. Upscale the crop so
    // its long edge clears the floor with margin — the generator re-synthesizes
    // anyway, so a moderate upscale costs nothing.
    const longEdge = Math.max(width, height)
    const MIN_OUT  = MIN_LONG_EDGE_PX + 256
    if (longEdge < MIN_OUT) {
      const scale = MIN_OUT / longEdge
      pipeline = pipeline.resize(Math.round(width * scale), Math.round(height * scale))
    }
    const out = await pipeline.jpeg({ quality: 95 }).toBuffer()
    return out.toString('base64')
  } catch (e) {
    console.warn('[portraits/generate] focal crop failed, using original source:', e)
    return b64
  }
}

// Rough per-stage cost (cents) for qa_log observability only — not billing.
const QA_COST = { gate: 1, nb2: 5, canvasPad: 0, gptImage: 8 } as const

/* ── WHO MAY GENERATE ────────────────────────────────────────────
   Decided from credentials, never from what the body asks for.

     internal   Authorization: Bearer $CRON_SECRET (checkInternalAuth) --
                Discovery's server-side portfolio render. Clean output.
     bake       x-liten-internal (bakeAuthorized), unchanged.
     grant      a signed-in owner AND a single-use generation grant from the
                /credits/gate spend for this exact craft -- Portraits in the
                browser. Claimed before any NB2 work; consumed only once the
                canonical result is persisted.
     refused    everything else: no session, no grant, experimental_effect,
                is_preview.

   This route used to return a clean image to anyone who left out
   is_preview, while the credit charge happened in a separate call it never
   looked at. */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const access = decideGenerateAccess({
    body,
    internal: checkInternalAuth(req).ok,
    bakeAuthorized: bakeAuthorized(req),
  })
  if (access.kind === 'refuse') {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let grant: ClaimedGrant | null = null
  let grantDb: ReturnType<typeof supaOrNull> = null
  if (access.kind === 'grant') {
    const user = await getUser().catch(() => null)
    if (!user) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })
    if (typeof body.grant_id !== 'string' || !body.grant_id) {
      return NextResponse.json({ error: 'grant_required' }, { status: 403 })
    }
    grantDb = supaOrNull()
    if (!grantDb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })
    const preset = String(body.preset_id ?? body.preset ?? '')
    const opened = await openGrant(grantDb, { grantId: body.grant_id, ownerKey: user.id, preset })
    if (opened.kind === 'refuse') {
      return NextResponse.json({ error: opened.error }, { status: opened.status })
    }
    if (opened.kind === 'redeliver') {
      // The canonical result for this grant already exists. Same shape as a
      // fresh render; no NB2 work.
      return NextResponse.json({ result: { ok: true, image_b64: opened.imageB64, redelivered: true }, redelivered: true })
    }
    grant = opened.grant
  }

  const outcome = { delivered: false }
  try {
    return await generatePortrait(req, body, grant, grantDb, outcome)
  } finally {
    // Anything that did not deliver -- a refusal, an intake rejection, a
    // redirect, a failed render, a failed persist, a throw -- puts the grant
    // back so the customer can retry it or be refunded for it.
    if (grant && grantDb && !outcome.delivered) {
      await releaseGrant(grantDb, grant, 'not_delivered')
    }
  }
}

async function generatePortrait(
  req: NextRequest,
  body: any,
  grant: ClaimedGrant | null,
  grantDb: ReturnType<typeof supaOrNull>,
  outcome: { delivered: boolean },
): Promise<NextResponse> {
  const t0 = Date.now()

  try {

    // ── Field mapping ─────────────────────────────────────────
    let sourceImageB64: string = body.source_image_b64
    if (!sourceImageB64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    // ── Focal subject-pick (§6, LIVE) ─────────────────────────────
    // Crop the source to the customer's chosen 3:4 framing BEFORE the QA
    // gates and generator. For a multi-person source this is what makes the
    // picked subject the one that gets crafted; subjectId is logged for QA.
    const focal = parseFocal(body.focal)
    if (focal && focalIsMeaningful(focal)) {
      sourceImageB64 = await cropSourceToFocal(sourceImageB64, focal)
      console.log(
        `[portraits/generate] focal crop applied — subject=${focal.subjectId ?? 'none'} ` +
        `zoom=${focal.zoom.toFixed(2)} x=${focal.x.toFixed(2)} y=${focal.y.toFixed(2)}`,
      )
    }

    /* The experimental-effects branch lived here: it called NB2 directly and
       returned a clean image before the age refusal, for anyone. It had no
       caller and is closed (2026-09-10); experimental_effect is refused before
       this function runs. */

    // ── Preview-bake mode (internal-only) ─────────────────────────
    // Runs the IDENTICAL pipeline (prompts, gates, QA) and only diverts
    // the output to storage + skips user-attributed side effects, so
    // library previews can never drift from customer renders. Auth is the
    // x-liten-internal token specifically — NOT qaOverrideAllowed — so a
    // header-less call is rejected even when QA_OVERRIDE_ENABLED=1 on dev.
    const isBake = body.is_preview_bake === true
    if (isBake) {
      if (!bakeAuthorized(req)) {
        return NextResponse.json({ error: 'preview_bake_forbidden' }, { status: 403 })
      }
      if (typeof body.preview_bake_path !== 'string' || !body.preview_bake_path) {
        return NextResponse.json({ error: 'preview_bake_path_required' }, { status: 400 })
      }
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

    // Three-framings (S1.1): framing is the source of truth; aspect is
    // derived from it and OVERRIDES any client aspect (a stale client can
    // disagree — framing wins). Resolution tier drives the post-render size.
    const framing: Framing = normalizeFraming(body.framing)
    /* An explicit output_aspect_ratio wins; anything else keeps the
       framing-derived value exactly as before. Note this is NOT
       body.aspect_ratio -- portraits.html sends that as '1:1' on every
       request and depends on it being discarded (portraits.html:6742). */
    const outputAspect = isPortraitOutputAspect(body.output_aspect_ratio)
      ? body.output_aspect_ratio
      : null
    if (body.output_aspect_ratio && !outputAspect) {
      return NextResponse.json(
        { error: 'unsupported_output_aspect_ratio', supported: PORTRAIT_OUTPUT_ASPECTS },
        { status: 400 },
      )
    }
    const aspectForFraming: string = outputAspect ?? ASPECT_FOR_FRAMING[framing]
    const resolution: ResolutionTier | undefined =
      isResolutionTier(body.resolution) ? body.resolution : undefined

    // Subject picks the gendered prompt body and the matching style-ref
    // plate. An explicit `subject` wins; otherwise fall back to analyze's
    // detected_gender so an untouched client still gets it right.
    // Undefined is valid — the engine renders the base variant.
    const subject: PortraitsSubject | undefined =
      isSubject(body.subject)
        ? body.subject
        : subjectFromDetectedGender(body.detected_gender)

    // Age bracket from analyze. 'child' and 'teen' suppress the style-ref
    // plates in the generator — every plate is an adult and a ref outranks
    // the source photograph.
    const ageGroup: PortraitsAgeGroup | undefined =
      isAgeGroup(body.age_group)
        ? body.age_group
        : (isAgeGroup(body.detected_age_group) ? body.detected_age_group : undefined)

    // ── AGE REFUSAL (server-side, authoritative) ──────────────────
    // Policy: Liten and Co does not craft images of anyone under 18.
    // The client gate in the workshop is a courtesy; this one is the gate.
    // Client-supplied age_group is NOT trusted here — we detect on the bytes
    // we are about to render. Best-guess by design: a wrong refusal goes to
    // concierge with an ID upload, a wrong pass is accepted.
    //
    // Fails OPEN on detection error. A vision outage must not stop the
    // business; it must not silently become a policy either, so it is logged.
    try {
      const ageCheck = await detectFaceVisibility({
        sourceImageB64,
        openaiApiKey: process.env.OPENAI_API_KEY || '',
      })
      console.log(
        `[portraits/generate] age gate: age_group=${ageCheck.age_group ?? 'null'} ` +
        `gender=${ageCheck.gender ?? 'null'}`
      )
      if (ageCheck.age_group === 'child' || ageCheck.age_group === 'teen') {
        return NextResponse.json(
          {
            error:  'This photograph appears to show someone under 18. Liten and Co crafts images of adults only.',
            code:   'age_restricted',
            reason: ageCheck.age_group,
          },
          { status: 403 }
        )
      }
    } catch (e) {
      console.error('[portraits/generate] age gate FAILED OPEN —', e)
    }

    const generateRequest: PortraitsGenerateRequest = {
      source_image_b64:       sourceImageB64,
      additional_images_b64:  body.additional_images_b64 || [],
      style_reference_b64:    body.style_reference_b64 || undefined,
      style_id:               styleId,
      preset_id:              presetId,
      location_id:            location,
      pose_id:                isPoseId(body.pose_id ?? body.pose) ? (body.pose_id ?? body.pose) : undefined,
      subject,
      age_group:              ageGroup,
      scale,
      framing,
      resolution,
      aspect_ratio:           aspectForFraming,   // framing wins unless output_aspect_ratio said otherwise; body.aspect_ratio still ignored
      output_aspect_ratio:    outputAspect ?? undefined,
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

    /* The anonymous free-preview entry gate lived here. It is closed
       (2026-09-10): it had no caller, and is_preview is refused before this
       function runs. The foyer's free preview will be designed on its own.
       */

    let qa: QaEntry | null = null
    let qaSettings: Awaited<ReturnType<typeof loadQaSettings>> | null = null
    let costCents = 0

    if (sb && openaiApiKey) {
      try {
        qaSettings = await loadQaSettings(sb, 'portraits')

        // 8b — per-request strictness override (internal traffic only).
        // Moves intake (source) AND fidelity/aesthetic (render) thresholds
        // together, since every gate below reads from this one qaSettings object.
        // No-op for customer traffic and whenever no qa_override is attached.
        qaSettings = applyQaOverride(qaSettings, 'portraits', body, qaOverrideAllowed(req)).settings

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
            sessionId: typeof body.session_id === 'string' ? body.session_id : undefined,
            userRef:   typeof body.user_ref   === 'string' ? body.user_ref   : undefined,
            detectedSubject:    classification.subjectType,
            subjectConfidence:  classification.confidence,
            subjectDescription: classification.description,
            activityDetected:   classification.activityDetected,
            seriesMatch:        decision.match,
            redirectSeries:     decision.redirectSeries,
            redirectMessage:    decision.userMessage,
          }

          // Redirect path — offer the right Series, do NOT generate.
          // skip_redirect: the customer already saw the multi-person
          // warning and chose "craft the most prominent person."
          const skipRedirect = body.skip_redirect === true
          if (!skipRedirect && !decision.match && decision.redirectSeries) {
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

    // ════════════════════════════════════════════════════════════
    // PREVIEW-BAKE — exit (internal library bake). Runs AFTER Gate 2
    // so QA scored the render identically to a customer render. Diverts
    // the image to storage and returns the baked shape. Gate 0/1 rejects
    // already returned above (the bake script swaps the source on those).
    // ════════════════════════════════════════════════════════════
    if (isBake) {
      if (!result.ok || !result.image_b64) {
        return NextResponse.json(
          { status: 'bake_failed', error: result.fatal_error || 'generator returned no image' },
          { status: 500 },
        )
      }
      if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

      const fullPath = String(body.preview_bake_path)
      const slash    = fullPath.indexOf('/')
      // First path segment is the (existing, private) bucket; remainder is the key.
      const bucket   = slash > 0 ? fullPath.slice(0, slash) : 'previews'
      const key      = slash > 0 ? fullPath.slice(slash + 1) : fullPath

      // Same delivery-JPEG spec as customer renders: q82, sRGB, progressive,
      // EXIF stripped (sharp drops metadata unless withMetadata() is called).
      const jpeg = await sharp(Buffer.from(result.image_b64, 'base64'))
        .toColourspace('srgb')
        .jpeg({ quality: 82, progressive: true, mozjpeg: true })
        .toBuffer()

      const { error: upErr } = await sb.storage
        .from(bucket)
        .upload(key, jpeg, { contentType: 'image/jpeg', upsert: true })
      if (upErr) {
        return NextResponse.json({ error: `bake_upload_failed: ${upErr.message}` }, { status: 500 })
      }

      console.log(`[portraits/generate] baked → ${fullPath} (${jpeg.length}b)`)
      return NextResponse.json({
        status:       'baked',
        storage_path: fullPath,
        qa_log_id:    (qa as any)?.id ?? null,
      })
    }

    /* A PAID GENERATION IS NOT FULFILLED UNTIL ITS RESULT IS PERSISTED.
       Ruled 2026-09-10: claim -> render -> persist canonical -> consume ->
       return. A grant-backed render that produced nothing is not delivered
       and the grant goes back (the finally in POST). One that produced an
       image is stored first, at a path derived from the grant alone and with
       upsert off, so a second attempt can never replace it; only then is the
       grant consumed. If storing fails, nothing is returned for this grant
       and it is released into the retry/refund path -- an image the
       customer cannot get back is not a delivered one.

       The image returned is always the canonical one. If another attempt on
       this grant stored first, that stored image is what goes back, never
       this render's own. */
    if (grant) {
      if (!result.ok || !result.image_b64) {
        return NextResponse.json({ result })
      }
      if (!grantDb) {
        return NextResponse.json({ error: 'result_persist_unavailable', retryable: true }, { status: 503 })
      }
      const persisted = await persistAndConsume(grantDb, grant, result.image_b64)
      if (!persisted.ok) {
        console.error(`[portraits/generate] canonical result not persisted for grant ${grant.id}: ${persisted.reason}`)
        return NextResponse.json({ error: 'result_persist_failed', retryable: true }, { status: 503 })
      }
      result.image_b64 = persisted.imageB64
      outcome.delivered = true
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

// Preview-bake gate: requires the x-liten-internal token explicitly. Unlike
// qaOverrideAllowed this does NOT honor QA_OVERRIDE_ENABLED — a customer (or a
// header-less dev call) must never be able to write into the preview library.
function bakeAuthorized(req: NextRequest): boolean {
  const tok = process.env.LITEN_INTERNAL_TOKEN
  return !!tok && req.headers.get('x-liten-internal') === tok
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
