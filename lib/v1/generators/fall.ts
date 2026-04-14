import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const SEASON = `
SEASON: FALL
Trees ablaze with amber, orange, and deep red foliage.
Fallen leaves scattered across the base and pathway.
Warm golden directional light rakes across surfaces — long soft shadows.
Dried flower stalks, ornamental grasses, late-season mums in rust and gold.
The scene feels like peak autumn — rich, warm, deeply beautiful.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
Dark walnut desk glowing with warm amber reflection from the autumn light.
The room is cozy and warm — golden afternoon light pours through the windows.
Perhaps a candle, a wool throw, warm-toned furnishings. Deeply comfortable.
The background room matches the house — same period, same autumn warmth.
Strong depth of field — diorama sharp, room recedes into amber bokeh.
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

export async function generateFall(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt     = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Fall done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
