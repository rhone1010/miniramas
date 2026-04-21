import sharp from 'sharp'
import OpenAI, { toFile } from 'openai'

// ── SHARED TYPES ──────────────────────────────────────────────
export type Preset =
  | 'summer' | 'spring' | 'fall' | 'winter'
  | 'flood'  | 'fire'   | 'abandoned' | 'explosion'
  | 'haunted' | 'alien'

export type BaseParams = {
  preset?:                  Preset | string
  customPrompt?:            string
  manual_prompt?:           string
  structureBlock?:          string
  interiorLights?:          boolean  // true = warm window glow (softer texture), false = crisp raking light only
  architectureDescription?: string   // GPT-4o vision analysis — injected as Stage 0 in route.ts
  // pipeline params — not injected into prompt
  brightness?:              number
  expand?:                  boolean
  name?:                    string
  _preset?:                 string
  _expStr?:                 string
}

export type GenerateResult = {
  imageB64:         string
  promptUsed:       string
  manualPromptUsed: string | null
}

// ── STRUCTURE BLOCK ───────────────────────────────────────────
export const STRUCTURE_BLOCK = `
THIS IS A MUSEUM-QUALITY SCALE MODEL DIORAMA PHOTOGRAPH.

SOURCE IMAGE IS THE ABSOLUTE GROUND TRUTH FOR STRUCTURE AND MATERIALS:
- This exact building — same mass, footprint, roofline geometry, and facade layout — replicated with precision
- MATERIALS MUST MATCH EXACTLY: brick stays brick, wood siding stays wood siding, stone stays stone, stucco stays stucco, shingle stays shingle — colors and surface textures reproduced faithfully from the source
- Every architectural detail preserved without exception: window count, placement, shape and glazing style, door design, trim profiles, porch columns and railings, chimney position and form, decorative elements, dormers, gables, bay windows, shutters
- Proportions are exact — this is a certified scale replica, not an artistic interpretation
- If the source shows a Victorian, render a Victorian. If it shows a Ranch, render a Ranch. If it shows brick, render brick. Do not invent or substitute architectural character or materials.

THE SOURCE IMAGE IS NOT THE SOURCE OF TRUTH FOR ANYTHING ELSE — IGNORE COMPLETELY:
- Lighting, time of day, sun angle, shadows, or exposure — derive NOTHING from these
- Season, foliage state, or vegetation — derive NOTHING from these
- Landscaping layout or garden design — derive NOTHING from these
- Background, neighborhood context, street, or sky — derive NOTHING from these

BUILD THE STRUCTURE AND ITS MATERIALS EXACTLY AS THEY APPEAR IN THE SOURCE.
CHANGE ONLY WHAT THE LIGHTING, SEASON, AND DISASTER BLOCKS SPECIFY.

DO NOT INVENT ARCHITECTURAL ELEMENTS:
- Only include stairs, steps, railings, porches, bays, and extensions that are CLEARLY VISIBLE in the source image(s)
- If stairs are not visible on a particular side, do not add them — place stairs only where they appear in the source
- Do not add doors, windows, dormers, chimneys, or any other elements beyond what is shown
- Do not simplify or remove elements that ARE visible — only add what can be confirmed
`.trim()

// ── COMPOSITION BLOCK ─────────────────────────────────────────
export const COMPOSITION_BLOCK = `
CAMERA POSITION — THIS IS CRITICAL:

The camera is mounted HIGH and aimed DOWN at approximately 50 degrees below horizontal.
Imagine a drone hovering above and in front of the diorama, tilted downward at 50 degrees.

What this means for the image:
- You can clearly see the TOP of the roof and the TOP surfaces of trees
- The front facade is visible but angled — not flat-on like a front elevation
- The circular base top surface is clearly visible as an oval shape
- The desk surface is visible in the lower foreground stretching away from camera
- The background room environment is visible above and behind the diorama

THIS IS NOT a straight-on front view. THIS IS NOT eye-level.
The viewer is looking DOWN at the diorama from above and in front.
The roof is prominent. The base top is prominent. The desk is prominent.

Think of how a display shelf item is photographed in a product catalogue — 
camera above, tilted down, showing top and front simultaneously.

Depth of field: diorama sharp, background falls off softly behind it.
`.trim()

