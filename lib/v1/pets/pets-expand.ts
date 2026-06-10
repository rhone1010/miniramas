// lib/v1/pets/pets-expand.ts
//
// Stability AI outpaint post-process. Adds canvas padding around the
// Pass 1 rendered animal so the subject doesn't fill the frame. Same
// mechanism as portraits-expand.ts — NB2 ignores every variant of
// prompt-based framing directive (its prior to fill the frame is too
// strong), so margins are real pixels of canvas added around the
// rendered image. For Pets this matters even more than Portraits:
// the four environments (grass, rug, gallery pool light, atmospheric
// haze) need visible room to read as a scene.
//
// Stability outpaint endpoint: v2beta/stable-image/edit/outpaint
//
// Non-fatal: if Stability fails for any reason, the original Pass 1
// image is returned unchanged.

import sharp from 'sharp'

const STABILITY_URL =
  'https://api.stability.ai/v2beta/stable-image/edit/outpaint'

export interface PetsExpandInput {
  imageB64:        string
  expandPercent:   number       // % of original dimension added on each side
  stabilityApiKey: string
}

export interface PetsExpandOutput {
  imageB64:   string
  expanded:   boolean
  durationMs: number
  newWidth?:  number
  newHeight?: number
  reason?:    string
}

export async function expandPetImage(
  input: PetsExpandInput,
): Promise<PetsExpandOutput> {

  const t0 = Date.now()

  if (input.expandPercent <= 0) {
    return {
      imageB64:   input.imageB64,
      expanded:   false,
      durationMs: 0,
      reason:     `expandPercent=${input.expandPercent} (skipped)`,
    }
  }

  try {
    const original = Buffer.from(input.imageB64, 'base64')

    // Read source dimensions to compute padding in pixels
    const meta = await sharp(original).metadata()
    const srcW = meta.width  || 1024
    const srcH = meta.height || 1024

    const padX = Math.round((input.expandPercent / 100) * srcW)
    const padY = Math.round((input.expandPercent / 100) * srcH)

    console.log(
      `[pets/expand] start src=${srcW}×${srcH} ` +
      `pad=${input.expandPercent}% (${padX}px L/R, ${padY}px T/B) ` +
      `→ target=${srcW + 2 * padX}×${srcH + 2 * padY}`,
    )

    // Stability outpaint expects multipart/form-data
    const form = new FormData()
    form.append('image', new Blob([original], { type: 'image/jpeg' }), 'image.jpg')
    form.append('left',          String(padX))
    form.append('right',         String(padX))
    form.append('up',            String(padY))
    form.append('down',          String(padY))
    form.append('creativity',    '0.3')   // low — extend the environment subtly
    form.append('output_format', 'jpeg')

    const res = await fetch(STABILITY_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${input.stabilityApiKey}`,
        'Accept':        'image/*',
      },
      body: form,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Stability outpaint failed (${res.status}): ${err.slice(0, 200)}`)
    }

    const buf = Buffer.from(await res.arrayBuffer())
    const b64 = buf.toString('base64')

    const outMeta = await sharp(buf).metadata()
    const durationMs = Date.now() - t0

    console.log(
      `[pets/expand] done in ${durationMs}ms — ` +
      `output ${outMeta.width}×${outMeta.height}`,
    )

    return {
      imageB64:   b64,
      expanded:   true,
      durationMs,
      newWidth:   outMeta.width,
      newHeight:  outMeta.height,
    }

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    console.warn(`[pets/expand] failed, returning original: ${msg}`)
    return {
      imageB64:   input.imageB64,
      expanded:   false,
      durationMs: Date.now() - t0,
      reason:     `error: ${msg}`,
    }
  }
}
