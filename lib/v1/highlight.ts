import sharp from 'sharp'

export async function boostHighlights(input: {
  imageB64: string
  brightness?: number
}) {
  const buf = Buffer.from(input.imageB64, 'base64')

  const out = await sharp(buf)
    .modulate({
      brightness: input.brightness ?? 1.2,
      saturation: 1.05
    })
    .gamma(1.08)
    .linear(1.05, -5)
    .sharpen(1.2)
    .toBuffer()

  return {
    success: true,
    imageB64: out.toString('base64')
  }
}