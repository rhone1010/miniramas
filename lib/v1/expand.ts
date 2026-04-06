import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

export async function expandScene(input: {
  imageB64: string
  openaiApiKey: string
  expand?: boolean
}) {
  if (!input.expand) {
    return { imageB64: input.imageB64 }
  }

  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const original = Buffer.from(input.imageB64, 'base64')
  const meta = await sharp(original).metadata()
  const w = meta.width!
  const h = meta.height!

  // 🔥 Increased padding for REAL margins
  const pad = Math.round(w * 0.18)

  // Create expanded canvas
  const expanded = await sharp({
    create: {
      width: w + pad * 2,
      height: h + pad * 2,
      channels: 3,
      background: { r: 128, g: 128, b: 128 }
    }
  })
    .composite([{ input: original, left: pad, top: pad }])
    .png()
    .toBuffer()

  // Mask: protect original, allow ONLY outer expansion
  const mask = await sharp({
    create: {
      width: w + pad * 2,
      height: h + pad * 2,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: w,
            height: h,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
          }
        }).png().toBuffer(),
        left: pad,
        top: pad
      }
    ])
    .png()
    .toBuffer()

  // 🔥 STRONG expand prompt (prevents shrink / lighting drift)
  const prompt = `
Extend the image outward only.

Do NOT modify, resize, or reposition the existing diorama.

Preserve EXACTLY:
- subject size
- subject position
- lighting
- exposure
- materials
- detail

The existing image must remain unchanged.

ONLY generate new content OUTSIDE the original image.

Extend:
- desk surface outward
- background room outward

Maintain:
- consistent perspective
- consistent lighting direction
- consistent color tone

CRITICAL:
The goal is to increase empty space around the subject.

Do NOT:
- zoom in
- crop tighter
- enlarge the subject
- alter brightness or contrast

The subject must remain centered with clearly increased margins on all sides.
`

  const res = await openai.images.edit({
    model: 'gpt-image-1',
    image: await toFile(expanded, 'expanded.png'),
    mask: await toFile(mask, 'mask.png'),
    prompt,
    size: '1024x1024'
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('expand_failed')

  return { imageB64: b64 }
}