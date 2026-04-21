// lib/v1/generate.ts — router only
import { BaseParams, GenerateResult } from './generators/base'
import { generateSummer }    from './generators/summer'
import { generateSpring }    from './generators/spring'
import { generateFall }      from './generators/fall'
import { generateWinter }    from './generators/winter'
import { generateFlood }     from './generators/flood'
import { generateFire }      from './generators/fire'
import { generateAbandoned } from './generators/abandoned'
import { generateExplosion } from './generators/explosion'
import { generateHaunted }   from './generators/haunted'
import { generateAlien }     from './generators/alien'

export type Params = BaseParams

const GENERATORS: Record<string, (input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}) => Promise<GenerateResult>> = {
  summer:    generateSummer,
  spring:    generateSpring,
  fall:      generateFall,
  winter:    generateWinter,
  flood:     generateFlood,
  fire:      generateFire,
  abandoned: generateAbandoned,
  explosion: generateExplosion,
  haunted:   generateHaunted,
  alien:     generateAlien,
}

export async function generateDiorama(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params?:        Params
}): Promise<{ imageB64: string; promptUsed: string; manualPromptUsed: string | null }> {
  const params    = input.params || {}
  const preset    = params.preset || 'summer'
  const generator = GENERATORS[preset] || generateSummer

  console.log(`[generate] Preset: ${preset}`)

  return generator({
    sourceImageB64: input.sourceImageB64,
    openaiApiKey:   input.openaiApiKey,
    params:         { ...params, preset },
  })
}
