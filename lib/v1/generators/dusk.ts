import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, SCALE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'
import { analyzeImage } from '../analyze'
import { getLandscaping } from './landscaping'

const LIGHTING = `
LIGHTING: DUSK / GOLDEN HOUR — THIS IS NOT DAYTIME
- The sun is at or below the horizon — the sky is deep orange, pink, and purple
- Light source behind camera at extreme low angle — front facade receives warm amber-gold illumination
- Shadows fall behind architectural features with long warm-edged definition
- Upper surfaces catch warm orange-gold highlights; shadow sides have cool blue-violet tones
- Interior lights glow warmly and prominently through all windows — more visible than daytime
- Divided light shadow patterns from window mullions fall visibly on the grass and pathway
- A porch or entry light glows in period-appropriate style matching the house architecture
- This must read unmistakably as golden hour dusk — rich, warm, cinematic
- Primary light direction is from above and slightly behind the camera, illuminating the front facade clearly.
- The front of the structure must be fully visible and well-lit, never in shadow.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The diorama sits on a highly detailed dark walnut desk with visible wood grain.
The desk surface reflects warm orange and amber tones from the dusk light through the windows.
The room is bathed in deep warm amber-golden light from large windows showing the sunset sky.
Orange-pink dusk light spills across the room floor and walls at a low angle.
The room feels intimate and warm — lamps are beginning to glow, day transitioning to evening.
Period-appropriate furnishings and warm wood tones catch the last golden light.
The background room matches the house style — same era, same warmth, same character.
Strong depth of field — diorama sharp, room recedes into warm amber bokeh.
The overall atmosphere is romantic, cinematic, deeply warm — the golden hour at its best.
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
Foliage catches warm golden light on upper surfaces, cool violet in shadow.

${CAMERA_BLOCK}
`.trim()

  return params.manual_prompt?.trim()
    ? `${prompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
    : prompt
}

export async function generateDusk(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt     = buildPrompt(params)

  // No pre-lift — model generates its own warm dark mood
  const preparedBuf = await prepareSourceImage(input.sourceImageB64, 'dusk_evening')
  const b64         = await callGenerateAPI(
    preparedBuf.toString('base64'),
    prompt,
    input.openaiApiKey
  )

  // Auto-retry up to 2x if generation came back too dark
  let finalB64 = b64
  for (let attempt = 1; attempt <= 2; attempt++) {
    const check = await analyzeImage(finalB64)
    if (check.brightness >= 20) break
    console.log(`[generate] Dusk retry ${attempt} — too dark (${Math.round(check.brightness)})`)
    finalB64 = await callGenerateAPI(
      preparedBuf.toString('base64'),
      prompt,
      input.openaiApiKey
    )
  }

  console.log('[generate] Dusk done')
  return { imageB64: finalB64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
