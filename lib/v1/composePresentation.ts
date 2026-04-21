import sharp from 'sharp'

// ── CANVAS ────────────────────────────────────────────────────
const CANVAS_W = 1280
const CANVAS_H = 960    // 4:3 — gives vertical room for tall structures

// ── DIORAMA SIZING ────────────────────────────────────────────
// Scale model + base contained within 750px width max
// Remaining (1280 - 750) = 530px → 265px padding each side (~20.7%)
const DIORAMA_MAX_W = 750

// ── VERTICAL PLACEMENT ────────────────────────────────────────
// 0.53 = slightly below center → more air above for tall rooflines/turrets
const VERTICAL_CENTER = 0.53

// ── SHADOW ────────────────────────────────────────────────────
const SHADOW_BLUR     = 28
const SHADOW_OPACITY  = 0.50
const SHADOW_OFFSET_Y = 14

// ── REFLECTION ────────────────────────────────────────────────
const REFLECTION_OPACITY = 0.20
const REFLECTION_H_RATIO = 0.10   // reflection = 10% of diorama height

// ── BACKGROUND ────────────────────────────────────────────────
// Warm dark study — radial gradient, walnut-brown center fading to near-black
const BG_WARM  = 'rgb(52,38,24)'
const BG_DARK  = 'rgb(14,10,6)'

export async function composePresentation(input: {
  imageB64: string
}): Promise<{ imageB64: string; success: boolean; error?: string }> {
  try {
    const srcBuf = Buffer.from(input.imageB64, 'base64')
    const srcMeta = await sharp(srcBuf).metadata()
    const srcW = srcMeta.width  ?? 1024
    const srcH = srcMeta.height ?? 1024

    // ── STEP 1: Scale diorama — max 750px wide ─────────────────
    // Input may be PNG with alpha (from removeBg) or JPEG — sharp handles both
    const scale   = DIORAMA_MAX_W / srcW
    const dioW    = DIORAMA_MAX_W
    const dioH    = Math.round(srcH * scale)

    const diorama = await sharp(srcBuf)
      .resize({ width: dioW, height: dioH, fit: 'fill' })
      .ensureAlpha()   // preserve transparency from removeBg
      .png()
      .toBuffer()

    // ── STEP 2: Position — centered horizontally, slight vertical bias ──
    const left    = Math.round((CANVAS_W - dioW) / 2)           // exactly centered
    const top     = Math.round(CANVAS_H * VERTICAL_CENTER - dioH / 2)
    const safeTop = Math.max(20, Math.min(top, CANVAS_H - dioH - 20))

    // ── STEP 3: Warm room background with radial vignette ─────
    const bgSvg = Buffer.from(
      `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs>` +
      `<radialGradient id="vg" cx="50%" cy="48%" r="60%">` +
      `<stop offset="0%" stop-color="${BG_WARM}"/>` +
      `<stop offset="100%" stop-color="${BG_DARK}"/>` +
      `</radialGradient>` +
      `</defs>` +
      `<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#vg)"/>` +
      `</svg>`
    )
    const background = await sharp(bgSvg).png().toBuffer()

    // ── STEP 4: Drop shadow ───────────────────────────────────
    const shadowSvg = Buffer.from(
      `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">` +
      `<ellipse ` +
      `cx="${left + dioW / 2}" ` +
      `cy="${safeTop + dioH + SHADOW_OFFSET_Y}" ` +
      `rx="${dioW * 0.40}" ` +
      `ry="${dioH * 0.035}" ` +
      `fill="rgba(0,0,0,${SHADOW_OPACITY})"/>` +
      `</svg>`
    )
    const shadow = await sharp(shadowSvg).blur(SHADOW_BLUR).png().toBuffer()

    // ── STEP 5: Desk reflection ───────────────────────────────
    const reflH = Math.round(dioH * REFLECTION_H_RATIO)
    const reflRaw = await sharp(diorama)
      .flip()
      .resize({ width: dioW, height: reflH, fit: 'fill' })
      .png()
      .toBuffer()

    const fadeSvg = Buffer.from(
      `<svg width="${dioW}" height="${reflH}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="white" stop-opacity="${REFLECTION_OPACITY}"/>` +
      `<stop offset="100%" stop-color="white" stop-opacity="0"/>` +
      `</linearGradient></defs>` +
      `<rect width="${dioW}" height="${reflH}" fill="url(#fg)"/>` +
      `</svg>`
    )
    const fadeMask = await sharp(fadeSvg).png().toBuffer()
    const reflection = await sharp(reflRaw)
      .composite([{ input: fadeMask, blend: 'dest-in' }])
      .png()
      .toBuffer()

    // ── STEP 6: Composite all layers ──────────────────────────
    const result = await sharp(background)
      .composite([
        { input: shadow,     blend: 'over' },
        { input: reflection, blend: 'over', left, top: safeTop + dioH },
        { input: diorama,    blend: 'over', left, top: safeTop },
      ])
      .jpeg({ quality: 97 })
      .toBuffer()

    console.log(
      `[compose] ${CANVAS_W}×${CANVAS_H} canvas — ` +
      `diorama ${dioW}×${dioH}px at (${left}, ${safeTop}) — ` +
      `padding L:${left}px R:${CANVAS_W - left - dioW}px`
    )

    return { imageB64: result.toString('base64'), success: true }

  } catch (e: any) {
    console.error('[compose] Error:', e.message)
    return { imageB64: input.imageB64, success: false, error: e.message }
  }
}
