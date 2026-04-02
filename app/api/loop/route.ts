// app/api/loop/route.ts — v4 LEAN
// 2 passes: generate → score → patch → generate
// GPT-4o scoring only. Blueprint locked across all passes.
// Base prompts are the working ChatGPT originals.

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import openai from '@/lib/openai'
import { extractBlueprint, extractBlueprintFromBase64 } from '@/lib/engines/blueprints'
import { assemblePrompt, buildPatchBlock, type ScoredFailure } from '@/lib/engines/modules'

const SCORE_THRESHOLD = 85
const API_BASE        = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function sse(data: object): string { return `data: ${JSON.stringify(data)}\n\n` }

async function storeFile(file: File, name: string, bucket = 'uploads'): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabaseAdmin.storage.from(bucket).upload(name, new Uint8Array(buffer), { contentType: file.type })
  if (error) throw new Error(`Storage: ${error.message}`)
  return supabaseAdmin.storage.from(bucket).getPublicUrl(name).data.publicUrl
}

async function callGenerate(file: File, prompt: string, sessionId: string, loopId: string, pass: number): Promise<any> {
  const form = new FormData()
  form.append('file', file)
  form.append('prompt', prompt.substring(0, 4000))
  form.append('sessionId', sessionId)
  form.append('loopId', loopId)
  form.append('iterationNumber', String(pass))
  const res  = await fetch(`${API_BASE}/api/generate`, { method: 'POST', body: form })
  const data = await res.json()
  if (!data.imageUrl) {
    const msg = data.error || 'No image URL'
    if (msg.includes('429') || msg.includes('quota') || msg.includes('billing')) {
      throw new Error('OpenAI quota exceeded — add credits at platform.openai.com/billing')
    }
    throw new Error(msg)
  }
  return data
}

