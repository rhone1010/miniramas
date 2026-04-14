import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const SEASON = `
SEASON: WINTER
Bare branched trees with stark elegant silhouettes frame the house.
Light dusting of snow on the roof, base edge, and along the pathway.
Frost on the ground, muted cool tones, minimal landscaping.
The scene is quiet and still — clean, crisp, serene winter light.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
Dark walnut desk with a cool crisp reflection — clean and still.
The room is cool and quiet — clear winter light through the windows, pale and clean.
Perhaps a fireplace glow in the background. Simple, elegant, still.
The background room matches the house — same period, same quiet winter character.
Strong depth of field — diorama sharp, room recedes into cool pale bokeh.
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

export async function generateWinter(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt     = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Winter done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
