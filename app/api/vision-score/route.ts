// app/api/vision-score/route.ts — v2
// Structured scoring with category_scores + failures[] + severity weights
// Accepts passContext to adjust what it scores against
// Returns both merged structured score AND legacy format for backwards compat

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import openai from '@/lib/openai'
import { getVisionRubric, EngineId } from '@/lib/engines'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Scoring system prompt ─────────────────────────────────────────────────────
function getScoringSystem(rubric: string, passContext: string, hasStyleRef: boolean): string {
  const styleRefNote = hasStyleRef
    ? `\nYou also have a STYLE REFERENCE image. Score how well the output matches that aesthetic quality (base finish, lighting, materials, presentation).`
    : ''

  const passNote = passContext === 'full_synthesis'
    ? '\nThis is the first real generation from the source photo. Be constructive — identify the biggest structural gaps.'
    : passContext === 'convergence' || passContext === 'phase2_converge'
    ? '\nThis is a convergence pass — previous corrections have been applied. Score carefully and identify remaining gaps.'
    : passContext === 'phase2_seed'
    ? '\nThis is a Phase 2 refinement seeded from a prior output. Focus on whether user-requested changes were applied.'
    : ''

  return `You are evaluating how well an AI-generated image matches a target miniature diorama transformation.
${passNote}${styleRefNote}

Score from 0–100 across these four dimensions (25 pts each):

1. identity (0–25): Are the structure, proportions, floor count, roof type, and window pattern preserved from the source photo? Does it look like the SAME building/subject?

2. diorama (0–25): Does it look like a real physical handcrafted miniature scene on a circular base? Are all elements 3D physical objects?

3. detail (0–25): Are materials, foliage, and textures rich and varied? Do surfaces read as real physical materials at miniature scale?

4. composition (0–25): Is the framing, camera angle, depth of field, and lighting correct? Is the base fully visible?

ENGINE RUBRIC:
${rubric}

Respond ONLY in raw JSON — no markdown, no preamble, no explanation:
{
  "score": <sum of category scores>,
  "category_scores": {
    "identity": <0-25>,
    "diorama": <0-25>,
    "detail": <0-25>,
    "composition": <0-25>
  },
  "failures": [
    {
      "type": "<snake_case_type>",
      "severity": <0.0-1.0>,
      "description": "<specific visual observation under 20 words>",
      "fix": "<imperative instruction under 20 words starting with a verb>",
      "dimension": "<identity|diorama|detail|composition>"
    }
  ],
  "what_went_wrong": "<single most important issue>",
  "what_went_right": "<what this generation got right>",
  "style_gap": "<how output differs from style reference>",
  "prompt_patch": "<single most impactful prompt addition — imperative, under 25 words>",
  "confidence": <50-100>
}`
}

async function fetchBase64(url: string): Promise<{ data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' }> {
  const res    = await fetch(url)
  const buffer = await res.arrayBuffer()
  const ct     = res.headers.get('content-type') || 'image/png'
  return {
    data:      Buffer.from(buffer).toString('base64'),
    mediaType: ct.includes('jpeg') ? 'image/jpeg' : ct.includes('webp') ? 'image/webp' : 'image/png',
  }
}

