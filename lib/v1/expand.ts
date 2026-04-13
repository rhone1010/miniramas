import sharp from 'sharp'

<<<<<<< HEAD
const ORIG_SIZE  = 1024
const PAD        = 160   // slightly larger = better breathing room
const FINAL_SIZE = ORIG_SIZE + PAD * 2  // 1344
=======
const TARGET_SIZE = '1024x1024'
>>>>>>> parent of b3c68b3 (great results reset)

export async function expandScene(input: {
  imageB64:     string
  openaiApiKey: string
  expand?:      boolean
}) {
  if (!input.expand) {
    return { imageB64: input.imageB64, warnings: [] }
  }

<<<<<<< HEAD
  const runwareApiKey = process.env.RUNWARE_API_KEY
  if (!runwareApiKey) throw new Error('RUNWARE_API_KEY not set')

  // ── Upload ────────────────────────────────────────────────
  const uploadRes = await fetch('https://api.runware.ai/v1', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${runwareApiKey}`,
    },
    body: JSON.stringify([{
      taskType: 'imageUpload',
      taskUUID: crypto.randomUUID(),
      image:    `data:image/jpeg;base64,${input.imageB64}`,
    }]),
=======
  const openai   = new OpenAI({ apiKey: input.openaiApiKey })
  const original = Buffer.from(input.imageB64, 'base64')
  const meta     = await sharp(original).metadata()
  const w        = meta.width!
  const h        = meta.height!
  const warnings: string[] = []

  // Square validation
  if (w !== h) {
    warnings.push(`expand_input_not_square: ${w}x${h}`)
    console.warn(`[expand] Input not square (${w}x${h})`)
  }

  const pad  = Math.round(w * 0.12)
  const newW = w + pad * 2
  const newH = h + pad * 2

  // Expanded canvas — original centred
  const expanded = await sharp({
    create: { width: newW, height: newH, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .composite([{ input: original, left: pad, top: pad }])
    .png()
    .toBuffer()

  // ── MASK — must be RGBA (4 channels) ─────────────────────────
  // alpha=255 (opaque)    = preserve original
  // alpha=0   (transparent) = regenerate this area
  const innerMask = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
  })
    .png()
    .toBuffer()

  const mask = await sharp({
    create: { width: newW, height: newH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  })
    .composite([{ input: innerMask, left: pad, top: pad }])
    .png()
    .toBuffer()

  const prompt = `
Extend the image outward only.

Do not modify the existing diorama.
Preserve lighting, materials, and composition exactly.

Only extend:
- desk surface
- background environment

Maintain consistent perspective and lighting.
`.trim()

  const res = await openai.images.edit({
    model: 'gpt-image-1',
    image: await toFile(expanded, 'expanded.png', { type: 'image/png' }),
    mask:  await toFile(mask,     'mask.png',     { type: 'image/png' }),
    prompt,
    size:  TARGET_SIZE,
>>>>>>> parent of b3c68b3 (great results reset)
  })

  const uploadData = await uploadRes.json()
  const imageUUID  = uploadData?.data?.[0]?.imageUUID
  if (!imageUUID) throw new Error('expand_upload_failed')

  // ── OUTPAINT (FIXED PROMPT) ───────────────────────────────
  const inferRes = await fetch('https://api.runware.ai/v1', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${runwareApiKey}`,
    },
    body: JSON.stringify([{
      taskType: 'imageInference',
      taskUUID: crypto.randomUUID(),
      model:    'runware:102@1',

      // 🔑 KEY FIX: ONLY EXTEND ROOM — DO NOT TOUCH SUBJECT
      positivePrompt: `
extend the existing interior room naturally outward,
preserve identical lighting direction, tone, and intensity,
continue the wooden desk surface with accurate grain and reflection,
maintain correct perspective and depth,
do not modify the central object in any way
      `.trim(),

      negativePrompt: `
blurry, distortion, warped perspective,
lighting change, exposure shift,
object alteration, duplicate subject,
text, watermark
      `.trim(),

      seedImage: imageUUID,
      width:     FINAL_SIZE,
      height:    FINAL_SIZE,

      outpaint: {
        top:    PAD,
        bottom: PAD,
        left:   PAD,
        right:  PAD,
        blur:   24,   // lower = sharper edge preservation
      },

      steps:         28,
      outputType:    'base64Data',
      outputFormat:  'JPG',
      numberResults: 1,
    }]),
  })

  const inferData = await inferRes.json()
  const b64       = inferData?.data?.[0]?.imageBase64Data
  if (!b64) throw new Error('expand_infer_failed')

  console.log('[expand] Done — ' + TARGET_SIZE)
  return { imageB64: b64, warnings }
}
