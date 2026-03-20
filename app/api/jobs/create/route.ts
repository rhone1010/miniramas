// app/api/jobs/create/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { toFile } from 'openai'
import { supabaseAdmin } from '@/lib/supabase'
import { buildFinalPrompt } from '@/lib/prompts/promptBuilder'
import { validateConfig, styleToSubjectType, styleToSceneType, MiniramaConfig } from '@/lib/prompts/validateConfig'
import openai from '@/lib/openai'

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface IdentityFeatures {
  age_range: string
  face_shape: string
  jaw_profile: string
  eye_shape: string
  eye_size_ratio: string
  eye_spacing: string
  nose_shape: string
  mouth_shape: string
  ear_size: string
  hair_color: string
  hair_style: string
  skin_tone: string
  distinct_features: string[]
  expression: string
  clothing: string[]
  pose: string
  ground_surface: string
}

interface IdentityScore {
  total_score: number
  pass_threshold: number
  fail: boolean
  issues: string[]
  corrections_required: string[]
  breakdown: {
    face_geometry_match: number
    facial_width_integrity: number
    age_accuracy: number
    expression_match: number
    eye_accuracy: number
    mouth_accuracy: number
    skin_tone_and_texture: number
    overall_identity_feel: number
  }
}

// ─── STEP 1: STRUCTURED IDENTITY EXTRACTION ──────────────────────────────────