async function scoreOutput(params: {
  sourceUrl:   string
  outputUrl:   string
  styleRefUrl: string
  engineId:    string
  pass:        number
}): Promise<{ total: number; failures: ScoredFailure[]; summary: string; whatWentRight: string }> {
  const { sourceUrl, outputUrl, styleRefUrl, engineId, pass } = params

  const system = `You are scoring a miniature diorama generation against a source photo.
Return ONLY raw JSON, no markdown:
{
  "score_total": <0-100>,
  "category_scores": {
    "structure_preservation": <0-30>,
    "diorama_realism": <0-25>,
    "environment_completion": <0-25>,
    "detail_craftsmanship": <0-20>
  },
  "failures": [
    { "type": "<snake_case>", "severity": <0.0-1.0>, "fix": "<imperative under 20 words>" }
  ],
  "summary": "<biggest problem in one sentence>",
  "what_went_right": "<what worked in one sentence>"
}
SCORING:
structure_preservation (0-30): correct floors, roof, windows, proportions from source?
diorama_realism (0-25): looks like real physical handcrafted miniature on a base?
environment_completion (0-25): base and surrounding fully built — no empty areas?
detail_craftsmanship (0-20): materials and textures well-defined at miniature scale?
Score 70+ only if it genuinely looks like the source as a premium miniature.`

  const fetchB64 = async (url: string) => {
    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    const ct  = res.headers.get('content-type') || 'image/png'
    return {
      data:      Buffer.from(buf).toString('base64'),
      mediaType: (ct.includes('jpeg') ? 'image/jpeg' : ct.includes('webp') ? 'image/webp' : 'image/png') as 'image/jpeg' | 'image/png' | 'image/webp',
    }
  }

  const [srcImg, outImg] = await Promise.all([fetchB64(sourceUrl), fetchB64(outputUrl)])
  const refImg = styleRefUrl ? await fetchB64(styleRefUrl) : null

  const content: any[] = [
    { type: 'text',      text: 'IMAGE 1 — SOURCE PHOTO:' },
    { type: 'image_url', image_url: { url: `data:${srcImg.mediaType};base64,${srcImg.data}` } },
  ]
  if (refImg) {
    content.push(
      { type: 'text',      text: 'IMAGE 2 — STYLE REFERENCE:' },
      { type: 'image_url', image_url: { url: `data:${refImg.mediaType};base64,${refImg.data}` } },
    )
  }
  content.push(
    { type: 'text',      text: `IMAGE ${refImg ? 3 : 2} — GENERATED OUTPUT:` },
    { type: 'image_url', image_url: { url: `data:${outImg.mediaType};base64,${outImg.data}` } },
    { type: 'text',      text: `Pass ${pass}. Engine: ${engineId}.` },
  )

  const res = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      600,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content }],
  })

  const raw = JSON.parse(res.choices[0]?.message?.content || '{}')
  const cs  = raw.category_scores || {}
  const total = raw.score_total
    || ((cs.structure_preservation || 0) + (cs.diorama_realism || 0) + (cs.environment_completion || 0) + (cs.detail_craftsmanship || 0))

  return {
    total,
    failures:      (raw.failures || []).map((f: any) => ({ type: f.type || 'unknown', severity: Math.min(1, Math.max(0, parseFloat(f.severity) || 0.5)), fix: f.fix || '' })),
    summary:       raw.summary        || '',
    whatWentRight: raw.what_went_right || '',
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(sse(data)))
      try {
        const formData   = await request.formData()
        const sourceFile = formData.get('file')      as File | null
        const styleRef   = formData.get('styleRef')  as File | null
        const engineId   = formData.get('engineId')  as string || 'architecture'
        const sessionId  = formData.get('sessionId') as string || `s-${Date.now()}`
        const userPrompt = (formData.get('userPrompt') as string || '').trim()

        let blueprint: Record<string, any> | null = null
        try { const pb = formData.get('priorBlueprint') as string; if (pb) blueprint = JSON.parse(pb) } catch {}

        if (!sourceFile) { send({ type: 'fatal_error', error: 'Source photo required' }); controller.close(); return }

        const loopId = `loop-${Date.now()}-${engineId}`
        send({ type: 'loop_start', loopId, engineId, maxPasses: 2 })

        send({ type: 'storing_images' })
        const sourceUrl   = await storeFile(sourceFile, `source-${loopId}.${sourceFile.name.split('.').pop() || 'jpg'}`)
        const styleRefUrl = styleRef ? await storeFile(styleRef, `ref-${loopId}.${styleRef.name.split('.').pop() || 'jpg'}`) : ''
        send({ type: 'images_stored', sourceUrl, styleRefUrl })

        if (!blueprint) {
          send({ type: 'blueprint_start' })
          try {
            // Pass base64 directly — GPT-4o may not be able to fetch Supabase URLs
            const srcBuf    = Buffer.from(await sourceFile.arrayBuffer())
            const srcB64    = srcBuf.toString('base64')
            const srcMime   = sourceFile.type || 'image/jpeg'
            blueprint = await extractBlueprintFromBase64(srcB64, srcMime, engineId)
            send({ type: 'blueprint_ready', blueprint })
          }
          catch (err: any) {
            console.error('Blueprint extraction error:', err.message, err?.status)
            send({ type: 'blueprint_failed', error: err.message })
            blueprint = {}
          }
        } else {
          send({ type: 'blueprint_reused', blueprint })
        }

        let bestScore = 0, bestImageUrl = '', patchBlock = ''

        // ── PASS 1 ────────────────────────────────────────────────────────────
        send({ type: 'pass_start', pass: 1, maxPasses: 2, description: 'Pass 1 — baseline generation' })
        const p1Prompt = assemblePrompt({ engineId, blueprint, userPrompt })
        send({ type: 'prompt_built', pass: 1, prompt: p1Prompt })

        let p1Gen: any
        try {
          p1Gen = await callGenerate(sourceFile, p1Prompt, sessionId, loopId, 1)
          send({ type: 'generation_complete', pass: 1, iteration: 1, imageUrl: p1Gen.imageUrl, modelUsed: p1Gen.modelUsed })
        } catch (err: any) { send({ type: 'fatal_error', error: 'Pass 1: ' + err.message }); controller.close(); return }

        send({ type: 'scoring', pass: 1 })
        try {
          const s1 = await scoreOutput({ sourceUrl, outputUrl: p1Gen.imageUrl, styleRefUrl, engineId, pass: 1 })
          bestScore = s1.total; bestImageUrl = p1Gen.imageUrl
          patchBlock = buildPatchBlock(s1.failures)
          if (p1Gen.renderId) await supabaseAdmin.from('renders').update({ score_total: s1.total, issue_label: `${engineId}·p1` }).eq('id', p1Gen.renderId)
          send({ type: 'iteration_complete', pass: 1, iteration: 1, imageUrl: p1Gen.imageUrl, modelUsed: p1Gen.modelUsed, total: s1.total, failures: s1.failures, summary: s1.summary, whatWentRight: s1.whatWentRight, bestScore, blueprint })
          if (s1.total >= SCORE_THRESHOLD) { send({ type: 'threshold_reached', pass: 1, total: s1.total }); send({ type: 'loop_complete', bestScore, bestImageUrl, blueprint, passes: 1 }); controller.close(); return }
        } catch (err: any) { send({ type: 'scoring_error', pass: 1, error: err.message }) }

        // ── PASS 2 ────────────────────────────────────────────────────────────
        send({ type: 'pass_start', pass: 2, maxPasses: 2, description: 'Pass 2 — applying corrections' })
        const p2Prompt = assemblePrompt({ engineId, blueprint, userPrompt, patchBlock })
        send({ type: 'prompt_built', pass: 2, prompt: p2Prompt })

        let p2Gen: any
        try {
          p2Gen = await callGenerate(sourceFile, p2Prompt, sessionId, loopId, 2)
          send({ type: 'generation_complete', pass: 2, iteration: 2, imageUrl: p2Gen.imageUrl, modelUsed: p2Gen.modelUsed })
        } catch (err: any) { send({ type: 'generation_error', pass: 2, error: err.message }); send({ type: 'loop_complete', bestScore, bestImageUrl, blueprint, passes: 1 }); controller.close(); return }

        send({ type: 'scoring', pass: 2 })
        try {
          const s2 = await scoreOutput({ sourceUrl, outputUrl: p2Gen.imageUrl, styleRefUrl, engineId, pass: 2 })
          if (s2.total > bestScore) { bestScore = s2.total; bestImageUrl = p2Gen.imageUrl }
          if (p2Gen.renderId) await supabaseAdmin.from('renders').update({ score_total: s2.total, issue_label: `${engineId}·p2` }).eq('id', p2Gen.renderId)
          send({ type: 'iteration_complete', pass: 2, iteration: 2, imageUrl: p2Gen.imageUrl, modelUsed: p2Gen.modelUsed, total: s2.total, failures: s2.failures, summary: s2.summary, whatWentRight: s2.whatWentRight, bestScore, blueprint })
        } catch (err: any) { send({ type: 'scoring_error', pass: 2, error: err.message }) }

        send({ type: 'loop_complete', bestScore, bestImageUrl, blueprint, passes: 2 })

      } catch (err: any) {
        try { controller.enqueue(encoder.encode(sse({ type: 'fatal_error', error: err.message }))) } catch {}
      } finally {
        try { controller.close() } catch {}
      }
    }
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })
}
