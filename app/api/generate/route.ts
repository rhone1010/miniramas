// app/api/generate/route.ts
// Image-to-image via Responses API
// gpt-4o + image_generation tool with forced tool_choice
// Source image passed as input_image in base64

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import openai from '@/lib/openai'
import sharp from 'sharp'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const formData        = await request.formData()
    const file            = formData.get('file') as File | null
    const prompt          = formData.get('prompt') as string
    const sessionId       = formData.get('sessionId') as string
    const loopId          = formData.get('loopId') as string
    const iterationNumber = parseInt(formData.get('iterationNumber') as string || '1')

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const trimmedPrompt = prompt.substring(0, 4000)
    const promptHash    = crypto.createHash('sha256').update(trimmedPrompt).digest('hex').substring(0, 16)

    // ── Resize + convert to JPEG ──────────────────────────────────────────────
    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const resized   = await sharp(rawBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer()

    const base64Image = resized.toString('base64')
    console.log('ORIGINAL:', rawBuffer.length, 'RESIZED:', resized.length, 'bytes')

    // ── Responses API: gpt-4o + forced image_generation tool ─────────────────
    let b64Output: string | null = null

    try {
      const response = await (openai as any).responses.create({
        model: 'gpt-4o',
        input: [
          {
            role: 'user',
            content: [
              {
                type:      'input_image',
                image_url: `data:image/jpeg;base64,${base64Image}`,
              },
              {
                type: 'input_text',
                text: trimmedPrompt,
              },
            ],
          },
        ],
        tools:       [{ type: 'image_generation' }],
        tool_choice: { type: 'image_generation' },
      })

      console.log('FULL OUTPUT:', JSON.stringify(response.output, null, 2))

      const imageBlock = response.output?.find(
        (block: any) => block.type === 'image_generation_call'
      )
      b64Output = imageBlock?.result || null

      if (!b64Output) {
        throw new Error('No image_generation_call in response output')
      }

    } catch (err: any) {
      console.error('=== GENERATION FAILED ===')
      console.error('Status:', err?.status)
      console.error('Message:', err?.message)
      console.error('Error:', JSON.stringify(err?.error || {}, null, 2))
      console.error('=========================')
      return NextResponse.json({
        error: `Generation failed: ${err?.message || 'unknown'}`
      }, { status: 500 })
    }

    // ── Store in Supabase ─────────────────────────────────────────────────────
    const imgBytes = new Uint8Array(Buffer.from(b64Output, 'base64'))
    const fileName = `gpt-image-${loopId || sessionId}-iter${iterationNumber}-${promptHash}.png`

    const { error: uploadErr } = await supabaseAdmin
      .storage
      .from('renders')
      .upload(fileName, imgBytes, { contentType: 'image/png' })

    if (uploadErr) {
      return NextResponse.json({ error: 'Storage failed: ' + uploadErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('renders')
      .getPublicUrl(fileName)

    const { data: render } = await supabaseAdmin
      .from('renders')
      .insert({
        session_id:   sessionId || null,
        patch_source: 'gpt-image-1',
        prompt_text:  trimmedPrompt,
        prompt_hash:  promptHash,
        stored_url:   publicUrl,
        config:       { loopId, iterationNumber, model: 'gpt-image-1' },
      })
      .select('id')
      .single()

    console.log('SUCCESS:', publicUrl)

    return NextResponse.json({
      imageUrl:   publicUrl,
      modelUsed:  'gpt-image-1',
      renderId:   render?.id,
      iterationNumber,
      loopId,
    })

  } catch (error: any) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: error?.message || 'Generation failed' }, { status: 500 })
  }
}