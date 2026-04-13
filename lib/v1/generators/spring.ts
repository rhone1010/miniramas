import OpenAI, { toFile } from 'openai'
import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, LANDSCAPING_BLOCK, STYLE_BLOCK } from './base'

export async function generateSpring(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  if (params.customPrompt) {
    return runGenerate(input.sourceImageB64, input.openaiApiKey, params.customPrompt)
  }

  const interiorLine = params.interior_lights
    ? `Very subtle warm glow inside windows — barely visible in bright daylight, does not affect exterior.`
    : `No interior window glow.`

  const prompt = `
${STRUCTURE_BLOCK}

LIGHTING: SOFT SPRING AFTERNOON
Light source positioned above and behind camera — front facade evenly and gently illuminated.
Diffused bright sunlight — high key, airy, and clear. Not dim, not flat.
Soft shadow edges on architectural features — gentle definition, no harsh contrast.
Slight warm tone with vivid greens and soft surface glow.
This is a bright cheerful scene — think full bloom on a clear spring day.
${interiorLine}

${LANDSCAPING_BLOCK}
Spring blooms appropriate to the region. Lush green grass. Soft flower colors.

${STYLE_BLOCK}

${CAMERA_BLOCK}
`.trim()

  const sourceBuf = Buffer.from(input.sourceImageB64, 'base64')
  return runGenerate(sourceBuf, input.openaiApiKey, prompt)
}

async function runGenerate(
  source: string | Buffer,
  apiKey: string,
  prompt: string
): Promise<GenerateResult> {
  const openai = new OpenAI({ apiKey })
  const buf    = typeof source === 'string' ? Buffer.from(source, 'base64') : source
  const file   = await toFile(buf, 'source.png', { type: 'image/png' })
  const res    = await openai.images.edit({ model: 'gpt-image-1', image: file, prompt, size: '1024x1024' })
  const b64    = res.data?.[0]?.b64_json
  if (!b64) throw new Error('generate_failed')
  return { imageB64: b64, promptUsed: prompt }
}
