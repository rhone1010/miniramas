// runners/landscapes.ts
// lib/v1/runners/landscapes.ts

import { generateLandscape, generateCollectableCard } from '@/lib/v1/landscape-generator'
import { applyLevels } from '@/lib/v1/levels'
import { expandScene } from '@/lib/v1/expand'
import { applyPlaque } from '@/lib/v1/plaque'

export type LandscapesRunResult =
  | {
      result: {
        front_b64:     string
        back_b64:      string
        scene:         string
        mood:          string
        presentation:  'collectable_card'
        artwork_style: string
        memory_text:   string
      }
    }
  | {
      result: {
        image_b64:        string
        prompt_used:      string
        scene:            string
        character_source: string | undefined
        mood:             string
        presentation:     string
      }
    }

export async function runLandscapesGeneration(body: Record<string, unknown>): Promise<LandscapesRunResult> {
  const {
    source_image_b64,
    extra_images          = [],
    scene_description,
    viewing_direction,
    memory_text,
    environment,
    character_source,
    distinctive_features,
    primary_subject,
    display_name,
    mood              = 'golden',
    presentation      = 'insitu',
    scale_feel        = 'intimate',
    notes,
    plaque_text,
    plaque_shape      = 'rectangular',
    artwork_style     = '3d',
  } = body as Record<string, string | undefined> & {
    extra_images?:        string[]
    artwork_style?:       string
  }

  if (!source_image_b64) throw new Error('validation: source_image_b64 required')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set')

  if (presentation === 'collectable_card') {
    const { frontB64, backB64 } = await generateCollectableCard({
      sourceImageB64:      source_image_b64,
      sceneDesc:           scene_description || '',
      viewingDirection:    viewing_direction || '',
      distinctiveFeatures: distinctive_features || '',
      primarySubject:      primary_subject || '',
      memoryText:          memory_text || '',
      displayName:         display_name || 'Untitled',
      mood:                mood as string,
      plaqueText:          (plaque_text as string) || '',
      artworkStyle:        artwork_style === 'impressionist' ? 'impressionist' : '3d',
      openaiApiKey,
    })
    return {
      result: {
        front_b64:     frontB64,
        back_b64:      backB64,
        scene:         display_name as string,
        mood:          mood as string,
        presentation:  'collectable_card',
        artwork_style: artwork_style as string,
        memory_text:   memory_text as string,
      },
    }
  }

  const generated = await generateLandscape({
    sourceImageB64:      source_image_b64,
    extraImages:         (extra_images as string[]) ?? [],
    sceneDescription:    scene_description,
    viewingDirection:    viewing_direction,
    environment,
    characterSource:     character_source,
    distinctiveFeatures: distinctive_features,
    primarySubject:      primary_subject,
    displayName:         display_name,
    mood,
    presentation,
    scaleFeel:           scale_feel,
    notes,
    openaiApiKey,
  })
  let current = generated.imageB64

  try {
    const leveled = await applyLevels({ imageB64: current, lighting_preset: 'landscape' })
    if (leveled.success && leveled.imageB64) current = leveled.imageB64
  } catch (e) {
    console.warn('[landscapes-runner] levels failed:', (e as Error).message)
  }

  try {
    const expanded = await expandScene({ imageB64: current, openaiApiKey, expand: true })
    if (expanded.imageB64) current = expanded.imageB64
  } catch (e) {
    console.warn('[landscapes-runner] expand failed:', (e as Error).message)
  }

  if (plaque_text && plaque_text.trim()) {
    try {
      current = await applyPlaque({
        imageB64:  current,
        text:      plaque_text,
        shape:     plaque_shape as 'rectangular' | 'curved' | 'victorian',
        integrate: true,
        openaiApiKey,
      })
    } catch (e) {
      console.warn('[landscapes-runner] plaque failed:', (e as Error).message)
    }
  }

  return {
    result: {
      image_b64:        current,
      prompt_used:      generated.promptUsed,
      scene:            display_name as string,
      character_source,
      mood:             mood as string,
      presentation:     presentation as string,
    },
  }
}
