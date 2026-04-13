import { BaseParams, GenerateResult } from './generators/base'
import { generateMidday } from './generators/midday'
import { generateSpring } from './generators/spring'
import { generateDusk }   from './generators/dusk'
import { generateNight }  from './generators/night'

<<<<<<< HEAD
export type Params = BaseParams

const GENERATORS: Record<string, (input: { sourceImageB64: string; openaiApiKey: string; params: BaseParams }) => Promise<GenerateResult>> = {
  midday_summer: generateMidday,
  soft_spring:   generateSpring,
  dusk_evening:  generateDusk,
  night:         generateNight,
=======
type Params = {
  landscaping?: string
  lighting?: string
  color?: string
  foreground?: string
  detail?: string
  structureBlock?: string
  customPrompt?: string

  environment_style?: string
  prop_density?: string
  background_structure?: string
  interior_lighting?: string
  foreground_density?: string
}

const MODIFIERS: Record<string, string> = {
  // LANDSCAPE
  sparse_landscape:   `Landscaping is minimal with visible open ground.`,
  moderate_landscape: `Landscaping is balanced with shrubs, flowers, and spacing.`,
  lush_landscape:     `Landscaping is rich, layered, and detailed but remains controlled.`,

  // LIGHTING
  clean_daylight:     `Lighting is bright neutral daylight.`,
  high_pop_light:     `Lighting has strong clarity, crisp highlights, and controlled contrast.`,

  // COLOR
  strict_color:       `Preserve all facade color sections exactly.`,
  enhanced_color:     `Enhance color separation while preserving original tones.`,

  // FOREGROUND
  no_foreground:      `No foreground elements.`,
  light_foreground:   `Subtle foreground blur elements.`,
  layered_foreground: `Layered foreground with soft blurred leaves or edge elements.`,

  // DETAIL
  standard_detail:    `Clean readable detail.`,
  high_detail:        `High material fidelity with micro texture.`,

  // ENVIRONMENT
  clean_product: `Minimal tabletop scene.`,
  styled_desk:   `Curated desk scene with natural object placement.`,
  interior_room: `Scene extends into a realistic interior.`,

  // PROPS
  minimal_props:  `Very few objects.`,
  balanced_props: `A small number of objects arranged with spacing.`,
  styled_props:   `Styled objects placed intentionally.`,

  // BACKGROUND
  soft_depth:     `Soft depth background.`,
  windowed_room:  `Background includes a window with daylight.`,
  decorated_room: `Background includes furniture and decor.`,

  // INTERIOR LIGHT
  no_interior_light:  `No interior glow.`,
  soft_window_glow:   `Soft warm glow inside windows.`,
  warm_window_glow:   `Warm visible interior lighting.`,
  bright_window_glow: `Bright interior glow with strong depth contrast.`,
}

function buildPrompt(params: Params): string {
  if (params.customPrompt) return params.customPrompt

  return `
Create a high-end miniature diorama as a premium product photograph.

FORMAT:
1:1 square image.
The circular base must be fully visible with generous margins on ALL sides.

COMPOSITION:
The base should occupy ~70% of the image width.
Maintain additional breathing room beyond standard framing.
Do not allow subject or landscaping to approach edges.

CAMERA:
Close-up, intimate desk perspective.
~35–40 degree elevated angle.
Framed like a premium product shot.

CORE IDENTITY:
This is a handcrafted miniature.
Materials must feel real and tactile at small scale:
- painted wood
- detailed shingles
- miniature foliage
- handcrafted edges
Do not render full-scale realism.

STRUCTURE:

Preserve exact architecture and proportions.

${params.structureBlock ? `
STRUCTURE REFERENCE (MANDATORY):

${params.structureBlock}

Do not reinterpret this structure.
Recreate it faithfully at miniature scale.
` : ''}

STRUCTURE LOCK (MANDATORY):

- preserve massing and layout
- preserve roof type and dormers
- preserve porch placement and depth
- preserve window placement and grouping
- preserve entry position

DO NOT redesign the house.

PRIORITY ORDER:

1. STRUCTURE
2. SCALE + MATERIALS
3. ENVIRONMENT
4. PROPS

ENVIRONMENT (CRITICAL):

The room must feel like it belongs to the house.

- match architectural style and trim language
- echo color palette and materials
- feel like a real room from the house

DESK SURFACE:

The diorama sits on a real wooden desk with:
- deep wood grain
- rich texture
- subtle imperfections

REFLECTIONS:

The desk must show a soft realistic reflection:
- subtle and slightly blurred
- physically plausible
- not mirror-like

PROPS (MANDATORY):

Include 2–4 desk objects:
- book, magnifying glass, pen, ceramic, glass, dried flowers

- must be visible
- placed near edges
- must not block subject

At least one object must be partially visible.

ENVIRONMENT STYLE:
${MODIFIERS[params.environment_style || 'styled_desk']}

PROP DENSITY:
${MODIFIERS[params.prop_density || 'balanced_props']}

BACKGROUND:
${MODIFIERS[params.background_structure || 'windowed_room']}

Background must:
- contain real structure
- remain softly out of focus
- be dimmer than subject

LANDSCAPING:
${MODIFIERS[params.landscaping || 'moderate_landscape']}

PROPERTY COMPOSITION (MANDATORY):

This is a property, not just a house.

The house must occupy ~70% of the base diameter.

Maintain at least 15% open space between the house and the base edge on ALL sides.

This space must include:
- ground plane
- pathways or landscaping
- visible separation from edge

BASE:

Circular wooden base with visible thickness and shadow grounding.

LIGHTING (DAYLIGHT SYSTEM):

The scene is lit by strong natural daylight.

- daylight is the dominant light source
- interior glow is secondary
- must not appear as night

Sunlight must hit:
- roof
- trim
- landscaping
- base

The subject must be the brightest element.

Do not allow environment color to tint the subject.

ANTI-NIGHT RULE:

Do not render dusk or evening lighting.

INTERIOR LIGHTING:
${MODIFIERS[params.interior_lighting || 'soft_window_glow']}

COLOR:
${MODIFIERS[params.color || 'strict_color']}

FOREGROUND:
${MODIFIERS[params.foreground_density || 'layered_foreground']}

DETAIL:
${MODIFIERS[params.detail || 'high_detail']}

FINAL CHECK:

- structure must match source image
- must feel like a real miniature
- must include visible margins (external + internal)
- must include props
- must be bright daylight
- must have depth and reflection
`.trim()
>>>>>>> parent of b3c68b3 (great results reset)
}

export async function generateDiorama(input: {
  sourceImageB64: string
<<<<<<< HEAD
  openaiApiKey:   string
  params?:        Params
}): Promise<{ imageB64: string; promptUsed: string; manualPromptUsed: string | null }> {
  const params  = input.params || {}
  const key     = params.lighting_preset || 'midday_summer'
  const generator = GENERATORS[key] || generateMidday

  console.log(`[generate] Mode: ${key}`)
=======
  openaiApiKey: string
  params?: Params
}): Promise<{ imageB64: string; promptUsed: string }> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const prompt = buildPrompt(input.params || {})
>>>>>>> parent of b3c68b3 (great results reset)

  const result = await generator({
    sourceImageB64: input.sourceImageB64,
    openaiApiKey:   input.openaiApiKey,
    params,
  })

<<<<<<< HEAD
  return {
    imageB64:         result.imageB64,
    promptUsed:       result.promptUsed,
    manualPromptUsed: null,
  }
}
=======
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('generate_failed')

  return { imageB64: b64, promptUsed: prompt }
}
>>>>>>> parent of b3c68b3 (great results reset)
