import sharp from 'sharp'
import OpenAI, { toFile } from 'openai'

// ── SHARED TYPES ──────────────────────────────────────────────
export type Preset =
  | 'summer' | 'spring' | 'fall' | 'winter'
  | 'flood'  | 'fire'   | 'abandoned' | 'explosion'

export type BaseParams = {
  preset?:        Preset | string
  customPrompt?:  string
  manual_prompt?: string
  structureBlock?: string
  // pipeline params — not injected into prompt
  brightness?:    number
  expand?:        boolean
  name?:          string
  _preset?:       string
  _expStr?:       string
}

export type GenerateResult = {
  imageB64:         string
  promptUsed:       string
  manualPromptUsed: string | null
}

// ── STRUCTURE BLOCK ───────────────────────────────────────────
export const STRUCTURE_BLOCK = `
SOURCE IMAGE IS THE GROUND TRUTH FOR ARCHITECTURE ONLY:
- Exact structure geometry, proportions, layout, and architectural identity
- All structural elements preserved: rooflines, windows, trim, materials, porch, chimney
- Geographic location determines plant species only

DO NOT alter structure design in any way.

IGNORE FROM SOURCE — DO NOT DERIVE THESE FROM THE SOURCE IMAGE:
- Landscaping style, layout, or any implied design
- Time of day, lighting, exposure, or scene mood
- Camera angle or position
`.trim()

// ── CAMERA BLOCK ──────────────────────────────────────────────
export const CAMERA_BLOCK = `
CAMERA (MANDATORY — IGNORE SOURCE CAMERA ANGLE COMPLETELY):
The source photo camera angle is irrelevant — do not reproduce it.
Camera is elevated 24-30 inches above the desk, tilted downward at 55 degrees toward the diorama.
Camera physically pulled back so subject occupies ~60-65% of frame width.
Full base and desk surface visible as natural margin on all sides — minimum 15% each side.
The diorama is a small object on a large desk — frame it as such.
Do not use any street-level, eye-level, or facade-facing angle from the source photo.
`.trim()

// ── SCALE BLOCK ───────────────────────────────────────────────
export const SCALE_BLOCK = `
SCALE AND SPACING (CRITICAL):
The house occupies NO MORE than 60-70% of the diorama base diameter.
Visible landscaped ground surrounds the house on all sides of the base.
The full circular base perimeter must always be visible — never cropped.
Trees always frame the left, right, and rear of the base — mandatory.
`.trim()

// ── LIGHTING BLOCK (locked to midday for all presets) ─────────
export const LIGHTING_BLOCK = `
LIGHTING: BRIGHT NATURAL DAYLIGHT
Light source positioned above and behind camera — front facade fully and directly illuminated.
Strong directional sunlight with crisp shadow edges on trim, moldings, railings, and eaves.
High contrast, bright clean exposure, neutral-warm color temperature.
Strong specular highlights on glass, polished wood, and resin surfaces.
The diorama is the brightest, most defined element in the frame.
`.trim()

// ── STYLE BLOCK ───────────────────────────────────────────────
export const STYLE_BLOCK = `
STYLE:
Museum-quality architectural scale model — not a toy.
Full structural fidelity with realistic materials: wood, resin, glass, foliage.
The house is shiny and handcrafted — premium collectible quality.
`.trim()

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
