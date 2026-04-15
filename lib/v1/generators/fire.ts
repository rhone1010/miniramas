import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING — IGNORE ALL SOURCE IMAGE LIGHTING COMPLETELY:
A single overhead spotlight of extreme intensity — as bright as direct sunlight — illuminates the diorama from above.
The spotlight bleaches the highest surfaces near-white and casts hard crisp shadows straight down.
The falloff is dramatic but gradual — bright top, strong shadow at sides, soft ambient at the base.
The overall diorama reads like an overcast bright day — fully readable in all detail, not dim, not nighttime.
The room ambient is warm smoky amber — like looking through haze at a fire in the distance.
The diorama is the brightest element in the frame — lit like a stage set, the rest of the room in shadow.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT — THE ROOM IS THE INSIDE OF THE BURNT HOUSE:
The room the diorama sits in has itself been damaged by the same fire — charring on walls, burnt window frames, smoke haze.
Strong directional shadows from the overhead spotlight fall across the room walls — dramatic but fully readable.
The desk surface is charred like a burnt log — black, deeply textured with fire damage, grain still visible in places like islands.
A large puddle of water covers part of the charred desk — perfectly reflecting the burnt diorama above, fragmented and beautiful.
The room is warm amber and smoky — same fire-damaged environment as the model, just larger and more ruined.
`.trim()

const DISASTER = `
DISASTER: FIRE — AFTERMATH
The fire raged hours ago. The building is partially destroyed, still smoldering.
Small fires still burning in sections — orange embers glowing through collapsed walls.
The roof has partially collapsed — exposed charred timber beams, black and skeletal.
Some walls have burnt through entirely — large gaping holes revealing charred timbers at skewed angles.
Remaining walls deeply charred, blackened, soot streaking upward from every opening.
Windows all blown out — dark void frames with melted and shattered glass remnants.
Landscaping completely scorched — black ash covering everything, charred stumps where trees stood.
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
