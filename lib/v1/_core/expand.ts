import sharp from 'sharp'

// ── STABILITY AI OUTPAINT ─────────────────────────────────────
// Uses stability.ai/v2beta/stable-image/edit/outpaint
// Dedicated outpaint endpoint — expands canvas in all directions
// while preserving the original image exactly.
// Docs: https://platform.stability.ai/docs/api-reference#tag/Edit/paths/~1v2beta~1stable-image~1edit~1outpaint/post

const PAD_PX = 150   // pixels to add each side (~15% on 1024)

export async function expandScene(input: {
  imageB64:     string
  openaiApiKey: string
  expand?:      boolean
}): Promise<{ imageB64: string; warnings?: string[] }> {
  if (!input.expand) return { imageB64: input.imageB64 }

  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) throw new Error('Missing STABILITY_API_KEY in env')

  const original = Buffer.from(input.imageB64, 'base64')

  // Stability outpaint requires multipart/form-data
  const form = new FormData()
  form.append('image',       new Blob([original], { type: 'image/jpeg' }), 'image.jpg')
  form.append('left',        String(PAD_PX))
  form.append('right',       String(PAD_PX))
  form.append('up',          String(PAD_PX))
  form.append('down',        String(PAD_PX))
  form.append('creativity',  '0.5')   // 0=faithful to edges, 1=more creative
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
  const b64 = buf.toString('base64')

  const meta = await sharp(buf).metadata()
  console.log(`[expand] Stability outpaint done — output: ${meta.width}×${meta.height} (+${PAD_PX}px each side)`)

  return { imageB64: b64 }
}
