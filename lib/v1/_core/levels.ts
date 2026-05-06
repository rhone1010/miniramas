import sharp from 'sharp'

// ── GLOBAL BRIGHTNESS BOOST ───────────────────────────────────
// Simple global modulate — no masking, applied to entire image.

const MODE_BOOST: Record<string, number> = {
  summer:    1.60,
  spring:    1.65,
  fall:      1.28,
  winter:    1.25,
  fire:      2.80,
  abandoned: 2.20,
  flood:     1.90,
  explosion: 2.00,
  haunted:   2.6,
  alien:     1.30,
}

const DEFAULT_BOOST = 1.30

export async function applyLevels(input: {
  imageB64:         string
  brightness?:      number
  lighting_preset?: string
}): Promise<{ imageB64: string; success: boolean; errors?: string[] }> {
  try {
    const buf        = Buffer.from(input.imageB64, 'base64')
    const brightness = input.brightness
      ?? MODE_BOOST[input.lighting_preset || '']
      ?? DEFAULT_BOOST

    const result = await sharp(buf)
      .modulate({ brightness })
      .jpeg({ quality: 97 })
      .toBuffer()

    console.log(`[levels] ${input.lighting_preset || 'default'} → ${brightness}× global boost`)
    return { success: true, imageB64: result.toString('base64') }

  } catch (e: any) {
    console.error('[levels] Error:', e.message)
    return { success: false, errors: [e.message] }
  }
}
