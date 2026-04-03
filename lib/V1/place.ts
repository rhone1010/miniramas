import sharp from 'sharp'

const CANVAS_W = 1500
const CANVAS_H = 1200
const OBJ_WIDTH = 0.42   // ← KEY CHANGE (more space)
const TABLE_LINE = 0.56
const MIN_TOP_PAD = 0.04

async function findVisualBottom(buf: Buffer): Promise<number> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const w = info.width, h = info.height
  const px = new Uint8Array(data.buffer)

  for (let y = h - 1; y >= 0; y--) {
    let solid = 0
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 20) solid++
    }
    if (solid > w * 0.10) return y
  }
  return h - 1
}

export async function placeDiorama(input: {
  imagePngB64: string
}) {
  const srcBuf = Buffer.from(input.imagePngB64, 'base64')
  const meta = await sharp(srcBuf).metadata()

  const srcW = meta.width ?? 1024
  const srcH = meta.height ?? 1024

  const targetW = Math.round(CANVAS_W * OBJ_WIDTH)
  const scale = targetW / srcW
  const targetH = Math.round(srcH * scale)

  const maxH = Math.round(CANVAS_H * (1 - MIN_TOP_PAD))
  const clampedH = Math.min(targetH, maxH)
  const clampedW = clampedH < targetH
    ? Math.round(srcW * (clampedH / srcH))
    : targetW

  const resized = await sharp(srcBuf)
    .resize({ width: clampedW, height: clampedH, fit: 'fill' })
    .png()
    .toBuffer()

  const tableLineY = Math.round(CANVAS_H * TABLE_LINE)
  const left = Math.round((CANVAS_W - clampedW) / 2)
  const top = Math.max(
    Math.round(CANVAS_H * MIN_TOP_PAD),
    tableLineY - clampedH
  )

  const visibleRow = await findVisualBottom(resized)
  const visibleBottomY = top + visibleRow

  const placed = await sharp({
    create: {
      width: CANVAS_W,
      height: CANVAS_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer()

  return {
    placedPngB64: placed.toString('base64'),
    visibleBottomY,
    dioramaLeft: left,
    dioramaTop: top,
    dioramaW: clampedW,
    dioramaH: clampedH,
  }
}