// app/api/loop/route.ts
//
// TWO-PHASE REINFORCEMENT LOOP
//
// PHASE 1 — Foundation (always runs against source photo, max 3 passes)
//   Pass 1: Style learning — style reference as input image
//   Pass 2: Full synthesis — source photo + style learnings + photo analysis
//   Pass 3: First convergence — source photo + all patches
//   Stops early at SCORE_THRESHOLD
//
// PHASE 2 — Refinement (seeded from a user-selected render, max 3 passes)
//   Passes 1-3: User selects best render from Phase 1, seeds next loop from it
//   Each pass: seed image + all prior patches + new user prompt additions
//   Continues until SCORE_THRESHOLD or 3 passes exhausted
//
// NEW FIELDS accepted from frontend:
//   phase        — "1" or "2" (defaults to "1")
//   userPrompt   — Claude-converted natural language instructions (appended to every prompt)
//   sceneBlock   — Lighting/environment/zoom/size block built by buildScenePromptBlock()
//   seedImageUrl — URL of the selected render to seed Phase 2 from
//   config.maxIterations — capped server-side at MAX_ITERATIONS_PER_PHASE (3)

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildEnginePrompt, EngineId, EngineConfig } from '@/lib/engines'
import openai from '@/lib/openai'

const MAX_ITERATIONS_PER_PHASE = 3   // hard cap — never exceed regardless of config
const SCORE_THRESHOLD          = 90
const API_BASE                 = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

// ── Engine-specific photo analysis prompts ────────────────────────────────────
const ANALYSIS_PROMPTS: Record<string, string> = {
  architecture: `Analyze this building photo in precise architectural detail for scale model generation. Describe:
- Building style and era
- Exact number of floors
- Roof shape, pitch, material and color
- Siding material and exact color
- Trim color and style
- Window count, positions, sizes on each floor
- Door position, style, color
- Porch details: columns, railings, steps
- Any bay windows, dormers, chimneys, unique features
- Foundation type
- Current landscaping state
Be extremely precise — someone must build an exact replica from this description. Under 300 words.`,

  people: `Analyze this photo for miniature figurine generation. Describe:
- Number of people and positions
- Each person's facial features: face shape, jaw, cheekbones, eye shape/color, nose, mouth, smile asymmetry
- Hair: color, length, style
- Apparent age
- Skin tone
- Clothing: colors, style, details
- Expression and emotion
- Lighting direction
- Background environment
Be extremely specific about facial geometry. Under 250 words.`,

  sports: `Analyze this photo for sports diorama generation. Describe:
- Number of people, positions and poses
- Facial features of each person
- Team apparel: colors, jersey style, numbers
- Sport and venue context
- Crowd or background elements
- Lighting and atmosphere
Under 250 words.`,

  landscape: `Analyze this landscape for terrain diorama generation. Describe:
- Primary terrain type
- Water bodies: type, surface, color, reflections
- Vegetation: types, density, colors
- Man-made structures
- Time of day and lighting
- Atmospheric conditions
- Color palette
- Any people present (to be excluded)
Under 250 words.`,

  dollhouse: `Analyze this interior for dollhouse cutaway generation. Describe:
- Room type and style
- Furniture: pieces, positions, colors, materials
- Flooring and wall treatment
- Ceiling and light fixtures
- Windows and natural light
- Decorative items and props
- Color palette and mood
Under 250 words.`,
}

// ── GPT-4o photo analysis ─────────────────────────────────────────────────────
async function analyzePhoto(imageUrl: string, engineId: string): Promise<string> {
  const prompt = ANALYSIS_PROMPTS[engineId] || ANALYSIS_PROMPTS.people
  const res = await openai.chat.completions.create({
    model:      'gpt-4o',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        { type: 'text',      text: prompt },
      ],
    }],
  })
  return res.choices[0]?.message?.content || ''
}

