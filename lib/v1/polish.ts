// ─────────────────────────────────────────────────────────────
// MODULE 3 — PHOTOGRAPHY POLISH
// lib/v1/polish.ts
//
// ONE JOB: Apply subtle post-processing via Cloudinary.
//
// Intent: lift midtones slightly, add just enough contrast
// for separation, enhance detail without crunch, preserve warmth.
//
// This is NOT a rescue operation.
// Generation owns composition and structure.
// This step is polish only.
//
// Transformations applied:
//   e_auto_contrast          — normalise tonal range automatically
//   e_brightness:6           — slight midtone lift, not a push
//   e_contrast:10            — separation without harshness
//   e_sharpen:35             — detail clarity, not crunch
//   e_saturation:5           — preserve warmth, not boost
//   e_gamma:1.06             — optional, only if image reads muddy
//
// REMOVED (too opinionated or too heavy):
//   e_colorize               — too opinionated
//   heavy sharpen (>60)      — creates crunch
//   strong brightness (>15)  — flattens, not lifts
// ─────────────────────────────────────────────────────────────

import { v2 as cloudinary } from 'cloudinary'

// ── CONFIG ────────────────────────────────────────────────────
// Reads from env — set these in .env.local:
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// ── TRANSFORMATIONS ───────────────────────────────────────────

const POLISH_TRANSFORMS = [
  { effect: 'auto_contrast' },
  { effect: 'brightness:6'  },
  { effect: 'contrast:10'   },
  { effect: 'sharpen:35'    },
  { effect: 'saturation:5'  },
]

// Add e_gamma:1.06 only when the image reads muddy.
// Toggle this flag if needed — default off.
const APPLY_GAMMA = false
const GAMMA_TRANSFORM = { effect: 'gamma:1.06' }

// ── TYPES ─────────────────────────────────────────────────────

export interface PolishInput {
  imageB64: string    // JPEG from generation step
}

export interface PolishResult {
  imageUrl:  string   // Final Cloudinary URL (CDN-delivered)
  imageB64?: string   // Optional: b64 of polished image for API response
}

// ── MAIN ──────────────────────────────────────────────────────

export async function polishImage(input: PolishInput): Promise<PolishResult> {

  // 1. Upload raw generation to Cloudinary (temporary, no public display)
  console.log('[polish] Uploading to Cloudinary…')
  const uploadResult = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:         'minirama/raw',
        resource_type:  'image',
        format:         'jpg',
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    )
    const buf = Buffer.from(input.imageB64, 'base64')
    stream.end(buf)
  })

  const publicId = uploadResult.public_id
  console.log('[polish] Uploaded — public_id:', publicId)

  // 2. Build transformation chain
  const transforms = APPLY_GAMMA
    ? [...POLISH_TRANSFORMS, GAMMA_TRANSFORM]
    : POLISH_TRANSFORMS

  // 3. Generate polished URL
  const polishedUrl = cloudinary.url(publicId, {
    transformation: transforms,
    format:         'jpg',
    quality:        'auto:best',
    fetch_format:   'auto',
  })

  console.log('[polish] Done —', polishedUrl)

  // 4. Optionally fetch the polished image as b64 for direct API return
  // (avoids client needing to hit Cloudinary URL separately)
  let imageB64: string | undefined
  try {
    const res  = await fetch(polishedUrl)
    const buf  = Buffer.from(await res.arrayBuffer())
    imageB64   = buf.toString('base64')
  } catch {
    // Non-fatal — URL is still valid, b64 just won't be in response
    console.warn('[polish] Could not fetch polished b64 — URL still valid')
  }

  return { imageUrl: polishedUrl, imageB64 }
}
