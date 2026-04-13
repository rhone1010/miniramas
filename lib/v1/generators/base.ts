import sharp from 'sharp'

// ── SHARED TYPES ──────────────────────────────────────────────
export type BaseParams = {
  lighting_preset?:   string
  interior_lights?:   boolean   // daytime only — subtle warm glow
  customPrompt?:      string    // replaces entire prompt
  brightness?:        number    // levels circular boost override
  expand?:            boolean
  name?:              string
  _preset?:           string
  _expStr?:           string
}

export type GenerateResult = {
  imageB64:    string
  promptUsed:  string
}

// ── SHARED PROMPT BLOCKS ──────────────────────────────────────

export const STRUCTURE_BLOCK = `
SOURCE IMAGE IS THE GROUND TRUTH FOR ARCHITECTURE ONLY:
- Exact structure geometry, proportions, layout, and architectural identity
- All structural elements preserved with high fidelity: rooflines, windows, trim, materials, porch, chimney
- Geographic location determines plant species only
DO NOT alter structure design in any way.
DO NOT use source image for lighting, landscaping, camera angle, or scene mood.
`.trim()

export const CAMERA_BLOCK = `
CAMERA (MANDATORY — IGNORE SOURCE CAMERA ANGLE):
The source photo camera angle is irrelevant — do not reproduce it.
Camera is elevated 24-30 inches above desk, tilted downward at 55 degrees toward the diorama.
Light source is positioned above and behind the camera — front facade receives direct illumination.
Shadows fall behind and to the sides of architectural features (trim, moldings, railings, eaves).
Shadow edges define and enhance every architectural detail.
Camera physically pulled back so subject occupies ~60-65% of frame width.
MARGINS (CRITICAL): The full circular base must be completely visible on all four sides.
Clear desk surface must be visible surrounding the base — minimum 15% of frame width on each side.
Do not crop the base, do not fill the frame edge to edge.
The diorama is a small object on a large desk — frame it as such.
`.trim()

export const LANDSCAPING_BLOCK = `
LANDSCAPING (NATURALISTIC):
Organic, asymmetrical layout — no patterns, no symmetry.
Natural clustering of plants with varied heights and density.
Soft transitions between lawn, beds, and hardscape.
Regionally appropriate plant species based on source location.
Preserve walkway/sidewalk placement from source if present.
Must feel like a professionally designed real yard at miniature scale.
`.trim()

export const STYLE_BLOCK = `
STYLE:
Museum-quality architectural scale model — not a toy.
Full structural fidelity with realistic materials: wood, resin, glass, foliage.
The house is shiny and hand-crafted on a round wooden diorama base.
Diorama sits on a highly detailed dark walnut desk with visible grain and soft reflection.
Trees frame the sides and back of the house.
Everything on the diorama is sharp and in focus. Room has strong depth of field.
The room feel, colors, trim, and windows complement the model architecture.
`.trim()

// ── SOURCE PRE-PROCESSING ─────────────────────────────────────
const CANVAS_SIZE  = 1024
const SUBJECT_SIZE = Math.round(CANVAS_SIZE * 0.60)

export async function prepareSourceImage(
  sourceB64:      string,
  targetBrightness: number  // 0 = skip lift
): Promise<Buffer> {
  const sourceBuf = Buffer.from(sourceB64, 'base64')

  const stats     = await sharp(sourceBuf).greyscale().stats()
  const srcBright = stats.channels[0].mean

  let processed: Buffer = sourceBuf
  if (targetBrightness > 0 && srcBright < targetBrightness) {
    const mult = Math.min(targetBrightness / srcBright, 3.0)
    console.log(`[generate] Source: ${Math.round(srcBright)} → target: ${targetBrightness} — lift: ${mult.toFixed(2)}`)
    processed = await sharp(sourceBuf).modulate({ brightness: mult }).png().toBuffer()
  } else {
    console.log(`[generate] Source: ${Math.round(srcBright)} — no lift`)
  }

  const resized = await sharp(processed)
    .resize(SUBJECT_SIZE, SUBJECT_SIZE, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()

  const meta = await sharp(resized).metadata()
  const left = Math.round((CANVAS_SIZE - meta.width!)  / 2)
  const top  = Math.round((CANVAS_SIZE - meta.height!) / 2)

  return sharp({
    create: {
      width: CANVAS_SIZE, height: CANVAS_SIZE,
      channels: 3,
      background: { r: 160, g: 155, b: 148 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer()
}
