// runners/structures.ts
// lib/v1/runners/structures.ts

import { generateDiorama }       from '@/lib/v1/generate'
import { applyLevels }           from '@/lib/v1/levels'
import { analyzeImage }          from '@/lib/v1/analyze'
import { analyzeArchitecture }   from '@/lib/v1/analyze-architecture'
import { expandScene }           from '@/lib/v1/expand'

interface StageEntry { code: number; stage: string; err?: string; params?: unknown }
interface RenderEntry { ok: boolean; msg: string }

export interface StructuresRunResult {
  results: Array<{
    name:                string
    image_b64:           string | null
    render_log:          RenderEntry[]
    system_log:          StageEntry[]
    fatal_error:         string | null
    prompt_used:         string
    manual_prompt_used:  string | null
    params_used:         Record<string, unknown>
  }>
}

export async function runStructuresGeneration(body: Record<string, unknown>): Promise<StructuresRunResult> {
  const sourceImageB64 = body.source_image_b64 as string
  const extraImages    = (body.extra_images as string[]) ?? []
  const variants       = (body.variants as Array<Record<string, unknown>>) ?? [{ name: 'default' }]

  if (!sourceImageB64) throw new Error('validation: source_image_b64 required')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set')

  const results: StructuresRunResult['results'] = []

  // ── architecture analysis (non-fatal) ─────────────────────────
  let architectureDescription: string | null = null
  try {
    const arch = await analyzeArchitecture({ sourceImageB64, extraImages, openaiApiKey })
    if (arch.success && arch.description) {
      architectureDescription = arch.description
    }
  } catch (e) {
    console.warn('[structures-runner] arch analysis failed (non-fatal):', (e as Error).message)
  }

  for (const v of variants) {
    if (architectureDescription) v.architectureDescription = architectureDescription

    const system_log: StageEntry[] = []
    const render_log: RenderEntry[] = []
    let current: string | null = null
    let promptUsed = ''
    let manualPromptUsed: string | null = null
    const lightingPreset = ((v.preset as string | undefined) || (v.lighting_preset as string | undefined) || 'summer')

    // ── generate ────────────────────────────────────────────────
    try {
      const generated = await generateDiorama({
        sourceImageB64,
        openaiApiKey,
        params: v,
      })
      if (!generated.imageB64) throw new Error('no_output')
      current          = generated.imageB64
      promptUsed       = generated.promptUsed
      manualPromptUsed = generated.manualPromptUsed ?? null
      system_log.push({ code: 200, stage: 'generate' })
      if (architectureDescription) {
        system_log.push({ code: 200, stage: 'arch-analysis', err: `${architectureDescription.length} chars` })
      }
    } catch (e) {
      const msg = (e as Error).message
      // Bubble up — caller decides how to classify. Don't swallow.
      // But we still want partial results in the response, so re-throw only
      // if every variant fails. For v1, propagate immediately.
      throw new Error('generate failed: ' + msg)
    }

    // ── levels (non-fatal) ──────────────────────────────────────
    try {
      const leveled = await applyLevels({
        imageB64:        current!,
        brightness:      v.brightness as number | undefined,
        lighting_preset: lightingPreset,
      })
      if (!leveled.success) throw new Error(leveled.errors?.[0] || 'levels_failed')
      current = leveled.imageB64!
      system_log.push({ code: 200, stage: 'levels' })
    } catch (e) {
      system_log.push({ code: 500, stage: 'levels', err: (e as Error).message })
    }

    // ── expand (non-fatal) ──────────────────────────────────────
    try {
      const expanded = await expandScene({
        imageB64:     current!,
        openaiApiKey,
        expand:       true,
      })
      if (expanded.imageB64) {
        current = expanded.imageB64
        system_log.push({ code: 200, stage: 'expand' })
      }
      if (expanded.warnings?.length) {
        expanded.warnings.forEach((w: string) =>
          system_log.push({ code: 0, stage: 'expand_warn', err: w }),
        )
      }
    } catch (e) {
      system_log.push({ code: 500, stage: 'expand', err: (e as Error).message })
    }

    // ── analyze (non-fatal) ─────────────────────────────────────
    let analysis: { brightness: number; contrast: number } | null = null
    try {
      analysis = await analyzeImage(current!)
      system_log.push({ code: 200, stage: 'analyze', params: analysis })
    } catch (e) {
      system_log.push({ code: 500, stage: 'analyze', err: (e as Error).message })
    }

    if (analysis) {
      const b = Math.round(analysis.brightness)
      const c = Math.round(analysis.contrast)
      if (analysis.brightness < 80) {
        render_log.push({ ok: false, msg: `image too dim — brightness ${b} (check generation)` })
      } else if (analysis.brightness > 210) {
        render_log.push({ ok: false, msg: `image overexposed — brightness ${b}` })
      } else {
        render_log.push({ ok: true, msg: `exposure good — brightness ${b}, contrast ${c}` })
      }
      if (analysis.contrast < 25) {
        render_log.push({ ok: false, msg: `image flat — low contrast ${c}` })
      }
    }
    if (render_log.length === 0) {
      render_log.push({ ok: true, msg: 'no major issues detected' })
    }

    results.push({
      name:                v.name as string,
      image_b64:           current,
      render_log,
      system_log,
      fatal_error:         null,
      prompt_used:         promptUsed,
      manual_prompt_used:  manualPromptUsed,
      params_used:         v,
    })
  }

  return { results }
}