// ── SCALE BLOCK ───────────────────────────────────────────────
export const SCALE_BLOCK = `
BASE SHAPE — NON-NEGOTIABLE:
The base is a CIRCULAR oval plinth — round like a coin or drum, thick and heavy. NOT rectangular. NO straight edges or corners anywhere.
It is a turned-wood oval base with a visible curved side profile — like a trophy base or lazy susan.

INTERNAL SCALE:
The house occupies 55-65% of the base diameter.
The remaining 30-35% is visible landscaped yard surrounding the house on all sides.
No wall, porch, or element reaches the base edge — clear yard visible on all sides between house and base perimeter.
A walkway runs from the entrance toward the base edge but ends in lawn before reaching it.
`.trim()

// ── LIGHTING BLOCK ────────────────────────────────────────────
// Raking directional light — maximises surface texture and material detail
export const LIGHTING_BLOCK = `
LIGHTING: EXHIBITION-QUALITY — PRIMARY LIGHT FROM OUTSIDE WINDOW

PRIMARY SOURCE: Strong warm natural light streams in through a large window — the dominant light source for the entire scene.
The window light falls across the diorama from one side at a slight angle — warm golden-white, the quality of afternoon sun through glass.
This window light is the only real illumination on the diorama. It wraps around the structure with a soft feathered falloff — 
bright and crisp on the lit faces, fading naturally to deeper shadow on the away sides.
Think exhibition spotlight quality — the diorama is the gallery subject, perfectly and dramatically lit.

ACCENT ONLY: A small, expensive table lamp sits in the far corner of the room — antique brass with a silk shade.
It contributes warm ambient fill to the room background only. It does NOT light the diorama directly.
The lamp is a supporting character, not a light source for the subject.

DIORAMA LIGHTING QUALITY:
The light on the diorama has a soft feathered radius — brightest on the primary lit face, 
falling off smoothly around the curved sides. Every surface texture is visible — 
brick mortar joints, shingle rows, trim profiles all catch the directional light with crisp micro-shadows.
This is how a master photographer would light a museum exhibit.
`.trim()

// ── INTERIOR LIGHTS BLOCK ─────────────────────────────────────
// Optional — warm glow through windows. Beautiful but softens facade texture slightly.
export const INTERIOR_LIGHTS_BLOCK = `
INTERIOR LIGHTING — REALISTIC AND VARIED:
NOT every window is lit. Rooms in use glow warmly — other rooms are dark or dim, as in a real occupied house.
Roughly half the windows show interior light — the rest are dark, reflecting the exterior sky.

LIGHT QUALITY — each lit window is different:
- Some windows have warm amber lamp glow partially blocked by a shade or curtain — the light pools unevenly, brighter at the bottom of the pane where the shade ends
- Some windows show a cooler overhead light further back in the room — dimmer, more diffuse
- One or two windows show the suggestion of a lamp silhouette visible through sheer curtain — the lampshade itself glowing

SHADOWS — realistic and pronounced:
- Each lit window casts a distinct warm rectangle of light onto the porch or ground below — but not evenly, it falls at an angle matching the interior lamp position
- Window mullions and frames cast shadow bars across the light pool on the ground
- Interior shadows are deep — furniture silhouettes, curtain folds, the edge of a bookcase — visible through the glass as dark shapes against the warm glow

The overall effect is a real house with people living in it — some rooms lit, some dark, each light telling a story.
The exterior remains in full warm daylight. Interior warmth is an accent, not a light source.
`.trim()

// ── STYLE BLOCK ───────────────────────────────────────────────
export const STYLE_BLOCK = `
MATERIALS AND STYLE:
Handcrafted miniature materials throughout — painted wood siding, realistic shingles, miniature glass, scale foliage.
Slight satin sheen — not matte, not plastic, not glossy lacquer.
Crisp physical edges and hand-crafted detail at every scale.
This is a serious architectural scale model — precise, weighty, and convincing.
`.trim()

