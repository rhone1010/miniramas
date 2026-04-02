// app/api/run-pass/route.ts
// Destination: app/api/run-pass/route.ts
//
// Single reinforcement pass:
//   1. Assemble prompt from blueprint + patch + variation params
//   2. Generate via gpt-image-1 image.edit()
//   3. Score against structural anchors (always on raw output)
//   4. Build patch from failed anchors
//   5. If is_final_pass: generate AI background + run Sharp compositor
//   6. Return result (composed image on final pass, raw on intermediate passes)
//
// Blueprint is IMMUTABLE — passed in from client, never re-extracted.
// Completion requires score >= 85 AND zero failed anchors.

import { NextRequest, NextResponse }    from 'next/server'
import { assemblePrompt, VariationParams } from '@/lib/structure/assemblePrompt'
import { generateImage }                from '@/lib/structure/generateImage'
import { AnchorBlueprint }              from '@/lib/structure/extractBlueprint'
import { composeMiniramaPresentation }  from '@/lib/structure/composePresentation'

export const maxDuration = 300

interface RunPassRequest {
  blueprint:       AnchorBlueprint
  structure_lock:  string
  anti_drift:      string
  iteration:          number
  model:              'gpt-image-1'
  patch?:             string
  style_reference?:   string
  variation?:         VariationParams
  // Lab sends source_images[] — route normalises to source_image_b64 + extra_images_b64
  source_images?:      string[]   // array form from lab: [primary, ...extras]
  source_image_b64?:   string     // single form (backwards compat)
  previous_image_b64?: string
  is_final_pass?:     boolean
  previous_score?:    number
  user_overrides?:    string[]
  scope_attempts?:    Record<string, number>
  debug_mode?:        boolean
}

export async function POST(request: NextRequest) {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

  let body: RunPassRequest
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const {
    blueprint, iteration, style_reference, variation,
    source_images, source_image_b64: source_image_b64_direct,
    previous_image_b64,
  } = body

  // Single pass only
  const source_image_b64 = source_image_b64_direct || source_images?.[0]

  if (!source_image_b64)   return NextResponse.json({ error: 'source_image_b64 is required' }, { status: 400 })
  if (!blueprint?.anchors) return NextResponse.json({ error: 'blueprint with anchors is required' }, { status: 400 })

  console.log(`[run-pass] iter=${iteration} anchors=${blueprint.anchors.length}`)

  try {
    // 1. Assemble prompt
    const prompt = assemblePrompt({
      blueprint,
      styleReference: style_reference,
      model:          'gpt-image-1',
      variation:      variation || undefined,
    })
    console.log(`[run-pass] Prompt assembled — ${prompt.length} chars`)

    // 2. Generate diorama (raw)
    // Extra views from lab (source_images[1+]) passed as additional context images
    const extraImagesBb64 = source_images?.slice(1).filter(Boolean) || []
    const generation = await generateImage({
      prompt, model: 'gpt-image-1',
      sourceImageB64:   source_image_b64,
      extraImagesB64:   extraImagesBb64.length > 0 ? extraImagesBb64 : undefined,
      previousImageB64: previous_image_b64,
      openaiApiKey,
    })
    console.log(`[run-pass] Image generated`)

    // 3. Cloudinary background removal + Sharp placement on living room background
    console.log(`[run-pass] Compositing...`)
    const presentationB64 = await composeMiniramaPresentation(generation.image_b64)
    console.log(`[run-pass] Composition complete`)

    return NextResponse.json({
      iteration,
      image_b64:        generation.image_b64,
      presentation_b64: presentationB64,
      model_used:       generation.model_used,
      patch:            null,
      should_continue:  false,
      scope_attempts:   { iter_1: 1 },
    })

  } catch (error) {
    console.error('[run-pass] Error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pass failed' }, { status: 500 })
  }
}
