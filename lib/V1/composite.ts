// ─────────────────────────────────────────────────────────────
// MODULE 3 — COMPOSITE
// lib/v1/composite.ts
//
// ONE JOB: Take the placed diorama and produce the final image.
//
// Responsibilities:
//   - Load background scene
//   - Build contact shadow (base footprint only)
//   - Build table reflection (flipped, faded)
//   - Composite in correct layer order
//   - Return final JPEG
//
// Does NOT handle:
//   - Generation
//   - Canvas placement or margins
//   - Prompt logic
// ─────────────────────────────────────────────────────────────

import sharp from 'sharp'
import path  from 'path'
import fs    from 'fs'

const CANVAS_W = 1500
const CANVAS_H = 1200

// ── TYPES ─────────────────────────────────────────────────────

export interface CompositeInput {
  placedPngB64:   string    // From place.ts — RGBA PNG on 1500x1200 transparent canvas
  visibleBottomY: number    // Canvas Y of visible base bottom
  dioramaLeft:    number
  dioramaW:       number
}

export interface CompositeResult {
  jpegB64: string           // Final 5:4 JPEG, ready to display
}

// ── CONTACT SHADOW ────────────────────────────────────────────
// Ellipse under the base. Stays within base footprint.
// Spec: opacity 0.22-0.28, blur 18-26px, height ~20% of base width.

async function makeContactShadow(baseW: number): Promise<Buffer> {
  const w = baseW
  const h = Math.round(baseW * 0.20)

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="cs" cx="50%" cy="38%" r="52%">
        <stop offset="0%"   stop-color="rgba(0,0,0,0.26)"/>
        <stop offset="60%"  stop-color="rgba(0,0,0,0.12)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </radialGradient>
    </defs>
    <ellipse cx="${w/2}" cy="${h*0.38}" rx="${w*0.48}" ry="${h*0.58}"
      fill="url(#cs)"/>
  </svg>`

  return sharp(Buffer.from(svg)).blur(22).png().toBuffer()
}

// ── TABLE REFLECTION ──────────────────────────────────────────
// Vertically flipped diorama crop, compressed, faded.
// Spec: opacity 0.07-0.11, blur 8-12px, height ~20% of source.
// Uses the bottom 30% of the diorama (base area only).

async function makeTableReflection(
  placedBuf: Buffer,
  left: number,
  w: number,
  visibleBottomY: number
): Promise<{ buf: Buffer; top: number; left: number }> {
  // Crop just the base region from the placed canvas
  const cropH   = Math.round(w * 0.30)
  const cropTop  = Math.max(0, visibleBottomY - cropH)
  const cropLeft = left

  const cropped = await sharp(placedBuf)
    .extract({ left: cropLeft, top: cropTop, width: w, height: cropH })
    .png()
    .toBuffer()

  // Flip + squash + blur
  const reflH = Math.round(cropH * 0.70)
  const squashed = await sharp(cropped)
    .flip()
    .resize({ width: w, height: reflH, fit: 'fill' })
    .blur(10)
    .png()
    .toBuffer()

  // Fade mask: 0.09 at top, 0 at bottom
  const mask = Buffer.from(
    `<svg width="${w}" height="${reflH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="white" stop-opacity="0.09"/>
          <stop offset="35%"  stop-color="white" stop-opacity="0.04"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#fade)"/>
    </svg>`
  )

  const faded = await sharp(squashed)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return { buf: faded, top: visibleBottomY, left: cropLeft }
}

// ── MAIN ──────────────────────────────────────────────────────

export async function compositeFinal(input: CompositeInput): Promise<CompositeResult> {
  const placedBuf = Buffer.from(input.placedPngB64, 'base64')

  // 1. Background
  const bgPath = path.join(process.cwd(), 'public', 'backgrounds', 'living-room-01.jpg')
  if (!fs.existsSync(bgPath)) throw new Error(`Background not found: ${bgPath}`)

  const bgBuf = await sharp(fs.readFileSync(bgPath))
    .resize({ width: CANVAS_W, height: CANVAS_H, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 97 })
    .toBuffer()

  // 2. Contact shadow
  const shadowBuf  = await makeContactShadow(input.dioramaW)
  const shadowMeta = await sharp(shadowBuf).metadata()
  const shadowW    = shadowMeta.width  ?? input.dioramaW
  const shadowH    = shadowMeta.height ?? Math.round(input.dioramaW * 0.20)
  const shadowLeft = Math.round(input.dioramaLeft + (input.dioramaW - shadowW) / 2)
  const shadowTop  = Math.min(
    input.visibleBottomY - Math.round(shadowH * 0.35),
    CANVAS_H - shadowH - 1
  )

  // 3. Reflection
  const refl = await makeTableReflection(
    placedBuf,
    input.dioramaLeft,
    input.dioramaW,
    input.visibleBottomY
  )

  // 4. Composite — spec layer order: background → reflection → shadow → foreground
  const output = await sharp(bgBuf)
    .composite([
      { input: refl.buf,  left: refl.left,  top: refl.top   },
      { input: shadowBuf, left: shadowLeft,  top: shadowTop  },
      { input: placedBuf, left: 0,           top: 0          },
    ])
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer()

  console.log('[composite] Done')
  return { jpegB64: output.toString('base64') }
}