// ── Store file to Supabase ────────────────────────────────────────────────────
async function storeFile(file: File, name: string, bucket = 'uploads'): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const bytes  = new Uint8Array(buffer)
  const { error } = await supabaseAdmin.storage.from(bucket).upload(name, bytes, { contentType: file.type })
  if (error) throw new Error(`Storage failed: ${error.message}`)
  const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(name)
  return publicUrl
}

// ── Fetch a URL as a File object (for seeding Phase 2 from stored render) ────
async function urlToFile(url: string, filename: string): Promise<File> {
  const res    = await fetch(url)
  const buffer = await res.arrayBuffer()
  const ct     = res.headers.get('content-type') || 'image/png'
  return new File([buffer], filename, { type: ct })
}

// ── Call generate API ─────────────────────────────────────────────────────────
async function callGenerate(
  file: File,
  prompt: string,
  sessionId: string,
  loopId: string,
  iteration: number,
): Promise<any> {
  const form = new FormData()
  form.append('file',            file)
  form.append('prompt',          prompt)
  form.append('sessionId',       sessionId)
  form.append('loopId',          loopId)
  form.append('iterationNumber', String(iteration))

  const res  = await fetch(`${API_BASE}/api/generate`, { method: 'POST', body: form })
  const data = await res.json()
  if (!data.imageUrl) throw new Error(data.error || 'No image URL returned')
  return data
}

