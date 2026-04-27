// actionmini-generator.ts
// lib/v1/actionmini-generator.ts
//
// Routes preset to the correct prompt builder. Two non-card presets:
//   - insitu  — outdoor editorial diorama (locked at v11)
//   - museum  — desk presentation in curator's study
//
// NOTE: collectable_card has its own dedicated path in the route — it does NOT
// flow through this generator. See actionmini-route.ts and actionmini-card.ts.

import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import {
  buildInSituPrompt,
  ActionMiniInSituInput,
  ActionMiniHero,
  ActionMiniSecondaryFigures,
} from './actionmini-insitu'
import {
  buildMuseumPrompt,
  ActionMiniMuseumInput,
} from './actionmini-museum'

export type ActionMiniPreset = 'insitu' | 'museum' | 'collectable_card'

export interface ActionMiniGenerateInput {
  sourceImageB64:        string
  preset:                ActionMiniPreset
  kineticMedium:         string
  actionDescription:     string
  freezeMomentQuality?:  string
  hero:                  ActionMiniHero | null
  secondaryFigures?:     ActionMiniSecondaryFigures
  environment:           string
  distinctiveFeatures?:  string
  sourceLighting?:       string
  displayName?:          string
  mood:                  string
  plaqueText?:           string
  notes?:                string
  openaiApiKey:          string
}

export async function generateActionMini(
  input: ActionMiniGenerateInput
): Promise<{ imageB64: string; promptUsed: string; preset: ActionMiniPreset }> {

  const preset: ActionMiniPreset = input.preset || 'insitu'
  if (preset === 'collectable_card') {
    throw new Error('[actionmini-generator] collectable_card is handled by route directly — do not call generateActionMini for it')
  }

  // Build the correct prompt for the preset
  let prompt: string
  if (preset === 'museum') {
    const museumInput: ActionMiniMuseumInput = {
      kineticMedium:        input.kineticMedium,
      actionDescription:    input.actionDescription,
      freezeMomentQuality:  input.freezeMomentQuality,
      hero:                 input.hero,
      secondaryFigures:     input.secondaryFigures,
      distinctiveFeatures:  input.distinctiveFeatures,
      sourceLighting:       input.sourceLighting,
      displayName:          input.displayName,
      mood:                 input.mood,
      plaqueText:           input.plaqueText,
      notes:                input.notes,
    }
    prompt = buildMuseumPrompt(museumInput)
  } else {
    // 'insitu' (default)
    const insituInput: ActionMiniInSituInput = {
      kineticMedium:        input.kineticMedium,
      actionDescription:    input.actionDescription,
      freezeMomentQuality:  input.freezeMomentQuality,
      hero:                 input.hero,
      secondaryFigures:     input.secondaryFigures,
      environment:          input.environment,
      distinctiveFeatures:  input.distinctiveFeatures,
      sourceLighting:       input.sourceLighting,
      displayName:          input.displayName,
      mood:                 input.mood,
      plaqueText:           input.plaqueText,
      notes:                input.notes,
    }
    prompt = buildInSituPrompt(insituInput)
  }

  // ── SOURCE PREP ──────────────────────────────────────────────
  const srcBuf = Buffer.from(input.sourceImageB64, 'base64')
  const bright = (await sharp(srcBuf).rotate().greyscale().stats()).channels[0].mean
  const lift   = bright < 165 ? Math.min(165 / bright, 2.0) : 1.0

  let pipeline = sharp(srcBuf)
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
  if (lift > 1.0) pipeline = pipeline.modulate({ brightness: lift })
  const prepared = await pipeline.png().toBuffer()

  console.log(
    `[actionmini] ${input.displayName || 'action'} / ${input.kineticMedium} / ${input.mood} / ${preset} — ` +
    `brightness ${Math.round(bright)} × ${lift.toFixed(2)} — prepared ${Math.round(prepared.length / 1024)} KB — ` +
    `quality:high input_fidelity:high`
  )

  // ── gpt-image-1 EDIT CALL ────────────────────────────────────
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const file   = await toFile(prepared, 'source.png', { type: 'image/png' })

  const res = await openai.images.edit({
    model:          'gpt-image-1',
    image:          file,
    prompt,
    size:           '1024x1024',
    quality:        'high',
    input_fidelity: 'high',
  } as any)

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('actionmini_generation_failed')

  console.log(`[actionmini] ${preset} — done`)
  return { imageB64: b64, promptUsed: prompt }
}
