// app/api/admin/settings/route.ts
//
// The only write path the control panel has. Two kinds, both narrow:
//   { kind: 'qa',   series, source_strictness, render_strictness, qa_enabled }
//   { kind: 'flag', owner_key, fulfilment }
//
// Everything else the panel shows is read-only by design. In particular
// there is no path here to prompt_versions — prompt text is not editable
// from a dashboard, deliberately.

import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const kind = body.kind

  if (kind === 'qa') {
    const series = typeof body.series === 'string' ? body.series : null
    const src = Number(body.source_strictness)
    const rnd = Number(body.render_strictness)
    const on  = Boolean(body.qa_enabled)

    if (!series) return NextResponse.json({ error: 'missing_series' }, { status: 400 })
    if (!Number.isInteger(src) || src < 1 || src > 10)
      return NextResponse.json({ error: 'source_strictness_out_of_range' }, { status: 400 })
    if (!Number.isInteger(rnd) || rnd < 1 || rnd > 10)
      return NextResponse.json({ error: 'render_strictness_out_of_range' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('qa_settings')
      .update({
        source_strictness: src,
        render_strictness: rnd,
        qa_enabled: on,
        updated_at: new Date().toISOString(),
        updated_by: 'control-panel',
      })
      .eq('series', series)

    if (error) {
      console.error('[admin/settings] qa update failed', error.message)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (kind === 'flag') {
    const owner = typeof body.owner_key === 'string' ? body.owner_key : null
    const on = Boolean(body.fulfilment)
    if (!owner) return NextResponse.json({ error: 'missing_owner_key' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('account_flags')
      .upsert({ owner_key: owner, fulfilment: on, updated_at: new Date().toISOString() },
              { onConflict: 'owner_key' })

    if (error) {
      console.error('[admin/settings] flag update failed', error.message)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown_kind' }, { status: 400 })
}
