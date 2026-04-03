import OpenAI, { toFile } from 'openai'

type Params = {
  landscaping?: string
  lighting?: string
  color?: string
  background?: string
  foreground?: string
  detail?: string
  structureBlock?: string
  customPrompt?: string
}

const MODIFIERS: Record<string, string> = {
  sparse_landscape:   `Landscaping is minimal with visible open ground.`,
  moderate_landscape: `Landscaping is balanced with shrubs and spacing.`,
  clean_daylight:     `Lighting is bright neutral daylight.`,
  strict_color:       `Preserve all facade color sections exactly.`,
  neutral_bg:         `Background is a soft neutral studio environment.`,
  light_foreground:   `Include subtle foreground elements with soft blur.`,
  standard_detail:    `Maintain clean readable detail.`,
  high_detail:        `High material fidelity and texture.`,
}

function buildPrompt(params: Params): string {
  if (params.customPrompt) return params.customPrompt

  return `
Create a realistic miniature diorama of the provided house.

COMPOSITION (MANDATORY):
The entire circular base must be fully visible.
Maintain clear space around the base on all sides.
The subject must not fill the frame edge-to-edge.
Keep visible breathing room around the diorama.
Even with landscaping, the base perimeter must remain fully visible.

STRUCTURE:
Preserve exact architecture, proportions, and silhouette.
${params.structureBlock ? `Use this structure analysis:\n${params.structureBlock}` : ''}

PROPERTY BALANCE:
The house occupies roughly 60–70% of the base.
Remaining space is landscaping with visible spacing.

LANDSCAPING:
${MODIFIERS[params.landscaping || 'moderate_landscape']}
Do not allow landscaping to eliminate margins.

LIGHTING:
${MODIFIERS[params.lighting || 'clean_daylight']}

COLOR:
${MODIFIERS[params.color || 'strict_color']}

BACKGROUND:
${MODIFIERS[params.background || 'neutral_bg']}

FOREGROUND:
${MODIFIERS[params.foreground || 'light_foreground']}

DETAIL:
${MODIFIERS[params.detail || 'high_detail']}

BASE:
Circular wooden base with visible thickness and edge.

CAMERA:
~40 degree elevated angle.
Slight zoom out to preserve margins.

FINAL CHECK:
If the base is cropped or margins are missing, adjust composition to restore full visibility.
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
    size: '1536x1024',
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('generate_failed')

  return { imageB64: b64, promptUsed: prompt }
}