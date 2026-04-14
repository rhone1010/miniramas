import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING: DRAMATIC SPOTLIGHT — NOT BRIGHT DAYLIGHT
A single harsh spotlight from above illuminates the destruction — no ambient fill.
Harsh directional light creates extreme contrast — bright on rubble surfaces, deep black in shadow.
Dust particles catch the light dramatically. Collapsed sections fade into darkness.
The overall image is dark and shocking — light reveals destruction selectively and brutally.
`.trim()

const DISASTER = `
DISASTER: EXPLOSION DAMAGE
The house has suffered a catastrophic explosion — partial structural collapse.
One section of the roof and wall has been blown outward — exposed interior framing visible.
Debris scattered across the base: bricks, timber, shattered glass, broken furniture fragments.
A crater or impact point visible near the structure — scorched and cratered earth.
Remaining walls show blast damage — cracked, blackened, structurally compromised.
Windows blown out entirely. Doors hanging open or missing.
The scene is frozen in the immediate aftermath — dramatic, violent, shocking.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The room shows blast damage — cracked walls, plaster fallen from the ceiling, dust cloud settling.
The desk is partially covered in debris and dust. Pictures knocked from walls. Furniture overturned.
Harsh directional light through blown-out windows — rubble visible on the floor.
A sense of violent sudden destruction — everything frozen in the moment after impact.
The room belongs to the same destroyed house — same blast, same chaos, same raw devastation.
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

export async function generateExplosion(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Explosion done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
