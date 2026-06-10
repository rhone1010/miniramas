// lib/v1/actionmini-expand.ts
//
// Stability AI outpaint for Action Minis — adds the external frame margin
// that prompt-only Pass 1+2 framing has not been able to hold reliably on
// NB2. Mirrors lib/v1/houses-expand.ts.
//
// SCALE-AWARE: outpaint runs only when scale === 'close_up' (the "Staged"
// composition). When scale === 'fill' (the "Close Up" composition), Pass
// 1+2 renders tight on the figure and outpaint is skipped — preserving
// the close-up macro register the user asked for.
//
// HISTORICAL NOTE: the original Action lock retired outpaint because it
// produced "stitched mismatched aesthetic at edges" when extending forest
// or beach environments (the in_situ register). With V6's complementary
// base architecture and tighter location vocabularies, that risk is much
// reduced — most locations are constrained interior surfaces (rotunda
// marble, desk wood, shelf bookshelf, workshop bench/wall). For in_situ,
// the painterly heavy blur on the action environment also helps the seam
// disappear. Re-enabled here at user request.
//
// Docs: https://platform.stability.ai/docs/api-reference#tag/Edit/paths/~1v2beta~1stable-image~1edit~1outpaint/post

import sharp from 'sharp'
import type { Scale } from './actionmini-presets'

// 150px on a 1024 image = ~15% padding each side. After outpaint, the
// subject occupies roughly 70% of the new image width — landing close to
// the Staged 75% target prompts have struggled to reach.
const PAD_PX = 150

export interface ActionMiniExpandInput {
  imageB64:          string
  scale:             Scale
  stabilityApiKey?:  string
}

export interface ActionMiniExpandOutput {
  imageB64:    string
  expanded:    boolean
  durationMs:  number
  reason?:     string   // why outpaint was skipped, when expanded === false
}

export async function expandActionImage(
  input: ActionMiniExpandInput,
): Promise<ActionMiniExpandOutput> {

  // SCALE-AWARE skip — Close Up means "tight on the figure, no breathing
  // room." Adding 150px would dilute that to Staged framing.
  if (input.scale === 'fill') {
    return {
      imageB64:   input.imageB64,
      expanded:   false,
      durationMs: 0,
      reason:     'scale=fill (Close Up — outpaint intentionally skipped)',
    }
  }

  const t0     = Date.now()
  const apiKey = input.stabilityApiKey || process.env.STABILITY_API_KEY

  if (!apiKey) {
    console.warn('[actionmini/expand] STABILITY_API_KEY not set — skipping outpaint')
    return {
      imageB64:   input.imageB64,
      expanded:   false,
      durationMs: 0,
      reason:     'STABILITY_API_KEY not set',
    }
  }

  const original = Buffer.from(input.imageB64, 'base64')

  const form = new FormData()
  form.append('image',         new Blob([original], { type: 'image/jpeg' }), 'image.jpg')
  form.append('left',          String(PAD_PX))
  form.append('right',         String(PAD_PX))
  form.append('up',            String(PAD_PX))
  form.append('down',          String(PAD_PX))
  // creativity 0.5 matches Houses' tested default — faithful enough to
  // edges to avoid stitched-aesthetic seams while still producing
  // believable extension into the location's architecture.
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
    const errText = await res.text()
    throw new Error(
      `Stability outpaint failed (${res.status}): ${errText.slice(0, 240)}`,
    )
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const b64 = buf.toString('base64')

  const meta = await sharp(buf).metadata()
  const durationMs = Date.now() - t0

  console.log(
    `[actionmini/expand] Stability outpaint done — ${meta.width}×${meta.height} ` +
    `(+${PAD_PX}px each side, ${durationMs}ms)`,
  )

  return {
    imageB64:  b64,
    expanded:  true,
    durationMs,
  }
}
