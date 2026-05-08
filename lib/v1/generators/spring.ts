import { BaseParams, GenerateResult, STRUCTURE_BLOCK, COMPOSITION_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, buildSeasonPrompt, prepareSourceImage, callGenerateAPI } from './base'

const SEASON = `
SEASON: SPRING
Fresh young foliage — bright lime and yellow-green, trees not yet at full summer weight.
Flowering shrubs and blooming perennials: cherry blossom, tulips, daffodils in bloom.
New grass vivid and fresh. Petals on the pathway and garden beds.
The landscape feels like the first warm days — hopeful, fresh, and full of color.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The diorama sits on a large dark walnut desk — the desk surface extends well beyond the base in every direction.
A hardcover book lies open to the left of the diorama. Reading glasses rest folded to the right.
A small ceramic mug of tea sits near the lamp — steam curling gently upward.
The desk surface is richly grained — the reflection of the diorama visible in its polished finish.
The room beyond is airy and bright — fresh spring light through large windows, softly out of focus.
The diorama is a small precious object on a large desk — the camera pulls back to show the whole scene.
`.trim()

const LANDSCAPE = `
PROPERTY & LANDSCAPE — NATURALISTIC GARDEN:
The property feels thoughtfully designed to look naturally beautiful — planted with intent but wearing it lightly.

FLANKING TREES:
A large native tree stands approximately 15 feet to the right — birch, serviceberry, or dogwood appropriate to the region, with interesting natural form and clean trunk.
A larger more dominant native tree stands approximately 20 feet to the left — oak, beech, or tulip poplar, commanding but well-kept.
Both trees are healthy and clearly established — irregular but not neglected.

GARDEN DESIGN — NEAT NATURALISTIC STYLE:
Planting beds have soft but clearly defined edges — not geometric, but not overgrown.
Native perennials, ornamental grasses, and ground covers in well-organized layered drifts — taller grasses behind, flowering perennials mid, low groundcover at edges.
The lawn areas are lush and green — slightly softer texture than a formal lawn but clearly maintained.
Stepping stones set cleanly into the groundcover lead to the front steps — moss between them is intentional, not neglected.
A few small natural boulders placed intentionally among the plantings.
The overall feeling: a home in harmony with its landscape — beautiful, considered, and genuinely alive.
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

export async function generateSpring(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Spring done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
