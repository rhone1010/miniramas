import OpenAI, { toFile } from 'openai'

type Params = {
  customPrompt?: string
}

function buildPrompt(params: Params): string {
  if (params.customPrompt) return params.customPrompt

  return `
Create a museum-quality architectural scale model (not a toy).

CRITICAL — STRUCTURE:
Preserve full architectural complexity with NO simplification:
- fine trim
- layered moldings
- window mullions
- railing spacing
- siding articulation
- roof transitions
Do not smooth, simplify, or reinterpret any structural detail.

CAMERA / FRAMING:
The camera is physically pulled back approximately 1.5 feet and raised 1 foot, tilted downward toward the diorama.
The camera moves in space (NOT zoom), increasing field of view.
This must naturally create margins and environmental context.
The subject should occupy approximately 60–65% of the frame width.
The subject must never approach the image edges.

MODEL:
The house is a hand-crafted, slightly satin (subtle sheen) architectural miniature.
It sits on a round wooden diorama base.

DIORAMA:
The base includes rich, tasteful landscaping:
- grass
- shrubs
- ground cover
- walkway
Trees frame the sides and rear of the scene.

SURFACE:
The diorama sits on a dark walnut desk with:
- visible wood grain
- realistic soft reflections
- high material fidelity

ENVIRONMENT:
The room must match the architecture of the house:
- similar trim language
- similar color palette
- similar window design

The room should feel like a real interior extension of the house.

FOCUS / DEPTH:
All elements of the diorama must be sharply detailed and in focus.
The surrounding room should exhibit depth of field.

LIGHTING:
Strong, clean natural daylight.
Bright highlights with no dull or gray lighting.
Maintain realistic contrast and material response.

CONSTRAINTS:
- No stylization
- No cartooning
- No simplification
- No tight cropping
- No scale distortion

FINAL:
This must read as a premium, realistic miniature photographed in a real environment with natural margins created by camera distance.
`.trim()
}

export async function generateDiorama(input: {
  sourceImageB64: string
  openaiApiKey: string
  params?: Params
}): Promise<{ imageB64: string; promptUsed: string }> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const prompt = buildPrompt(input.params || {})

  const file = await toFile(
    Buffer.from(input.sourceImageB64, 'base64'),
    'source.png',
    { type: 'image/png' }
  )

  const res = await openai.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt,
    size: '1024x1024'
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('generate_failed')

  return {
    imageB64: b64,
    promptUsed: prompt
  }
}