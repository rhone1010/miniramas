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

  const padX = Math.round(w * 0.15)
  const padY = Math.round(h * 0.25)

  const expanded = await sharp({
    create: {
      width: w + padX * 2,
      height: h + padY * 2,
      channels: 3,
      background: { r: 128, g: 128, b: 128 }
    }
  })
    .composite([{ input: original, left: padX, top: padY }])
    .png()
    .toBuffer()

  const mask = await sharp({
    create: {
      width: w + padX * 2,
      height: h + padY * 2,
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
        left: padX,
        top: padY
      }
    ])
    .png()
    .toBuffer()

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
`

  const res = await openai.images.edit({
    model: 'gpt-image-1',
    image: await toFile(expanded, 'expanded.png'),
    mask: await toFile(mask, 'mask.png'),
    prompt,
    size: '1536x1024'
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('expand_failed')

  return { imageB64: b64 }
}