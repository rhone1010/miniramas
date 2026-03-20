// app/api/jobs/create/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { toFile } from 'openai'
import { supabaseAdmin } from '@/lib/supabase'
import { buildFinalPrompt } from '@/lib/prompts/promptBuilder'
import { validateConfig, styleToSubjectType, styleToSceneType, MiniramaConfig } from '@/lib/prompts/validateConfig'
import openai from '@/lib/openai'

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

    // ─── 1. Upload original image to Supabase ───────────────────────────────
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

    // ─── 2. Analyze image with GPT-4o Vision ────────────────────────────────
    let imageDescription = ''
    try {
      const visionPrompt = style === 'architecture'
        ? 'Describe this building photograph for miniature diorama conversion. Include: exact roof shape and style, siding color and material, window count and positions, porch or entry details, trim colors, any unique architectural features. Also describe: what vegetation or landscaping is actually visible (do not invent any). Keep under 200 words. Be precise and literal — do not interpret or embellish.'
        : style === 'people_miniature'
        ? 'Describe this person precisely for chibi figurine creation. Include: exact hair color and cut (e.g. short strawberry blonde, side parted), eye color (e.g. blue-grey), skin tone, face shape (round, oval, etc), approximate age, exact clothing description including colors, patterns, logos or patches, and any props they are holding. Also describe the floor or ground surface they are standing on (carpet color, grass, tile, dirt etc). Be hyper-specific about the face. Keep under 200 words.'
        : 'Describe this image in detail for miniature diorama generation. Include: main subjects, their poses and positions, the environment and setting, colors, lighting, and any important details that must be preserved. Be specific and visual. Keep under 200 words.'

      const visionResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: publicUrl } },
            { type: 'text', text: visionPrompt }
          ]
        }],
        max_tokens: 300
      })

      imageDescription = visionResponse.choices[0]?.message?.content || ''
      console.log('Image analysis:', imageDescription)
    } catch (err) {
      console.error('Vision analysis failed:', err)
    }

    // ─── 3. Build structured config ─────────────────────────────────────────
    const rawConfig: Partial<MiniramaConfig> = {
      subject: {
        type: styleToSubjectType(style),
        preserve_identity: true,
        pose_preservation: true,
      },
      scene: {
        type: styleToSceneType(style),
        reconstruct_environment: true,
      },
      style: {
        base_style: 'circular_wood_plinth',
        material_style: style === 'architecture' ? 'semi_gloss_collectible' : 'painted_resin',
        lighting_style: 'warm_studio',
        background_style: 'blurred_home',
      },
      composition: {
        camera_angle: style === 'architecture' ? 35 : 40,
        margin_ratio: 0.15,
        depth_of_field: 'shallow',
      },
      detail: {
        level: 'high',
      },
    }

    const config = validateConfig(rawConfig)

    // ─── 4. Build final prompt ───────────────────────────────────────────────
    const mode = style === 'sports' ? 'sports' : style === 'activity' ? 'activity' : style === 'people_miniature' ? 'keychain' : undefined
    const prompt = buildFinalPrompt(config, imageDescription, mode)
    console.log('Final prompt:', prompt)

    // ─── 5. Create job record ────────────────────────────────────────────────
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .insert({
        email: email || 'anonymous',
        original_url: publicUrl,
        style,
        mood,
        detail,
        composition,
        prompt_config: config,
        status: 'analyzing'
      })
      .select()
      .single()

    if (jobError) {
      console.error('Job error:', jobError)
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }

    // ─── 6. Generate image with gpt-image-1 (image-to-image) ────────────────
    const imageResponse = await openai.images.edit({
      model: 'gpt-image-1',
      image: await toFile(fileBytes, fileName, { type: file.type }),
      prompt: prompt,
      n: 1,
      size: '1024x1024',
    })

    // gpt-image-1 returns base64
    const base64Image = imageResponse.data?.[0]?.b64_json
    if (!base64Image) {
      console.error('No image returned from gpt-image-1')
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

    // ─── 7. Convert base64 to bytes ──────────────────────────────────────────
    const imageBytes = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0))

    // ─── 8. Upload preview to Supabase ───────────────────────────────────────
    const previewFileName = `preview-${job.id}.png`

    const { error: previewError } = await supabaseAdmin
      .storage
      .from('previews')
      .upload(previewFileName, imageBytes, { contentType: 'image/png' })

    if (previewError) {
      console.error('Preview upload error:', previewError)
    }

    // ─── 9. Get preview URL ──────────────────────────────────────────────────
    const { data: { publicUrl: previewUrl } } = supabaseAdmin
      .storage
      .from('previews')
      .getPublicUrl(previewFileName)

    // ─── 10. Update job ──────────────────────────────────────────────────────
    await supabaseAdmin
      .from('jobs')
      .update({ preview_url: previewUrl, status: 'preview_ready' })
      .eq('id', job.id)

    // ─── 11. Return ──────────────────────────────────────────────────────────
    return NextResponse.json({
      jobId: job.id,
      previewUrl,
      status: 'preview_ready'
    })

  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}