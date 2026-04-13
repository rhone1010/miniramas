import sharp from 'sharp'

// Target mean brightness by lighting mode (0-255 scale)
// These are photographic midtone targets for each mood:
const BRIGHTNESS_TARGETS: Record<string, number> = {
  midday_summer: 145,  // bright clean daylight — slightly reduced to prevent blowout
  soft_spring:   125,  // soft diffused — model generates bright enough, just nudge
  dusk_evening:  115,  // skipped in route.ts — kept for reference
  night:         100,  // skipped in route.ts — kept for reference
  default:       130,
}

const CIRCLE_RATIO = 0.586  // scales with canvas
const FEATHER      = 50

// ── GLOBAL EXPOSURE CORRECTION ────────────────────────────────
// Measures actual image brightness and corrects to target.
// Returns corrected image buffer.
export async function correctExposure(input: {
  imageB64:         string
  lighting_preset?: string
  targetOverride?:  number
}): Promise<{ imageB64: string; before: number; after: number; multiplier: number }> {
  const buf    = Buffer.from(input.imageB64, 'base64')
  const target = input.targetOverride
    ?? BRIGHTNESS_TARGETS[input.lighting_preset || 'default']
    ?? BRIGHTNESS_TARGETS.default

  const stats  = await sharp(buf).greyscale().stats()
  const before = stats.channels[0].mean
  const mult   = before > 5 ? Math.min(target / before, 3.0) : 1.0

  console.log(`[exposure] Before: ${Math.round(before)} — Target: ${target} — Multiplier: ${mult.toFixed(2)} — Mode: ${input.lighting_preset || 'default'}`)

  if (Math.abs(mult - 1.0) < 0.05) {
    // Already close enough — skip correction
    return { imageB64: input.imageB64, before, after: before, multiplier: 1.0 }
  }

  const corrected = await sharp(buf)
    .modulate({ brightness: mult })
    .jpeg({ quality: 97 })
    .toBuffer()

  const statsAfter = await sharp(corrected).greyscale().stats()
  const after      = statsAfter.channels[0].mean

  console.log(`[exposure] After: ${Math.round(after)}`)
  return { imageB64: corrected.toString('base64'), before, after, multiplier: mult }
}

// ── CIRCULAR FEATHERED BOOST ──────────────────────────────────
// Applies circular feathered brightness boost to center subject.
// Used as final polish after global correction.
export async function applyLevels(input: {
  imageB64:         string
  brightness?:      number    // UI override — multiplier
  lighting_preset?: string
}): Promise<{ imageB64: string; success: boolean; errors?: string[] }> {
  try {
    const buf = Buffer.from(input.imageB64, 'base64')

    // Circular boost multipliers by mode — applied ON TOP of global correction
    const MODE_BOOST: Record<string, number> = {
      midday_summer: 1.15,
      soft_spring:   1.12,
      dusk_evening:  1.18,  // support only — preserve model mood
      night:         1.12,  // support only — preserve model mood
    }
    const boost = input.brightness
      ?? MODE_BOOST[input.lighting_preset || '']
      ?? 1.15

    const meta     = await sharp(buf).metadata()
    const CANVAS   = meta.width!
    const CENTER   = Math.round(CANVAS / 2)
    const CIRCLE_R = Math.round(CANVAS * CIRCLE_RATIO / 2)

    const circleSvg = Buffer.from(
      `<svg width="${CANVAS}" height="${CANVAS}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${CANVAS}" height="${CANVAS}" fill="black"/>` +
      `<circle cx="${CENTER}" cy="${CENTER}" r="${CIRCLE_R}" fill="white"/>` +
      `</svg>`
    )

    const mask = await sharp(circleSvg)
      .blur(FEATHER).greyscale().png().toBuffer()

    const boosted = await sharp(buf)
      .modulate({ brightness: boost })
      .png()
      .toBuffer()

    const boostedWithAlpha = await sharp(boosted)
      .joinChannel(mask)
      .png()
      .toBuffer()

    const result = await sharp(buf)
      .composite([{ input: boostedWithAlpha, blend: 'over' }])
      .jpeg({ quality: 97 })
      .toBuffer()

    console.log(`[levels] Circular boost ${boost} — ${CIRCLE_R * 2}px on ${CANVAS}px (${input.lighting_preset || 'default'})`)
    return { success: true, imageB64: result.toString('base64') }

  } catch (e: any) {
    console.error('[levels] Error:', e.message)
    return { success: false, errors: [e.message] }
  }
}
