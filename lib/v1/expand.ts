import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

const TARGET_SIZE = '1024x1024'

export async function expandScene(input: {
  imageB64:     string
  openaiApiKey: string
  expand?:      boolean
}) {
  if (!input.expand) {
    return { imageB64: input.imageB64, warnings: [] }
  }

  const openai   = new OpenAI({ apiKey: input.openaiApiKey })
  const original = Buffer.from(input.imageB64, 'base64')
  const meta     = await sharp(original).metadata()
  const w        = meta.width!
  const h        = meta.height!
  const warnings: string[] = []

  // Square validation
  if (w !== h) {
    warnings.push(`expand_input_not_square: ${w}x${h}`)
    console.warn(`[expand] Input not square (${w}x${h})`)
  }

  const pad  = Math.round(w * 0.12)
  const newW = w + pad * 2
  const newH = h + pad * 2

  // Expanded canvas — original centred
  const expanded = await sharp({
    create: { width: newW, height: newH, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .composite([{ input: original, left: pad, top: pad }])
    .png()
    .toBuffer()

  // ── MASK — must be RGBA (4 channels) ─────────────────────────
  // alpha=255 (opaque)    = preserve original
  // alpha=0   (transparent) = regenerate this area
  const innerMask = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
  })
    .png()
    .toBuffer()

  const mask = await sharp({
    create: { width: newW, height: newH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  })
    .composite([{ input: innerMask, left: pad, top: pad }])
    .png()
    .toBuffer()

  const prompt = `
Extend the image outward only.

Do not modify the existing diorama.
Preserve lighting, materials, and composition exactly.

Only extend:
- desk surface
- background environment

Maintain consistent perspective and lighting.
`.trim()

  const res = await openai.images.edit({
    model: 'gpt-image-1',
    image: await toFile(expanded, 'expanded.png', { type: 'image/png' }),
    mask:  await toFile(mask,     'mask.png',     { type: 'image/png' }),
    prompt,
    size:  TARGET_SIZE,
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('expand_failed')

  console.log('[expand] Done — ' + TARGET_SIZE)
  return { imageB64: b64, warnings }
}
