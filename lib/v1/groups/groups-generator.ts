// lib/v1/groups/groups-generator.ts
//
// Orchestrator for the Groups silo. REWRITTEN 2026-08-11.
//
//   Pre-flight   face visibility on the source, before anything is spent
//   Stage 1      NB2 generate at MAIN_ASPECT
//   Stage 2      per-figure likeness score
//                -> retry from Stage 1, up to four attempts
//   Stage 3      Stability outpaint, margin mode, every render
//
// ── WHAT THIS REPLACES ─────────────────────────────────────────────────
//
// The previous file was written for the style axis and did not compile
// after the flat-catalog rewrite: it imported resolveLocation,
// STYLE_PIPELINE, defaultAspectForStyle, GroupsStyleId, GroupArrangement,
// evaluateCaricatureScore and groups-experimental.ts, none of which exist.
//
// Gone with it, on Rich's ruling 2026-08-11:
//
//   FACE SWAP    groups-faceswap.ts is no longer called.
//   PASS 2       groups-pass2.ts is no longer called. It re-sent a render
//                to fix likeness on figures that scored badly rather than
//                re-rolling the whole image. A fourth attempt is the
//                cheaper answer now that there are four.
//   GPT-IMAGE-1  no interpretive path in this silo.
//
// Neither file is deleted. They are simply not imported, so Turbopack
// leaves them alone, and they come back from git rather than from memory
// if the ruling changes.
//
// ── FOUR ATTEMPTS, AND WHAT HAPPENS AFTER THE FOURTH ───────────────────
//
// Rich, 2026-08-11. Two attempts on a five-person composite where every
// figure must reach 9/10 is a gate that mostly fails.
//
// After the fourth, the BEST attempt is returned with `passed: false` and
// a structured `failure`. It is not thrown away and it is not silently
// shipped as if it passed — the route offers it alongside a refund, and
// the Concierge explains what went wrong from the failure shape rather
// than from a guess.
//
// This is the opposite posture to Wallpapers, deliberately. A wallpaper is
// $2.99 and a bad one is cheap to be wrong about. A group piece is up to
// forty credits and goes to print.
//
// ── SCORING IS THE EXPENSE, NOT THE RENDER ─────────────────────────────
//
// One vision call per attempt, on top of one NB2 call. At four attempts a
// twelve-person craft can cost four of each, which is what the price bands
// in groups-shared.ts are for.
//
// So the loop STOPS AT THE FIRST PASS. It does not render four and pick.

import {
  buildGroupsPrompt,
  GROUPS_EFFECTS,
  type GroupsEffectId,
} from './groups-effects'
import {
  scorePerFigureFidelity,
  detectFaceVisibility,
} from './groups-refine'
import {
  evaluateGroupScores,
  MAX_ATTEMPTS_GROUPS,
  MAX_SOURCE_IMAGES,
  groupsCreditCost,
  type GroupsGenerateRequest,
  type GroupsGenerateResult,
  type GroupsAttempt,
  type GroupsFailure,
  type PerFigureScore,
} from './groups-shared'
import { outpaintMargin } from '../shared/outpaint'
import { MAIN_ASPECT } from '../shared/render-aspect'

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

export interface GenerateGroupsInput {
  request:           GroupsGenerateRequest
  replicateApiToken: string
  /** Scoring and pre-flight face detection. Without it the gate cannot
   *  run — see the note at the call site. */
  openaiApiKey?:     string
  /** Outpaint. Without it every piece crops at the frame edge. */
  stabilityApiKey?:  string
}

