import { BaseParams, GenerateResult, STRUCTURE_BLOCK, COMPOSITION_BLOCK, SCALE_BLOCK, STYLE_BLOCK, prepareSourceImage, callGenerateAPI } from './base'

const LIGHTING_OVERRIDE = `
LIGHTING: ALIEN SUN — VIVID AND FULLY ILLUMINATED
The alien sun casts strong direct light across the entire diorama — the model is the fully lit showcase subject.
The sun color is a deep violet-magenta — not yellow, not white. The light it casts has a warm purple-pink hue across all surfaces.
Shadows are crisp and deep — cast at a low dramatic angle across the base terrain.
The alien sunlight makes familiar materials look otherworldly — brick reads purple-tinted, white reads lavender, glass refracts with prismatic color.
The diorama is the brightest object in the frame — fully exposed and richly colored in alien light.
`.trim()

const ALIEN_WORLD = `
ALIEN PLANET — THE STRUCTURE EXISTS ON ANOTHER WORLD

THE TERRAIN AND BASE:
The diorama base terrain is an alien landscape — bioluminescent ground cover in electric teal and acid green replacing grass.
Strange crystalline formations jut from the base like purple and blue geodes — growing organically around the foundation.
The soil is deep rust-red like Martian regolith — alien and unfamiliar.
Pools of luminescent liquid — glowing cyan — collect in low spots on the base.

ALIEN FLORA (these are CRITICAL — they must appear):
Strange alien plants replace all earthly vegetation — tall stalks with multiple glowing orbs instead of leaves, pulsing with soft light.
Enormous mushroom-like organisms with wide flat caps in deep purple and bioluminescent undersides frame the sides of the base.
Tentacle-like vines with iridescent surfaces cling to the structure walls — not dead, but alive and slowly moving-looking.
Floating spore-like seeds drift upward from pod-shaped plants near the base.

ALIEN FAUNA (these are CRITICAL — they must appear):
2 to 3 alien creatures visible in the yard — small, insect-like with too many legs, translucent exoskeletons that catch the alien light.
A large creature with a long sinuous neck peers over the roofline — curious, not threatening, enormous eyes reflecting the violet sun.
Small lizard-like creatures with frilled crests cling to the exterior walls.
Strange flying creatures — not birds, not bats — membrane-winged, bio-luminescent undersides, circling above the roofline.

ATMOSPHERE:
Two moons visible low on the horizon in the background — one large and close, one small and distant.
The sky is a deep burnt orange fading to purple-black at the zenith — utterly alien.
Bioluminescence from the plants and creatures adds soft colored light to shadowed areas.
`.trim()

const ROOM = `
ROOM AND ENVIRONMENT — ALIEN SCIENCE LABORATORY:
The room is a futuristic alien research facility — but designed by non-human intelligence.
Curved organic walls that seem grown rather than built — a material between bone and ceramic, off-white with faint iridescent veining.
Alien display screens float in the air — holographic, showing incomprehensible data readouts in symbols no human wrote.
Strange scientific instruments surround the diorama — crystalline sensors on articulated arms pointing at the model, taking readings.
Alien specimen jars on curved shelves behind — containing floating organisms in luminescent fluid.
The lighting in the lab is cold blue-white ambient with accents of teal and violet — clinical, advanced, alien.
The diorama sits on a display plinth of polished dark material — like obsidian but with a faint internal glow.
The lab communicates: this structure from another world is being studied and catalogued.
Strong depth of field — model razor sharp, alien lab recedes into soft focus behind.
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

${ALIEN_WORLD}

${ROOM}

${SCALE_BLOCK}

${STYLE_BLOCK}

${COMPOSITION_BLOCK}
`.trim()
  return params.manual_prompt?.trim()
    ? `${prompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
    : prompt
}

export async function generateAlien(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  const prompt      = buildPrompt(params)
  const preparedBuf = await prepareSourceImage(input.sourceImageB64)
  const b64         = await callGenerateAPI(preparedBuf.toString('base64'), prompt, input.openaiApiKey)
  console.log('[generate] Alien done')
  return { imageB64: b64, promptUsed: prompt, manualPromptUsed: params.manual_prompt?.trim() || null }
}
