// moments-generator.ts
// lib/v1/moments-generator.ts
//
// Minimal gpt-image-1 edit call — same shape as landscape-generator.
// No input_fidelity, no quality override. EXIF rotate, send, return.

import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import { buildMomentsPrompt } from './moments-prompt'

export interface MomentsGenerateInput {
  sourceImageB64: string
  notes?:         string
  openaiApiKey:   string
}

export async function generateMoments(
  input: MomentsGenerateInput
): Promise<{ imageB64: string; promptUsed: string }> {

  const prompt = buildMomentsPrompt({
    sourceImageB64: input.sourceImageB64,
    notes:          input.notes,
  })

  console.log(`[moments] prompt ${prompt.length} chars`)

  // EXIF-rotate the source so it arrives at gpt-image-1 in visual orientation
  const srcBuf  = Buffer.from(input.sourceImageB64, 'base64')
  const rotated = await sharp(srcBuf).rotate().png().toBuffer()

  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const file   = await toFile(rotated, 'source.png', { type: 'image/png' })

  const result = await openai.images.edit({
    model:           'gpt-image-1',
    image:           file,
    prompt,
    size:            '1024x1024',
    quality:         'high',
    input_fidelity:  'high',
  } as any)

  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error('moments_generation_failed')

  console.log(`[moments] done`)
  return { imageB64: b64, promptUsed: prompt }
}
