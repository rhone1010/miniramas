import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING: DRAMATIC SPOTLIGHT — NOT BRIGHT DAYLIGHT
This is NOT a sunny scene. A single dramatic spotlight from above illuminates the diorama.
Strong light hits key structural elements — the rest falls into deep moody shadow.
Shafts of light catch dust particles. Deep shadow fills corners and unlit sections.
Overgrown areas catch dappled light through broken canopy — uneven, atmospheric, haunting.
The overall image is dark, with the spotlight revealing selective detail only.
`.trim()

const DISASTER = `
DISASTER: ABANDONED — DECADES OF DECAY
The house has been abandoned for 20-30 years. Nature has taken over completely.
Thick vines and ivy consume every wall surface — crawling through every gap and crack.
The roof has partially collapsed in sections — holes exposing dark interior sky.
Windows are all broken — jagged glass fragments, dark empty frames choked with vines.
Porch railings rotted and fallen. Front steps broken and tilted. Door hanging open or missing.
Exterior paint entirely gone — bare weathered wood, stained and warped.
Sections of siding have fallen away — bare rotted sheathing visible beneath.
The landscaping is completely consumed — wild growth, dead trees, chest-high weeds.
The pathway is buried under vegetation. The house is being swallowed by the earth.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The room is forgotten — thick dust on every surface, cobwebs across the corners.
Peeling wallpaper hanging in strips. Floorboards warped and buckled.
Broken furniture, tipped over or collapsed. A mirror cracked and clouded with age.
Cold grey light filters through grime-covered broken windows — barely illuminating anything.
The room feels like time stopped decades ago — eerie, deeply melancholic, beautiful in decay.
The spotlight cuts through the dimness and catches only the diorama — everything else in shadow.
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

export async function generateAbandoned(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Abandoned done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
