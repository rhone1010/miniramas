import sharp from 'sharp'

export async function analyzeImage(imageB64: string) {
  const buf = Buffer.from(imageB64, 'base64')

  const stats = await sharp(buf).stats()

  const brightness = stats.channels[0].mean
  const contrast = stats.channels[0].stdev

  return {
    brightness,
    contrast
  }
}