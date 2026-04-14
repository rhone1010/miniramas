import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'
import { getLandscaping } from './landscaping'

const LIGHTING = `
LIGHTING: SOFT SPRING AFTERNOON
- Light source positioned above and behind camera — front facade evenly and gently illuminated
- Diffused bright sunlight — high key, airy, and clear. Not dim, not flat
- Soft shadow edges on architectural features — gentle definition, no harsh contrast
- Slight warm tone with vivid greens and soft highlights on all surfaces
- The diorama reads as bright and cheerful — a full bloom day in clear spring weather
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The diorama sits on a highly detailed dark walnut desk with visible wood grain and soft reflection.
The room is filled with soft bright diffused light — airy, clean, and fresh.
Large windows let in bright indirect daylight that fills the space gently without harsh shadows.
The room feels light and open — white or pale walls, natural wood accents, perhaps spring flowers nearby.
The background room style matches the house — same period, character, and warmth.
Strong depth of field — diorama sharp, background recedes into soft bright bokeh.
The overall feel is fresh, optimistic, and welcoming — like a well-loved home on a perfect spring day.
`.trim()

function buildPrompt(params: BaseParams): string {
  if (params.customPrompt) {
    return params.manual_prompt?.trim()
      ? `${params.customPrompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
      : params.customPrompt
  }

  const interiorLine = params.interior_lights
    ? `Very subtle warm glow inside windows — barely visible in bright daylight.`
    : `No interior window glow — windows reflect soft exterior light only.`

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

export async function generateSpring(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt     = buildPrompt(params)

  const preparedBuf = await prepareSourceImage(input.sourceImageB64, 'soft_spring')
  const b64         = await callGenerateAPI(
    preparedBuf.toString('base64'),
    prompt,
    input.openaiApiKey
  )

  console.log('[generate] Spring done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
