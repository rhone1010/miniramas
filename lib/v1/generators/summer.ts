import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const SEASON = `
SEASON: SUMMER
Lush full canopy trees frame the house in deep rich greens.
Dense layered landscaping — mature shrubs, flowering perennials, thick grass.
Warm golden light brings out vivid color in every surface.
Stone or brick pathway winds through full garden beds to the entrance.
The scene feels like a perfect summer afternoon — abundant, warm, alive.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
Dark walnut desk with visible grain and soft warm reflection.
The room is bright and warm — strong natural light through large windows.
The background room feels like it could be inside the house — same period and character.
Rich wood tones, natural light, perhaps a book or plant nearby.
Strong depth of field — diorama sharp, room recedes into warm bokeh.
`.trim()

function buildPrompt(params: BaseParams): string {
  if (params.customPrompt) {
    return params.manual_prompt?.trim()
      ? `${params.customPrompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
      : params.customPrompt
  }

  const prompt = `
${STRUCTURE_BLOCK}

${LIGHTING_BLOCK}

${SEASON}

${ROOM}

${SCALE_BLOCK}

${STYLE_BLOCK}

${CAMERA_BLOCK}
`.trim()

  return params.manual_prompt?.trim()
    ? `${prompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
    : prompt
}

export async function generateSummer(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt     = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Summer done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