export async function generateGroupsRender(
  input: GenerateGroupsInput,
): Promise<GroupsGenerateResult> {

  const t0  = Date.now()
  const req = input.request

  const effect = GROUPS_EFFECTS[req.effect_id]
  if (!effect) {
    return fatal({
      msg: `unknown groups effect: ${req.effect_id}`,
      req, prompt: '', t0,
      code: 'unknown_effect', retryable: false,
    })
  }

  const sources = req.source_images_b64.slice(0, MAX_SOURCE_IMAGES)
  if (!sources.length) {
    return fatal({
      msg: 'no source images', req, prompt: '', t0,
      code: 'no_sources', retryable: false,
    })
  }

  // The slice above is where the old four-image ceiling silently truncated
  // multi-photo composites — Family Impressionism composes five, so the
  // fifth reference vanished and the render came back with four faces and
  // no error. MAX_SOURCE_IMAGES is 14 now, NB2's own ceiling. Log the loss
  // if it ever bites again rather than letting it be quiet.
  if (req.source_images_b64.length > sources.length) {
    console.warn(
      `[groups] TRUNCATED sources: ${req.source_images_b64.length} sent, ` +
      `${sources.length} used (ceiling ${MAX_SOURCE_IMAGES})`,
    )
  }

  // The count the prompt and the scorer will actually use. Replaced by the
  // pre-flight estimate below for group_photo; for multi_photo the
  // photographs ARE the count and nothing can be more right than that.
  let detectedCount = effect.intake === 'multi_photo'
    ? sources.length
    : req.subject_count

  // Provisional, for the error paths BELOW the pre-flight only. The real
  // prompt cannot be built until the count is known, because the framing
  // clause is chosen from it. Never sent to NB2.
  const provisionalPrompt = buildGroupsPrompt({
    effectId:     req.effect_id,
    subjectCount: detectedCount,
  })

  // ── Pre-flight ──
  //
  // BEFORE any render, because a source photograph where a face is turned
  // away or occluded will fail the gate four times and cost four renders
  // to discover. The cheapest failure is the one found first.
  //
  // Only for group_photo. A multi_photo composite has one face per
  // photograph and the count is the number of files.
  //
  // ── THIS CALL ALSO SETS THE PRICE ────────────────────────────────────
  //
  // detectFaceVisibility returns subject_count_estimate alongside the
  // visibility verdict. It enumerates hero subjects, excludes bystanders,
  // crowds and photobombers, and trusts the length of its own array over
  // its self-reported number.
  //
  // THAT ESTIMATE IS AUTHORITATIVE AND THE CALLER'S IS NOT. The count
  // drives the framing clause, the scoring bar and the credit band, so a
  // client that could set it could pick its own price. Same posture the
  // credit gate takes on cost_per: the value is read, logged when it
  // disagrees, and never trusted.
  //
  // No separate analyze route exists for this silo and none is needed —
  // the call is already being made and already paid for.
  if (effect.intake === 'group_photo' && !req.skip_scoring) {
    if (!input.openaiApiKey) {
      // Refused, not proceeded. Without this call there is no count, and
      // without a count the craft would be framed, scored and PRICED on a
      // guess. Rendering anyway means charging the wrong number.
      console.error('[groups] OPENAI_API_KEY missing — cannot count subjects, refusing')
      return fatal({
        msg: 'subject detection unavailable',
        req, prompt: provisionalPrompt, t0,
        code: 'detection_unavailable', retryable: true,
      })
    }

    try {
      const vis = await detectFaceVisibility({
        sourceImageB64: sources[0],
        openaiApiKey:   input.openaiApiKey,
      })

      if (!vis.face_visible) {
        console.log(`[groups] pre-flight refused: ${vis.reason}`)
        return {
          ...emptyResult(req, provisionalPrompt, t0),
          ok:      true,
          passed:  false,
          failure: {
            kind:           'face_not_visible',
            failed_figures: [],
            reasons:        [vis.reason],
            attempts:       0,
          },
        }
      }

      if (vis.subject_count_estimate !== detectedCount) {
        console.warn(
          `[groups] subject_count ${detectedCount} sent, ` +
          `${vis.subject_count_estimate} detected — using detected`,
        )
      }
      detectedCount = vis.subject_count_estimate

    } catch (e: any) {
      // A vision call that ERRORED is different from one that was never
      // configured. The count falls back to what the caller sent, which is
      // the generous reading, and it is logged loudly enough to reconcile.
      console.error(
        `[groups] pre-flight errored, falling back to caller's count ` +
        `${detectedCount}: ${e?.message}`,
      )
    }
  }

  // Built after detection, because the framing clause is chosen from the
  // count and the count is not known until the pre-flight has run.
  const finalPrompt = buildGroupsPrompt({
    effectId:     req.effect_id,
    subjectCount: detectedCount,
  })

  console.log(
    `[groups] effect=${req.effect_id} intake=${effect.intake} ` +
    `subjects=${detectedCount} sources=${sources.length} ` +
    `credits=${groupsCreditCost(detectedCount)} chars=${finalPrompt.length}`,
  )

  // ── The attempt loop ──
  const attempts: GroupsAttempt[] = []
  let best:      { b64: string; scores: PerFigureScore[]; failed: number } | null = null
  let passedB64: string | null = null

  const maxAttempts = req.skip_scoring ? 1 : MAX_ATTEMPTS_GROUPS

  for (let n = 1; n <= maxAttempts; n++) {
    const aT0 = Date.now()

    let imageB64: string
    try {
      imageB64 = await callNB2({
        prompt: finalPrompt,
        sourceImagesB64:   sources,
        aspectRatio:       MAIN_ASPECT,
        replicateApiToken: input.replicateApiToken,
      })
    } catch (e: any) {
      const msg = e?.message || 'NB2 generate failed'
      console.error(`[groups] attempt ${n} NB2 failed: ${msg}`)
      attempts.push({
        attempt:     n,
        prompt_used: finalPrompt,
        duration_ms: Date.now() - aT0,
        passed:      false,
        pass_reason: `nb2_failed: ${msg}`,
      })
      continue
    }

    // Unscored path: internal shoots only.
    if (req.skip_scoring || !input.openaiApiKey) {
      if (!input.openaiApiKey && !req.skip_scoring) {
        // NOT silent. An unscored customer render is the exact thing the
        // gate exists to prevent, and it should be visible in the log
        // rather than inferred from an absent score.
        console.error('[groups] OPENAI_API_KEY missing — GATE DID NOT RUN')
      }
      attempts.push({
        attempt:     n,
        prompt_used: finalPrompt,
        duration_ms: Date.now() - aT0,
        passed:      true,
        pass_reason: 'scoring skipped',
      })
      passedB64 = imageB64
      break
    }

    let scores: PerFigureScore[] = []
    try {
      scores = await scorePerFigureFidelity({
        sourceImageB64:       sources[0],
        renderedImageB64:     imageB64,
        openaiApiKey:         input.openaiApiKey,
        expectedSubjectCount: detectedCount,
      })
    } catch (e: any) {
      console.warn(`[groups] attempt ${n} scoring errored: ${e?.message}`)
    }

    const verdict = evaluateGroupScores(scores)

    attempts.push({
      attempt:           n,
      prompt_used:       finalPrompt,
      duration_ms:       Date.now() - aT0,
      per_figure_scores: scores,
      passed:            verdict.passed,
      pass_reason:       verdict.reason,
    })

    console.log(
      `[groups] attempt ${n}/${maxAttempts} — ${verdict.reason} ` +
      `(${scores.map(s => s.score).join(',')})`,
    )

    if (verdict.passed) {
      passedB64 = imageB64
      break
    }

    // Keep the best so far by how many figures cleared the bar, so a
    // fourth-attempt failure still returns the strongest of the four
    // rather than the last of them.
    const failed = failedFigures(scores, verdict.rule.topTierCount).length
    if (!best || failed < best.failed) {
      best = { b64: imageB64, scores, failed }
    }
  }

  const finalB64 = passedB64 ?? best?.b64 ?? null

  if (!finalB64) {
    return {
      ...emptyResult(req, finalPrompt, t0),
      ok:       false,
      attempts,
      failure:  {
        kind:           'render_failed',
        failed_figures: [],
        reasons:        attempts.map(a => a.pass_reason).slice(0, 4),
        attempts:       attempts.length,
      },
      fatal_error: 'every attempt failed to render',
      error_code:  'nb2_failed',
      retryable:   true,
    }
  }

  // ── Outpaint, every render ──
  //
  // Not conditional, unlike Wallpapers. NB2 does not leave margins and
  // every Groups render to date crops at the frame edge, so the piece
  // needs room around it before it reaches a print.
  let outpainted   = false
  let outpaintSkip: string | null = null
  let outB64 = finalB64

  if (input.stabilityApiKey) {
    try {
      const buf  = Buffer.from(finalB64, 'base64')
      const dims = readJpegDimensions(buf)
      if (!dims) {
        outpaintSkip = 'dimensions_unreadable'
      } else {
        const r = await outpaintMargin({
          image:           buf,
          width:           dims.width,
          height:          dims.height,
          stabilityApiKey: input.stabilityApiKey,
        })
        if (r.outpainted) {
          outB64     = r.image.toString('base64')
          outpainted = true
        } else {
          outpaintSkip = r.reason || 'unknown'
        }
      }
    } catch (e: any) {
      console.warn(`[groups] outpaint hard fail (non-fatal): ${e?.message}`)
      outpaintSkip = `error: ${e?.message}`
    }
  } else {
    outpaintSkip = 'STABILITY_API_KEY not set'
  }

  const passed = passedB64 !== null

  console.log(
    `[groups] done in ${Date.now() - t0}ms — passed=${passed} ` +
    `attempts=${attempts.length} outpainted=${outpainted} ` +
    `skip=${outpaintSkip ?? '-'}`,
  )

  return {
    ok:            true,
    image_b64:     outB64,
    prompt_used:   finalPrompt,
    effect:        req.effect_id,
    subject_count: detectedCount,
    attempts,
    passed,
    failure:       passed ? null : describeFailure(best, attempts.length),
    outpainted,
    outpaint_skip: outpaintSkip,
    fatal_error:   null,
    duration_ms:   Date.now() - t0,
  }
}

