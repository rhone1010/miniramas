import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'
import { getLandscaping } from './landscaping'

const LIGHTING = `
LIGHTING: MIDDAY SUMMER SUN
- Light source positioned above and behind camera — front facade fully and directly illuminated
- Strong directional sunlight with crisp shadow edges on trim, moldings, railings, and eaves
- High contrast, bright clean exposure, neutral-warm color temperature
- Strong specular highlights on glass, polished wood, and resin surfaces
- The diorama is the brightest, most defined element in the frame
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The diorama sits on a highly detailed dark walnut desk with visible wood grain and soft reflection.
The room is bright with natural daylight streaming through windows — clean, warm, and inviting.
Crisp window frame shadows fall across the desk surface from the room's own windows.
The background room feels like it could be inside the house — matching its period, style, and character.
Warm wood tones, architectural details, and natural light define the room.
Strong depth of field — diorama is sharp, background recedes naturally into soft bokeh.
The room is a supporting character — present but never competing with the diorama.
`.trim()

function buildPrompt(params: BaseParams): string {
  if (params.customPrompt) {
    return params.manual_prompt?.trim()
      ? `${params.customPrompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
      : params.customPrompt
  }

  const interiorLine = params.interior_lights
    ? `Subtle warm amber glow visible inside windows — does not affect exterior daylight.`
    : `No interior window glow — windows reflect exterior light only.`

  const prompt = `
${STRUCTURE_BLOCK}

${LIGHTING}
${interiorLine}

${ROOM}

${getLandscaping(params.landscaping)}

${SCALE_BLOCK}

STYLE:
Museum-quality architectural scale model — not a toy.
Full structural fidelity with realistic materials: wood, resin, glass, foliage.
The house is shiny and handcrafted — premium collectible quality.

${CAMERA_BLOCK}
`.trim()

  return params.manual_prompt?.trim()
    ? `${prompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
    : prompt
}

export async function generateMidday(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt     = buildPrompt(params)

  const preparedBuf = await prepareSourceImage(input.sourceImageB64, 'midday_summer')
  const b64         = await callGenerateAPI(
    preparedBuf.toString('base64'),
    prompt,
    input.openaiApiKey
  )

  console.log('[generate] Midday done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
