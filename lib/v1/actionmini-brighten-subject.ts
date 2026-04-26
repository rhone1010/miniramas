// brightenSubject.ts
// lib/v1/actionmini-brighten-subject.ts
//
// Applies a feathered circular brightness boost centered on the diorama.
//
// Approach: brighten the whole image 15%, then composite it over the original
// through a radial gradient mask so only the central circle gets the lift,
// with smooth falloff to the edges.

import sharp from 'sharp'

const BRIGHTNESS_MULTIPLIER = 1.15   // +15%
const FEATHER_SOFTNESS      = 0.85   // inner solid radius as % of full radius

export async function brightenSubject(input: {
  imageB64: string
  cx: number
  cy: number
  radius: number
}): Promise<{ imageB64: string; success: boolean }> {
  try {
    const buf  = Buffer.from(input.imageB64, 'base64')
    const meta = await sharp(buf).metadata()
    const w    = meta.width  ?? 1024
    const h    = meta.height ?? 1024

    // 1. Brightened full-image copy
    const brightened = await sharp(buf)
      .modulate({ brightness: BRIGHTNESS_MULTIPLIER })
      .png()
      .toBuffer()

    // 2. Radial gradient mask — white circle at center, transparent outside
    const innerR = Math.round(input.radius * FEATHER_SOFTNESS)
    const outerR = input.radius

    const maskSvg = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs>` +
      `<radialGradient id="g" cx="${input.cx}" cy="${input.cy}" r="${outerR}" ` +
      `gradientUnits="userSpaceOnUse">` +
      `<stop offset="0"                      stop-color="white" stop-opacity="1"/>` +
      `<stop offset="${innerR / outerR}"     stop-color="white" stop-opacity="1"/>` +
      `<stop offset="1"                      stop-color="white" stop-opacity="0"/>` +
      `</radialGradient>` +
      `</defs>` +
      `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
      `</svg>`
    )
    const mask = await sharp(maskSvg).png().toBuffer()

    // 3. Apply mask to brightened copy — keeps only the feathered circle
    const maskedBrightened = await sharp(brightened)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer()

    // 4. Composite the feathered bright zone over the original
    const result = await sharp(buf)
      .composite([{ input: maskedBrightened, blend: 'over' }])
      .jpeg({ quality: 97 })
      .toBuffer()

    console.log(`[brighten-subject] +15% lift at (${input.cx}, ${input.cy}) r=${input.radius}`)
    return { imageB64: result.toString('base64'), success: true }

  } catch (e: any) {
    console.error('[brighten-subject] Error:', e.message)
    return { imageB64: input.imageB64, success: false }
  }
}
