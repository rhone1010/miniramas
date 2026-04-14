import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING: DRAMATIC SPOTLIGHT — NOT BRIGHT DAYLIGHT
This is NOT a sunny daytime scene. Use a single dramatic spotlight source from above.
Strong directional light illuminates key areas — bright lit zones fade into deep shadow.
Unlit areas fall into near-darkness. High contrast between highlights and shadow.
The overall image reads as dark and moody — light reveals selectively, not universally.
Glowing embers and small residual fires provide warm orange accent light from within.
`.trim()

const DISASTER = `
DISASTER: FIRE — AFTERMATH
The fire raged hours ago. The building is partially destroyed, still smoldering.
Small fires still burning in sections — orange embers glowing through collapsed walls.
The roof has partially collapsed — exposed charred timber beams, black and skeletal.
Some walls have burnt through entirely — open holes revealing dark interior beyond.
Remaining walls are deeply charred, blackened, with soot streaking upward from every opening.
Windows are all blown out — dark void frames with melted and shattered glass remnants.
Twisted metal, collapsed sections, and structural failure visible throughout.
The landscaping is completely scorched — black ash covering everything, charred stumps.
A sense of violent recent destruction — raw, devastating, still hot.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The room itself has suffered fire damage — smoke-blackened walls, ash on every surface.
Ember-orange light spills through the windows from the still-burning sections of the house.
The desk surface is coated in fine ash. Burnt furniture fragments visible in background.
The room is dim and smoky — dramatic spotlight catches the diorama from above.
Deep shadows surround the scene. The room feels like it belongs to the same destroyed house.
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

export async function generateFire(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Fire done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
