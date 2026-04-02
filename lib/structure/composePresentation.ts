// lib/structure/composePresentation.ts
//
// Premium compositor — 5:4 landscape canvas, warm interior scene.
// Pipeline:
//   1. Load living-room background (1536x1024)
//   2. Receive transparent RGBA diorama from gpt-image-1
//   3. Resize to 58–64% canvas width, place on table line
//   4. Light match — warm amber to match room lamps
//   5. Contact shadow — elliptical, aligned to base footprint
//   6. Table reflection — compressed, faded, restrained
//   7. Edge integration — subtle softening, no halo
//   8. Composite and return 5:4 JPEG

import sharp from 'sharp'
import path  from 'path'
import fs    from 'fs'

// ── CANVAS ────────────────────────────────────────────────────────────────────

const CANVAS_W = 1500
const CANVAS_H = 1200   // 5:4 ratio

// ── BACKGROUND LIBRARY ────────────────────────────────────────────────────────

export type BackgroundPreset = 'living_room'
export type OutputAspect     = '5:4'

export interface ComposeOptions {
  background?: BackgroundPreset
}

const BACKGROUND_FILES: Record<BackgroundPreset, string> = {
  living_room: 'living-room-01.jpg',
}

// Table line — fraction of CANVAS_H where table surface starts
const TABLE_LINE: Record<BackgroundPreset, number> = {
  living_room: 0.56,
}

// ── CONTACT SHADOW ────────────────────────────────────────────────────────────
// Spec: opacity core 0.22–0.30, blur 18–32px, vertical squash 0.18–0.28 of base diameter
// Must visually seat the object — not crush it with a hard dark ring.

