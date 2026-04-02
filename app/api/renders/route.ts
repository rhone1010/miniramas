// app/api/renders/route.ts
// POST — save a render to Supabase (downloads image, stores permanently)
// GET  — fetch render history for the gallery

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

// ── POST: save a render ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      patchSource,       // 'original' | 'claude' | 'gpt'
      suggestionText,
      issueLabel,
      promptText,
      imageDescription,
      dalleUrl,
      revisedPrompt,
      scoreTotal,
      scoreBreakdown,
      config,
    } = body

    if (!promptText || !dalleUrl) {
      return NextResponse.json({ error: 'promptText and dalleUrl are required' }, { status: 400 })
    }

    // 1. Hash the prompt for dedup
    const promptHash = crypto
      .createHash('sha256')
      .update(promptText)
      .digest('hex')
      .substring(0, 16)

    // 2. Download the DALL-E image (it expires in 1hr — store it permanently)
    let storedUrl = dalleUrl // fallback if upload fails
    try {
      const imageRes = await fetch(dalleUrl)
      const imageBuffer = await imageRes.arrayBuffer()
      const imageBytes = new Uint8Array(imageBuffer)

      const fileName = `${Date.now()}-${patchSource || 'render'}-${promptHash}.png`

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
      } else {
        console.error('Render upload error:', uploadError)
      }
    } catch (err) {
      console.error('Failed to permanently store render:', err)
      // non-fatal — we still save the record with the DALL-E URL
    }

    // 3. Insert into renders table
    const { data: render, error: insertError } = await supabaseAdmin
      .from('renders')
      .insert({
        session_id:       sessionId,
        patch_source:     patchSource || 'original',
        suggestion_text:  suggestionText || null,
        issue_label:      issueLabel || null,
        prompt_text:      promptText,
        prompt_hash:      promptHash,
        image_description: imageDescription || null,
        dalle_url:        dalleUrl,
        stored_url:       storedUrl,
        revised_prompt:   revisedPrompt || null,
        score_total:      scoreTotal || null,
        score_breakdown:  scoreBreakdown || null,
        config:           config || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Render insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save render' }, { status: 500 })
    }

    return NextResponse.json({ render })

  } catch (error) {
    console.error('Renders POST error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ── GET: fetch gallery ───────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const source = searchParams.get('source') // 'original' | 'claude' | 'gpt' | null (all)
    const winners = searchParams.get('winners') === 'true'

    let query = supabaseAdmin
      .from('renders')
      .select('id, created_at, patch_source, issue_label, stored_url, dalle_url, score_total, score_breakdown, rating, notes, is_winner, suggestion_text, image_description, revised_prompt')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (source) query = query.eq('patch_source', source)
    if (winners) query = query.eq('is_winner', true)

    const { data, error, count } = await query

    if (error) {
      console.error('Renders GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch renders' }, { status: 500 })
    }

    return NextResponse.json({ renders: data, total: count })

  } catch (error) {
    console.error('Renders GET error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ── PATCH: update rating / notes / winner flag ───────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const { id, rating, notes, is_winner } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const updates: Record<string, any> = {}
    if (rating    !== undefined) updates.rating    = rating
    if (notes     !== undefined) updates.notes     = notes
    if (is_winner !== undefined) updates.is_winner = is_winner

    const { data, error } = await supabaseAdmin
      .from('renders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update render' }, { status: 500 })
    }

    return NextResponse.json({ render: data })

  } catch (error) {
    console.error('Renders PATCH error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