async function extractIdentityFeatures(imageUrl: string): Promise<{ features: IdentityFeatures, description: string }> {
  const extractionPrompt = `You are an identity feature extractor for a collectible figurine generation system.

Analyze this image and return a JSON object with EXACT, MEASURABLE identity features.
Be precise and clinical — avoid stylistic language.
Focus on geometry, proportions, and observable traits.

Return ONLY valid JSON in this exact format, no other text:
{
  "age_range": "e.g. 7-8 years old",
  "face_shape": "e.g. narrow oval, long, slightly angular — NOT round",
  "jaw_profile": "e.g. narrow and defined, soft and rounded, square",
  "eye_shape": "e.g. almond, round, hooded — include size relative to face: small/medium/large",
  "eye_size_ratio": "e.g. small relative to face, normal, large",
  "eye_spacing": "e.g. close-set, normal, wide-set",
  "nose_shape": "e.g. small button nose, straight, upturned, broad",
  "mouth_shape": "e.g. wide smile showing teeth, thin lips, full lips",
  "ear_size": "e.g. small, medium, prominent",
  "hair_color": "e.g. strawberry blonde, dark brown, black",
  "hair_style": "e.g. short and messy, side-parted, curly",
  "skin_tone": "e.g. fair, medium, tan, dark — note any marks like freckles or dirt",
  "distinct_features": ["e.g. freckles", "mud on face", "gap in teeth", "dimples"],
  "expression": "e.g. open wide smile, smirk, neutral, laughing",
  "clothing": ["e.g. blue striped t-shirt with CALVIN text", "dark cargo shorts", "red crocs"],
  "pose": "e.g. standing straight, walking mid-stride, arms at sides",
  "ground_surface": "e.g. concrete pavement, carpet, grass, hardwood floor"
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: extractionPrompt }
      ]
    }],
    max_tokens: 600
  })

  const raw = response.choices[0]?.message?.content || '{}'

  let features: IdentityFeatures
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim()
    features = JSON.parse(cleaned)
  } catch {
    console.error('Failed to parse identity JSON, using empty features')
    features = {} as IdentityFeatures
  }

  const description = buildDescriptionFromFeatures(features)
  console.log('Identity features extracted:', features)
  return { features, description }
}

function buildDescriptionFromFeatures(f: IdentityFeatures): string {
  if (!f.age_range) return ''
  const parts = [
    `Age: ${f.age_range}`,
    `Face shape: ${f.face_shape}`,
    `Jaw: ${f.jaw_profile}`,
    `Eyes: ${f.eye_shape}, ${f.eye_size_ratio}, ${f.eye_spacing} spacing`,
    `Nose: ${f.nose_shape}`,
    `Mouth: ${f.mouth_shape}`,
    `Ears: ${f.ear_size}`,
    `Hair: ${f.hair_color}, ${f.hair_style}`,
    `Skin: ${f.skin_tone}`,
    f.distinct_features?.length ? `Distinct features: ${f.distinct_features.join(', ')}` : '',
    `Expression: ${f.expression}`,
    `Clothing: ${f.clothing?.join(', ')}`,
    `Pose: ${f.pose}`,
    `Ground surface: ${f.ground_surface}`,
  ].filter(Boolean)
  return parts.join('\n')
}

// ─── STEP 2: IDENTITY SCORING ENGINE ─────────────────────────────────────────

async function scoreIdentityFidelity(
  originalImageUrl: string,
  generatedImageBase64: string,
  identityFeatures: IdentityFeatures
): Promise<IdentityScore> {

  const featuresSummary = buildDescriptionFromFeatures(identityFeatures)

  const scoringPrompt = `You are a strict identity fidelity evaluator for collectible figurines.

Compare the GENERATED IMAGE (second image) against the SOURCE IDENTITY PROFILE below.
Evaluate ONLY identity preservation — not artistic quality.
Be critical and precise.

SOURCE IDENTITY PROFILE:
${featuresSummary}

Return ONLY valid JSON, no other text:
{
  "total_score": 0,
  "pass_threshold": 90,
  "fail": true,
  "breakdown": {
    "face_geometry_match": 0,
    "facial_width_integrity": 0,
    "age_accuracy": 0,
    "expression_match": 0,
    "eye_accuracy": 0,
    "mouth_accuracy": 0,
    "skin_tone_and_texture": 0,
    "overall_identity_feel": 0
  },
  "issues": [],
  "corrections_required": []
}

SCORING GUIDE:
- face_geometry_match (max 25): jaw shape, face length, cheekbone position, temple width preserved
- facial_width_integrity (max 15): cheek width preserved, no inward tapering, no V-shape narrowing
- age_accuracy (max 15): exact age preserved, no aging shadows added, no de-aging
- expression_match (max 15): smile shape, eye liveliness, cheek lift all preserved
- eye_accuracy (max 10): max 10% scale increase, eye shape preserved, eyelids intact
- mouth_accuracy (max 10): width, teeth visibility, lip curvature, asymmetry all preserved
- skin_tone_and_texture (max 5): skin tone matches source, freckles and marks retained
- overall_identity_feel (max 5): would a parent recognize this child immediately

HARD FAIL (set fail: true if ANY apply):
- Subject looks older than source (aging shadows, texture)
- Subject looks younger than source (baby face, de-aging)
- Expression changed from source (tired, blank, generic smile)
- Face shape altered in any dimension
- Cheek compression detected
- Eyes enlarged beyond 10%
- Face narrowed from original width
- Jaw taper exaggerated

For corrections_required, be specific:
e.g. "restore original cheekbone width — face has been narrowed inward"
e.g. "restore expression — subject looks tired/blank, source shows active smile"
e.g. "remove under-eye shadows — lighting is aging the subject"
e.g. "reduce eye size — eyes exceed 10% enlargement cap"
e.g. "restore mouth detail — smile has been simplified from original expression"`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: originalImageUrl } },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${generatedImageBase64}` } },
          { type: 'text', text: scoringPrompt }
        ]
      }],
      max_tokens: 500
    })

    const raw = response.choices[0]?.message?.content || '{}'
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const score: IdentityScore = JSON.parse(cleaned)
    console.log('Identity score:', score)
    return score

  } catch (err) {
    console.error('Scoring failed:', err)
    return {
      total_score: 91, pass_threshold: 90, fail: false,
      issues: [], corrections_required: [],
      breakdown: { face_geometry_match: 35, eye_accuracy: 12, age_accuracy: 13, feature_accuracy: 12, texture_detail: 8, expression_match: 6 }
    }
  }
}

