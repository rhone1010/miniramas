// group-generate-route.ts
// app/api/v1/groups/generate/route.ts
//
// Pipeline (Path A — per-face hero refinement):
//   1. Analyze (GPT-4o)         — sculptor's reference notes per person
//   2. Generate (gpt-image-1)   — group composition, hero scale, all the
//                                  identity prompt blocks (faces are passable)
//   3. Levels                    — light brightness boost
//   4. Face refine               — detect faces in source + group, regenerate
//                                  each face at full hero pixel budget, blend
//                                  back into group image with feathered alpha +
//                                  LAB color match
//   5. Score (GPT-4o)            — quality gate
//   6. Retry composition (up to 3x) if score gate fails
//
// Two API keys required:
//   - OPENAI_API_KEY    — analyze, generate, refine-faces, score
//   - REPLICATE_API_TOKEN — face detection (grounding-dino)

import { NextRequest, NextResponse }      from 'next/server'
import { analyzeGroup, GroupAnalysis }    from '@/lib/v1/group-analyzer'
import { generateGroup, RetryHint }       from '@/lib/v1/group-generator'
import { scoreGroup, GroupScore }         from '@/lib/v1/group-scorer'
import { applyLevels }                    from '@/lib/v1/levels'
import { refineFacesInGroup, FaceRefineResult } from '@/lib/v1/face-refine'

const LIKENESS_THRESHOLD = 88
const MAX_RETRIES        = 3

interface Attempt {
  attempt:        number
  imageB64:       string
  score:          GroupScore | null
  promptUsed:     string
  passed:         boolean
  faceRefineLog?: Omit<FaceRefineResult, 'imageB64'>
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sourceImageB64: string                       = body.source_image_b64
    const notes:          string | undefined           = body.notes
    const skipScoring:    boolean                      = body.skip_scoring === true
    const skipFaceRefine: boolean                      = body.skip_face_refine === true
    const providedAnalysis: GroupAnalysis | undefined  = body.analysis