// ── Call vision-score API ─────────────────────────────────────────────────────
async function callScore(
  goldUrl:    string,
  outputUrl:  string,
  styleRefUrl: string,
  prompt:     string,
  iteration:  number,
  engineId:   string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/vision-score`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      goldStandardUrl: goldUrl,
      outputUrl,
      styleRefUrl,
      currentPrompt:   prompt,
      iterationNumber: iteration,
      engineId,
    }),
  })
  return res.json()
}

// ── Update render record ──────────────────────────────────────────────────────
async function updateRender(
  renderId:      string,
  scores:        any,
  total:         number,
  passNum:       number,
  engineId:      string,
  loopId:        string,
  claudeAnalysis: any,
  gptAnalysis:   any,
) {
  await supabaseAdmin.from('renders').update({
    score_total:     total,
    score_breakdown: scores,
    issue_label:     `${engineId} · pass ${passNum}`,
    config:          { loopId, pass: passNum, engineId, claudeAnalysis, gptAnalysis },
  }).eq('id', renderId)
}

// ── Build the full prompt for a pass ─────────────────────────────────────────
// Assembles: master engine prompt + scene block + user prompt + analysis + patches
function buildPassPrompt(
  masterPrompt:   string,
  sourceAnalysis: string,
  stylePatches:   string[],
  structPatches:  string[],
  sceneBlock:     string,
  userPrompt:     string,
  passType:       'style_learning' | 'full_synthesis' | 'convergence',
): string {
  const parts: string[] = [masterPrompt]

  // Scene context (lighting, environment, zoom, model size)
  if (sceneBlock) {
    parts.push(`\nSCENE PARAMETERS (apply to all outputs):\n${sceneBlock}`)
  }

  // User-directed refinements (converted from plain English by Claude)
  if (userPrompt) {
    parts.push(`\nUSER REFINEMENTS (highest priority — apply these explicitly):\n${userPrompt}`)
  }

  if (passType === 'full_synthesis' || passType === 'convergence') {
    if (sourceAnalysis) {
      parts.push(`\nSOURCE PHOTO ANALYSIS:\n${sourceAnalysis}`)
    }
  }

  if (passType === 'full_synthesis' && stylePatches.length > 0) {
    parts.push(`\nSTYLE LEARNINGS FROM PASS 1 (apply to the real subject):\n${stylePatches.map(p => '- ' + p).join('\n')}`)
  }

  if (passType === 'convergence') {
    const allPatches = [...stylePatches, ...structPatches]
    if (allPatches.length > 0) {
      parts.push(`\nACCUMULATED CORRECTIONS (most recent first — apply all):\n${allPatches.slice(-5).reverse().map(p => '- ' + p).join('\n')}`)
    }
  }

  return parts.filter(Boolean).join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(sse(data)))

      try {
        const formData     = await request.formData()
        const sourceFile   = formData.get('file')         as File | null
        const styleRefFile = formData.get('styleRef')     as File | null
        const engineId     = (formData.get('engineId')    as EngineId) || 'people'
        const sessionId    = formData.get('sessionId')    as string || `session-${Date.now()}`
        const configRaw    = formData.get('config')       as string || '{}'
        const userConfig   = JSON.parse(configRaw) as Partial<EngineConfig & { maxIterations?: number, scene?: any }>

        // ── New Phase 1/2 fields ──────────────────────────────────────────────
        const phase        = parseInt(formData.get('phase') as string || '1', 10)   // 1 or 2
        const userPrompt   = (formData.get('userPrompt')  as string || '').trim()   // converted from plain English
        const sceneBlock   = (formData.get('sceneBlock')  as string || '').trim()   // lighting/env/zoom/size block
        const seedImageUrl = (formData.get('seedImageUrl') as string || '').trim()  // Phase 2 seed render URL

        // Hard cap — never exceed 3 iterations regardless of config
        const MAX_ITERATIONS = MAX_ITERATIONS_PER_PHASE

        // Validations
        if (!sourceFile) {
          send({ type: 'fatal_error', error: 'Source photo is required' })
          controller.close(); return
        }
        if (!styleRefFile) {
          send({ type: 'fatal_error', error: 'Style reference image is required' })
          controller.close(); return
        }
        if (phase === 2 && !seedImageUrl) {
          send({ type: 'fatal_error', error: 'Phase 2 requires a seed image URL — select a render on the wall first' })
          controller.close(); return
        }

        const loopId = `loop-${Date.now()}-ph${phase}-${engineId}`
        send({ type: 'loop_start', loopId, engineId, phase, maxIterations: MAX_ITERATIONS, scoreThreshold: SCORE_THRESHOLD })

        // ── Store source + style ref ──────────────────────────────────────────
        send({ type: 'storing_images' })
        const [sourceUrl, styleRefUrl] = await Promise.all([
          storeFile(sourceFile,   `source-${loopId}.${sourceFile.name.split('.').pop()    || 'jpg'}`),
          storeFile(styleRefFile, `styleref-${loopId}.${styleRefFile.name.split('.').pop() || 'jpg'}`),
        ])
        send({ type: 'images_stored', sourceUrl, styleRefUrl })

        // ── GPT-4o pre-analysis of source photo ───────────────────────────────
        send({ type: 'pre_analysis_start', engineId })
        let sourceAnalysis = ''
        try {
          sourceAnalysis = await analyzePhoto(sourceUrl, engineId)
          send({ type: 'pre_analysis_complete', analysis: sourceAnalysis, wordCount: sourceAnalysis.split(/\s+/).filter(Boolean).length })
        } catch (err: any) {
          send({ type: 'pre_analysis_failed', error: err.message })
        }

        // ── Build engine config ───────────────────────────────────────────────
        const engineConfig: EngineConfig = {
          sceneDescription: sourceAnalysis,
          cameraAngle:      userConfig.cameraAngle  || 40,
          marginRatio:      userConfig.marginRatio   || 0.15,
          lightingStyle:    userConfig.lightingStyle || 'warm studio',
          baseStyle:        userConfig.baseStyle     || 'circular_wood_plinth',
          overrides:        userConfig.overrides     || {},
        }

        const { prompt: masterPrompt } = buildEnginePrompt(engineId, engineConfig)

        const stylePatches:  string[] = []
        const structPatches: string[] = []

        let bestScore     = 0
        let bestIteration = 0
        let stopped       = false

        // ════════════════════════════════════════════════════════════════════
        // PHASE 1 — Foundation (3 passes: style learning, synthesis, convergence)
        // ════════════════════════════════════════════════════════════════════
        if (phase === 1) {

          // ── PASS 1: Style Learning ────────────────────────────────────────
          send({ type: 'pass_start', pass: 1, iteration: 1, maxIterations: MAX_ITERATIONS, phase: 1,
            description: 'Style learning — using style reference as input to understand target aesthetic' })

          const p1Prompt = buildPassPrompt(masterPrompt, '', [], [], sceneBlock, userPrompt, 'style_learning')

          let pass1Gen: any
          try {
            pass1Gen = await callGenerate(styleRefFile, p1Prompt, sessionId, loopId, 1)
            send({ type: 'generation_complete', iteration: 1, pass: 1, imageUrl: pass1Gen.imageUrl, modelUsed: pass1Gen.modelUsed, renderId: pass1Gen.renderId })
          } catch (err: any) {
            send({ type: 'generation_error', iteration: 1, error: err.message, pass: 1 })
            send({ type: 'fatal_error', error: 'Pass 1 failed: ' + err.message })
            controller.close(); return
          }

          send({ type: 'scoring', iteration: 1, pass: 1 })
          try {
            const score1 = await callScore(styleRefUrl, pass1Gen.imageUrl, styleRefUrl, p1Prompt, 1, engineId)
            const total  = score1?.merged?.total || 0
            const scores = score1?.merged?.scores || {}
            if (total > bestScore) { bestScore = total; bestIteration = 1 }
            if (pass1Gen.renderId) await updateRender(pass1Gen.renderId, scores, total, 1, engineId, loopId, score1?.claude, score1?.gpt)

            const patch = score1?.merged?.prompt_patch || ''
            if (patch) stylePatches.push(patch)

            send({ type: 'iteration_complete', iteration: 1, pass: 1, phase: 1,
              imageUrl: pass1Gen.imageUrl, modelUsed: pass1Gen.modelUsed, renderId: pass1Gen.renderId,
              scores, total,
              whatWentWrong: score1?.merged?.what_went_wrong || '',
              whatWentRight: score1?.merged?.what_went_right || '',
              styleGap:      score1?.merged?.style_gap       || '',
              patch, claudeAnalysis: score1?.claude, gptAnalysis: score1?.gpt,
              bestScore, bestIteration,
              passDescription: 'Style learning — teaching the model the target aesthetic',
            })
          } catch (err: any) {
            send({ type: 'scoring_error', iteration: 1, error: err.message })
          }

          // ── PASS 2: Full Synthesis ────────────────────────────────────────
          send({ type: 'pass_start', pass: 2, iteration: 2, maxIterations: MAX_ITERATIONS, phase: 1,
            description: 'Full synthesis — source photo + style learnings + photo analysis' })

          const p2Prompt = buildPassPrompt(masterPrompt, sourceAnalysis, stylePatches, [], sceneBlock, userPrompt, 'full_synthesis')

          let pass2Gen: any
          try {
            pass2Gen = await callGenerate(sourceFile, p2Prompt, sessionId, loopId, 2)
            send({ type: 'generation_complete', iteration: 2, pass: 2, imageUrl: pass2Gen.imageUrl, modelUsed: pass2Gen.modelUsed, renderId: pass2Gen.renderId })
          } catch (err: any) {
            send({ type: 'generation_error', iteration: 2, error: err.message, pass: 2 })
            send({ type: 'fatal_error', error: 'Pass 2 failed: ' + err.message })
            controller.close(); return
          }

          send({ type: 'scoring', iteration: 2, pass: 2 })
          try {
            const score2 = await callScore(sourceUrl, pass2Gen.imageUrl, styleRefUrl, p2Prompt, 2, engineId)
            const total  = score2?.merged?.total || 0
            const scores = score2?.merged?.scores || {}
            if (total > bestScore) { bestScore = total; bestIteration = 2 }
            if (pass2Gen.renderId) await updateRender(pass2Gen.renderId, scores, total, 2, engineId, loopId, score2?.claude, score2?.gpt)

            const patch = score2?.merged?.prompt_patch || ''
            if (patch) structPatches.push(patch)

            send({ type: 'iteration_complete', iteration: 2, pass: 2, phase: 1,
              imageUrl: pass2Gen.imageUrl, modelUsed: pass2Gen.modelUsed, renderId: pass2Gen.renderId,
              scores, total,
              whatWentWrong: score2?.merged?.what_went_wrong || '',
              whatWentRight: score2?.merged?.what_went_right || '',
              styleGap:      score2?.merged?.style_gap       || '',
              patch, claudeAnalysis: score2?.claude, gptAnalysis: score2?.gpt,
              bestScore, bestIteration,
              passDescription: 'Full synthesis — source photo transformed with style learnings applied',
            })

            if (total >= SCORE_THRESHOLD) {
              send({ type: 'threshold_reached', iteration: 2, total, threshold: SCORE_THRESHOLD })
              stopped = true
            }
          } catch (err: any) {
            send({ type: 'scoring_error', iteration: 2, error: err.message })
          }

          // ── PASS 3: First Convergence ─────────────────────────────────────
          if (!stopped) {
            send({ type: 'pass_start', pass: 3, iteration: 3, maxIterations: MAX_ITERATIONS, phase: 1,
              description: 'Convergence — source photo + all accumulated patches' })

            const p3Prompt = buildPassPrompt(masterPrompt, sourceAnalysis, stylePatches, structPatches, sceneBlock, userPrompt, 'convergence')

            let pass3Gen: any
            try {
              pass3Gen = await callGenerate(sourceFile, p3Prompt, sessionId, loopId, 3)
              send({ type: 'generation_complete', iteration: 3, pass: 3, imageUrl: pass3Gen.imageUrl, modelUsed: pass3Gen.modelUsed, renderId: pass3Gen.renderId })
            } catch (err: any) {
              send({ type: 'generation_error', iteration: 3, error: err.message, pass: 3 })
            }

            if (pass3Gen) {
              send({ type: 'scoring', iteration: 3, pass: 3 })
              try {
                const score3 = await callScore(sourceUrl, pass3Gen.imageUrl, styleRefUrl, p3Prompt, 3, engineId)
                const total  = score3?.merged?.total || 0
                const scores = score3?.merged?.scores || {}
                if (total > bestScore) { bestScore = total; bestIteration = 3 }
                if (pass3Gen.renderId) await updateRender(pass3Gen.renderId, scores, total, 3, engineId, loopId, score3?.claude, score3?.gpt)

                const patch = score3?.merged?.prompt_patch || ''
                if (patch) structPatches.push(patch)

                send({ type: 'iteration_complete', iteration: 3, pass: 3, phase: 1,
                  imageUrl: pass3Gen.imageUrl, modelUsed: pass3Gen.modelUsed, renderId: pass3Gen.renderId,
                  scores, total,
                  whatWentWrong: score3?.merged?.what_went_wrong || '',
                  whatWentRight: score3?.merged?.what_went_right || '',
                  styleGap:      score3?.merged?.style_gap       || '',
                  patch, claudeAnalysis: score3?.claude, gptAnalysis: score3?.gpt,
                  bestScore, bestIteration,
                  passDescription: 'Convergence — all patches applied',
                })

                if (total >= SCORE_THRESHOLD) {
                  send({ type: 'threshold_reached', iteration: 3, total, threshold: SCORE_THRESHOLD })
                  stopped = true
                }
              } catch (err: any) {
                send({ type: 'scoring_error', iteration: 3, error: err.message })
              }
            }
          }
        }

        // ════════════════════════════════════════════════════════════════════
        // PHASE 2 — Refinement (3 passes seeded from user-selected render)
        // ════════════════════════════════════════════════════════════════════
        if (phase === 2) {

          // Fetch the seed render as a File to pass into generate
          let seedFile: File
          try {
            seedFile = await urlToFile(seedImageUrl, `seed-${loopId}.png`)
          } catch (err: any) {
            send({ type: 'fatal_error', error: 'Failed to fetch seed image: ' + err.message })
            controller.close(); return
          }

          for (let pass = 1; pass <= MAX_ITERATIONS && !stopped; pass++) {
            const iteration = pass  // Phase 2 iterations are 1-indexed within this phase
            const isFirstPass = pass === 1

            const passDesc = isFirstPass
              ? 'Refinement pass 1 — seeded from selected render + new user refinements'
              : `Refinement pass ${pass} — continuing convergence with all patches`

            send({ type: 'pass_start', pass, iteration, maxIterations: MAX_ITERATIONS, phase: 2, description: passDesc })

            // First pass of Phase 2 uses seed image as input
            // Subsequent passes use source photo (the seed image anchored the style)
            const inputFile  = isFirstPass ? seedFile : sourceFile
            const passType   = isFirstPass ? 'full_synthesis' : 'convergence'
            const passPrompt = buildPassPrompt(
              masterPrompt,
              sourceAnalysis,
              stylePatches,
              structPatches,
              sceneBlock,
              userPrompt,
              passType,
            )

            let genData: any
            try {
              genData = await callGenerate(inputFile, passPrompt, sessionId, loopId, iteration)
              send({ type: 'generation_complete', iteration, pass, imageUrl: genData.imageUrl, modelUsed: genData.modelUsed, renderId: genData.renderId })
            } catch (err: any) {
              send({ type: 'generation_error', iteration, pass, error: err.message })
              break
            }

            send({ type: 'scoring', iteration, pass })
            try {
              const scoreData = await callScore(sourceUrl, genData.imageUrl, styleRefUrl, passPrompt, iteration, engineId)
              const total     = scoreData?.merged?.total || 0
              const scores    = scoreData?.merged?.scores || {}
              if (total > bestScore) { bestScore = total; bestIteration = iteration }
              if (genData.renderId) await updateRender(genData.renderId, scores, total, pass, engineId, loopId, scoreData?.claude, scoreData?.gpt)

              const patch = scoreData?.merged?.prompt_patch || ''
              if (patch) {
                structPatches.push(patch)
                if (structPatches.length > 6) structPatches.shift()
              }

              send({ type: 'iteration_complete', iteration, pass, phase: 2,
                imageUrl: genData.imageUrl, modelUsed: genData.modelUsed, renderId: genData.renderId,
                scores, total,
                whatWentWrong: scoreData?.merged?.what_went_wrong || '',
                whatWentRight: scoreData?.merged?.what_went_right || '',
                styleGap:      scoreData?.merged?.style_gap       || '',
                patch, claudeAnalysis: scoreData?.claude, gptAnalysis: scoreData?.gpt,
                bestScore, bestIteration,
                passDescription: passDesc,
              })

              if (total >= SCORE_THRESHOLD) {
                send({ type: 'threshold_reached', iteration, total, threshold: SCORE_THRESHOLD,
                  message: `Score ${total} reached threshold — stopping` })
                stopped = true
              }
            } catch (err: any) {
              send({ type: 'scoring_error', iteration, error: err.message })
            }
          }
        }

        // ── Complete ──────────────────────────────────────────────────────────
        send({ type: 'loop_complete', loopId, engineId, phase,
          bestScore, bestIteration, stoppedEarly: stopped,
          message: stopped
            ? `Phase ${phase} stopped early — score ${bestScore}/100 reached threshold`
            : `Phase ${phase} complete — ${MAX_ITERATIONS} passes done. Best: ${bestScore}/100 at pass ${bestIteration}`,
        })

      } catch (err: any) {
        try { controller.enqueue(encoder.encode(sse({ type: 'fatal_error', error: err.message }))) } catch {}
      } finally {
        try { controller.close() } catch {}
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
