// runners/moments.ts
// lib/v1/runners/moments.ts

import { generateMoments } from '@/lib/v1/moments-generator'

export interface MomentsRunResult {
  result: {
    image_b64:   string
    prompt_used: string
    notes:       string
  }
}

export async function runMomentsGeneration(body: Record<string, unknown>): Promise<MomentsRunResult> {
  const source_image_b64 = body.source_image_b64 as string
  const notes = (body.notes as string | undefined) ?? ''

  if (!source_image_b64) throw new Error('validation: source_image_b64 required')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set')

  const generated = await generateMoments({
    sourceImageB64: source_image_b64,
    notes,
    openaiApiKey,
  })

  return {
    result: {
      image_b64:   generated.imageB64,
      prompt_used: generated.promptUsed,
      notes,
    },
  }
}
