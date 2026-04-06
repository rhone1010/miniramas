import { NextRequest, NextResponse } from 'next/server'
import { generateDiorama } from '@/lib/v1/generate'
import { boostHighlights } from '@/lib/v1/highlight'
import { analyzeImage }    from '@/lib/v1/analyze'

const TARGET_SIZE = '1024x1024'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const sourceImageB64: string = body.source_image_b64
    const variants = body.variants || [{ name: 'default' }]

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const results = []

    for (const v of variants) {
      const system_log: any[] = []
      const render_log: any[] = []

      let current: string | null = null
      let promptUsed = ''
      let manualPromptUsed: string | null = null

      const brightnessValue = v.brightness ?? 1.28

      // ── GENERATE ──────────────────────────────────────────────
      try {
        const generated = await generateDiorama({
          sourceImageB64,
          openaiApiKey,
          params: v,
        })

        if (!generated.imageB64) throw new Error('no_output')

        current = generated.imageB64
        promptUsed = generated.promptUsed
        manualPromptUsed = generated.manualPromptUsed

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

      // ── HIGHLIGHT ─────────────────────────────────────────────
      try {
        const h = await boostHighlights({
          imageB64: current!,
          brightness: brightnessValue
        })

        if (!h.success) throw new Error('highlight_failed')

        current = h.imageB64!

        system_log.push({
          code: 200,
          stage: 'highlight',
          brightness: brightnessValue
        })

      } catch (e: any) {
        system_log.push({ code: 500, stage: 'highlight', err: e.message })
      }

      // ── ANALYZE ───────────────────────────────────────────────
      let analysis: { brightness: number; contrast: number } | null = null

      try {
        analysis = await analyzeImage(current!)

        system_log.push({
          code: 200,
          stage: 'analyze',
          params: analysis
        })

      } catch (e: any) {
        system_log.push({ code: 500, stage: 'analyze', err: e.message })
      }

      // ── RENDER DIAGNOSTICS ────────────────────────────────────
      if (analysis) {
        if (brightnessValue > 1.2 && analysis.brightness < 120) {
          render_log.push({
            ok: false,
            msg: 'sunlight not achieved — image too dim'
          })
        }

        if (analysis.brightness > 200) {
          render_log.push({
            ok: false,
            msg: 'image overexposed — highlights blown'
          })
        }

        if (analysis.contrast < 30) {
          render_log.push({
            ok: false,
            msg: 'image flat — low contrast'
          })
        }

        if (analysis.contrast > 80) {
          render_log.push({
            ok: false,
            msg: 'contrast too harsh'
          })
        }

        if (
          analysis.brightness >= 120 &&
          analysis.brightness <= 180 &&
          analysis.contrast >= 30
        ) {
          render_log.push({
            ok: true,
            msg: `exposure good — brightness ${Math.round(analysis.brightness)}, contrast ${Math.round(analysis.contrast)}`
          })
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
    return NextResponse.json(
      { error: err.message, fatal_error: true },
      { status: 500 }
    )
  }
}