async function makeContactShadow(baseW: number, _baseH: number): Promise<Buffer> {
  // Shadow width = 96% of base, height = 0.22 of base width (perspective squash)
  const w = Math.round(baseW * 1.0)
  const h = Math.round(baseW * 0.22)

  // Single ellipse, soft blur — no hard core ring. Darkest at center, fades naturally.
  const shadow = await sharp(Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cs" cx="50%" cy="40%" r="52%">
          <stop offset="0%"   stop-color="rgba(0,0,0,0.28)"/>
          <stop offset="55%"  stop-color="rgba(0,0,0,0.14)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="${w/2}" cy="${h*0.40}" rx="${w*0.48}" ry="${h*0.55}"
        fill="url(#cs)"/>
    </svg>`
  )).blur(22).png().toBuffer()

  return shadow
}

// ── TABLE REFLECTION ──────────────────────────────────────────────────────────
// Spec: flipped object, compress 70-85% vertically, opacity 0.07-0.14, blur 6-14px,
// fade out by 18-28% of object height. Table texture must remain visible through it.
// Over blend at low opacity — NOT screen (screen ignores table texture).
//
// We crop only the bottom 28% of the diorama (the base area), flip it, squash to
// 75% of that crop height, apply opacity 0.10 max with linear top→bottom fade.
// Result: base rim and lower landscaping visible, house body almost gone, table shows through.

async function makeTableReflection(diorama: Buffer, _baseW: number): Promise<Buffer> {
  const { width: w = 0, height: h = 0 } = await sharp(diorama).metadata()

  // Crop bottom 28% — the base + lower landscaping only
  const cropH = Math.round(h * 0.28)
  const cropped = await sharp(diorama)
    .extract({ left: 0, top: h - cropH, width: w, height: cropH })
    .png()
    .toBuffer()

  // Flip vertically so base rim appears at top of reflection (contact point)
  const flipped = await sharp(cropped).flip().png().toBuffer()

  // Squash to 75% of crop height — compressed table reflection
  const reflH = Math.round(cropH * 0.75)

  const squashed = await sharp(flipped)
    .resize({ width: w, height: reflH, fit: 'fill' })
    .blur(10)
    .png()
    .toBuffer()

  // Opacity mask: 0.10 at top (base contact rim), decays to 0 by bottom
  // Table texture always shows through — this is a whisper, not a mirror
  const mask = Buffer.from(
    `<svg width="${w}" height="${reflH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="white" stop-opacity="0.11"/>
          <stop offset="28%"  stop-color="white" stop-opacity="0.06"/>
          <stop offset="60%"  stop-color="white" stop-opacity="0.02"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#rfade)"/>
    </svg>`
  )

  return sharp(squashed)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export async function composeMiniramaPresentation(
  dioramaB64: string,
  options:    ComposeOptions = {},
): Promise<string> {
  const { background = 'living_room' } = options

  // ── 1. Load + resize background to 5:4 canvas ─────────────────────────
  const bgFile = BACKGROUND_FILES[background]
  const bgPath = path.join(process.cwd(), 'public', 'backgrounds', bgFile)
  if (!fs.existsSync(bgPath)) {
    throw new Error(`Background not found: ${bgPath}`)
  }

  const bgBuffer = await sharp(fs.readFileSync(bgPath))
    .resize({ width: CANVAS_W, height: CANVAS_H, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 97 })
    .toBuffer()

  console.log(`[compose] Canvas: ${CANVAS_W}x${CANVAS_H} (5:4)`)

  // ── 2. Decode transparent diorama ─────────────────────────────────────
  const rawBuffer = Buffer.from(dioramaB64, 'base64')
  const rawMeta   = await sharp(rawBuffer).metadata()
  const srcW      = rawMeta.width  ?? 1024
  const srcH      = rawMeta.height ?? 1024
  console.log(`[compose] Diorama source: ${srcW}x${srcH} ch:${rawMeta.channels}`)

  // ── 3. Chroma key — remove #FF69B4 hot pink background ───────────────────
  // Hot pink never appears in diorama content — safe zero-risk removal
  const { data: rawData, info: rawInfo } = await sharp(rawBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pw     = rawInfo.width
  const ph     = rawInfo.height
  const pixels = new Uint8Array(rawData.buffer)

  // Target: #FF69B4 = rgb(255, 105, 180)
  const TARGET_R = 255, TARGET_G = 105, TARGET_B = 180
  // Tolerance 40: catches true hot pink bg (dist 0-30) and a narrow feather zone (30-40).
  // Pink/salmon house siding sits at dist 52+, safely outside — no longer eaten.
  const TOLERANCE = 40
  const FEATHER_START = 30   // fully transparent below this
  const FEATHER_WIDTH = TOLERANCE - FEATHER_START  // feather zone width

  for (let i = 0; i < pw * ph; i++) {
    const p = i * 4
    const r = pixels[p], g = pixels[p+1], b = pixels[p+2]
    const dist = Math.sqrt(
      (r - TARGET_R)**2 + (g - TARGET_G)**2 + (b - TARGET_B)**2
    )
    if (dist <= TOLERANCE) {
      // Feather: fully transparent in core, ramps to full opacity at boundary
      pixels[p+3] = dist < FEATHER_START
        ? 0
        : Math.round(((dist - FEATHER_START) / FEATHER_WIDTH) * 255)
    }
  }

  const cleanBuffer = await sharp(Buffer.from(pixels.buffer), {
    raw: { width: pw, height: ph, channels: 4 }
  }).png().toBuffer()

  console.log(`[compose] Chroma key complete`)

  // ── PASS 2: INTERIOR WINDOW GLOW (only post-effect on diorama) ─────────────
  // Warm amber flood over the building zone — ensures ALL windows receive glow
  // regardless of their position. Narrow targeted gradients were missing right-side
  // windows (cx=28/45% with r=18% doesn't reach x=60-70% of image).
  //
  // Approach: broad soft rect over building zone (x:15-85%, y:15-80%) at moderate opacity,
  // plus a subtle hot-spot in the center-left where door/porch typically sits.
  // Screen blend — purely additive, never darkens walls.

  async function applyWindowGlow(input: Buffer): Promise<Buffer> {
    const { width: w = 0, height: h = 0 } = await sharp(input).metadata()

    const glowOverlay = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Broad building-zone flood: covers entire structure x:10-90%, y:15-82% -->
          <radialGradient id="flood" cx="50%" cy="52%" r="42%">
            <stop offset="0%"   stop-color="rgb(255,170,40)" stop-opacity="0.22"/>
            <stop offset="60%"  stop-color="rgb(255,165,35)" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="rgb(255,160,30)" stop-opacity="0"/>
          </radialGradient>
          <!-- Porch/door warm hotspot — center-left -->
          <radialGradient id="door" cx="38%" cy="62%" r="16%">
            <stop offset="0%"   stop-color="rgb(255,175,45)" stop-opacity="0.30"/>
            <stop offset="100%" stop-color="rgb(255,175,45)" stop-opacity="0"/>
          </radialGradient>
          <!-- Upper floor accent — center-right (hits right-side windows) -->
          <radialGradient id="upper" cx="62%" cy="35%" r="18%">
            <stop offset="0%"   stop-color="rgb(255,172,42)" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="rgb(255,172,42)" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#flood)"/>
        <rect width="100%" height="100%" fill="url(#door)"/>
        <rect width="100%" height="100%" fill="url(#upper)"/>
      </svg>`
    )

    return sharp(input)
      .composite([{ input: glowOverlay, blend: 'screen' }])
      .png()
      .toBuffer()
  }

  // Apply interior glow only — no brightness boost, no saturation shift, no linear lift
  const withGlow = await applyWindowGlow(cleanBuffer)
  console.log(`[compose] Window glow applied — no brightness modification`)

  // ── PASS 3: LIGHTING MATCH — colour temperature only ─────────────────────────
  // Spec: match white balance to background midtones, then apply subtle warm bias.
  // The living-room background has a warm amber temperature (~5000K equivalent).
  // The generation output is neutral. We apply a tiny warm tint + saturation lift
  // to colour-match — NOT a brightness change.
  // This is done via a semi-transparent warm amber rect over the diorama at low opacity.
  const warmTint = await (async () => {
    const { width: tw, height: th } = await sharp(withGlow).metadata()
    const tintSvg = Buffer.from(
      `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="rgb(255,185,90)" fill-opacity="0.06"/>
      </svg>`
    )
    return sharp(withGlow)
      .composite([{ input: tintSvg, blend: 'multiply' }])
      .modulate({ saturation: 1.08 })
      .png()
      .toBuffer()
  })()

  // ── PASS 4: EDGE INTEGRATION — 1-2px perimeter darkening ─────────────────────
  // Spec: no cutout edges or halos. Micro-darken perimeter to anchor object naturally.
  // Creates a tiny inner shadow at the RGBA boundary without touching the interior.
  const withEdge = await (async () => {
    const { width: ew, height: eh } = await sharp(warmTint).metadata()
    // 2px dark inner border drawn on transparent background, composited multiply
    const edgeSvg = Buffer.from(
      `<svg width="${ew}" height="${eh}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="none"
          stroke="rgba(0,0,0,0.35)" stroke-width="3"/>
      </svg>`
    )
    return sharp(warmTint)
      .composite([{ input: edgeSvg, blend: 'multiply' }])
      .png()
      .toBuffer()
  })()

  const dioramaLifted = withEdge
  console.log(`[compose] Lighting match + edge integration applied`)

  // ── 4. Resize to target dimensions ──────────────────────────────────────
  const targetW    = Math.round(CANVAS_W * 0.61)
  const liftedMeta = await sharp(dioramaLifted).metadata()
  const lW         = liftedMeta.width  ?? srcW
  const lH         = liftedMeta.height ?? srcH
  const targetH    = Math.round((targetW / lW) * lH)
  const clampedH   = Math.min(targetH, Math.round(CANVAS_H * 0.88))
  const clampedW   = clampedH < targetH
    ? Math.round((clampedH / lH) * lW)
    : targetW

  console.log(`[compose] Diorama target: ${clampedW}x${clampedH}`)

  const dioramaFinal = await sharp(dioramaLifted)
    .resize({ width: clampedW, height: clampedH, fit: 'fill' })
    .png()
    .toBuffer()

  // ── 5. Placement ──────────────────────────────────────────────────────
  const left        = Math.round((CANVAS_W - clampedW) / 2)
  const tableLineY  = Math.round(CANVAS_H * TABLE_LINE[background])
  const minTop      = Math.round(CANVAS_H * 0.03)
  const top         = Math.max(minTop, tableLineY - clampedH)
  const baseBottomY = top + clampedH   // bounding box bottom — includes transparent padding

  // ── DETECT VISUAL BASE BOTTOM ─────────────────────────────────────────
  // gpt-image-1 generates 1024x1024 with transparent padding around the diorama.
  // After resize, baseBottomY (top + clampedH) is the BOUNDING BOX bottom —
  // not the visible base edge. Measured gap is ~300px on a 915px tall image.
  // All grounding effects MUST use visibleBaseBottomY, not baseBottomY.
  //
  // Method: scan resized diorama RGBA bottom-up, find last row with alpha > 20
  // across at least 10% of its width. That row = visible base bottom.
  const { data: scanData, info: scanInfo } = await sharp(dioramaFinal)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const scanW = scanInfo.width
  const scanH = scanInfo.height
  let   visibleBottomRow = scanH - 1   // fallback: bounding box bottom
  for (let y = scanH - 1; y >= 0; y--) {
    let solidCount = 0
    for (let x = 0; x < scanW; x++) {
      if (scanData[(y * scanW + x) * 4 + 3] > 20) solidCount++
    }
    if (solidCount > scanW * 0.10) {
      visibleBottomRow = y
      break
    }
  }
  const visibleBaseBottomY = top + visibleBottomRow
  console.log(`[compose] baseBottomY=${baseBottomY}  visibleBaseBottomY=${visibleBaseBottomY}  gap=${baseBottomY - visibleBaseBottomY}px`)
  console.log(`[compose] Placed: left=${left} top=${top} baseBottom=${baseBottomY}`)

  // ── 6. Contact shadow — Stage 4C spec ────────────────────────────────────
  // Derived from base silhouette. Stays within base footprint — no directional spread.
  // Spec: blur 18-32px, opacity 0.22-0.30, vertical squash ~20%, width ~95-100% of base.
  const baseW      = Math.round(clampedW * 0.96)
  const shadow     = await makeContactShadow(baseW, baseW)
  const shadowMeta = await sharp(shadow).metadata()
  const shadowW2   = shadowMeta.width  ?? baseW
  const shadowH2   = shadowMeta.height ?? Math.round(baseW * 0.22)
  const shadowLeft = Math.round(left + (clampedW - shadowW2) / 2)
  const shadowTop  = Math.min(
    visibleBaseBottomY - Math.round(shadowH2 * 0.38),
    CANVAS_H - shadowH2 - 1
  )

  // ── 7. Table reflection — Stage 4B spec ──────────────────────────────────
  const refl     = await makeTableReflection(dioramaFinal, clampedW)
  const reflMeta = await sharp(refl).metadata()
  const reflH2   = reflMeta.height ?? 0
  const reflW2   = reflMeta.width  ?? clampedW
  const reflLeft    = Math.max(0, left + Math.round((clampedW - reflW2) / 2))
  const reflTop     = Math.min(visibleBaseBottomY, CANVAS_H - reflH2 - 1)
  const reflRight   = reflLeft + reflW2
  const reflCropped = reflRight > CANVAS_W
    ? await sharp(refl).extract({ left: 0, top: 0, width: CANVAS_W - reflLeft, height: reflH2 }).png().toBuffer()
    : refl

  // ── 8. Composite — Stage 4 spec layer order: background → reflection → shadow → foreground
  // Directional shadow removed: extends beyond base footprint (violates pipeline spec).
  // Rim shadow removed: same reason.
  const output = await sharp(bgBuffer)
    .composite([
      { input: reflCropped,  left: reflLeft,   top: reflTop,  blend: 'over' },
      { input: shadow,       left: shadowLeft,  top: shadowTop               },
      { input: dioramaFinal, left,              top,           blend: 'over' },
    ])
    .jpeg({ quality: 96, mozjpeg: true })
  .toBuffer()

  console.log('[compose] Complete')
  return output.toString('base64')
}
