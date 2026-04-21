import { BaseParams, GenerateResult, STRUCTURE_BLOCK, COMPOSITION_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, buildSeasonPrompt, prepareSourceImage, callGenerateAPI } from './base'

const SEASON = `
SEASON: FALL
Trees ablaze with amber, orange, and deep red foliage at peak color.
Fallen leaves scattered naturally across the lawn, pathway, and base.
Dried flower stalks, ornamental grasses, late-season mums in rust and gold.
The landscape feels like peak autumn — rich, warm, deeply beautiful.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The diorama sits on a large dark walnut desk — deeply figured grain, rich chocolate-brown with amber streaks,
mirror-satin finish. The wood grain is prominent and beautiful — dark walnut at its finest.
Exceptional desk reflections — the entire diorama base and lower structure reflects clearly into the polished surface,
doubled and warm, slightly diffused at the edges.
Warm afternoon light pours through a large window — golden and directional, the dominant light source.
A small antique brass lamp with a silk shade glows in the far corner — warm accent for the room only.
A hardcover book lies open to the left. Reading glasses to the right.
The room is a warm autumn study — paintings on walls, leather chair, bookshelves. All in soft warm bokeh.
`.trim()

const LANDSCAPE = `
PROPERTY & LANDSCAPE — CLASSIC AMERICAN NEIGHBORHOOD:
The property presents a picture-perfect American home — neat, proud, and beautifully maintained.

FLANKING TREES:
A mature shade tree stands approximately 15 feet to the right — oak, maple, or elm appropriate to the region, trunk clean and substantial, canopy full and rounded.
A slightly larger companion tree stands approximately 20 feet to the left — same species family, slightly more established, with a broader well-shaped crown.
Both trees are clearly maintained — no dead branches, clean trunks, properly shaped.

GARDEN DESIGN — NEAT CLASSIC STYLE:
A classic green lawn extends from the house to the base perimeter — perfectly even, lush, well-kept with visible mowing lines.
Symmetrical foundation plantings frame the porch and facade — clipped boxwood spheres or neat hydrangea mounds in matching pairs.
A straight front walk runs from the base edge to the visible porch steps — brick, concrete, or pavers, cleanly edged with low border plantings.
Neat seasonal annuals line the walk: impatiens, marigolds, or petunias in tidy rows.
Lawn edges are razor-sharp where they meet the beds and walk.
The overall feeling: a neighborhood showpiece — orderly, welcoming, genuinely beautiful.
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

export async function generateFall(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Fall done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