// ── ARCHITECTURE BLOCK ────────────────────────────────────────
// Formats the GPT-4o architectural analysis as a prompt block
export function buildArchitectureBlock(description: string): string {
  // Extract geometry flags from the description to reinforce them
  const hasMansard    = /mansard/i.test(description)
  const hasOctagonal  = /octagonal|polygonal bay/i.test(description)
  const hasWrap       = /wraparound|wrap-around|wrap around/i.test(description)
  const hasBayProj    = /bay projection|projects outward/i.test(description)

  const geometryWarnings: string[] = []

  if (hasMansard) geometryWarnings.push(
    'MANSARD ROOF — CRITICAL: The lower roof slope is steep and near-vertical (approx 70-80 degrees). ' +
    'Do NOT render this as a standard hip or gable roof. The steep lower slope is a defining feature that must be clearly visible. ' +
    'The upper deck is flat or very low-pitched. Both sections must read clearly as separate roof planes.'
  )
  if (hasOctagonal) geometryWarnings.push(
    'OCTAGONAL/POLYGONAL BAY — CRITICAL: This corner MUST project outward as a multi-faceted 3D form with angled wall planes. ' +
    'It is NOT a flat wall or a simple rectangular corner. Render it as a distinct projecting bay with visible angled facets.'
  )
  if (hasWrap) geometryWarnings.push(
    'WRAPAROUND PORCH — CRITICAL: The porch wraps around the side of the building. ' +
    'Render the full extent of the porch — do not flatten it to a simple front stoop.'
  )
  if (hasBayProj) geometryWarnings.push(
    'PROJECTING BAYS — CRITICAL: Each bay described extends outward from the main wall plane as a 3D projection. ' +
    'Render each as a distinct volume, not as a flat facade element.'
  )

  const warningBlock = geometryWarnings.length > 0
    ? '\n\nGEOMETRY ENFORCEMENT — DO NOT SIMPLIFY THESE ELEMENTS:\n' + geometryWarnings.join('\n\n')
    : ''

  return [
    'THIS SPECIFIC BUILDING — ARCHITECTURAL ANALYSIS:',
    'The following is a precise architectural analysis of the source image.',
    'Use this to accurately reconstruct the 3D form, geometry, and details of this exact building.',
    'Every element described below must be present in the scale model.',
    '',
    description,
    warningBlock,
    '',
    'Reproduce ALL of the above exactly. Do not simplify, omit, or substitute any described element.',
  ].join('\n').trim()
}

// ── PROMPT BUILDER HELPER ─────────────────────────────────────
// Shared by all season generators — inserts architecture description and interior lights
export function buildSeasonPrompt(
  blocks: string[],
  params: BaseParams
): string {
  const withLights = params.interiorLights !== false
  let allBlocks = [...blocks]

  // Insert INTERIOR_LIGHTS_BLOCK after LIGHTING_BLOCK (index 1) if enabled
  if (withLights) {
    allBlocks = [...allBlocks.slice(0, 2), INTERIOR_LIGHTS_BLOCK, ...allBlocks.slice(2)]
  }

  // Insert ARCHITECTURE_BLOCK right after STRUCTURE_BLOCK (index 0) if we have a description
  if (params.architectureDescription?.trim()) {
    const archBlock = buildArchitectureBlock(params.architectureDescription)
    allBlocks = [allBlocks[0], archBlock, ...allBlocks.slice(1)]
  }

  const prompt = allBlocks.join('\n\n')

  return params.manual_prompt?.trim()
    ? `${prompt}\n\nMANUAL OVERRIDE:\n${params.manual_prompt.trim()}`
    : prompt
}

// ── SOURCE PRE-PROCESSING ─────────────────────────────────────
export async function prepareSourceImage(sourceB64: string): Promise<Buffer> {
  const sourceBuf = Buffer.from(sourceB64, 'base64')

  const stats     = await sharp(sourceBuf).greyscale().stats()
  const srcBright = stats.channels[0].mean
  const target    = 165
  const preLift   = srcBright < target ? Math.min(target / srcBright, 2.5) : 1.0

  console.log(`[generate] Source brightness: ${Math.round(srcBright)} — lift: ${preLift.toFixed(2)}`)

  if (preLift > 1.0) {
    return sharp(sourceBuf).modulate({ brightness: preLift }).png().toBuffer()
  }
  return sourceBuf
}

// ── API CALL ──────────────────────────────────────────────────
export async function callGenerateAPI(
  sourceB64:    string,
  prompt:       string,
  openaiApiKey: string
): Promise<string> {
  const openai = new OpenAI({ apiKey: openaiApiKey })
  const file   = await toFile(
    Buffer.from(sourceB64, 'base64'),
    'source.png',
    { type: 'image/png' }
  )
  const res = await openai.images.edit({
    model:  'gpt-image-1',
    image:  file,
    prompt,
    size:   '1024x1024',
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('generate_failed')
  return b64
}
