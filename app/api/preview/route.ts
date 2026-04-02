// app/api/preview/route.ts
// Generate a DALL-E 3 preview AND auto-save to the renders library
// POST {
//   prompt: string,
//   label?: string,
//   patchSource?: 'original' | 'claude' | 'gpt',
//   suggestionText?: string,
//   issueLabel?: string,
//   imageDescription?: string,
//   scoreTotal?: number,
//   scoreBreakdown?: Record<string, number>,
//   config?: object,
//   sessionId?: string,
// }

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import openai from '@/lib/openai'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const {
      prompt,
      label,
      patchSource = 'original',
      suggestionText,
      issueLabel,
      imageDescription,
      scoreTotal,
      scoreBreakdown,
      config,
      sessionId,
    } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const trimmedPrompt = prompt.substring(0, 4000)

    // 1. Generate with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: trimmedPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',   // better identity preservation than 'vivid'
    })

    const dalleUrl      = response.data?.[0]?.url
    const revisedPrompt = response.data?.[0]?.revised_prompt || ''

    if (!dalleUrl) {
      return NextResponse.json({ error: 'No image returned from DALL-E' }, { status: 500 })
    }

    // 2. Permanently store the image (DALL-E URLs expire in 1hr)
    const promptHash = crypto
      .createHash('sha256')
      .update(trimmedPrompt)
      .digest('hex')
      .substring(0, 16)

    let storedUrl = dalleUrl
    try {
      const imageRes    = await fetch(dalleUrl)
      const imageBuffer = await imageRes.arrayBuffer()
      const imageBytes  = new Uint8Array(imageBuffer)
      const fileName    = `${Date.now()}-${patchSource}-${promptHash}.png`

      const { error: uploadError } = await supabaseAdmin
        .storage
        .from('renders')
        .upload(fileName, imageBytes, { contentType: 'image/png' })

      if (!uploadError) {
        const { data: { publicUrl } } = supabaseAdmin
          .storage
          .from('renders')
          .getPublicUrl(fileName)
        storedUrl = publicUrl
      }
    } catch (err) {
      console.error('Permanent storage failed (non-fatal):', err)
    }

    // 3. Save record to renders table
    const { data: render } = await supabaseAdmin
      .from('renders')
      .insert({
        session_id:        sessionId || null,
        patch_source:      patchSource,
        suggestion_text:   suggestionText || null,
        issue_label:       issueLabel || null,
        prompt_text:       trimmedPrompt,
        prompt_hash:       promptHash,
        image_description: imageDescription || null,
        dalle_url:         dalleUrl,
        stored_url:        storedUrl,
        revised_prompt:    revisedPrompt || null,
        score_total:       scoreTotal || null,
        score_breakdown:   scoreBreakdown || null,
        config:            config || null,
      })
      .select('id')
      .single()

    return NextResponse.json({
      imageUrl:   storedUrl,
      dalleUrl,
      revisedPrompt,
      renderId:   render?.id,
      label:      label || patchSource,
    })

  } catch (error: any) {
    console.error('Preview error:', error)
    const message = error?.error?.message || error?.message || 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
