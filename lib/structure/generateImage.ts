// lib/structure/generateImage.ts
// Destination: lib/structure/generateImage.ts
//
// All generation via gpt-image-1 using images.edit().
// Replicate removed entirely.
// Pass 1: source image only.
// Pass 2+: source image + previous pass output (continuity).

import OpenAI, { toFile } from 'openai'

export type GenerationModel = 'gpt-image-1'

export interface GenerateInput {
  prompt:            string
  model:             GenerationModel
  sourceImageB64:    string     // REQUIRED — primary ground truth, always first
  extraImagesB64?:   string[]   // optional — additional views (from lab source_images[1+])
  previousImageB64?: string     // optional — previous pass output for continuity, always last
  openaiApiKey:      string
}

export interface GenerateResult {
  image_b64:  string
  model_used: GenerationModel
  mode:       'image-to-image'
}

export async function generateImage(input: GenerateInput): Promise<GenerateResult> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  // Image order: source (ground truth) → extra views → previous pass (continuity)
  const sourceFile = await toFile(
    Buffer.from(input.sourceImageB64, 'base64'),
    'source.png',
    { type: 'image/png' }
  )

  const imageFiles: Awaited<ReturnType<typeof toFile>>[] = [sourceFile]

  if (input.extraImagesB64?.length) {
    for (let i = 0; i < input.extraImagesB64.length; i++) {
      imageFiles.push(await toFile(
        Buffer.from(input.extraImagesB64[i], 'base64'),
        `view_${i + 2}.png`,
        { type: 'image/png' }
      ))
    }
  }

  if (input.previousImageB64) {
    imageFiles.push(await toFile(
      Buffer.from(input.previousImageB64, 'base64'),
      'previous.png',
      { type: 'image/png' }
    ))
  }

  // Single image: pass directly (not array) — gpt-image-1 requirement
  const images = imageFiles.length === 1 ? imageFiles[0] : imageFiles

  const response = await openai.images.edit({
    model:      'gpt-image-1',
    image:      images as any,
    prompt:     input.prompt,
    n:          1,
    size:       '1024x1024',
    quality:    'high',
    background: 'transparent',
  })

  const b64 = response.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-1 returned no image data')
  }

  return {
    image_b64:  b64,
    model_used: 'gpt-image-1',
    mode:       'image-to-image',
  }
}
