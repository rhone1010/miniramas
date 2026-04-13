import OpenAI, { toFile } from 'openai'
import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, LANDSCAPING_BLOCK, STYLE_BLOCK } from './base'

export async function generateMidday(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  if (params.customPrompt) {
    return runGenerate(input.sourceImageB64, input.openaiApiKey, params.customPrompt)
  }

  const interiorLine = params.interior_lights
    ? `Subtle warm amber glow visible inside windows — does not affect exterior lighting or facade color.`
    : `No interior window glow.`

  const prompt = `
${STRUCTURE_BLOCK}

LIGHTING: MIDDAY SUMMER SUN
Light source positioned above and behind camera — front facade fully and directly illuminated.
Strong directional sunlight with crisp shadow edges on trim, moldings, railings, and eaves.
High contrast, bright clean exposure, neutral-warm color temperature.
Strong specular highlights on glass, polished wood, and resin surfaces.
The diorama is the brightest most defined element in the frame.
${interiorLine}

${LANDSCAPING_BLOCK}

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
