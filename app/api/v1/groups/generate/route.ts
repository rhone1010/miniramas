// app/api/v1/groups/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { runGroupPipeline } from '@/lib/v1/group-orchestrator'
import type { SceneStyle, SceneVariant } from '@/lib/v1/group-generator'
import { VARIANTS_BY_STYLE } from '@/lib/v1/group-generator'

const VALID_STYLES: SceneStyle[] = ['figurine', 'plushy', 'stop_motion', 'designer']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sourceImageB64: string = body.source_image_b64 || body.image_b64

    if (!sourceImageB64) {
      return NextResponse.json({ error: 'source_image_b64 required' }, { status: 400 })
    }

    const sceneStyle = (
      VALID_STYLES.includes(body.scene_style) ? body.scene_style : 'figurine'
    ) as SceneStyle

    // Validate variant against this style's variant list
    const validVariants = VARIANTS_BY_STYLE[sceneStyle].map(v => v.key)
    const sceneVariant = (
      validVariants.includes(body.scene_variant)
        ? body.scene_variant
        : 'standard'
    ) as SceneVariant

    const openaiApiKey    = process.env.OPENAI_API_KEY
    const replicateApiKey = process.env.REPLICATE_API_TOKEN

    if (!openaiApiKey)    return NextResponse.json({ error: 'OPENAI_API_KEY not set' },      { status: 500 })
    if (!replicateApiKey) return NextResponse.json({ error: 'REPLICATE_API_TOKEN not set' }, { status: 500 })

    const result = await runGroupPipeline({
      sourceImageB64,
      openaiApiKey,
      replicateApiKey,
      skipBrandOverlay: body.skip_brand_overlay === true,
      skipScoring:      body.skip_scoring       === true,
      options: {
        plaqueTitle:  body.plaque_title,
        noPlaque:     body.no_plaque === true,
        sceneStyle,
        sceneVariant,
        notes:        body.notes,
        aspectRatio:  body.aspect_ratio || '1:1',
        resolution:   body.resolution   || '1K',
      },
    })

    if ('rejected' in result) {
      return NextResponse.json(
        { rejected: true, tier: result.tier, message: result.message },
        { status: 400 },
      )
    }

    return NextResponse.json({
      result: {
        image_b64:        result.imageB64,
        prompt_used:      result.promptUsed,
        description:      result.description,
        mood_summary:     result.moodSummary,
        scene_style:      sceneStyle,
        scene_variant:    sceneVariant,
        attempts:         result.attempts,
        quality_warning:  result.qualityWarning,
        warnings:         result.warnings,
      },
    })

  } catch (err: any) {
    console.error('[groups/generate]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
