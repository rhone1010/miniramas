// lib/structure/extractDioramaMask.ts
//
// Removes the generated background from a gpt-image-1 output.
// Returns a clean RGBA PNG — diorama only, no background.
//
// Method: Replicate API (primary) → circular Sharp fallback
// The generated background is DISCARDED entirely.
// All environment is added fresh in composePresentation.

import sharp from 'sharp'

export interface MaskResult {
  maskedB64: string             // RGBA PNG — diorama only, transparent bg
  method:    'replicate' | 'circular'
  width:     number
  height:    number
}

// ── METHOD 1: REPLICATE API ───────────────────────────────────────────────────
// Uses birefnet-general — state of the art background removal.
// Returns clean RGBA PNG. Cost ~$0.001/image.
// Set REPLICATE_API_TOKEN in env to enable.

async function maskWithReplicate(imageB64: string): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return null

  try {
    // Convert to data URL for Replicate input
    const dataUrl = `data:image/png;base64,${imageB64}`

    // Start prediction
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Prefer':         'wait',   // synchronous — waits up to 60s for result
      },
      body: JSON.stringify({
        version: 'da7d45f3b836795f945f221fc0b01a6d3ab7f5e163f13208948ad436001e2255',  // birefnet-general
        input: {
          image:                    dataUrl,
          model:                    'birefnet-general',
          output_format:            'png',
          output_quality:           100,
        },
      }),
    })

    if (!startRes.ok) {
      console.warn(`[mask] Replicate start failed: ${startRes.status}`)
      return null
    }

    const prediction = await startRes.json()

    // If not complete yet, poll
    let output = prediction.output
    if (!output && prediction.status !== 'failed') {
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const polled = await pollRes.json()
      output = polled.output
    }

    if (!output) {
      console.warn('[mask] Replicate returned no output')
      return null
    }

    // Output is a URL — fetch and convert to b64
    const outputUrl = Array.isArray(output) ? output[0] : output
    const imgRes    = await fetch(outputUrl)
    if (!imgRes.ok) { console.warn('[mask] Replicate output fetch failed'); return null }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    // Verify it's RGBA and has transparency
    const meta = await sharp(imgBuffer).metadata()
    if (meta.channels !== 4) {
      console.warn('[mask] Replicate output is not RGBA — falling back')
      return null
    }

    console.log('[mask] Replicate succeeded')
    return imgBuffer.toString('base64')

  } catch (err: any) {
    console.warn('[mask] Replicate error:', err.message)
    return null
  }
}

// ── METHOD 2: CIRCULAR SHARP FALLBACK ────────────────────────────────────────
// Deterministic elliptical mask centered on image.
// Works because every diorama is a round object centered in the generated frame.
// No AI, no cost, lower precision than Replicate but reliable.

async function maskWithCircular(imageB64: string): Promise<string> {
  console.log('[mask] Using circular fallback')
  const buf  = Buffer.from(imageB64, 'base64')
  const meta = await sharp(buf).metadata()
  const w    = meta.width  ?? 1024
  const h    = meta.height ?? 1024

  const cx = w / 2
  const cy = h / 2
  const rx = w * 0.46
  const ry = h * 0.47

  const featherStart = 0.88   // full opacity inside this
  const featherEnd   = 1.00   // full transparent outside this

  const pixels = Buffer.alloc(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx   = (x - cx) / rx
      const dy   = (y - cy) / ry
      const dist = Math.sqrt(dx * dx + dy * dy)

      let alpha: number
      if (dist <= featherStart) {
        alpha = 255
      } else if (dist >= featherEnd) {
        alpha = 0
      } else {
        const t = (dist - featherStart) / (featherEnd - featherStart)
        // Cosine ease for smooth feather
        alpha = Math.round(((1 + Math.cos(t * Math.PI)) / 2) * 255)
      }
      pixels[y * w + x] = alpha
    }
  }

  const maskBuf = await sharp(pixels, {
    raw: { width: w, height: h, channels: 1 },
  }).blur(1.5).png().toBuffer()

  const result = await sharp(buf)
    .ensureAlpha()
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return result.toString('base64')
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export async function extractDioramaMask(
  imageB64:      string,
  _openaiApiKey: string,   // interface compat — not used
): Promise<MaskResult> {
  const meta   = await sharp(Buffer.from(imageB64, 'base64')).metadata()
  const width  = meta.width  ?? 1024
  const height = meta.height ?? 1024

  // Try Replicate first
  const replicateResult = await maskWithReplicate(imageB64)
  if (replicateResult) {
    return { maskedB64: replicateResult, method: 'replicate', width, height }
  }

  // Circular fallback
  const circularResult = await maskWithCircular(imageB64)
  return { maskedB64: circularResult, method: 'circular', width, height }
}
