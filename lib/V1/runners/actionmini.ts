// runners/actionmini.ts
// lib/v1/runners/actionmini.ts

import {
  generateActionMini,
  ActionMiniPreset,
} from '@/lib/v1/actionmini-generator'
import { generateActionMiniCard } from '@/lib/v1/actionmini-card'
import { applyLevels }   from '@/lib/v1/levels'
import { expandScene }   from '@/lib/v1/expand'

const VALID_PRESETS: ActionMiniPreset[] = ['insitu', 'museum', 'collectable_card']

const ACTIONMINI_BRIGHTNESS_BY_MOOD: Record<string, number> = {
  golden:   1.55,
  dramatic: 1.30,
  peaceful: 1.40,
  vivid:    1.65,
}

export type ActionmineRunResult =
  | {
      result: {
        front_b64:     string
        back_b64:      string
        scene:         string
        mood:          string
        preset:        'collectable_card'
        artwork_style: string
        memory_text:   string
        kinetic_medium: string
      }
    }
  | {
      result: {
        image_b64:      string
        prompt_used:    string
        preset:         ActionMiniPreset
        kinetic_medium: string
        mood:           string
        display_name:   string
        plaque_text:    string
        applied_stages: string[]
      }
    }

export async function runActionminiGeneration(body: Record<string, unknown>): Promise<ActionmineRunResult> {
  const {
    source_image_b64,
    kinetic_medium       = 'whitewater',
    action_description   = '',
    freeze_moment_quality,
    hero                 = null,
    secondary_figures    = { count: 0, description: 'empty' },
    environment          = 'The action takes place in a natural outdoor setting with soft atmospheric light.',
    distinctive_features,
    source_lighting,
    display_name,
    preset               = 'insitu',
    mood                 = 'golden',
    plaque_text,
    memory_text,
    artwork_style        = '3d',
    notes,
  } = body as Record<string, string | undefined> & {
    secondary_figures?:   { count?: number; description?: string }
    hero?:                unknown
    freeze_moment_quality?: unknown
  }

  if (!source_image_b64) throw new Error('validation: source_image_b64 required')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set')

  const normalizedPreset: ActionMiniPreset = VALID_PRESETS.includes(preset as ActionMiniPreset)
    ? (preset as ActionMiniPreset)
    : 'insitu'

  const sf = (body.secondary_figures as { count?: number; description?: string } | undefined) ?? {}
  const clampedSec = {
    count: Math.max(0, Math.min(4, Number(sf.count) || 0)),
    description: typeof sf.description === 'string' ? sf.description : 'empty',
  }

  if (normalizedPreset === 'collectable_card') {
    const { frontB64, backB64 } = await generateActionMiniCard({
      sourceImageB64:      source_image_b64,
      kineticMedium:       kinetic_medium,
      actionDescription:   action_description,
      freezeMomentQuality: body.freeze_moment_quality,
      hero:                body.hero as never,
      secondaryFigures:    clampedSec,
      distinctiveFeatures: distinctive_features,
      environment,
      displayName:         display_name || 'Untitled',
      memoryText:          memory_text || '',
      mood:                mood as string,
      plaqueText:          (plaque_text as string) || '',
      artworkStyle:        artwork_style === 'impressionist' ? 'impressionist' : '3d',
      openaiApiKey,
    })
    return {
      result: {
        front_b64:      frontB64,
        back_b64:       backB64,
        scene:          display_name as string,
        mood:           mood as string,
        preset:         'collectable_card',
        artwork_style:  artwork_style as string,
        memory_text:    memory_text as string,
        kinetic_medium: kinetic_medium as string,
      },
    }
  }

  const generated = await generateActionMini({
    sourceImageB64:      source_image_b64,
    preset:              normalizedPreset,
    kineticMedium:       kinetic_medium,
    actionDescription:   action_description,
    freezeMomentQuality: body.freeze_moment_quality,
    hero:                body.hero as never,
    secondaryFigures:    clampedSec,
    environment,
    distinctiveFeatures: distinctive_features,
    sourceLighting:      source_lighting,
    displayName:         display_name,
    mood,
    plaqueText:          plaque_text,
    notes,
    openaiApiKey,
  })

  let current = generated.imageB64
  const appliedStages: string[] = ['generate']

  try {
    const moodBrightness = ACTIONMINI_BRIGHTNESS_BY_MOOD[mood as string] ?? 1.50
    const leveled = await applyLevels({
      imageB64:        current,
      brightness:      moodBrightness,
      lighting_preset: 'actionmini',
    })
    if (leveled.success && leveled.imageB64) {
      current = leveled.imageB64
      appliedStages.push(`levels(${moodBrightness}×)`)
    }
  } catch (e) {
    console.warn('[actionmini-runner] levels failed (non-fatal):', (e as Error).message)
  }

  try {
    const expanded = await expandScene({ imageB64: current, openaiApiKey, expand: true })
    if (expanded.imageB64) {
      current = expanded.imageB64
      appliedStages.push('expand')
    }
  } catch (e) {
    console.warn('[actionmini-runner] expand failed (non-fatal):', (e as Error).message)
  }

  return {
    result: {
      image_b64:       current,
      prompt_used:     generated.promptUsed,
      preset:          generated.preset,
      kinetic_medium:  kinetic_medium as string,
      mood:            mood as string,
      display_name:    display_name as string,
      plaque_text:     (plaque_text as string) ?? '',
      applied_stages:  appliedStages,
    },
  }
}
