import { BaseParams, GenerateResult, STRUCTURE_BLOCK, COMPOSITION_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI , buildArchitectureBlock } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING: OVERCAST FLOOD LIGHT — MUTED AND STILL
Soft overcast light — muted and heavy, filtering through grey clouds. Slightly warm undertone despite the gloom.
The water surface reflects the grey sky — dull silver-grey, catching any light that exists.
The ceiling light above glows dimly — its reflection visible in the still water below.
The model on the desk is the highest point of brightness — cool grey light falls on it from above.
Cold, still, silent — the light itself feels waterlogged.
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
ROOM AND ENVIRONMENT — THE ROOM IS SUBMERGED:
The flood has entered the room entirely — water fills the room right up to the bottom edge of the desktop surface.
The desk legs stand in flood water — murky brown-grey, opaque with silt, perfectly still.
Floating on the water surface around the desk: debris drifting slowly — a waterlogged book, a wooden chair leg, dead leaves, a child's toy, a picture frame face-down.
The water catches the grey overcast light and reflects it in dull, cold ripples.
The room walls show waterline stains climbing several feet — tide marks recording how much higher the water was.
Waterlogged curtains hang limp and heavy. Furniture is submerged or floating. A ceiling light still on — its reflection shimmering in the water below.
The model sits on the desk ABOVE the water line — the diorama is the only thing not submerged, making it even more poignant.
The room is silent, cold, and devastated — nature has claimed this space completely.
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

${COMPOSITION_BLOCK}
`.trim()
  // Inject architecture description if available
  const archBlock = params.architectureDescription?.trim()
    ? buildArchitectureBlock(params.architectureDescription)
    : null
  const finalPrompt = archBlock
    ? prompt.replace(STRUCTURE_BLOCK, STRUCTURE_BLOCK + '\n\n' + archBlock)
    : prompt

  return params.manual_prompt?.trim()
    ? `${finalPrompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
    : finalPrompt
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
