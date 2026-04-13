import OpenAI, { toFile } from 'openai'
import { BaseParams, GenerateResult, STRUCTURE_BLOCK, CAMERA_BLOCK, LANDSCAPING_BLOCK, STYLE_BLOCK } from './base'

export async function generateNight(input: {
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

LIGHTING: NIGHT — CINEMATIC MOONLIGHT
Strong blue-white moonlight from above and behind camera illuminates the front facade.
Moonlight is bright enough to read all architectural detail — not pitch black.
Crisp mullion shadow grids fall on the grass and pathway from window panes — key visual element.
Blue-silver highlights on roof, chimney, upper tree canopy, and desk surface.
Interior warm amber light glows brightly through all windows.
Either a period-appropriate lamppost in the yard OR a porch light — not both.
The lamp casts a warm pool of light on surrounding ground.
Deep shadows in corners and behind trees — detail still readable.
Desk reflects cool blue moonlight and warm amber window glow.
Romantic, cinematic — a beautifully lit still from a period film.

${LANDSCAPING_BLOCK}
Moonlit foliage — deep blue-green with silver highlights on upper leaves.

${STYLE_BLOCK}

${CAMERA_BLOCK}
`.trim()

  // No pre-lift — model generates the dark scene, we preserve it
  // No pre-lift — model generates its own dark mood
  // Retry once if generation comes back near-black (brightness < 25)
  const sourceBuf = Buffer.from(input.sourceImageB64, 'base64')
  const result = await runGenerate(sourceBuf, input.openaiApiKey, prompt)
  
  // Check brightness and retry if failed
  const { analyzeImage } = await import('../analyze')
  const check = await analyzeImage(result.imageB64)
  if (check.brightness < 25) {
    console.log(`[generate] Retry — too dark (${Math.round(check.brightness)})`)
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
