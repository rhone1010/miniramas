// lib/v1/landscapes-expand.ts
// Stability outpaint post-stage — adds ~15% margin around the rendered diorama.
// Same pattern as houses-expand. Non-fatal on failure — caller continues with unexpanded image.

import sharp from 'sharp'

const PAD_PX = 150 // pixels added each side (~15% on 1024)

export interface ExpandInput {
  imageB64: string
  expand?:  boolean
}

export interface ExpandOutput {
  imageB64: string
  warnings?: string[]
}

export async function expandLandscape(input: ExpandInput): Promise<ExpandOutput> {
  if (!input.expand) return { imageB64: input.imageB64 }

  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) throw new Error('Missing STABILITY_API_KEY in env')

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
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Stability outpaint failed (${res.status}): ${err.slice(0, 200)}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const meta = await sharp(buf).metadata()
  console.log(`[landscapes-expand] ${meta.width}×${meta.height} (+${PAD_PX}px each side)`)

  return { imageB64: buf.toString('base64') }
}
