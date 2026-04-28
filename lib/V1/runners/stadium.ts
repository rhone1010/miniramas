// runners/stadium.ts
// lib/v1/runners/stadium.ts

import { generateStadium } from '@/lib/v1/stadium-generator'
import { applyLevels }  from '@/lib/v1/levels'
import { expandScene }  from '@/lib/v1/expand'

export interface StadiumRunResult {
  result: {
    image_b64:   string
    prompt_used: string
    scene:       string | undefined
  }
}

export async function runStadiumGeneration(body: Record<string, unknown>): Promise<StadiumRunResult> {
  const source_image_b64 = body.source_image_b64 as string
  const scene = body.scene as string | undefined
  const notes = body.notes as string | undefined

  if (!source_image_b64) throw new Error('validation: source_image_b64 required')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set')

  const generated = await generateStadium({
    sourceImageB64: source_image_b64, scene, notes, openaiApiKey,
  })
  let current = generated.imageB64

  try {
    const leveled = await applyLevels({ imageB64: current, lighting_preset: scene })
    if (leveled.success && leveled.imageB64) current = leveled.imageB64
  } catch (e) { console.warn('[stadium-runner] levels:', (e as Error).message) }

  try {
    const expanded = await expandScene({ imageB64: current, openaiApiKey, expand: true })
    if (expanded.imageB64) current = expanded.imageB64
  } catch (e) { console.warn('[stadium-runner] expand:', (e as Error).message) }

  return { result: { image_b64: current, prompt_used: generated.promptUsed, scene } }
}
