// brand-overlay.ts
// lib/v1/brand-overlay.ts
//
// Composites the miniRama wordmark onto a generated image at bottom-right.
// Soft fail: if the wordmark asset is missing, returns the input unchanged
// with a warning logged. Never blocks the main generation.
//
// Place the wordmark PNG at:  public/brand/minirama-wordmark.png
//   - Should be a PNG with transparency
//   - Recommended dimensions: ~400px wide, height auto. The composite
//     resizes it to ~3% of the source image width regardless.
//
// To customize position/size, tweak the constants below.

import sharp from 'sharp'
import path  from 'path'
import fs    from 'fs/promises'

const WORDMARK_PATH    = path.join(process.cwd(), 'public/brand/minirama-wordmark.png')
const TARGET_WIDTH_PCT = 0.10   // wordmark width as fraction of image width
const EDGE_MARGIN_PCT  = 0.025  // margin from edges as fraction of image width
const OPACITY          = 0.70

let wordmarkBufCache: Buffer | null = null
let wordmarkMissingLogged = false

async function loadWordmark(): Promise<Buffer | null> {
  if (wordmarkBufCache) return wordmarkBufCache
  try {
    wordmarkBufCache = await fs.readFile(WORDMARK_PATH)
    return wordmarkBufCache
  } catch {
    if (!wordmarkMissingLogged) {
      console.warn(
        `[brand-overlay] wordmark not found at ${WORDMARK_PATH} — ` +
        `outputs will ship without brand mark. Drop the asset to enable.`
      )
      wordmarkMissingLogged = true
    }
    return null
  }
}

export async function applyBrandOverlay(input: {
  imageB64: string
}): Promise<{ imageB64: string; applied: boolean }> {
  const wordmark = await loadWordmark()
  if (!wordmark) {
    return { imageB64: input.imageB64, applied: false }
  }

  try {
    const imgBuf  = Buffer.from(input.imageB64, 'base64')
    const imgMeta = await sharp(imgBuf).metadata()
    const W = imgMeta.width  ?? 1024
    const H = imgMeta.height ?? 1024

    const targetW = Math.round(W * TARGET_WIDTH_PCT)
    const margin  = Math.round(W * EDGE_MARGIN_PCT)

    // Resize wordmark and apply opacity
    const wmResized = await sharp(wordmark)
      .resize({ width: targetW })
      .ensureAlpha()
      .composite([{
        input: Buffer.from([255, 255, 255, Math.round(255 * (1 - OPACITY))]),
        raw:   { width: 1, height: 1, channels: 4 },
        tile:  true,
        blend: 'dest-in',
      }])
      .png()
      .toBuffer()

    const wmMeta = await sharp(wmResized).metadata()
    const wmH = wmMeta.height ?? 60

    const left = W - targetW - margin
    const top  = H - wmH     - margin

    const composited = await sharp(imgBuf)
      .composite([{ input: wmResized, left, top }])
      .jpeg({ quality: 95 })
      .toBuffer()

    return {
      imageB64: composited.toString('base64'),
      applied:  true,
    }
  } catch (e: any) {
    console.warn(`[brand-overlay] composite failed: ${e.message} — shipping unbranded`)
    return { imageB64: input.imageB64, applied: false }
  }
}