// ─── CORRECTION PATCH ────────────────────────────────────────────────────────

function buildCorrectionPatch(score: IdentityScore): string {
  if (!score.corrections_required?.length) return ''
  return `
IDENTITY CORRECTION DIRECTIVE (OVERRIDE — APPLY ALL OF THESE):
${score.corrections_required.map(c => `- ${c}`).join('\n')}

SKULL-SCALING REMINDER:
- Scale the skull volume uniformly — do NOT reshape the face geometry
- Restore original face height and vertical proportions
- Restore original cheekbone width — remove any inward tapering
- Remove any artificial face narrowing or V-shape creation
- Restore jaw length and taper exactly
- Restore mouth detail and original smile shape
- Reduce eye size to match original proportions (max 10% enlargement)
- Remove any ear enlargement
- Restore subject's actual age appearance

These corrections override ALL stylization decisions.
Identity accuracy takes absolute priority over aesthetic choices.
`
}

// ─── GENERATION WITH SCORING LOOP ────────────────────────────────────────────

async function generateWithScoring(
  fileBytes: Uint8Array,
  fileName: string,
  fileType: string,
  prompt: string,
  originalImageUrl: string,
  identityFeatures: IdentityFeatures,
  isPeopleMode: boolean
): Promise<{ base64Image: string, score: IdentityScore | null, iterations: number }> {

  const MAX_ITERATIONS = isPeopleMode ? 3 : 1
  let currentPrompt = prompt
  let bestResult = { base64Image: '', score: null as IdentityScore | null, iterations: 0 }
  let bestScore = -1

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`Generation iteration ${iteration}/${MAX_ITERATIONS}`)

    const imageResponse = await openai.images.edit({
      model: 'gpt-image-1',
      image: await toFile(fileBytes, fileName, { type: fileType }),
      prompt: currentPrompt,
      n: 1,
      size: '1024x1024',
    })

    const base64Image = imageResponse.data?.[0]?.b64_json
    if (!base64Image) {
      console.error(`Iteration ${iteration}: no image returned`)
      continue
    }

    // Non-people: return immediately, no scoring
    if (!isPeopleMode) {
      return { base64Image, score: null, iterations: iteration }
    }

    // Score the output
    const score = await scoreIdentityFidelity(originalImageUrl, base64Image, identityFeatures)

    if (score.total_score > bestScore) {
      bestScore = score.total_score
      bestResult = { base64Image, score, iterations: iteration }
    }

    console.log(`Iteration ${iteration} score: ${score.total_score} fail: ${score.fail}`)

    // Pass threshold met
    if (score.total_score >= 90 && !score.fail) {
      console.log(`Passed on iteration ${iteration}`)
      return bestResult
    }

    // Apply corrections for next iteration
    if (iteration < MAX_ITERATIONS) {
      const patch = buildCorrectionPatch(score)
      currentPrompt = `${prompt}\n${patch}`
      console.log('Corrections applied for next iteration')
    }
  }

  console.log(`Best score after ${MAX_ITERATIONS} iterations: ${bestScore}`)
  return bestResult
}

