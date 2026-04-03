import { NextRequest, NextResponse } from 'next/server'
import { generateDiorama } from '@/lib/v1/generate'
import { boostHighlights } from '@/lib/v1/highlight'
import { expandScene }     from '@/lib/v1/expand'
import { analyzeImage }    from '@/lib/v1/analyze'

export async function POST(req: NextRequest) {
  try {
    const body          = await req.json()
    const sourceImageB64: string = body.source_image_b64
    const variants      = body.variants || [{ name: 'default' }]

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const results = []

    for (const v of variants) {
      const system_log: any[] = []
      const render_log: any[] = []
      let current: string | null = null
      let promptUsed  = ''

      // ── GENERATE ────────────────────────────────────────────
      try {
        const generated = await generateDiorama({
          sourceImageB64,
          openaiApiKey,
          params: v,
        })
        if (!generated.imageB64) throw new Error('no_output')
        current    = generated.imageB64
        promptUsed = generated.promptUsed
        system_log.push({ code: 200, stage: 'generate' })
      } catch (e: any) {
        system_log.push({ code: 500, stage: 'generate', err: e.message })
        results.push({
          name: v.name, image_b64: null,
          render_log: [], system_log,
          fatal_error: 'generate failed: ' + e.message,
          prompt_used: '', params: v,
        })
        continue
      }

      // ── HIGHLIGHT BEFORE EXPAND ──────────────────────────────
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

      // ── EXPAND ───────────────────────────────────────────────
      if (v.expand !== false) {
        try {
          const expanded = await expandScene({
            imageB64: current!,
            openaiApiKey,
            expand: v.expand,
            forceNeutralDaylight: v.forceNeutralDaylight,
            interiorLighting: v.interiorLighting,
          })
          if (!expanded.success || !expanded.imageB64) throw new Error(expanded.errors?.[0] || 'no_output')
          current = expanded.imageB64
          system_log.push({ code: 200, stage: 'expand', params: expanded.appliedParams })
          if (expanded.warnings?.length) {
            expanded.warnings.forEach(w => system_log.push({ code: 0, stage: 'expand_warn', err: w }))
          }
        } catch (e: any) {
          system_log.push({ code: 500, stage: 'expand', err: e.message })
        }
      } else {
        system_log.push({ code: 0, stage: 'expand', err: 'skipped' })
      }

      // ── HIGHLIGHT AFTER EXPAND ───────────────────────────────
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

      // ── ANALYSIS ────────────────────────────────────────────
      let analysis: { brightness: number; contrast: number } | null = null
      try {
        analysis = await analyzeImage(current!)
        system_log.push({ code: 200, stage: 'analyze', params: analysis })
      } catch (e: any) {
        system_log.push({ code: 500, stage: 'analyze', err: e.message })
      }

      // ── RENDER DIAGNOSTICS ──────────────────────────────────
      if (analysis) {
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
      }

      if (v.promptComplexity === 'minimal' || v.promptComplexity === 'reduced') {
        render_log.push({ ok: false, msg: `reduced prompt used (${v.promptComplexity}) — structure and color constraints may be weak` })
      }
      if (v.colorLockStrength === 'none') {
        render_log.push({ ok: false, msg: 'color lock disabled — facade segmentation and palette may drift' })
      }

      if (render_log.length === 0) {
        render_log.push({ ok: true, msg: 'no major issues detected' })
      }

      results.push({
        name:        v.name,
        image_b64:   current,
        render_log,
        system_log,
        fatal_error: null,
        prompt_used: promptUsed,
        params:      v,
      })
    }

    return NextResponse.json({ results })

  } catch (err: any) {
    return NextResponse.json({ error: err.message, fatal_error: true }, { status: 500 })
  }
}