// ─── FAILURE DESCRIPTION ────────────────────────────────────────

/**
 * What went wrong, in a shape the Concierge can speak from.
 *
 * The split at half the figures is the one that changes the advice. A
 * minority failing usually means those people were badly captured in the
 * source — turned away, in shadow, too small in frame — and a better
 * photograph fixes it. Most of them failing means the render is wrong
 * rather than the photograph, and a different effect is the better
 * suggestion.
 *
 * The scorer's own reasons are passed through because they describe the
 * picture rather than the person. Nothing here should ever reach a
 * customer as a score.
 */
function describeFailure(
  best: { scores: PerFigureScore[]; failed: number } | null,
  attemptCount: number,
): GroupsFailure {
  if (!best || best.scores.length === 0) {
    return {
      kind:           'no_figures',
      failed_figures: [],
      reasons:        ['the scorer found no figures in the render'],
      attempts:       attemptCount,
    }
  }

  const verdict = evaluateGroupScores(best.scores)
  const failed  = failedFigures(best.scores, verdict.rule.topTierCount)

  const reasons = Array.from(
    new Set(failed.map(f => f.reason).filter(Boolean)),
  ).slice(0, 4)

  return {
    kind:           failed.length > best.scores.length / 2 ? 'most_figures' : 'some_figures',
    failed_figures: failed.map(f => f.figure_index),
    reasons,
    attempts:       attemptCount,
  }
}

