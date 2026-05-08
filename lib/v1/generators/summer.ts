import { BaseParams, GenerateResult, STRUCTURE_BLOCK, COMPOSITION_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, buildSeasonPrompt, prepareSourceImage, callGenerateAPI } from './base'

const SEASON = `
SEASON: SUMMER
Full summer foliage — trees in deep rich green, lawns lush and thick.
Dense layered vegetation — mature shrubs, flowering perennials, dense grass in peak growth.
The landscape is at its most abundant and alive — full canopy, vivid color throughout.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The diorama sits on a large dark walnut desk — book-matched grain, rich chocolate-brown with flowing figured streaks, 
deep satin finish. The grain is clearly visible and beautiful.
The desk surface has a strong mirror-like reflection of the diorama base — the walnut base and the diorama 
reflect downward into the polished surface, doubled and slightly diffused.
A large window to one side fills the room with warm afternoon light — this is the primary light source.
In the far corner, a small antique brass lamp with a silk shade glows warmly — accent only, does not light the diorama.
A hardcover book lies open to the left. Reading glasses rest to the right.
The room beyond is a warm study — bookshelves, framed paintings, a chair. Everything softly out of focus.
`.trim()

const LANDSCAPE = `
PROPERTY & LANDSCAPE — COTTAGE GARDEN STYLE:
The property is the heart of this diorama — the house sits within a lovingly tended, neatly kept cottage garden.

FLANKING TREES:
A large mature tree stands approximately 15 feet to the right of the house — full rounded canopy, species appropriate to the region and season.
A slightly larger mature tree stands approximately 20 feet to the left — broader crown, arching gently over the left side of the property.
Both trees are well-maintained and clearly shaped — not wild or unkempt.

GARDEN DESIGN — NEAT COTTAGE STYLE:
Foundation plantings are tidy and well-defined — clipped low shrubs and perennials create a clean skirt around the house base.
Garden beds have clear, crisp edges — no overgrowth spilling onto the lawn.
Cottage flowers in organized drifts: roses, lavender, salvia, and black-eyed Susans arranged by height — taller at back, shorter at front.
A stone or brick pathway runs cleanly from the base edge to the front steps — neatly edged, stones well-set.
The lawn is lush, short-cropped, and evenly green — freshly mowed appearance.
Window boxes (if porch is visible) are neatly planted with trailing flowers.
The overall feeling: a beautiful, cared-for garden — welcoming, colorful, and impeccably maintained.
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

export async function generateSummer(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Summer done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
