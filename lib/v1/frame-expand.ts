// frame-expand.ts
// lib/v1/frame-expand.ts
//
// Final framing stage — shrinks the figurine within the frame by
// outpainting atmospheric environment around it. Uses Stability AI's
// outpaint endpoint (same pattern as expand.ts but with a guiding prompt
// and configurable padding).
//
// Why this stage exists:
//   - Generating the figurine at full hero scale preserves face-refine's
//     per-face pixel budget (the whole reason face-refine exists).
//   - But a hero figurine filling 85% of frame invites forensic likeness
//     comparison from users.
//   - Shrinking the figurine via post-processing + filling the new margins
//     with atmospheric lighting creates "premium display photo" framing,
//     which softens scrutiny and reads as a finished product shot rather
//     than a scan.
//
// The original figurine pixels are preserved exactly — Stability outpaint
// only generates the NEW pixels around the original. This means face-refine
// quality survives this stage intact.
//
// Cost: ~$0.04 per call (Stability outpaint, single-pass).

import sharp from 'sharp'

// ── PRESENTATION PROMPTS ────────────────────────────────────────
// Each preset describes the environment that gets generated AROUND the
// figurine. Strong atmospheric direction (warm light, bokeh, mood) so the
// final composition reads as "displayed in situ" rather than "studio scan."

const PRESENTATIONS: Record<string, string> = {
  insitu:
    'A premium painted resin collectible figurine on display in a warm domestic interior. Sitting on a polished walnut display shelf or side table. Warm afternoon window light from upper-right casts soft directional lighting across the scene with gentle catchlights. Background is a softly blurred warm interior — neutral walls, hint of bookshelves or framed art, atmospheric bokeh. Natural depth of field with the figurine sharp and the surroundings soft. Cinematic warm color grading. Premium product photography aesthetic.',

  mantel:
    'A premium painted resin collectible figurine displayed on a fireplace mantel of dark stained wood. Warm firelight glow from below and to the right, casting soft amber light and gentle dramatic shadows. Above and behind: deep softly blurred interior with a hint of framed family photos or candle holders. Strong atmospheric mood, intimate domestic warmth. Cinematic dim room lighting with the figurine catching the warm firelight. Rich warm color palette.',

  studio:
    'A premium painted resin collectible figurine on a clean polished walnut plinth. Soft studio lighting from upper-left with subtle warm fill. Gentle dark-to-mid neutral gradient backdrop, completely out of focus. Professional editorial product photography — moody, refined, magazine-quality. Slight warm tint, premium collectibles catalog aesthetic.',

  shelf:
    'A premium painted resin collectible figurine displayed on a built-in wooden bookshelf among warm-toned hardcover books with leather and cloth spines. Soft warm lamp light from above creates intimate directional lighting with golden hour color temperature. Background is the gentle bokeh of book spines and shelf interior, softly out of focus. Domestic warmth, treasured-keepsake atmosphere. Rich amber and ochre tones.',

  exhibition:
    'A premium painted resin collectible figurine displayed on a polished dark walnut pedestal in a private gallery setting. Single dramatic spotlight from above-right casts the figurine in warm light against a deep dark backdrop. Strong chiaroscuro — bright on the figurine, surroundings receding into shadow. Museum exhibition aesthetic. The figurine glows like a treasured artifact in the darkness.',
}

// ── PADDING PROFILES ────────────────────────────────────────────
// Controls how much the figurine shrinks within the final frame.
// Padding is added on all four sides of the original image, then the
// result is resized back to the target output size.
//
//   subtle     → figurine at ~70% of frame (gentle reduction)
//   moderate   → figurine at ~60% of frame (default — what user asked for)
//   aggressive → figurine at ~50% of frame (close to "half size")

const PADDING_PROFILES: Record<string, number> = {
  subtle:     200,
  moderate:   320,
  aggressive: 440,
}

// ── PUBLIC API ──────────────────────────────────────────────────

export interface FrameExpandResult {
  imageB64: string
  success:  boolean
  warnings?: string[]
}

export async function frameExpand(input: {
  imageB64:     string
  presentation?: string                            // 'insitu' | 'mantel' | 'studio' | 'shelf' | 'exhibition'
  reduction?:   'subtle' | 'moderate' | 'aggressive'
  customPrompt?: string                           // overrides presentation if provided
  finalSize?:   number                            // default 1024
}): Promise<FrameExpandResult> {
  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) {
    return {
      imageB64: input.imageB64,
      success:  false,
      warnings: ['STABILITY_API_KEY not set — skipping frame expansion'],
    }
  }

  const presentationKey = input.presentation || 'insitu'
  const reductionKey    = input.reduction    || 'moderate'
  const finalSize       = input.finalSize    || 1024

  const presentationPrompt = input.customPrompt
    ?? PRESENTATIONS[presentationKey]
    ?? PRESENTATIONS.insitu

  const padPx = PADDING_PROFILES[reductionKey] ?? PADDING_PROFILES.moderate

  // The full prompt anchors the figurine itself + describes the surrounding
  // environment. Stability outpaint uses this to fill ONLY the new margins,
  // not the original image area.
  const fullPrompt =
    `${presentationPrompt} The figurine itself is unchanged — preserve all character, ` +
    `material, colors, and details exactly as in the source image. Generate the ` +
    `surrounding environment to frame and contextualize the figurine, with cinematic ` +
    `atmospheric lighting that flows naturally from the figurine outward.`

  try {
    const original = Buffer.from(input.imageB64, 'base64')

    const form = new FormData()
    form.append('image',         new Blob([original], { type: 'image/jpeg' }), 'image.jpg')
    form.append('left',          String(padPx))
    form.append('right',         String(padPx))
    form.append('up',            String(padPx))
    form.append('down',          String(padPx))
    form.append('creativity',    '0.5')
    form.append('prompt',        fullPrompt)
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
      return {
        imageB64: input.imageB64,
        success:  false,
        warnings: [`Stability outpaint failed (${res.status}): ${errText.slice(0, 200)}`],
      }
    }

    const expanded = Buffer.from(await res.arrayBuffer())
    const expandedMeta = await sharp(expanded).metadata()

    // Resize to final target size (square crop if needed)
    const final = await sharp(expanded)
      .resize(finalSize, finalSize, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 95 })
      .toBuffer()

    console.log(
      `[frame-expand] ${presentationKey} / ${reductionKey} — ` +
      `padded ${padPx}px each side (${expandedMeta.width}×${expandedMeta.height}), ` +
      `resized to ${finalSize}×${finalSize}`
    )

    return {
      imageB64: final.toString('base64'),
      success:  true,
    }

  } catch (e: any) {
    return {
      imageB64: input.imageB64,
      success:  false,
      warnings: [`frame_expand_threw: ${e.message}`],
    }
  }
}

// Export presentation keys for UI / route validation
export const PRESENTATION_KEYS = Object.keys(PRESENTATIONS)
export const REDUCTION_KEYS    = Object.keys(PADDING_PROFILES)
