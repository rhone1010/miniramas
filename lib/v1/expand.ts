import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

// ── GEOMETRY ─────────────────────────────────────────────────
// Expand 1024→1200 (+88px each side)
// Protection zone: 975×975 centered (offset 112px each side)
// 24px bleed gives fill real scene reference at boundary
// RGBA mask with feathered edge

const ORIG_SIZE      = 1024
const EXPANDED_SIZE  = 1200
const PAD            = (EXPANDED_SIZE - ORIG_SIZE) / 2  // 88
const PROTECT_SIZE   = 975
const PROTECT_OFFSET = (EXPANDED_SIZE - PROTECT_SIZE) / 2  // 112
const FEATHER        = 24

export async function expandScene(input: {
  imageB64:     string
  openaiApiKey: string
  expand?:      boolean
}): Promise<{ imageB64: string; warnings?: string[] }> {
  if (!input.expand) {
    return { imageB64: input.imageB64 }
  }

  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const warnings: string[] = []

  const original = Buffer.from(input.imageB64, 'base64')
  const meta     = await sharp(original).metadata()

  if (meta.width !== ORIG_SIZE || meta.height !== ORIG_SIZE) {
    warnings.push(`Source is ${meta.width}×${meta.height}, expected ${ORIG_SIZE}×${ORIG_SIZE}`)
  }

  // ── STEP 1: Pad canvas to 1200×1200 ─────────────────────────
  const padded = await sharp({
    create: {
      width:    EXPANDED_SIZE,
      height:   EXPANDED_SIZE,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .composite([{ input: original, left: PAD, top: PAD }])
    .png()
    .toBuffer()

  // ── STEP 2: RGBA mask — white=fill, black=protect ─────────────
  // Protection zone with 24px bleed into original for natural boundary
  const maskSvg = Buffer.from(
    `<svg width="${EXPANDED_SIZE}" height="${EXPANDED_SIZE}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="${EXPANDED_SIZE}" height="${EXPANDED_SIZE}" fill="white"/>` +
    `<rect x="${PROTECT_OFFSET}" y="${PROTECT_OFFSET}" ` +
    `width="${PROTECT_SIZE}" height="${PROTECT_SIZE}" fill="black"/>` +
    `</svg>`
  )

  const mask = await sharp(maskSvg)
    .blur(FEATHER)
    .greyscale()
    .png()
    .toBuffer()

  // ── STEP 3: Call gpt-image-1 for outpainting ─────────────────
  const prompt = `
Extend the image outward only.

Preserve the existing image EXACTLY:
- do not modify the diorama
- do not change lighting
- do not change brightness or contrast
- do not alter colors or materials

Only generate new outer areas:
- extend the tabletop
- extend the blurred background

The original subject must remain pixel-identical.
`.trim()

  const res = await openai.images.edit({
    model:  'gpt-image-1',
    image:  await toFile(padded, 'expanded.png', { type: 'image/png' }),
    mask:   await toFile(mask,   'mask.png',     { type: 'image/png' }),
    prompt,
    size:   '1024x1024',
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('expand_failed')

  console.log(`[expand] Done — ${ORIG_SIZE}→${EXPANDED_SIZE}px`)
  return { imageB64: b64, warnings }
}
