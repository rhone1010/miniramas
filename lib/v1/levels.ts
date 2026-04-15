import sharp from 'sharp'

// ── GEOMETRY (matches Photoshop process) ──────────────────────
// Canvas: 1024×1024 (API output)
// Circle: 600px diameter, centered at (512, 512), radius 300px
// Feather: 50px gaussian blur on mask
// Brightness: +37 levels ≈ 1.29× modulate

const CANVAS     = 1024
const CIRCLE_D   = 600
const CIRCLE_R   = 300
const CENTER     = CANVAS / 2   // 512
const FEATHER    = 50
const BRIGHTNESS = 1.29

// Mode-aware boost — dark modes need more lift since they generate darker
const MODE_BOOST: Record<string, number> = {
  // legacy lighting presets
  night:         1.65,
  dusk_evening:  1.45,
  midday_summer: 1.25,
  soft_spring:   1.20,
  // season presets
  summer:        1.25,
  spring:        1.20,
  fall:          1.22,
  winter:        1.20,
  // disaster presets — spotlight style, lift subject only
  fire:          1.45,
  abandoned:     1.40,
  flood:         1.35,
  explosion:     1.45,
}

export async function applyLevels(input: {
  imageB64:         string
  brightness?:      number   // UI override — takes precedence
  lighting_preset?: string   // used for mode-aware boost
}): Promise<{ imageB64: string; success: boolean; errors?: string[] }> {
  try {
    const buf        = Buffer.from(input.imageB64, 'base64')
    const brightness = input.brightness ?? MODE_BOOST[input.lighting_preset || ''] ?? BRIGHTNESS

    // ── STEP 1: Feathered circular mask ──────────────────────
    // White = apply boost, Black = keep original
    const circleSvg = Buffer.from(
      `<svg width="${CANVAS}" height="${CANVAS}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${CANVAS}" height="${CANVAS}" fill="black"/>` +
      `<circle cx="${CENTER}" cy="${CENTER}" r="${CIRCLE_R}" fill="white"/>` +
      `</svg>`
    )

    const mask = await sharp(circleSvg)
      .blur(FEATHER)
      .greyscale()
      .png()
      .toBuffer()

    // ── STEP 2: Brightness-boosted version ───────────────────
    const boosted = await sharp(buf)
      .modulate({ brightness })
      .png()
      .toBuffer()

    // ── STEP 3: Composite using mask as alpha ─────────────────
    // Boosted layer with mask as alpha, composited over original
    // Center gets full boost, edges fall off naturally over 50px
    const boostedWithAlpha = await sharp(boosted)
      .joinChannel(mask)
      .png()
      .toBuffer()

    const result = await sharp(buf)
      .composite([{ input: boostedWithAlpha, blend: 'over' }])
      .jpeg({ quality: 97 })
      .toBuffer()

    console.log(`[levels] Done — ${CIRCLE_D}px circle, ${FEATHER}px feather, brightness ${brightness}`)
    return { success: true, imageB64: result.toString('base64') }

  } catch (e: any) {
    console.error('[levels] Error:', e.message)
    return { success: false, errors: [e.message] }
  }
}
