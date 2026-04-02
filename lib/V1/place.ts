// ─────────────────────────────────────────────────────────────
// MODULE 2 — PLACEMENT
// lib/v1/place.ts
//
// ONE JOB: Take the transparent diorama PNG and place it
//          on a correctly-sized canvas with consistent margins.
//
// Responsibilities:
//   - Detect where the diorama visually ends (bottom scan)
//   - Scale to ~60% of canvas width
//   - Center horizontally
//   - Place base at the table line
//   - Return a RGBA PNG ready for compositing
//
// Does NOT handle:
//   - Backgrounds
//   - Shadows or reflections
//   - Color grading
// ─────────────────────────────────────────────────────────────

import sharp from 'sharp'

// ── CANVAS CONSTANTS ──────────────────────────────────────────

const CANVAS_W    = 1500
const CANVAS_H    = 1200          // 5:4 ratio
const OBJ_WIDTH   = 0.60          // diorama occupies 60% of canvas width
const TABLE_LINE  = 0.56          // table surface at 56% down the canvas
const MIN_TOP_PAD = 0.04          // at least 4% top breathing room

// ── TYPES ─────────────────────────────────────────────────────

export interface PlaceInput {
  imagePngB64: string             // Transparent RGBA PNG from generate.ts
}

export interface PlaceResult {
  placedPngB64:      string       // RGBA PNG on transparent 1500x1200 canvas
  visibleBottomY:    number       // Canvas Y of the visible base bottom
  dioramaLeft:       number       // Canvas X of diorama left edge
  dioramaTop:        number       // Canvas Y of diorama top edge
  dioramaW:          number       // Scaled diorama width in canvas px
  dioramaH:          number       // Scaled diorama height in canvas px
}

// ── HELPERS ───────────────────────────────────────────────────

// Scan bottom-up to find the last row with meaningful content.
// Stops at the first row where >10% of pixels have alpha > 20.
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
  return h - 1   // fallback: full height
}

// ── MAIN ──────────────────────────────────────────────────────

export async function placeDiorama(input: PlaceInput): Promise<PlaceResult> {
  const srcBuf  = Buffer.from(input.imagePngB64, 'base64')
  const srcMeta = await sharp(srcBuf).metadata()
  const srcW    = srcMeta.width  ?? 1024
  const srcH    = srcMeta.height ?? 1024

  // Scale diorama so its width = OBJ_WIDTH * CANVAS_W
  const targetW = Math.round(CANVAS_W * OBJ_WIDTH)
  const scale   = targetW / srcW
  const targetH = Math.round(srcH * scale)

  // Clamp height so it never goes off the top of canvas
  const maxH    = Math.round(CANVAS_H * (1 - MIN_TOP_PAD))
  const clampedH = Math.min(targetH, maxH)
  const clampedW = clampedH < targetH
    ? Math.round(srcW * (clampedH / srcH))
    : targetW

  // Resize
  const resized = await sharp(srcBuf)
    .resize({ width: clampedW, height: clampedH, fit: 'fill' })
    .png()
    .toBuffer()

  // Placement: center horizontally, base bottom on table line
  const tableLineY = Math.round(CANVAS_H * TABLE_LINE)
  const left       = Math.round((CANVAS_W - clampedW) / 2)
  const minTop     = Math.round(CANVAS_H * MIN_TOP_PAD)
  const top        = Math.max(minTop, tableLineY - clampedH)

  // Detect visual base bottom within the resized image
  const visibleRow   = await findVisualBottom(resized)
  const visibleBottomY = top + visibleRow

  console.log(`[place] src=${srcW}x${srcH}  scaled=${clampedW}x${clampedH}`)
  console.log(`[place] left=${left}  top=${top}  visibleBottom=${visibleBottomY}`)

  // Composite onto transparent canvas
  const placed = await sharp({
    create: {
      width:      CANVAS_W,
      height:     CANVAS_H,
      channels:   4,
      background: { r:0, g:0, b:0, alpha:0 },
    }
  })
    .composite([{ input: resized, left, top, blend: 'over' }])
    .png()
    .toBuffer()

  return {
    placedPngB64:   placed.toString('base64'),
    visibleBottomY,
    dioramaLeft:    left,
    dioramaTop:     top,
    dioramaW:       clampedW,
    dioramaH:       clampedH,
  }
}
