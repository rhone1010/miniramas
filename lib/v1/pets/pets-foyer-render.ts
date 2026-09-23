import sharp from 'sharp'
import { callNB2 } from '@/lib/v1/portraits/portraits-generator'
import { PETS_35 } from './pets-catalog-35'
import { bakeFoyerWatermark } from '@/lib/v1/foyer/foyer-watermark'
import { FOYER_ASPECT } from '@/lib/v1/foyer/foyer-policy'

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

// Exact catalog prompt assembly from pets-generator.ts; no Portraits composition or style plates.
export function petsFoyerPrompt(effectId: string): string {
  const effect = PETS_35[effectId]
  if (!effect) throw new Error(`Pets Foyer: unknown effect ${effectId}`)
  return effect.body + (effect.avoid ? '\n' + effect.avoid : '')
}

export async function renderPetsFoyerReveal(input: {
  sourceImageB64: string
  effectId: string
  replicateApiToken: string
}): Promise<FoyerRevealResult> {
  const presetId = input.effectId
  const styleRefs: string[] = []
  const prompt = petsFoyerPrompt(presetId)

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
    label:        PETS_35[input.effectId].label,
    presetId,
    promptChars:  prompt.length,
    timing:       { nb2Ms, markMs: Date.now() - tMark, styleRefs: styleRefs.length },
  }
}
