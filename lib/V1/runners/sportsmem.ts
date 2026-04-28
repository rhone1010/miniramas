// runners/sportsmem.ts
// lib/v1/runners/sportsmem.ts

import { generateStadiumTableau } from '@/lib/v1/sportsmem-generator'

export interface SportsmemRunResult {
  result: {
    image_b64:   string
    prompt_used: string
    plaque_text: string
    mode:        'memory'
  }
}

export async function runSportsmemGeneration(body: Record<string, unknown>): Promise<SportsmemRunResult> {
  const source_image_b64 = body.source_image_b64 as string
  const plaque_text = (body.plaque_text as string | undefined) ?? ''

  if (!source_image_b64) throw new Error('validation: source_image_b64 required')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set')

  const generated = await generateStadiumTableau({
    sourceImageB64: source_image_b64,
    mode:           'memory',
    plaqueText:     plaque_text,
    openaiApiKey,
  })

  return {
    result: {
      image_b64:   generated.imageB64,
      prompt_used: generated.promptUsed,
      plaque_text,
      mode:        'memory',
    },
  }
}
