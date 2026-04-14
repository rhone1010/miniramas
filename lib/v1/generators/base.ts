import sharp from 'sharp'
import OpenAI, { toFile } from 'openai'

// ── SHARED TYPES ──────────────────────────────────────────────
export type LightingPreset = 'midday_summer' | 'soft_spring' | 'dusk_evening' | 'night'

export type BaseParams = {
  lighting_preset?:  LightingPreset | string
  landscaping?:      'sparse' | 'moderate' | 'lush' | string
  interior_lights?:  boolean
  customPrompt?:     string
  manual_prompt?:    string
  structureBlock?:   string
  // pipeline params — not injected into prompt
  brightness?:       number
  expand?:           boolean
  name?:             string
  _preset?:          string
  _expStr?:          string
  // legacy UI compat
  lighting?:         string
  color?:            string
  detail?:           string
  environment_style?: string
  prop_density?:     string
  background_structure?: string
  interior_lighting?: string
}

export type GenerateResult = {
  imageB64:         string
  promptUsed:       string
  manualPromptUsed: string | null
}

// ── STRUCTURE BLOCK ───────────────────────────────────────────
// Source image is ground truth for architecture only.
// Everything else — lighting, landscaping, camera — is overridden.

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
// Consistent across all four lighting modes.

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
// House-to-base ratio and tree framing rules.

export const SCALE_BLOCK = `
SCALE AND SPACING (CRITICAL):
The house occupies NO MORE than 60-70% of the diorama base diameter.
Visible landscaped ground surrounds the house on all sides of the base.
The full circular base perimeter must always be visible — never cropped.
Trees ALWAYS frame the left, right, and rear of the base — mandatory, never optional.
`.trim()

// ── SOURCE PRE-PROCESSING ─────────────────────────────────────
// Brightness pre-lift for daylight modes so model doesn't anchor
// to overcast source and generate dim output.
// Dark modes (dusk/night) skip lift — model generates its own mood.

export async function prepareSourceImage(
  sourceB64: string,
  lightingPreset?: string
): Promise<Buffer> {
  const sourceBuf = Buffer.from(sourceB64, 'base64')
  const darkMode  = lightingPreset === 'night' || lightingPreset === 'dusk_evening'

  if (darkMode) {
    console.log(`[generate] Dark mode (${lightingPreset}) — no pre-lift`)
    return sourceBuf
  }

  // Brightness pre-lift for daylight modes only.
  // Color is preserved — model needs it for accurate material rendering.
  const stats     = await sharp(sourceBuf).greyscale().stats()
  const srcBright = stats.channels[0].mean
  const target    = lightingPreset === 'soft_spring' ? 150 : 165
  const preLift   = srcBright < target ? Math.min(target / srcBright, 2.5) : 1.0

  console.log(`[generate] Source brightness: ${Math.round(srcBright)} — target: ${target} — lift: ${preLift.toFixed(2)} — mode: ${lightingPreset || 'default'}`)

  if (preLift > 1.0) {
    return sharp(sourceBuf).modulate({ brightness: preLift }).png().toBuffer()
  }
  return sourceBuf
}

// ── API CALL ──────────────────────────────────────────────────
// Shared image generation call used by all lighting generators.

export async function callGenerateAPI(
  sourceB64:    string,
  prompt:       string,
  openaiApiKey: string
): Promise<string> {
  const openai = new OpenAI({ apiKey: openaiApiKey })

  const file = await toFile(
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
