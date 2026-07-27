// lib/v1/groups/groups-gpt-image.ts
//
// gpt-image-1 generator path — used by Tribal styles where source fidelity
// is intentionally NOT preserved. Sends the source photo(s) plus curated
// style-reference images as a multi-image input to OpenAI's image-edit
// endpoint. gpt-image-1 weights the prompt heavily relative to source,
// producing the abstracted aesthetic the prose alone can't pull out of NB2.

import OpenAI, { toFile } from 'openai'

// ─── ASPECT → SIZE MAPPING ──────────────────────────────────────
// gpt-image-1 supports three sizes: 1024x1024, 1024x1536, 1536x1024.
// We map the silo's aspect ratios to the closest native size.
const ASPECT_TO_SIZE: Record<string, '1024x1024' | '1024x1536' | '1536x1024'> = {
  '1:1':  '1024x1024',
  '3:2':  '1536x1024',
  '4:3':  '1536x1024',  // no native 4:3 — use landscape
  '5:4':  '1536x1024',  // no native 5:4 — use landscape
  '16:9': '1536x1024',
  '3:4':  '1024x1536',  // no native 3:4 — use portrait
  '4:5':  '1024x1536',  // no native 4:5 — use portrait
  '9:16': '1024x1536',
}

function aspectToSize(aspectRatio: string): '1024x1024' | '1024x1536' | '1536x1024' {
  return ASPECT_TO_SIZE[aspectRatio] || '1024x1024'
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

  // Build the image input set. Order matters: source first, then aux source
  // photos, then style references LAST. The prompt directive in
  // STYLE_REFERENCE_DIRECTIVE tells the model that the trailing reference
  // images supply aesthetic, not subjects.
  const allB64 = [
    input.sourceImageB64,
    ...(input.additionalImagesB64 || []),
    ...(input.styleReferenceB64s  || []),
  ].filter(Boolean)

  // gpt-image-1 caps total image inputs at 16 per request. Cap defensively.
  const capped = allB64.slice(0, 16)

  // Convert base64 strings → Uploadable File-like objects expected by SDK.
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
    `[groups/generate] gpt-image-1 aspect=${input.aspectRatio} size=${size} quality=${quality} ` +
    `inputs=${capped.length} (source+aux=${1 + (input.additionalImagesB64?.length || 0)}, ` +
    `style_refs=${input.styleReferenceB64s?.length || 0}) ` +
    `prompt_chars=${input.prompt.length}`,
  )

  const response = await openai.images.edit({
    model:   'gpt-image-1',
    image:   files as any,    // SDK type allows File | File[]
    prompt:  input.prompt,
    size,
    quality,    // medium default ~$0.042; 'high' ~$0.19, 'low' ~$0.011
    n:       1,
  })

  const b64 = response.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-1 returned no image data')
  }
  return b64
}
