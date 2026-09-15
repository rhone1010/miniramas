// lib/v1/foyer/foyer-render.ts
//
// ONE render for the foyer's free personal reveal: the production NB2 call,
// the production prompt, the production watermark -- and nothing else.
//
//   callNB2        lib/v1/portraits/portraits-generator.ts, the exact request
//                  every Portraits and Discovery render makes (google/
//                  nano-banana-2, image_input, aspect_ratio, output_format jpg,
//                  its own wait/poll bounds).
//   the prompt     assembled line for line as generatePortraitsRender does
//                  (portraits-generator.ts, "Build prompt"): the effect's whole
//                  production body, the default pose's phrase if it has one,
//                  and the style-plate clause only when a plate is sent.
//   the watermark  lib/v1/foyer/foyer-watermark.ts: ONE large Liten & Co
//                  lockup baked across the portrait (Rich, 2026-09-14). Not the
//                  tiled pattern (lib/store/preview.ts bakeWatermark), which is
//                  the Portraits free preview's and is unchanged.
//
// generatePortraitsRender itself is NOT called: it runs its own face
// detection (the foyer's intake already did) and a scored second attempt
// (MAX_ATTEMPTS = 2) -- aesthetic QA and a retry policy the foyer's fast
// reveal is ruled not to have. No Gate 1, no Gate 2.
//
// THE CLEAN IMAGE NEVER LEAVES THIS FUNCTION. callNB2 fetches Replicate's
// output URL server-side and hands back bytes; the URL is never returned. The
// clean bytes are watermarked and dropped -- not stored, not logged, not
// returned. What comes back is the marked JPEG only.

import sharp from 'sharp'
import { callNB2 } from '@/lib/v1/portraits/portraits-generator'
import { hasBody, buildEffectPrompt } from '@/lib/v1/portraits/portraits-bodies'
import {
  POSE_PHRASE, DEFAULT_POSE, STYLE_REF_CLAUSE, resolvePresetForSubject, shouldSendStyleRefs,
  type PortraitsPresetId, type PortraitsSubject,
} from '@/lib/v1/portraits/portraits-shared'
import { loadStyleRefs } from '@/lib/v1/portraits/style-refs'
import { bakeFoyerWatermark } from './foyer-watermark'
import { FOYER_ASPECT, revealLabel } from './foyer-policy'

export interface FoyerRevealResult {
  imageDataUrl: string        // data:image/jpeg;base64, -- watermarked
  label:        string
  presetId:     string
  promptChars:  number
  /* Diagnostic timing only (go-to-market pass 1, 2026-09-14): measured
     around the calls, never fed back into them. nb2Ms is callNB2 whole --
     the Replicate request, its wait/poll and the output download; markMs is
     bakeFoyerWatermark plus the delivery JPEG; styleRefs is how many style plates
     went with the request (they change what NB2 is asked to do). */
  timing:       { nb2Ms: number; markMs: number; styleRefs: number }
}

/* The prompt exactly as generatePortraitsRender builds it for one attempt,
   so a foyer reveal can never drift from what a customer is sold. */
export function foyerPrompt(
  presetId: PortraitsPresetId, styleRefCount: number,
): string {
  if (!hasBody(presetId)) throw new Error(`foyer: no production body for ${presetId}`)
  const promptBody = buildEffectPrompt(presetId)
  const posePhrase = POSE_PHRASE[DEFAULT_POSE]
  const posed = posePhrase ? `${promptBody}\n\n${posePhrase}` : promptBody
  return styleRefCount > 0 ? `${posed}\n\n${STYLE_REF_CLAUSE}` : posed
}

export async function renderFoyerReveal(input: {
  sourceImageB64:    string
  effectId:          string
  subject:           PortraitsSubject | null
  ageGroup:          string | null
  replicateApiToken: string
}): Promise<FoyerRevealResult> {
  const subject  = input.subject ?? undefined
  const presetId = resolvePresetForSubject(input.effectId as PortraitsPresetId, subject)
  const styleRefs = shouldSendStyleRefs(input.ageGroup) ? loadStyleRefs(presetId, { subject }) : []
  const prompt   = foyerPrompt(presetId, styleRefs.length)

  const tNb2  = Date.now()
  const clean = await callNB2({
    prompt,
    sourceImageB64:      input.sourceImageB64,
    additionalImagesB64: [],
    styleReferenceB64s:  styleRefs,
    aspectRatio:         FOYER_ASPECT,
    replicateApiToken:   input.replicateApiToken,
  })

  /* Fail closed: bakeFoyerWatermark throws rather than return an unmarked
     image, and so does this. The delivery JPEG is unchanged (q82, sRGB,
     progressive, metadata stripped) and keeps NB2's dimensions. */
  const nb2Ms  = Date.now() - tNb2
  const tMark  = Date.now()
  const marked = await bakeFoyerWatermark(clean)
  const jpeg = await sharp(Buffer.from(marked, 'base64'))
    .toColourspace('srgb')
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer()

  return {
    imageDataUrl: 'data:image/jpeg;base64,' + jpeg.toString('base64'),
    label:        revealLabel(input.effectId),
    presetId,
    promptChars:  prompt.length,
    timing:       { nb2Ms, markMs: Date.now() - tMark, styleRefs: styleRefs.length },
  }
}
