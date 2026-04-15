import { NextRequest, NextResponse } from 'next/server'
import { generateDiorama } from '@/lib/v1/generate'
import { expandScene }     from '@/lib/v1/expand'
import { applyLevels }    from '@/lib/v1/levels'
import { analyzeImage }    from '@/lib/v1/analyze'

export async function POST(req: NextRequest) {
  try {
    const body           = await req.json()
    const sourceImageB64: string = body.source_image_b64
    const variants       = body.variants || [{ name: 'default' }]

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const results = []

    for (const v of variants) {
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

      } catch (e: any) {
        system_log.push({ code: 500, stage: 'generate', err: e.message })
        results.push({
          name:               v.name,
          image_b64:          null,
          render_log:         [],
          system_log,
          fatal_error:        'generate failed: ' + e.message,
          prompt_used:        '',
          manual_prompt_used: null,
          params_used:        v,
        })
        continue
      }

      // ── STAGE 2: EXPAND ───────────────────────────────────────
      if (v.expand !== false) {
        try {
          const expanded = await expandScene({
            imageB64:     current!,
            openaiApiKey,
            expand:       true,
          })
          if (!expanded.imageB64) throw new Error('no_output')
          current = expanded.imageB64
          system_log.push({ code: 200, stage: 'expand' })
          if (expanded.warnings?.length) {
            expanded.warnings.forEach((w: string) =>
              system_log.push({ code: 0, stage: 'expand_warn', err: w })
            )
          }
        } catch (e: any) {
          system_log.push({ code: 500, stage: 'expand', err: e.message })
          // non-fatal — continue with unexpanded image
        }
      } else {
        system_log.push({ code: 0, stage: 'expand', err: 'skipped' })
      }

      // ── STAGE 3: LEVELS ───────────────────────────────────────
      try {
        const leveled = await applyLevels({
          imageB64:         current!,
          brightness:       v.brightness,
          lighting_preset:  lightingPreset,
        })
        if (!leveled.success) throw new Error(leveled.errors?.[0] || 'levels_failed')
        current = leveled.imageB64!
        system_log.push({ code: 200, stage: 'levels' })
      } catch (e: any) {
        system_log.push({ code: 500, stage: 'levels', err: e.message })
        // non-fatal
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
        const b        = Math.round(analysis.brightness)
        const c        = Math.round(analysis.contrast)
        const dimFloor = 80

        if (analysis.brightness < dimFloor) {
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

      if (v.expand === false) {
        render_log.push({ ok: true, msg: 'expand skipped' })
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
