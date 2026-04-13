// route.ts — FULL REWRITE (expand restored, lighting-safe pipeline)

import { NextRequest, NextResponse } from 'next/server'
import { generateDiorama } from '@/lib/v1/generate'
<<<<<<< HEAD
import { correctExposure, applyLevels } from '@/lib/v1/levels'
import { expandScene }    from '@/lib/v1/expand'
import { analyzeImage }   from '@/lib/v1/analyze'
=======
import { boostHighlights } from '@/lib/v1/highlight'
import { expandScene }     from '@/lib/v1/expand'
import { analyzeImage }    from '@/lib/v1/analyze'

const TARGET_SIZE = '1024x1024' // 1:1 enforced globally
>>>>>>> parent of b3c68b3 (great results reset)

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

<<<<<<< HEAD
      const lightingPreset = (v.lighting_preset as string) || 'midday_summer'

      // ── STAGE 1: GENERATE ──────────────────────────────────
=======
      // ── GENERATE ──────────────────────────────────────────────
>>>>>>> parent of b3c68b3 (great results reset)
      try {
        const generated = await generateDiorama({
          sourceImageB64,
          openaiApiKey,
          params: v,
        })
        if (!generated.imageB64) throw new Error('no_output')
<<<<<<< HEAD

        current          = generated.imageB64
        promptUsed       = generated.promptUsed
        manualPromptUsed = generated.manualPromptUsed ?? null

=======
        current          = generated.imageB64
        promptUsed       = generated.promptUsed
        manualPromptUsed = generated.manualPromptUsed
>>>>>>> parent of b3c68b3 (great results reset)
        system_log.push({ code: 200, stage: 'generate' })

      } catch (e: any) {
        system_log.push({ code: 500, stage: 'generate', err: e.message })
        results.push({
          name: v.name,
          image_b64: null,
          render_log: [],
          system_log,
          fatal_error: 'generate failed: ' + e.message,
          prompt_used: '',
          manual_prompt_used: null,
          params_used: v,
        })
        continue
      }

<<<<<<< HEAD
      // ── STAGE 2: EXPOSURE PRE (BRIGHT MODES ONLY) ───────────
      const exposureMode =
        lightingPreset === 'midday_summer' ||
        lightingPreset === 'soft_spring'

      if (exposureMode) {
        try {
          const corrected = await correctExposure({
            imageB64:        current!,
            lighting_preset: lightingPreset,
          })

          current = corrected.imageB64

          system_log.push({
            code: 200,
            stage: 'exposure_pre',
            before: Math.round(corrected.before),
            after:  Math.round(corrected.after),
            mult:   corrected.multiplier.toFixed(2),
          })

        } catch (e: any) {
          system_log.push({ code: 500, stage: 'exposure_pre', err: e.message })
        }
      } else {
        system_log.push({ code: 0, stage: 'exposure_pre', err: 'skipped — dark mode' })
      }

      // ── STAGE 3: EXPAND (RESTORED — MARGIN ENGINE) ──────────
=======
      // ── HIGHLIGHT BEFORE EXPAND ────────────────────────────────
      if (!v.highlightAfter) {
        try {
          const h = await boostHighlights({ imageB64: current!, brightness: v.brightness })
          if (!h.success) throw new Error(h.errors?.[0] || 'highlight_failed')
          current = h.imageB64!
          system_log.push({ code: 200, stage: 'highlight', params: h.appliedParams })
        } catch (e: any) {
          system_log.push({ code: 500, stage: 'highlight', err: e.message })
        }
      }

      // ── EXPAND ────────────────────────────────────────────────
>>>>>>> parent of b3c68b3 (great results reset)
      if (v.expand !== false) {
        try {
          const expanded = await expandScene({
            imageB64: current!,
            openaiApiKey,
<<<<<<< HEAD
            expand: true,
          })

          if (!expanded.imageB64) throw new Error('no_output')

          current = expanded.imageB64

          system_log.push({ code: 200, stage: 'expand' })

=======
            expand:   v.expand,
          })
          if (!expanded.imageB64) throw new Error('no_output')
          current = expanded.imageB64
          system_log.push({ code: 200, stage: 'expand' })
          // capture square-validation warnings from expand
          if (expanded.warnings?.length) {
            expanded.warnings.forEach((w: string) =>
              system_log.push({ code: 0, stage: 'expand_warn', err: w })
            )
          }
>>>>>>> parent of b3c68b3 (great results reset)
        } catch (e: any) {
          system_log.push({ code: 500, stage: 'expand', err: e.message })
        }
      } else {
        system_log.push({ code: 0, stage: 'expand', err: 'skipped' })
      }
