import sharp from 'sharp'

const CANVAS_W = 1500
const CANVAS_H = 1200

export async function compositeFinal(input: {
  placedPngB64: string
}) {
  const placedBuf = Buffer.from(input.placedPngB64, 'base64')

  const bgBuf = await sharp({
    create: {
      width: CANVAS_W,
      height: CANVAS_H,
      channels: 3,
      background: { r: 245, g: 245, b: 245 }
    }
  })
    .jpeg({ quality: 97 })
    .toBuffer()

  const output = await sharp(bgBuf)
    .composite([{ input: placedBuf, left: 0, top: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer()

  return { jpegB64: output.toString('base64') }
}