// lib/v1/generate.ts — router only
// Dispatches to the correct lighting generator based on lighting_preset.
// All prompt assembly, pre-processing, and generation logic lives in generators/.

import { BaseParams, GenerateResult } from './generators/base'
import { generateMidday } from './generators/midday'
import { generateSpring } from './generators/spring'
import { generateDusk }   from './generators/dusk'
import { generateNight }  from './generators/night'

export type Params = BaseParams

const GENERATORS: Record<string, (input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}) => Promise<GenerateResult>> = {
  midday_summer: generateMidday,
  soft_spring:   generateSpring,
  dusk_evening:  generateDusk,
  night:         generateNight,
}

export async function generateDiorama(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params?:        Params
}): Promise<{ imageB64: string; promptUsed: string; manualPromptUsed: string | null }> {
  const params  = input.params || {}

  // Support both lighting_preset (new) and lighting (legacy UI key)
  const preset  = params.lighting_preset || params.lighting || 'midday_summer'
  const generator = GENERATORS[preset] || generateMidday

  console.log(`[generate] Mode: ${preset}`)

  return generator({
    sourceImageB64: input.sourceImageB64,
    openaiApiKey:   input.openaiApiKey,
    params:         { ...params, lighting_preset: preset },
  })
}