    if (!sourceImageB64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const openaiApiKey    = process.env.OPENAI_API_KEY
    const replicateApiKey = process.env.REPLICATE_API_TOKEN

    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }
    if (!replicateApiKey && !skipFaceRefine) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN not set (required for face refinement; pass skip_face_refine=true to disable)' },
        { status: 500 }
      )
    }

    // ── STAGE 1: ANALYZE ─────────────────────────────────────
    let analysis: GroupAnalysis | null = providedAnalysis ?? null
    let analyzeWarning: string | null = null

    if (!analysis) {
      try {
        analysis = await analyzeGroup({ sourceImageB64, openaiApiKey })
        console.log(`[groups-route] Analysis: ${analysis.num_people} people / ${analysis.arrangement}`)
      } catch (e: any) {
        analyzeWarning = e.message || String(e)
        console.warn('[groups-route] Analyze failed, proceeding without it:', analyzeWarning)
        analysis = null
      }
    }

    // ── STAGE 2-5: GENERATE → LEVELS → FACE-REFINE → SCORE (WITH RETRY) ──
    const attempts: Attempt[] = []

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[groups-route] Attempt ${attempt}/${MAX_RETRIES}`)

      const retryHint: RetryHint | undefined = attempt > 1
        ? { attempt, reinforceLikeness: true, reduceStylization: true }
        : undefined

      // STAGE 2: GENERATE GROUP COMPOSITION
      let imageB64: string
      let promptUsed: string
      try {
        const generated = await generateGroup({
          sourceImageB64,
          analysis,
          notes,
          retryHint,
          openaiApiKey,
        })
        imageB64   = generated.imageB64
        promptUsed = generated.promptUsed
      } catch (e: any) {
        console.error(`[groups-route] Generate failed on attempt ${attempt}:`, e.message)
        attempts.push({
          attempt,
          imageB64:   '',
          score:      null,
          promptUsed: '',
          passed:     false,
        })
        continue
      }

      // STAGE 3: LEVELS
      try {
        const lev = await applyLevels({ imageB64, brightness: 1.08 })
        if (lev.success && lev.imageB64) imageB64 = lev.imageB64
      } catch (e: any) {
        console.warn('[groups-route] levels failed (non-fatal):', e.message)
      }

      // STAGE 4: FACE REFINE
      let faceRefineLog: Attempt['faceRefineLog'] = undefined
      if (!skipFaceRefine && replicateApiKey) {
        try {
          const refined = await refineFacesInGroup({
            sourceImageB64,
            groupImageB64: imageB64,
            analysis,
            openaiApiKey,
            replicateApiKey,
          })
          imageB64 = refined.imageB64
          faceRefineLog = {
            facesRefined: refined.facesRefined,
            facesSkipped: refined.facesSkipped,
            warning:      refined.warning,
            perFaceLog:   refined.perFaceLog,
          }
          console.log(
            `[groups-route] face-refine: ${refined.facesRefined} refined, ` +
            `${refined.facesSkipped} skipped` +
            (refined.warning ? ` (${refined.warning})` : '')
          )
        } catch (e: any) {
          console.warn('[groups-route] face-refine failed (non-fatal):', e.message)
          faceRefineLog = {
            facesRefined: 0,
            facesSkipped: 0,
            warning:      `face_refine_threw: ${e.message}`,
            perFaceLog:   [],
          }
        }
      }

      // STAGE 5: SCORE
      let score: GroupScore | null = null
      if (!skipScoring) {
        try {
          score = await scoreGroup({
            sourceImageB64,
            generatedImageB64: imageB64,
            openaiApiKey,
          })
        } catch (e: any) {
          console.warn('[groups-route] scoring failed (non-fatal):', e.message)
        }
      }

      const passed = score
        ? score.likeness_0_100 >= LIKENESS_THRESHOLD && !score.identity_drift
        : true

      attempts.push({
        attempt, imageB64, score, promptUsed, passed,
        faceRefineLog,
      })

      if (passed) {
        console.log(`[groups-route] PASSED on attempt ${attempt} (likeness ${score?.likeness_0_100 ?? 'n/a'})`)
        break
      }

      console.log(
        `[groups-route] Attempt ${attempt} failed gate ` +
        `(likeness=${score?.likeness_0_100 ?? '?'}, drift=${score?.identity_drift ?? '?'}) — retrying`
      )
    }

    // ── STAGE 6: SELECT BEST ATTEMPT ──────────────────────────
    const validAttempts = attempts.filter(a => a.imageB64)
    if (validAttempts.length === 0) {
      return NextResponse.json(
        { error: 'all_generation_attempts_failed', attempts, analyze_warning: analyzeWarning },
        { status: 500 }
      )
    }

    const passingAttempt = validAttempts.find(a => a.passed)
    const best = passingAttempt ?? validAttempts.reduce((winner, current) => {
      const wTotal = winner.score?.total ?? 0
      const cTotal = current.score?.total ?? 0
      return cTotal > wTotal ? current : winner
    })

    return NextResponse.json({
      result: {
        image_b64:        best.imageB64,
        prompt_used:      best.promptUsed,
        score:            best.score,
        analysis,
        analyze_warning:  analyzeWarning,
        passed:           best.passed,
        attempts:         attempts.length,
        face_refine_log:  best.faceRefineLog,
        attempt_log:      attempts.map(a => ({
          attempt:         a.attempt,
          passed:          a.passed,
          likeness_0_100:  a.score?.likeness_0_100 ?? null,
          total:           a.score?.total ?? null,
          identity_drift:  a.score?.identity_drift ?? null,
          notes:           a.score?.notes ?? null,
          faces_refined:   a.faceRefineLog?.facesRefined ?? null,
          faces_skipped:   a.faceRefineLog?.facesSkipped ?? null,
          face_warning:    a.faceRefineLog?.warning ?? null,
        })),
      },
    })

  } catch (err: any) {
    console.error('[groups-route] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
