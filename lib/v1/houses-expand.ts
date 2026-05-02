// houses-expand.ts
// lib/v1/houses-expand.ts
//
// Stability AI outpaint — adapted from the old expand.ts for the new pipeline.
// Adds ~15% padding around the rendered image to produce the external
// (frame) margin. This is the deterministic fix for image-margin —
// prompt-only language has been unreliable on NB2; outpaint is post-render
// and consistent.
//
// Note: the action-minis lock retired this stage because it produced
// "stitched mismatched aesthetic at edges" when extending forest/landscape.
// For Houses, extending into a desk surface or room walls is far more
// constrained — the seam problem is much less likely. Re-enabled here
// specifically for Houses.
//
// Docs: https://platform.stability.ai/docs/api-reference#tag/Edit/paths/~1v2beta~1stable-image~1edit~1outpaint/post

import sharp from 'sharp'

// 150px on a 1024 image = ~15% padding each side. The rendered subject
// ends up occupying ~70-75% of the new image width — close to the proven
// frame ratio in the old reference renders.
const PAD_PX = 150

export async function expandHouseImage(input: {
  imageB64:          string
  stabilityApiKey?:  string
}): Promise<{ imageB64: string; expanded: boolean; durationMs: number }> {

  const t0 = Date.now()
  const apiKey = input.stabilityApiKey || process.env.STABILITY_API_KEY

  if (!apiKey) {
    console.warn('[houses/expand] STABILITY_API_KEY not set — skipping outpaint')
    return { imageB64: input.imageB64, expanded: false, durationMs: 0 }
  }

  const original = Buffer.from(input.imageB64, 'base64')

  const form = new FormData()
  form.append('image',         new Blob([original], { type: 'image/jpeg' }), 'image.jpg')
  form.append('left',          String(PAD_PX))
  form.append('right',         String(PAD_PX))
  form.append('up',            String(PAD_PX))
  form.append('down',          String(PAD_PX))
  form.append('creativity',    '0.5')   // 0=faithful to edges, 1=more creative
  form.append('output_format', 'jpeg')

  const res = await fetch(
    'https://api.stability.ai/v2beta/stable-image/edit/outpaint',
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'image/*',
      },
      body: form,
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(
      `Stability outpaint failed (${res.status}): ${errText.slice(0, 240)}`
    )
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const b64 = buf.toString('base64')

  const meta = await sharp(buf).metadata()
  const durationMs = Date.now() - t0

  console.log(
    `[houses/expand] Stability outpaint done — ${meta.width}×${meta.height} ` +
    `(+${PAD_PX}px each side, ${durationMs}ms)`
  )

  return { imageB64: b64, expanded: true, durationMs }
}
