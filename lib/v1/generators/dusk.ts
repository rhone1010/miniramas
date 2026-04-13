import OpenAI, { toFile } from 'openai'
import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, LANDSCAPING_BLOCK, STYLE_BLOCK } from './base'

export async function generateDusk(input: {
  sourceImageB64: string
  openaiApiKey:   string
  params:         BaseParams
}): Promise<GenerateResult> {
  const { params } = input
  if (params.customPrompt) {
    return runGenerate(input.sourceImageB64, input.openaiApiKey, params.customPrompt)
  }

  const prompt = `
${STRUCTURE_BLOCK}

LIGHTING: DUSK / GOLDEN HOUR
This is not daytime. The sun is at or below the horizon.
Sky through windows is deep orange, pink, and purple.
Low-angle amber-golden light from above and behind camera illuminates the front facade.
Shadows fall behind architectural features with long, warm-edged definition.
Upper surfaces catch warm orange-gold highlights. Shadow sides have cool blue-violet tones.
Interior lights glow warmly and prominently through all windows.
Divided light shadow patterns from window mullions fall on the grass and pathway.
Desk surface reflects warm orange and amber tones.
A porch or entry light glows in period-appropriate style.
This must read unmistakably as golden hour — rich, warm, cinematic.

${LANDSCAPING_BLOCK}
Warm evening light on foliage — deep greens with amber highlights.

${STYLE_BLOCK}

${CAMERA_BLOCK}
`.trim()

  // No pre-lift — model must generate its own dark warm mood
  // No pre-lift — model generates its own dark mood
  // Retry once if generation comes back near-black (brightness < 25)
  const sourceBuf = Buffer.from(input.sourceImageB64, 'base64')
  const result = await runGenerate(sourceBuf, input.openaiApiKey, prompt)
  
  // Check brightness and retry if failed
  const { analyzeImage } = await import('../analyze')
  const check = await analyzeImage(result.imageB64)
  if (check.brightness < 25) {
    console.log(`[${mode}] Generation too dark (${Math.round(check.brightness)}) — retrying once`)
    return runGenerate(preparedBuf, input.openaiApiKey, prompt)
  }
  return result
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
