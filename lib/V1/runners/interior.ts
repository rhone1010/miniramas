// runners/interior.ts
// lib/v1/runners/interior.ts

import { generateInterior } from '@/lib/v1/interior-generator'
import { applyLevels }  from '@/lib/v1/levels'
import { expandScene }  from '@/lib/v1/expand'

export interface InteriorRunResult {
  result: {
    image_b64:   string
    prompt_used: string
    scene:       string | undefined
  }
}

export async function runInteriorGeneration(body: Record<string, unknown>): Promise<InteriorRunResult> {
  const source_image_b64 = body.source_image_b64 as string
  const scene = body.scene as string | undefined
  const notes = body.notes as string | undefined

  if (!source_image_b64) throw new Error('validation: source_image_b64 required')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set')

  const generated = await generateInterior({
    sourceImageB64: source_image_b64, scene, notes, openaiApiKey,
  })
  let current = generated.imageB64

  try {
    const leveled = await applyLevels({ imageB64: current, lighting_preset: scene })
    if (leveled.success && leveled.imageB64) current = leveled.imageB64
  } catch (e) { console.warn('[interior-runner] levels:', (e as Error).message) }

  try {
    const expanded = await expandScene({ imageB64: current, openaiApiKey, expand: true })
    if (expanded.imageB64) current = expanded.imageB64
  } catch (e) { console.warn('[interior-runner] expand:', (e as Error).message) }

  return { result: { image_b64: current, prompt_used: generated.promptUsed, scene } }
}
