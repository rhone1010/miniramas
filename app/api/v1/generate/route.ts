import { NextRequest, NextResponse } from 'next/server'
import { generateDiorama }       from '@/lib/v1/generate'
import { applyLevels }           from '@/lib/v1/levels'
import { analyzeImage }          from '@/lib/v1/analyze'
import { analyzeArchitecture }   from '@/lib/v1/analyze-architecture'
import { expandScene }           from '@/lib/v1/expand'

export async function POST(req: NextRequest) {
  try {
    const body                     = await req.json()
    const sourceImageB64: string   = body.source_image_b64
    const extraImages: string[]    = body.extra_images || []
    const variants                 = body.variants || [{ name: 'default' }]

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const results = []

    // ── STAGE 0: ARCHITECTURE ANALYSIS ───────────────────────
    let architectureDescription: string | null = null
    try {
      const arch = await analyzeArchitecture({ sourceImageB64, extraImages, openaiApiKey })
      if (arch.success && arch.description) {
        architectureDescription = arch.description
        console.log(`[route] Architecture analysis — ${1 + extraImages.length} image(s)`)
      }
    } catch (e: any) {
      console.warn('[route] Architecture analysis failed (non-fatal):', e.message)
    }

    for (const v of variants) {
      if (architectureDescription) v.architectureDescription = architectureDescription

      const system_log: any[] = []
      const render_log: any[] = []
      let current: string | null = null
      let promptUsed       = ''
      let manualPromptUsed: string | null = null
      const lightingPreset = (v.preset || v.lighting_preset || 'summer') as string

      // ── STAGE 1: GENERATE ─────────────────────────────────────
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
      } catch (e: any) {
        system_log.push({ code: 500, stage: 'generate', err: e.message })
        results.push({
          name: v.name, image_b64: null, render_log: [], system_log,
          fatal_error: 'generate failed: ' + e.message,
          prompt_used: '', manual_prompt_used: null, params_used: v,
        })
        continue
      }

      // ── STAGE 2: EXPAND — moved to Stage 3.5 (after levels) ───────

      // ── STAGE 3: LEVELS ───────────────────────────────────────
      try {
        const leveled = await applyLevels({
          imageB64:        current!,
          brightness:      v.brightness,
          lighting_preset: lightingPreset,
        })
        if (!leveled.success) throw new Error(leveled.errors?.[0] || 'levels_failed')
        current = leveled.imageB64!
        system_log.push({ code: 200, stage: 'levels' })
      } catch (e: any) {
        system_log.push({ code: 500, stage: 'levels', err: e.message })
      }

      // ── STAGE 3.5: EXPAND — standalone last processing step ─────
      // Runs after generation and levels are fully complete
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
            system_log.push({ code: 0, stage: 'expand_warn', err: w })
          )
        }
      } catch (e: any) {
        system_log.push({ code: 500, stage: 'expand', err: e.message })
        console.error('[expand] FAILED:', e.message)
        // non-fatal — continue with unexpanded image
      }

      // ── STAGE 4: ANALYZE ──────────────────────────────────────
      let analysis: { brightness: number; contrast: number } | null = null
      try {
        analysis = await analyzeImage(current!)
        system_log.push({ code: 200, stage: 'analyze', params: analysis })
      } catch (e: any) {
        system_log.push({ code: 500, stage: 'analyze', err: e.message })
      }

      // ── RENDER DIAGNOSTICS ────────────────────────────────────
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
        name:               v.name,
        image_b64:          current,
        render_log,
        system_log,
        fatal_error:        null,
        prompt_used:        promptUsed,
        manual_prompt_used: manualPromptUsed,
        params_used:        v,
      })
    }

    return NextResponse.json({ results })

  } catch (err: any) {
    return NextResponse.json({ error: err.message, fatal_error: true }, { status: 500 })
  }
}