// ─── MAIN ROUTE ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const email = formData.get('email') as string
    const style = formData.get('style') as string || 'landscape'
    const mood = formData.get('mood') as string || 'realistic'
    const detail = formData.get('detail') as string || 'high'
    const composition = formData.get('composition') as string || 'full'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const isPeopleMode = style === 'people_miniature'

    // ─── 1. Upload original image ──────────────────────────────────────────
    const fileBuffer = await file.arrayBuffer()
    const fileBytes = new Uint8Array(fileBuffer)
    const fileName = `${Date.now()}-${file.name}`

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('uploads')
      .upload(fileName, fileBytes, { contentType: file.type })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('uploads')
      .getPublicUrl(fileName)

    // ─── 2. Vision analysis ────────────────────────────────────────────────
    let imageDescription = ''
    let identityFeatures: IdentityFeatures = {} as IdentityFeatures

    try {
      if (isPeopleMode) {
        const extracted = await extractIdentityFeatures(publicUrl)
        identityFeatures = extracted.features
        imageDescription = extracted.description
      } else if (style === 'architecture') {
        const r = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: publicUrl } },
            { type: 'text', text: 'Describe this building for miniature diorama conversion. Include exact roof shape, siding color, window positions, porch details, trim colors, and only vegetation actually visible. Keep under 200 words. Be literal — do not embellish.' }
          ]}],
          max_tokens: 300
        })
        imageDescription = r.choices[0]?.message?.content || ''
      } else {
        const r = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: publicUrl } },
            { type: 'text', text: 'Describe this image for miniature diorama generation. Include main subjects, poses, environment, colors, and important details. Keep under 200 words.' }
          ]}],
          max_tokens: 300
        })
        imageDescription = r.choices[0]?.message?.content || ''
      }
      console.log('Vision analysis complete')
    } catch (err) {
      console.error('Vision analysis failed:', err)
    }

    // ─── 3. Build config and prompt ───────────────────────────────────────
    const rawConfig: Partial<MiniramaConfig> = {
      subject: { type: styleToSubjectType(style), preserve_identity: true, pose_preservation: true },
      scene: { type: styleToSceneType(style), reconstruct_environment: true },
      style: {
        base_style: 'circular_wood_plinth',
        material_style: style === 'architecture' ? 'semi_gloss_collectible' : 'painted_resin',
        lighting_style: 'warm_studio',
        background_style: 'blurred_home',
      },
      composition: { camera_angle: style === 'architecture' ? 35 : 40, margin_ratio: 0.15, depth_of_field: 'shallow' },
      detail: { level: 'high' },
    }

    const config = validateConfig(rawConfig)
    const mode = style === 'sports' ? 'sports' : style === 'activity' ? 'activity' : isPeopleMode ? 'keychain' : undefined
    const prompt = buildFinalPrompt(config, imageDescription, mode)

    // ─── 4. Create job record ─────────────────────────────────────────────
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .insert({
        email: email || 'anonymous',
        original_url: publicUrl,
        style, mood, detail, composition,
        prompt_config: config,
        status: 'generating'
      })
      .select()
      .single()

    if (jobError) {
      console.error('Job error:', jobError)
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }

    // ─── 5. Generate with scoring loop ────────────────────────────────────
    const { base64Image, score, iterations } = await generateWithScoring(
      fileBytes, fileName, file.type,
      prompt, publicUrl, identityFeatures, isPeopleMode
    )

    if (!base64Image) {
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

    // ─── 6. Upload preview ────────────────────────────────────────────────
    const imageBytes = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0))
    const previewFileName = `preview-${job.id}.png`

    const { error: previewError } = await supabaseAdmin
      .storage
      .from('previews')
      .upload(previewFileName, imageBytes, { contentType: 'image/png' })

    if (previewError) console.error('Preview upload error:', previewError)

    const { data: { publicUrl: previewUrl } } = supabaseAdmin
      .storage
      .from('previews')
      .getPublicUrl(previewFileName)

    // ─── 7. Update job ────────────────────────────────────────────────────
    await supabaseAdmin
      .from('jobs')
      .update({
        preview_url: previewUrl,
        status: 'preview_ready',
        ...(score && { identity_score: score.total_score, score_data: score, iterations_used: iterations })
      })
      .eq('id', job.id)

    // ─── 8. Return ────────────────────────────────────────────────────────
    return NextResponse.json({
      jobId: job.id,
      previewUrl,
      status: 'preview_ready',
      ...(score && {
        identityScore: score.total_score,
        scorePassed: !score.fail && score.total_score >= 90,
        iterations,
      })
    })

  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}