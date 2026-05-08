import { BaseParams, GenerateResult, STRUCTURE_BLOCK, COMPOSITION_BLOCK, SCALE_BLOCK, LIGHTING_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI , buildArchitectureBlock } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING: DUAL SOURCE — NIGHT BLAST SCENE
PRIMARY: A harsh work-light or bare bulb within the room throws stark directional light across the model and rubble — deep hard shadows.
SECONDARY: Cold blue-white moonlight and smoke-filtered starlight pour through the blown-out wall hole behind — backlighting the debris silhouettes.
The model itself is sharply lit by the work-light — every surface of the damage readable and textured.
Dust particles catch both light sources and glow in the beams.
The night sky through the hole is deep and real — stars visible through drifting smoke.
`.trim()

const DISASTER = `
DISASTER: EXPLOSION DAMAGE
The house has suffered a catastrophic explosion — partial structural collapse.
One section of the roof and wall has been blown outward — exposed interior framing visible.
Debris scattered across the base: bricks, timber, shattered glass, broken furniture fragments.
A crater or impact point visible near the structure — scorched and cratered earth.
Remaining walls show blast damage — cracked, blackened, structurally compromised.
Windows blown out entirely. Doors hanging open or missing.
The scene is frozen in the immediate aftermath — dramatic, violent, shocking.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT — BLOWN OPEN TO THE OUTSIDE:
The explosion has torn a massive hole — approximately 10 feet wide — through one of the room walls behind the diorama.
The hole punches through the wall AND through the ceiling above it — jagged edges of splintered timber, torn plaster, and bent rebar frame the opening.
Through this gaping hole: the night sky is visible — deep blue-black with stars, smoke drifting across the opening.
Silhouettes of surviving trees visible through the hole — branches against the dark sky.
The desk sits in the foreground of this destroyed room — rubble, plaster chunks, and dust covering its surface.
Everything in the room is in violent disarray — overturned furniture, cracked walls, pictures blown off. Plaster dust still settling.
A single emergency light or bare bulb swings from exposed wiring — casting harsh swinging shadows.
The room IS the disaster — as destroyed as the model sitting within it.
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

export async function generateExplosion(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Explosion done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
