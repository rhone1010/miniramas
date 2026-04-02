// app/api/save-target/route.ts
// Saves user-selected renders as learning targets.
// Targets are stored in the `renders` table with is_target=true and user notes.
// Future loops can query these as style references for a given engine.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { targets, sessionId, engineId } = await request.json()

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ error: 'targets array is required' }, { status: 400 })
    }

    const rows = targets.map((t: any) => ({
      session_id:   sessionId || null,
      patch_source: 'user_target',
      prompt_text:  t.notes || '',
      prompt_hash:  null,
      stored_url:   t.imageUrl,
      score_total:  t.score || null,
      issue_label:  t.notes || `${engineId} target · pass ${t.iterationNumber}`,
      config: {
        engineId:        engineId,
        phase:           t.phase || null,
        iterationNumber: t.iterationNumber,
        notes:           t.notes || '',
        is_target:       true,
        saved_at:        new Date().toISOString(),
      },
    }))

    const { data, error } = await supabaseAdmin
      .from('renders')
      .insert(rows)
      .select('id, stored_url')

    if (error) {
      console.error('Save target error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      saved:  data?.length || 0,
      ids:    data?.map((r: any) => r.id) || [],
    })

  } catch (err: any) {
    console.error('Save target error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}

// GET — fetch all saved targets for an engine (for future use as style refs)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const engineId = searchParams.get('engineId') || 'people'
    const limit    = parseInt(searchParams.get('limit') || '20', 10)

    const { data, error } = await supabaseAdmin
      .from('renders')
      .select('id, stored_url, score_total, issue_label, config, created_at')
      .eq('patch_source', 'user_target')
      .contains('config', { engineId, is_target: true })
      .order('score_total', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ targets: data || [] })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