<<<<<<< HEAD

      // ── STAGE 4: EXPOSURE POST (BRIGHT MODES ONLY) ──────────
      if (exposureMode) {
        try {
          const corrected = await correctExposure({
            imageB64:        current!,
            lighting_preset: lightingPreset,
          })

          current = corrected.imageB64

          system_log.push({
            code: 200,
            stage: 'exposure_post',
            before: Math.round(corrected.before),
            after:  Math.round(corrected.after),
            mult:   corrected.multiplier.toFixed(2),
          })

        } catch (e: any) {
          system_log.push({ code: 500, stage: 'exposure_post', err: e.message })
        }
      } else {
        system_log.push({ code: 0, stage: 'exposure_post', err: 'skipped — dark mode' })
      }

      // ── STAGE 5: LEVELS (REDUCED STRENGTH — DO NOT BREAK LIGHTING) ─
      try {
        const leveled = await applyLevels({
          imageB64:        current!,
          brightness:      v.brightness,
          lighting_preset: lightingPreset,
        })

        if (!leveled.success) {
          throw new Error(leveled.errors?.[0] || 'levels_failed')
        }

        current = leveled.imageB64!

        system_log.push({ code: 200, stage: 'levels' })

      } catch (e: any) {
        system_log.push({ code: 500, stage: 'levels', err: e.message })
      }

      // ── STAGE 6: ANALYZE ───────────────────────────────────
      let analysis: { brightness: number; contrast: number } | null = null
=======
>>>>>>> parent of b3c68b3 (great results reset)

      // ── HIGHLIGHT AFTER EXPAND ─────────────────────────────────
      if (v.highlightAfter) {
        try {
          const h = await boostHighlights({ imageB64: current!, brightness: v.brightness })
          if (!h.success) throw new Error(h.errors?.[0] || 'highlight_failed')
          current = h.imageB64!
          system_log.push({ code: 200, stage: 'highlight_after', params: h.appliedParams })
        } catch (e: any) {
          system_log.push({ code: 500, stage: 'highlight_after', err: e.message })
        }
      }

      // ── ANALYSIS ──────────────────────────────────────────────
      let analysis: { brightness: number; contrast: number } | null = null
      try {
        analysis = await analyzeImage(current!)
<<<<<<< HEAD

        system_log.push({
          code: 200,
          stage: 'analyze',
          params: analysis,
        })

=======
        system_log.push({ code: 200, stage: 'analyze', params: analysis })
>>>>>>> parent of b3c68b3 (great results reset)
      } catch (e: any) {
        system_log.push({ code: 500, stage: 'analyze', err: e.message })
      }

      // ── DIAGNOSTICS ────────────────────────────────────────
      if (analysis) {
<<<<<<< HEAD
        const b = Math.round(analysis.brightness)
        const c = Math.round(analysis.contrast)

        if (analysis.brightness < 50) {
          render_log.push({ ok: false, msg: `image too dark — brightness ${b}` })
        } else if (analysis.brightness < 80) {
          render_log.push({ ok: true, msg: `dark mode — brightness ${b}` })
        } else if (analysis.brightness > 210) {
          render_log.push({ ok: false, msg: `overexposed — brightness ${b}` })
        } else {
          render_log.push({ ok: true, msg: `exposure good — brightness ${b}, contrast ${c}` })
        }

        if (analysis.contrast < 25) {
          render_log.push({ ok: false, msg: `low contrast ${c}` })
        }
=======
        if ((v.brightness ?? 1.18) > 1.2 && analysis.brightness < 120) {
          render_log.push({ ok: false, msg: 'sunshine effect not achieved — brightness suppressed downstream' })
        }
        if (analysis.brightness > 200) {
          render_log.push({ ok: false, msg: 'image overexposed — highlights blown, detail lost' })
        }
        if (analysis.contrast < 30) {
          render_log.push({ ok: false, msg: 'image appears flat — low contrast, no separation' })
        }
        if (analysis.contrast > 80) {
          render_log.push({ ok: false, msg: 'contrast too harsh — crushing shadows or blowing highlights' })
        }
        if (analysis.brightness >= 120 && analysis.brightness <= 180 && analysis.contrast >= 30) {
          render_log.push({ ok: true, msg: `exposure good — brightness ${Math.round(analysis.brightness)}, contrast ${Math.round(analysis.contrast)}` })
        }
      }

      if (v.expand !== false && !v.highlightAfter) {
        render_log.push({ ok: false, msg: 'expand ran after highlight — expand may have overridden lighting gains' })
      }
      if (v.expand !== false && v.highlightAfter) {
        render_log.push({ ok: true, msg: 'highlight applied after expand — lighting correction order is correct' })
      }
      if (v.expand === false) {
        render_log.push({ ok: true, msg: 'expand skipped — generate output is final, no stage conflict possible' })
>>>>>>> parent of b3c68b3 (great results reset)
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
