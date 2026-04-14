import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING: DRAMATIC SPOTLIGHT — NOT BRIGHT DAYLIGHT
Overcast sky with a single dramatic spotlight cutting through cloud cover from above.
The diorama is lit with strong directional light — surrounding area falls into grey shadow.
Water surfaces catch the light and reflect it — glinting highlights on the flood water.
The overall image is dark and heavy — oppressive grey atmosphere with spotlight focus.
`.trim()

const DISASTER = `
DISASTER: FLOOD
The house has been partially submerged in a flood event.
A visible waterline stains the lower walls — dark water damage marks clearly showing how high the water rose.
Standing water surrounds the base — reflective, murky, with floating debris: leaves, a broken shutter, mud.
The landscaping is destroyed — flattened, muddy, waterlogged. No flowers. No grass. Just waterlogged earth and debris.
Silt and mud coat the lower foundation and pathway.
The scene feels like the water has just begun to recede — eerie, still, devastated.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The desk surface has a thin film of water — reflective, slightly murky, with waterline stains on the desk legs.
The room itself shows flood damage: damp walls with water stain marks, a grey overcast light through foggy streaked windows.
Waterlogged floorboards or damp carpet visible. The room smells of must and river silt.
Furniture is displaced or damaged. The atmosphere is heavy, grey, and deeply unsettling.
The room feels like it belongs to the same flooded house — same damage, same devastation.
`.trim()

function buildPrompt(params: BaseParams): string {
  if (params.customPrompt) {
    return params.manual_prompt?.trim()
      ? `${params.customPrompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
      : params.customPrompt
  }
  const prompt = `
${STRUCTURE_BLOCK}

${LIGHTING_OVERRIDE}

${DISASTER}

${ROOM}

${SCALE_BLOCK}

${STYLE_BLOCK}

${CAMERA_BLOCK}
`.trim()
  return params.manual_prompt?.trim()
    ? `${prompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
    : prompt
}

export async function generateFlood(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Flood done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
