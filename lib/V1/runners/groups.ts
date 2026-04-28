// runners/groups.ts
// lib/v1/runners/groups.ts
//
// Callable orchestration for the Groups product. Used by the route handler
// AND the queue cron worker.

import { runGroupPipeline } from '@/lib/v1/group-orchestrator'
import type { SceneStyle, SceneVariant } from '@/lib/v1/group-generator'
import { VARIANTS_BY_STYLE } from '@/lib/v1/group-generator'

const VALID_STYLES: SceneStyle[] = ['figurine', 'plushy', 'stop_motion', 'designer']

export interface GroupsRunResult {
  rejected?: boolean
  tier?:     string
  message?:  string
  result?: {
    image_b64:        string
    prompt_used:      string
    description:      string
    mood_summary:     string
    scene_style:      SceneStyle
    scene_variant:    SceneVariant
    attempts:         number
    quality_warning:  string | null
    warnings:         string[]
  }
}

export async function runGroupsGeneration(body: Record<string, unknown>): Promise<GroupsRunResult> {
  const sourceImageB64 = (body.source_image_b64 || body.image_b64) as string
  if (!sourceImageB64) throw new Error('validation: source_image_b64 required')

  const openaiApiKey    = process.env.OPENAI_API_KEY
  const replicateApiKey = process.env.REPLICATE_API_TOKEN
  if (!openaiApiKey)    throw new Error('OPENAI_API_KEY not set')
  if (!replicateApiKey) throw new Error('REPLICATE_API_TOKEN not set')

  const sceneStyle = (
    VALID_STYLES.includes(body.scene_style as SceneStyle) ? body.scene_style : 'figurine'
  ) as SceneStyle

  const validVariants = VARIANTS_BY_STYLE[sceneStyle].map((v) => v.key) as string[]
  const sceneVariant = (
    validVariants.includes(body.scene_variant as string) ? body.scene_variant : 'standard'
  ) as SceneVariant

  const result = await runGroupPipeline({
    sourceImageB64,
    openaiApiKey,
    replicateApiKey,
    skipBrandOverlay: body.skip_brand_overlay === true,
    skipScoring:      body.skip_scoring       === true,
    options: {
      plaqueTitle:  body.plaque_title as string | undefined,
      noPlaque:     body.no_plaque === true,
      sceneStyle,
      sceneVariant,
      notes:        body.notes as string | undefined,
      aspectRatio:  (body.aspect_ratio as '1:1' | undefined) ?? '1:1',
      resolution:   (body.resolution  as '1K'  | undefined) ?? '1K',
    },
  })

  if ('rejected' in result) {
    return { rejected: true, tier: result.tier, message: result.message }
  }

  return {
    result: {
      image_b64:       result.imageB64,
      prompt_used:     result.promptUsed,
      description:     result.description,
      mood_summary:    result.moodSummary,
      scene_style:     sceneStyle,
      scene_variant:   sceneVariant,
      attempts:        result.attempts,
      quality_warning: result.qualityWarning,
      warnings:        result.warnings,
    },
  }
}
