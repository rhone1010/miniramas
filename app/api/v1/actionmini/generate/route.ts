// actionmini-route.ts
// app/api/v1/actionmini/generate/route.ts
//
// Pipeline:
//   1. generate     — gpt-image-1 edit produces the diorama scene
//   2. applyLevels  — Landscapes-style mood-keyed global brightness lift
//   3. expandScene  — Stability outpaint for margins
//
// Mood-keyed lighting (bumped — closer to Landscapes summer 1.60×):
//   golden:   1.55× — warm afternoon abundance, was 1.35
//   dramatic: 1.30× — preserves moodiness but lifts subject, was 1.15
//   peaceful: 1.40× — gentle but visible lift, was 1.25
//   vivid:    1.65× — peak midday brightness, was 1.45

import { NextRequest, NextResponse } from 'next/server'
import { generateActionMini, ActionMiniPreset } from '@/lib/v1/actionmini-generator'
import { applyLevels } from '@/lib/v1/levels'
import { expandScene } from '@/lib/v1/expand'

const VALID_PRESETS: ActionMiniPreset[] = ['insitu', 'museum', 'collectable_card']

const ACTIONMINI_BRIGHTNESS_BY_MOOD: Record<string, number> = {
  golden:   1.55,
  dramatic: 1.30,
  peaceful: 1.40,
  vivid:    1.65,
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      source_image_b64,
      kinetic_medium         = 'whitewater',
      action_description     = '',
      freeze_moment_quality,
      hero                   = null,
      secondary_figures      = { count: 0, description: 'empty' },
      environment            = 'The diorama sits on neutral textured ground. Background is blurred natural environment with soft atmospheric light.',
      distinctive_features,
      source_lighting,
      display_name,
      preset                 = 'insitu',
      mood                   = 'golden',
      plaque_text,
      notes,
    } = body

    if (!source_image_b64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const normalizedPreset: ActionMiniPreset = VALID_PRESETS.includes(preset as ActionMiniPreset)
      ? (preset as ActionMiniPreset)
      : 'insitu'

    const clampedSec = {
      count: Math.max(0, Math.min(4, Number(secondary_figures?.count) || 0)),
      description: typeof secondary_figures?.description === 'string'
        ? secondary_figures.description
        : 'empty',
    }

    // ── STAGE 1: GENERATE ────────────────────────────────────────
    const generated = await generateActionMini({
      sourceImageB64:       source_image_b64,
      preset:               normalizedPreset,
      kineticMedium:        kinetic_medium,
      actionDescription:    action_description,
      freezeMomentQuality:  freeze_moment_quality,
      hero,
      secondaryFigures:     clampedSec,
      environment,
      distinctiveFeatures:  distinctive_features,
      sourceLighting:       source_lighting,
      displayName:          display_name,
      mood,
      plaqueText:           plaque_text,
      notes,
      openaiApiKey,
    })

    let current = generated.imageB64
    const appliedStages: string[] = ['generate']

    // ── STAGE 2: APPLY LEVELS ────────────────────────────────────
    try {
      const moodBrightness = ACTIONMINI_BRIGHTNESS_BY_MOOD[mood] ?? 1.50
      const leveled = await applyLevels({
        imageB64:        current,
        brightness:      moodBrightness,
        lighting_preset: 'actionmini',
      })
      if (leveled.success && leveled.imageB64) {
        current = leveled.imageB64
        appliedStages.push(`levels(${moodBrightness}×)`)
      }
    } catch (e: any) {
      console.warn('[actionmini-route] levels failed (non-fatal):', e.message)
    }

    // ── STAGE 3: EXPAND ──────────────────────────────────────────
    try {
      const expanded = await expandScene({
        imageB64:     current,
        openaiApiKey,
        expand:       true,
      })
      if (expanded.imageB64) {
        current = expanded.imageB64
        appliedStages.push('expand')
      }
      if (expanded.warnings?.length) {
        expanded.warnings.forEach((w: string) => console.warn('[actionmini-route] expand warn:', w))
      }
    } catch (e: any) {
      console.warn('[actionmini-route] expand failed (non-fatal):', e.message)
    }

    return NextResponse.json({
      result: {
        image_b64:       current,
        prompt_used:     generated.promptUsed,
        preset:          generated.preset,
        kinetic_medium,
        mood,
        display_name,
        plaque_text,
        applied_stages:  appliedStages,
      }
    })

  } catch (err: any) {
    console.error('[actionmini-route] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