/** Which figures missed the bar that applies to them. Mirrors
 *  evaluateGroupScores: the strongest N are held to the top tier and the
 *  rest to the relaxed one. */
function failedFigures(
  scores: PerFigureScore[],
  topTierCount: number,
): PerFigureScore[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  return sorted.filter((s, i) => s.score < (i < topTierCount ? 9 : 8))
}

// ─── HELPERS ────────────────────────────────────────────────────

function emptyResult(
  req: GroupsGenerateRequest,
  prompt: string,
  t0: number,
): GroupsGenerateResult {
  return {
    ok:            true,
    image_b64:     null,
    prompt_used:   finalPrompt,
    effect:        req.effect_id,
    subject_count: detectedCount,
    attempts:      [],
    passed:        false,
    failure:       null,
    outpainted:    false,
    outpaint_skip: null,
    fatal_error:   null,
    duration_ms:   Date.now() - t0,
  }
}

function fatal(args: {
  msg:       string
  req:       GroupsGenerateRequest
  prompt:    string
  t0:        number
  code:      string
  retryable: boolean
}): GroupsGenerateResult {
  return {
    ...emptyResult(args.req, args.prompt, args.t0),
    ok:          false,
    fatal_error: args.msg,
    error_code:  args.code,
    retryable:   args.retryable,
  }
}

/** Width and height from a JPEG's SOF marker. Keeps sharp out of the
 *  route's dependency chain — outpaint takes dimensions as arguments
 *  rather than reading the buffer itself. */
function readJpegDimensions(
  buf: Buffer,
): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null

  let i = 2
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue }

    const marker = buf[i + 1]
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }

    const len = buf.readUInt16BE(i + 2)
    const isSOF =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

    if (isSOF) {
      return {
        height: buf.readUInt16BE(i + 5),
        width:  buf.readUInt16BE(i + 7),
      }
    }

    i += 2 + len
  }

  return null
}

// ─── NB2 CALL ───────────────────────────────────────────────────

async function callNB2(input: {
  prompt:            string
  sourceImagesB64:   string[]
  aspectRatio:       string
  replicateApiToken: string
}): Promise<string> {

  // ── THE ASPECT IS SENT, AS OF 2026-08-20 ─────────────────────────────
  //
  // It was not sent at all before. NB2 took its default, which follows the
  // source photograph — so a Groups piece came out whatever shape the
  // customer's snapshot happened to be, and nothing in the engine had an
  // opinion about it.
  //
  // From lib/v1/shared/render-aspect.ts, so the day it becomes a customer
  // choice this line does not change: MAIN_ASPECT stops being a constant
  // and starts being a default.
  const body: any = {
    input: {
      prompt:        input.prompt,
      image_input:   input.sourceImagesB64.map(b => `data:image/jpeg;base64,${b}`),
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
