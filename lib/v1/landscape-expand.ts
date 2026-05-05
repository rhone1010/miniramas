// landscape-expand.ts
// lib/v1/landscape-expand.ts
//
// Stability outpaint post-stage — adds ~15% margin around the rendered
// landscape. Mirrors houses-expand.ts and the previous landscapes-expand.ts.
// Non-fatal on failure — caller continues with the unexpanded image.

import sharp from 'sharp'

const PAD_PX = 150 // ~15% on a 1024 image

export interface ExpandInput {
  imageB64: string
  expand?:  boolean
}

export interface ExpandOutput {
  imageB64:    string
  expanded:    boolean
  durationMs:  number
  warnings?:   string[]
}

export async function expandLandscape(input: ExpandInput): Promise<ExpandOutput> {
  const t0 = Date.now()

  if (!input.expand) {
    return { imageB64: input.imageB64, expanded: false, durationMs: 0 }
  }

  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) {
    console.warn('[landscape/expand] STABILITY_API_KEY not set — skipping outpaint')
    return { imageB64: input.imageB64, expanded: false, durationMs: 0 }
  }

  const original = Buffer.from(input.imageB64, 'base64')

  const form = new FormData()
  form.append('image',         new Blob([original], { type: 'image/jpeg' }), 'image.jpg')
  form.append('left',          String(PAD_PX))
  form.append('right',         String(PAD_PX))
  form.append('up',            String(PAD_PX))
  form.append('down',          String(PAD_PX))
  form.append('creativity',    '0.5')
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
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Stability outpaint failed (${res.status}): ${err.slice(0, 200)}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const meta = await sharp(buf).metadata()
  const durationMs = Date.now() - t0

  console.log(
    `[landscape/expand] ${meta.width}×${meta.height} ` +
    `(+${PAD_PX}px each side, ${durationMs}ms)`
  )

  return {
    imageB64:   buf.toString('base64'),
    expanded:   true,
    durationMs,
  }
}
