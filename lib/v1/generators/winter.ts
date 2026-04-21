import { BaseParams, GenerateResult, STRUCTURE_BLOCK, COMPOSITION_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, buildSeasonPrompt, prepareSourceImage, callGenerateAPI } from './base'

const SEASON = `
SEASON: WINTER
Bare branched trees with stark elegant silhouettes — no foliage.
Light dusting of snow on the roof, base edge, and along the pathway.
Frost on the ground, muted cool tones, minimal ground vegetation.
The landscape is quiet and still — clean, crisp, serene.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The diorama sits on a large dark walnut desk — the desk surface extends well beyond the base in every direction.
A hardcover book lies open to the left of the diorama. Reading glasses rest folded to the right.
A small lamp with a warm amber shade glows behind — its warmth contrasting with the cool winter light from the window.
The desk surface has a cool, crisp reflection — the snowy diorama mirrored in polished wood.
The room beyond is quiet and still — pale winter light through windows, softly out of focus.
The diorama is a small precious object on a large desk — the camera pulls back to show the whole scene.
`.trim()

const LANDSCAPE = `
PROPERTY & LANDSCAPE — FORMAL SYMMETRICAL GARDEN:
The property is designed with precision and classic taste — every element intentional, nothing out of place.

FLANKING TREES:
A well-shaped ornamental tree stands approximately 15 feet to the right — pyramidal conifer, clipped evergreen, or Japanese maple in a precise, architectural form.
A matching tree of slightly greater scale stands approximately 20 feet to the left — same species, equally maintained, creating a formal frame.
Both trees are immaculately kept — their forms are part of the design composition.

GARDEN DESIGN — NEAT FORMAL STYLE:
Clipped boxwood hedging defines bed edges with clean geometric lines — ruler-straight, perfectly maintained.
Matching shrubs or topiaries flank the front walk and porch steps in symmetrical pairs.
The front walk is centered and formal — straight, well-defined, in brick or bluestone with tight joints and sharp edges.
Beds are filled with structured plantings: clipped standard roses, formal hydrangeas, or cone-shaped evergreens in orderly arrangement.
The lawn is immaculate — even stripes visible, edges razor-trimmed against all bed borders.
The overall feeling: refined, established, and beautifully composed — a home of genuine taste.
`.trim()

function buildPrompt(params: BaseParams): string {
  if (params.customPrompt) {
    return params.manual_prompt?.trim()
      ? `${params.customPrompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
      : params.customPrompt
  }
  return buildSeasonPrompt([
    STRUCTURE_BLOCK,
    LIGHTING_BLOCK,
    // INTERIOR_LIGHTS_BLOCK injected here automatically if interiorLights !== false
    SEASON,
    ROOM,
    LANDSCAPE,
    SCALE_BLOCK,
    STYLE_BLOCK,
    COMPOSITION_BLOCK,
  ], params)
}

export async function generateWinter(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Winter done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