function safeParseJSON(text: string): any {
  try {
    // Strip markdown fences if present
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

function normalizeScore(raw: any): any {
  if (!raw) return null

  // Handle new structured format
  if (raw.category_scores) {
    const cs  = raw.category_scores
    const sum = (cs.identity || 0) + (cs.diorama || 0) + (cs.detail || 0) + (cs.composition || 0)
    return {
      ...raw,
      score:  raw.score || sum,
      total:  raw.score || sum,   // legacy compat
      scores: {                    // legacy compat — map to old dimension names
        identity_preservation: cs.identity    || 0,
        diorama_fidelity:      cs.diorama     || 0,
        detail_richness:       cs.detail      || 0,
        composition_camera:    cs.composition || 0,
      },
      failures: (raw.failures || []).map((f: any) => ({
        type:        f.type        || 'unknown',
        severity:    Math.min(1, Math.max(0, parseFloat(f.severity) || 0.5)),
        description: f.description || '',
        fix:         f.fix         || '',
        dimension:   f.dimension   || 'detail',
      })),
    }
  }

  // Legacy format — no category_scores, just scores dict
  const total = raw.total || raw.score || Object.values(raw.scores || {}).reduce((a: any, b: any) => a + b, 0) || 0
  return {
    ...raw,
    score:           total,
    total,
    category_scores: null,
    failures:        [],
    prompt_patch:    raw.prompt_patch || '',
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      goldStandardUrl,
      outputUrl,
      styleRefUrl,
      iterationNumber,
      engineId,
      passContext    = 'convergence',
      useStructuredScoring = true,
    } = await request.json()

    if (!goldStandardUrl || !outputUrl) {
      return NextResponse.json({ error: 'goldStandardUrl and outputUrl required' }, { status: 400 })
    }

    const hasStyleRef = !!styleRefUrl
    const rubric      = getVisionRubric((engineId || 'people') as EngineId)
    const system      = getScoringSystem(rubric, passContext, hasStyleRef)
    const iterMsg     = `Iteration ${iterationNumber || 1}. Pass context: ${passContext}. Score the generated output.`

    // Fetch images in parallel
    const fetches = [fetchBase64(goldStandardUrl), fetchBase64(outputUrl)]
    if (hasStyleRef) fetches.push(fetchBase64(styleRefUrl))
    const [goldImg, outputImg, styleImg] = await Promise.all(fetches)

    // Build content for both models
    const claudeContent: any[] = [
      { type: 'text',  text: 'IMAGE 1 — SOURCE PHOTO (structural reference):' },
      { type: 'image', source: { type: 'base64', media_type: goldImg.mediaType, data: goldImg.data } },
    ]
    const gptContent: any[] = [
      { type: 'text',      text: 'IMAGE 1 — SOURCE PHOTO (structural reference):' },
      { type: 'image_url', image_url: { url: `data:${goldImg.mediaType};base64,${goldImg.data}` } },
    ]

    if (hasStyleRef && styleImg) {
      claudeContent.push(
        { type: 'text',  text: 'IMAGE 2 — STYLE REFERENCE (aesthetic/quality target):' },
        { type: 'image', source: { type: 'base64', media_type: styleImg.mediaType, data: styleImg.data } },
      )
      gptContent.push(
        { type: 'text',      text: 'IMAGE 2 — STYLE REFERENCE (aesthetic/quality target):' },
        { type: 'image_url', image_url: { url: `data:${styleImg.mediaType};base64,${styleImg.data}` } },
      )
    }

    const outputLabel = hasStyleRef ? 'IMAGE 3 — GENERATED OUTPUT (score this):' : 'IMAGE 2 — GENERATED OUTPUT (score this):'
    claudeContent.push(
      { type: 'text',  text: outputLabel },
      { type: 'image', source: { type: 'base64', media_type: outputImg.mediaType, data: outputImg.data } },
      { type: 'text',  text: iterMsg },
    )
    gptContent.push(
      { type: 'text',      text: outputLabel },
      { type: 'image_url', image_url: { url: `data:${outputImg.mediaType};base64,${outputImg.data}` } },
      { type: 'text',      text: iterMsg },
    )

    // Run Claude + GPT-4o in parallel — Claude-only fallback if GPT-4o quota hit
    const [claudeResult, gptResult] = await Promise.allSettled([

      anthropic.messages.create({
        model:      'claude-sonnet-4-5',
        max_tokens: 1200,
        system,
        messages:   [{ role: 'user', content: claudeContent }],
      }).then(res => {
        const text = res.content.find(b => b.type === 'text')?.text || ''
        return safeParseJSON(text)
      }),

      openai.chat.completions.create({
        model:           'gpt-4o',
        max_tokens:      1200,
        messages:        [{ role: 'system', content: system }, { role: 'user', content: gptContent }],
        response_format: { type: 'json_object' },
      }).then(res => safeParseJSON(res.choices[0]?.message?.content || '{}')).catch(err => {
        // Graceful degradation on quota/rate limit — Claude carries on alone
        const status = err?.status || err?.response?.status
        if (status === 429 || status === 402) {
          console.warn('GPT-4o quota/rate limit — scoring with Claude only')
          return null
        }
        throw err
      }),

    ])

    const rawClaude = claudeResult.status === 'fulfilled' ? claudeResult.value : null
    const rawGpt    = gptResult.status    === 'fulfilled' ? gptResult.value    : null

    if (!rawClaude && !rawGpt) {
      const err429 = (gptResult as any).reason?.status === 429 || (claudeResult as any).reason?.status === 429
      return NextResponse.json({ 
        error: err429 ? 'OpenAI quota exceeded — add credits at platform.openai.com/billing' : 'Both vision models failed' 
      }, { status: 500 })
    }

    const claude = normalizeScore(rawClaude)
    const gpt    = normalizeScore(rawGpt)

    // Merge scores — average category scores, union failures, pick best patch
    const mergedCategoryScores = {
      identity:    mergeVal(claude?.category_scores?.identity,    gpt?.category_scores?.identity),
      diorama:     mergeVal(claude?.category_scores?.diorama,     gpt?.category_scores?.diorama),
      detail:      mergeVal(claude?.category_scores?.detail,      gpt?.category_scores?.detail),
      composition: mergeVal(claude?.category_scores?.composition, gpt?.category_scores?.composition),
    }
    const mergedTotal = mergedCategoryScores.identity + mergedCategoryScores.diorama + mergedCategoryScores.detail + mergedCategoryScores.composition

    // Merge legacy scores dict for backwards compat
    const mergedScores: Record<string, number> = {}
    const allKeys = new Set([...Object.keys(claude?.scores || {}), ...Object.keys(gpt?.scores || {})])
    for (const key of allKeys) {
      mergedScores[key] = mergeVal(claude?.scores?.[key], gpt?.scores?.[key])
    }

    // Merge failures — dedupe by type, take highest severity
    const failureMap = new Map<string, any>()
    for (const f of [...(claude?.failures || []), ...(gpt?.failures || [])]) {
      const existing = failureMap.get(f.type)
      if (!existing || f.severity > existing.severity) failureMap.set(f.type, f)
    }
    const mergedFailures = Array.from(failureMap.values()).sort((a, b) => b.severity - a.severity)

    // Pick patch from higher-confidence model
    const mergedPatch = (claude && gpt)
      ? ((claude.confidence || 50) >= (gpt.confidence || 50) ? claude.prompt_patch : gpt.prompt_patch)
      : (claude?.prompt_patch || gpt?.prompt_patch || '')

    return NextResponse.json({
      hasStyleRef,
      passContext,
      claude: claude
        ? { ...claude, engine: 'Claude Sonnet', error: null }
        : { error: (claudeResult as any).reason?.message || 'Failed', engine: 'Claude Sonnet' },
      gpt: gpt
        ? { ...gpt, engine: 'GPT-4o', error: null }
        : { error: (gptResult as any).reason?.message || 'Failed', engine: 'GPT-4o' },
      merged: {
        score:           mergedTotal,
        total:           mergedTotal,   // legacy compat
        category_scores: mergedCategoryScores,
        scores:          mergedScores,  // legacy compat
        failures:        mergedFailures,
        prompt_patch:    mergedPatch,
        what_went_wrong: claude?.what_went_wrong || gpt?.what_went_wrong || '',
        what_went_right: claude?.what_went_right || gpt?.what_went_right || '',
        style_gap:       claude?.style_gap       || gpt?.style_gap       || '',
      },
    })

  } catch (error: any) {
    console.error('Vision score error:', error)
    return NextResponse.json({ error: error?.message || 'Scoring failed' }, { status: 500 })
  }
}

function mergeVal(a: number | undefined, b: number | undefined): number {
  if (a !== undefined && b !== undefined) return Math.round((a + b) / 2)
  return Math.round(a ?? b ?? 0)
}
