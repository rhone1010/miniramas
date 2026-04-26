// sportsmem-generator.ts
// lib/v1/sportsmem-generator.ts
//
// Minimal gpt-image-1 edit call matching landscapes' shape:
//   openai.images.edit({ model, image, prompt, size: "1024x1024" })
// No input_fidelity. No quality override. No source padding.
// Margin is controlled by prompt ("base occupies 65-70% of image width"),
// same mechanism landscapes and structures use.

import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import { buildStadiumTableauPrompt, MiniramaMode } from './sportsmem-stadium-tableau'

export interface SportsMemGenerateInput {
  sourceImageB64: string
  mode?:          MiniramaMode
  plaqueText?:    string
  openaiApiKey:   string
}

export async function generateStadiumTableau(
  input: SportsMemGenerateInput
): Promise<{ imageB64: string; promptUsed: string }> {

  const prompt = buildStadiumTableauPrompt({
    sourceImageB64: input.sourceImageB64,
    mode:           input.mode || 'memory',
    plaqueText:     input.plaqueText,
  })

  console.log(`[sportsmem] mode=${input.mode || 'memory'} — prompt ${prompt.length} chars`)

  // EXIF-rotate the source so it arrives at gpt-image-1 in visual orientation
  const srcBuf  = Buffer.from(input.sourceImageB64, 'base64')
  const rotated = await sharp(srcBuf).rotate().png().toBuffer()

  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const file   = await toFile(rotated, 'source.png', { type: 'image/png' })

  const result = await openai.images.edit({
    model:  'gpt-image-1',
    image:  file,
    prompt,
    size:   '1024x1024',
  })

  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error('sportsmem_generation_failed')

  console.log(`[sportsmem] done`)
  return { imageB64: b64, promptUsed: prompt }
}
