// lib/v1/portraits/portraits-gpt-image.ts
//
// gpt-image-1 generator path — formerly used by the Tribal styles, which
// are MIGRATING to the standalone Artist Series silo. No Portraits style
// currently routes here (see STYLE_PIPELINE — all generators are 'nb2').
// Kept on disk for the Artist Series migration; do not delete.
//
// Sends source photo(s) plus curated style-reference images to OpenAI's
// image-edit endpoint. gpt-image-1 weights the prompt heavily relative to
// source, producing the abstracted aesthetic that NB2 can't pull out of
// the prose alone.

import OpenAI, { toFile } from 'openai'

// ─── ASPECT → SIZE MAPPING ──────────────────────────────────────
// gpt-image-1 supports three sizes: 1024x1024, 1024x1536, 1536x1024.
// Map silo aspect ratios to the closest native size.
const ASPECT_TO_SIZE: Record<string, '1024x1024' | '1024x1536' | '1536x1024'> = {
  '1:1':  '1024x1024',
  '3:2':  '1536x1024',
  '2:3':  '1024x1536',
  '4:3':  '1536x1024',
  '3:4':  '1024x1536',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
}

function aspectToSize(aspectRatio: string): '1024x1024' | '1024x1536' | '1536x1024' {
  return ASPECT_TO_SIZE[aspectRatio] || '1024x1536'   // Portraits default: portrait
}

// ─── PRIMARY ENTRY POINT ────────────────────────────────────────

export async function callGptImage1(input: {
  prompt:              string
  sourceImageB64:      string
  additionalImagesB64: string[]
  styleReferenceB64s:  string[]    // can be curated + user-supplied, in order
  aspectRatio:         string
  openaiApiKey:        string
  quality?:            'low' | 'medium' | 'high'  // default 'medium'
}): Promise<string> {

  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  // Build the image input set. Source first, then aux, then style refs LAST.
  const allB64 = [
    input.sourceImageB64,
    ...(input.additionalImagesB64 || []),
    ...(input.styleReferenceB64s  || []),
  ].filter(Boolean)

  // gpt-image-1 caps total image inputs at 16. Cap defensively.
  const capped = allB64.slice(0, 16)

  // Convert base64 → Uploadable File-like objects expected by SDK.
  const files = await Promise.all(
    capped.map((b64, i) =>
      toFile(
        Buffer.from(b64, 'base64'),
        `image_${i}.jpg`,
        { type: 'image/jpeg' },
      ),
    ),
  )

  const size = aspectToSize(input.aspectRatio)
  const quality = input.quality || 'medium'

  console.log(
    `[portraits/generate] gpt-image-1 aspect=${input.aspectRatio} size=${size} quality=${quality} ` +
    `inputs=${capped.length} (source+aux=${1 + (input.additionalImagesB64?.length || 0)}, ` +
    `style_refs=${input.styleReferenceB64s?.length || 0}) ` +
    `prompt_chars=${input.prompt.length}`,
  )

  const response = await openai.images.edit({
    model:   'gpt-image-1',
    image:   files as any,
    prompt:  input.prompt,
    size,
    quality,    // medium ~$0.042; high ~$0.19; low ~$0.011
    n:       1,
  })

  const b64 = response.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-1 returned no image data')
  }
  return b64
}
