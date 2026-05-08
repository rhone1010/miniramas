import { BaseParams, GenerateResult, STRUCTURE_BLOCK, COMPOSITION_BLOCK, SCALE_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI , buildArchitectureBlock } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING: WIDE OVERHEAD WORK-LIGHT + FIRELIGHT
PRIMARY: A single broad overhead work-light — wide beam, warm amber-toned — floods the entire model from above and slightly to the left.
This work-light illuminates ALL surfaces of the model: every charred wall, every burnt timber, every broken window frame is clearly readable and textured.
The beam is wide enough to cover the entire structure — no part of the model is in darkness from lack of light.
SECONDARY: Warm orange-red fire glow emanates from within the structure — pulsing through windows, doorways, and gaps in the walls.
The fire glow adds deep amber warmth in harmony with the warm work-light — both orange-warm, creating a unified infernal glow.
Embers and sparks catch the work-light and glow visibly in the beams above the structure.
The model is the BRIGHTEST element in the frame — every surface fully lit and readable.
`.trim()

const DISASTER = `
DISASTER: FIRE — AFTERMATH
The fire raged hours ago. The building is partially destroyed, still smoldering.

CRITICAL — CHARRED SURFACES ARE DARK BROWN AND GREY, NOT BLACK:
Fire damage reads as rich dark brown, deep charcoal grey, and ash white under daylight — not flat black.
Every surface has visible texture and detail: wood grain readable in the charred siding, brick still showing coursework under soot, shingle texture visible on collapsed roof sections.
This is a detailed scale model — every material is visible and textured in the bright window light.
The model is NOT a silhouette. It reads clearly and with full surface detail.

DAMAGE DETAILS:
The roof has partially collapsed — exposed charred timber beams, skeletal and textured.
Some walls have burnt through entirely — large gaping holes revealing interior framing.
Remaining walls are deeply scorched — soot streaks upward from every opening, paint blistered and peeling.
Windows all blown out — frames warped, glass melted and shattered.
Small embers still glowing in the debris — tiny points of orange-red light visible in the wreckage.
Landscaping completely scorched — ash-grey ground, charred stumps where trees stood, black debris scattered across the base.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT — THE ROOM IS BURNING:
The room the diorama sits in has been consumed by the same fire — this is not a safe observer's room, this IS the fire scene.
One wall of the room has partially burnt through — a jagged hole reveals the night sky and silhouettes of scorched trees outside.
Orange-red firelight pulses from within the hole and from the smoldering wreckage around the model.
The ceiling above shows charred beams — blackened timber exposed where the plaster has fallen.
The desk itself is charred and blackened — fire-scorched wood grain, ash and embers on its surface.
A large pool of water from firefighting efforts covers part of the charred desk — perfectly still, reflecting the burning model above it, the reflection fragmented and beautiful.
Smoke drifts upward. Hot orange light from the fire illuminates everything from below and through the wall opening.
The room and the model exist in the same catastrophe — unified, total, devastating.
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
