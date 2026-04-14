import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'
import { getLandscaping } from './landscaping'

const LIGHTING = `
LIGHTING: NIGHT SCENE — BRIGHT CINEMATIC MOONLIGHT
- The scene is SIGNIFICANTLY BRIGHT for a night scene — like a full moon on a clear night, or a Hollywood film night exterior
- This is NOT a dark moody image — it is a well-lit night scene where all details are clearly visible
- Primary light source is strong blue-white moonlight from above and behind camera
- Moonlight illuminates the front facade — all architectural detail clearly readable
- Crisp mullion shadow grids fall on the grass and pathway from window panes — key visual element
- Blue-silver highlights on roof, chimney, upper tree canopy, and desk surface
- Interior warm amber light glows brightly through all windows
- Either a period-appropriate lamppost in the yard OR a porch light — not both
- The lamp casts a warm pool of light on surrounding ground
- Interior window light casts divided light shadow patterns outward onto the base
- Deep shadows in corners and behind trees — detail still readable throughout
- Overall exposure higher than realistic night — romantic, cinematic, beautifully lit
- Primary light direction is from above and slightly behind the camera, illuminating the front facade clearly.
- The front of the structure must be fully visible and well-lit, never in shadow.
- The facade receives enough moonlight to clearly see all architectural details — trim, windows, porch, materials
- Think of it as a well-exposed night photograph, not a dark silhouette
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The diorama sits on a highly detailed dark walnut desk with visible wood grain.
The desk surface reflects both cool blue moonlight and warm amber window glow — a striking contrast.
The room is dark and intimate, lit primarily by moonlight through large windows.
Blue-white moonlight casts crisp mullion shadow grids across the room floor and walls.
Warm pools of lamplight or candlelight create intimate islands of amber in the darkness.
The room feels like a scene from a period film — moody, romantic, deeply atmospheric.
Period-appropriate furnishings are visible in silhouette and partial lamplight.
The background room matches the house — same era, same intimate character.
Strong depth of field — diorama sharp, room recedes into dark atmospheric bokeh.
The overall atmosphere is cinematic, romantic, and still — a perfect quiet night.
`.trim()

function buildPrompt(params: BaseParams): string {
  if (params.customPrompt) {
    return params.manual_prompt?.trim()
      ? `${params.customPrompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
      : params.customPrompt
  }

  const prompt = `
${STRUCTURE_BLOCK}

${LIGHTING}

${ROOM}

${getLandscaping(params.landscaping)}

${SCALE_BLOCK}

STYLE:
Museum-quality architectural scale model — not a toy.
Full structural fidelity with realistic materials: wood, resin, glass, foliage.
The house is shiny and handcrafted — premium collectible quality.
Moonlit foliage has blue-silver highlights on upper leaves, deep shadow beneath.

${CAMERA_BLOCK}
`.trim()

  return params.manual_prompt?.trim()
    ? `${prompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
    : prompt
}

export async function generateNight(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt     = buildPrompt(params)

  // No pre-lift — model generates its own dark cinematic mood
  const preparedBuf = await prepareSourceImage(input.sourceImageB64, 'night')
  const b64         = await callGenerateAPI(
    preparedBuf.toString('base64'),
    prompt,
    input.openaiApiKey
  )

  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
