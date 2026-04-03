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
  // pipeline params used by route.ts
  brightness?: number
  expand?: boolean
  highlightAfter?: boolean
  expandPadding?: number
  name?: string
  _preset?: string
  _expStr?: string
}

const MODIFIERS: Record<string, string> = {
  sparse_landscape:    `Landscaping is minimal and restrained with sparse plant placement, visible soil, and open ground.`,
  moderate_landscape:  `Landscaping is balanced with shrubs, flowers, and some open space.`,
  lush_landscape:      `Landscaping is dense, layered, and full with abundant flowers, shrubs, and ground cover.`,
  overgrown_landscape: `Landscaping is heavily overgrown with dense vegetation and a wild appearance.`,
  flat_light:          `Lighting is soft and even with minimal contrast.`,
  clean_daylight:      `Lighting is bright neutral daylight with clear highlights and natural contrast.`,
  high_pop_light:      `Lighting has strong highlights, crisp contrast, and bright edge reflections.`,
  strict_color:        `Preserve all facade color sections exactly with no blending.`,
  enhanced_color:      `Enhance color separation while preserving original tones.`,
  loose_color:         `Allow slight color interpretation while keeping palette consistent.`,
  neutral_bg:          `Background is a soft neutral studio environment.`,
  matched_bg:          `Background subtly reflects the colors and tones of the house.`,
  rich_interior_bg:    `Background is a softly blurred interior environment.`,
  no_foreground:       `No foreground objects are present.`,
  light_foreground:    `Include subtle foreground elements with soft blur.`,
  strong_foreground:   `Include clear foreground objects that frame the scene.`,
  standard_detail:     `Maintain clean readable detail.`,
  high_detail:         `Include high material fidelity and texture.`,
  hyper_detail:        `Extremely high detail with micro-texture and sharp definition.`,
}

function buildPrompt(params: Params): string {
  if (params.customPrompt) return params.customPrompt

  return `
Create a realistic miniature diorama of the provided house.

STRUCTURE:
Preserve exact architecture, proportions, and silhouette.
${params.structureBlock ? `Use this structure analysis:\n${params.structureBlock}` : ''}

LANDSCAPING:
${MODIFIERS[params.landscaping || 'moderate_landscape']}

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
Circular wooden base with visible thickness.

CAMERA:
~40 degree elevated angle, macro depth of field.
`.trim()
}

export async function generateDiorama(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params?:        Params
}): Promise<{ imageB64: string; promptUsed: string }> {
  const openai  = new OpenAI({ apiKey: input.openaiApiKey })
  const prompt  = buildPrompt(input.params || {})

  const file = await toFile(
    Buffer.from(input.sourceImageB64, 'base64'),
    'source.png',
    { type: 'image/png' }
  )

  const res = await openai.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt,
    size:  '1536x1024',
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('generate_failed')

  console.log('[generate] Done — 1536x1024')
  return { imageB64: b64, promptUsed: prompt }
}
