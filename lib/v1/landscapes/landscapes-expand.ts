// lib/v1/landscapes/landscapes-expand.ts
//
// Stability outpaint post-stage. Padding is scale-driven so each scale tier
// produces a final image where the model occupies its target percentage of
// the canvas:
//
//   subject  → ~82% target → ~11.0% pad each side
//   close_up → ~75% target → ~16.7% pad each side
//   zoom_out → ~60% target → ~33.3% pad each side
//
// Math: pad_ratio = (1/target - 1) / 2
// SCALE_PAD_RATIO is imported from landscape-effects.ts so scale math has
// a single source of truth across the engine.
//
// Non-fatal on failure — caller continues with the unexpanded image.

import sharp from 'sharp'
import type { ScaleID } from './landscapes-shared'
import { SCALE_PAD_RATIO } from './landscapes-effects'

const DEFAULT_PAD_RATIO = 0.15

export interface ExpandInput {
  imageB64: string
  expand?:  boolean
  scale?:   ScaleID
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
  const meta     = await sharp(original).metadata()
  const srcWidth = meta.width ?? 1024

  const padRatio = input.scale ? SCALE_PAD_RATIO[input.scale] : DEFAULT_PAD_RATIO
  const padPx    = Math.round(srcWidth * padRatio)

  const form = new FormData()
  form.append('image',         new Blob([original], { type: 'image/jpeg' }), 'image.jpg')
  form.append('left',          String(padPx))
  form.append('right',         String(padPx))
  form.append('up',            String(padPx))
  form.append('down',          String(padPx))
  form.append('creativity',    '0.5')
  form.append('output_format', 'jpeg')

  const res = await fetch(
    'https://api.stability.ai/v2beta/stable-image/edit/outpaint',
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' },
      body:    form,
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Stability outpaint failed (${res.status}): ${err.slice(0, 200)}`)
  }

  const buf        = Buffer.from(await res.arrayBuffer())
  const outMeta    = await sharp(buf).metadata()
  const durationMs = Date.now() - t0

  console.log(
    `[landscape/expand] scale=${input.scale || 'default'} ` +
    `pad=${padPx}px (${(padRatio * 100).toFixed(1)}%) → ` +
    `${outMeta.width}×${outMeta.height} (${durationMs}ms)`
  )

  return {
    imageB64:   buf.toString('base64'),
    expanded:   true,
    durationMs,
  }
}
