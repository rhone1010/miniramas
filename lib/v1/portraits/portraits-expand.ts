// lib/v1/portraits/portraits-expand.ts
//
// Local canvas-pad margin generator. Replaces the Stability AI outpaint
// post-process with a zero-cost local sharp operation.
//
// Why this works for Portraits (and Groups): the margin around a bust is
// just soft, out-of-focus gallery backdrop — not coherent environment the
// customer is paying for. So it does NOT need a generative model to invent
// it. We extend the canvas by compositing the crisp render onto a blurred,
// color-matched enlargement of itself. At the bokeh'd edges of a gallery
// shot this reads as continued depth-of-field, indistinguishable from the
// generative outpaint it replaces — for ~$0 and ~50ms instead of ~4¢ and
// ~15s, with no third-party dependency.
//
// NOTE: this is the right call ONLY for subject-IS-the-piece Series
// (Portraits, Groups), where the border is backdrop. The place Series
// (Houses, Landscapes) must keep generative outpaint — there the extended
// region IS the environment and has to be coherent.
//
// Interface is byte-identical to the previous Stability version
// (PortraitsExpandInput / PortraitsExpandOutput / expandPortraitImage),
// so the generator call site needs no changes. stabilityApiKey is retained
// in the input for signature compatibility and is intentionally unused.
//
// Non-fatal: if anything fails, the original Pass 1 image is returned
// unchanged — same contract as before.

import sharp from 'sharp'

export interface PortraitsExpandInput {
  imageB64:         string
  expandPercent:    number       // % of original dimension added on each side
  stabilityApiKey:  string       // retained for signature compatibility; unused
}

export interface PortraitsExpandOutput {
  imageB64:    string
  expanded:    boolean
  durationMs:  number
  newWidth?:   number
  newHeight?:  number
  reason?:     string
}

// Heavier blur = softer, more abstract surround that hides the lack of true
// perspective in the extended region. 60 is tuned for gallery backdrops at
// ~14% visible margin; lower it if the surround reads too smeared.
const SURROUND_BLUR_SIGMA = 60

export async function expandPortraitImage(
  input: PortraitsExpandInput,
): Promise<PortraitsExpandOutput> {

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

    const meta = await sharp(original).metadata()
    const srcW = meta.width  || 1024
    const srcH = meta.height || 1024

    const padX = Math.round((input.expandPercent / 100) * srcW)
    const padY = Math.round((input.expandPercent / 100) * srcH)
    const newW = srcW + 2 * padX
    const newH = srcH + 2 * padY

    console.log(
      `[portraits/expand] start src=${srcW}×${srcH} ` +
      `pad=${input.expandPercent}% (${padX}px L/R, ${padY}px T/B) ` +
      `→ target=${newW}×${newH} (local canvas pad)`,
    )

    // 1. Background: the render itself, enlarged to cover the full new
    //    canvas and heavily blurred — gives a color- and tone-matched
    //    surround that continues the scene's depth-of-field.
    const background = await sharp(original)
      .resize(newW, newH, { fit: 'cover', position: 'centre' })
      .blur(SURROUND_BLUR_SIGMA)
      .toBuffer()

    // 2. Composite the crisp original centered on top of the blurred bed.
    const out = await sharp(background)
      .composite([{ input: original, top: padY, left: padX }])
      .jpeg({ quality: 92 })
      .toBuffer()

    const b64 = out.toString('base64')
    const outMeta = await sharp(out).metadata()
    const durationMs = Date.now() - t0

    console.log(
      `[portraits/expand] done in ${durationMs}ms — ` +
      `output ${outMeta.width}×${outMeta.height} (local, $0)`,
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
    console.warn(`[portraits/expand] failed, returning original: ${msg}`)
    return {
      imageB64:   input.imageB64,
      expanded:   false,
      durationMs: Date.now() - t0,
      reason:     `error: ${msg}`,
    }
  }
}
