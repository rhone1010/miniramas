import { BaseParams, GenerateResult, STRUCTURE_BLOCK, COMPOSITION_BLOCK, SCALE_BLOCK, STYLE_BLOCK, INTERIOR_LIGHTS_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING: WINDOW MOONLIGHT — MODEL IS THE SPOTLIGHTED SUBJECT
A single large window off to one side casts cold blue-white moonlight directly onto the scale model.
The moonlight falls completely onto the diorama — the model is the showcased subject, fully illuminated in eerie silver light.
The rest of the room falls into deep shadow — the model glows within it like a cursed artifact on display.
The light rakes across every surface — catching roof shingles, rotted trim, creature details, bat wings mid-flight.
Strong cold shadows from the model fall across the desk surface — sharp and dramatic.
The model is the brightest object in the frame. Everything else is subordinate to it.
`.trim()

const HAUNTED = `
HAUNTED HOUSE — HALLOWEEN HORROR SCENE

THE STRUCTURE:
The building shows years of neglect and supernatural corruption — peeling paint, sagging porch, broken shutters hanging at angles, cracked and frost-heaved foundation.
Dead vines cling to every wall. Windows are dark and cracked — an eerie orange-yellow glow emanates from deep inside.
The roof has warped and sagged — shingles missing in patches, a weathervane twisted into a sinister shape at the peak.

CREATURES IN THE YARD (these are CRITICAL — they must appear):
3 to 5 zombies shambling across the diorama base — decayed, arms outstretched, tattered clothing, emerging from the ground or lurching toward the porch.
Zombies are scale-model quality — highly detailed miniature figures, painted resin, fully visible in the moonlight.
Gravestones tilted at odd angles in the overgrown yard. One grave freshly disturbed — dirt mounded, a hand emerging.
A large spider web stretches between the porch columns — with a visible oversized spider at its center.
Dead leafless trees twisted into claw-like shapes frame the base.

CREATURES IN AND ON THE STRUCTURE (these are CRITICAL — they must appear):
A ghost or pale spectral figure visible through one cracked window — glowing faintly from within.
A shadowy creature with glowing red eyes crouched on the porch roof — hunched, watching.
A witch silhouette or dark cloaked figure visible in an upper window.

BATS (these are CRITICAL — they must appear):
A swarm of 6 to 10 bats in various sizes circling the roofline and chimneys — wings spread, highly detailed miniature scale.
Some bats are landing on the roof edge. Some are mid-flight swooping around the peak.
Bats are clearly visible against the moonlit sky backdrop.

ATMOSPHERE:
Wisps of fog or mist curl across the base terrain — low to the ground.
The overall mood is delightfully terrifying — detailed horror diorama, premium collector quality.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT:
The room is a dark Victorian study — heavy dark wood paneling, shelves of leather-bound books barely visible in the shadows.
A single candle flickers somewhere off to the side — its light barely reaching the walls.
The cold moonlight from the window falls squarely on the diorama — everything else recedes into deep shadow.
The desk is dark aged wood — the moonlight catches the grain and creates a cold silver glow around the model's base.
The room feels haunted itself — old, heavy, secret. The perfect setting for this cursed miniature.
Strong depth of field — model razor sharp in the moonlight, dark room recedes into shadow behind.
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

${INTERIOR_LIGHTS_BLOCK}

${HAUNTED}

${ROOM}

${SCALE_BLOCK}

${STYLE_BLOCK}

${COMPOSITION_BLOCK}
`.trim()
  return params.manual_prompt?.trim()
    ? `${prompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
    : prompt
}

export async function generateHaunted(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Haunted done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
