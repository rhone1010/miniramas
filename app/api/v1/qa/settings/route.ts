// app/api/v1/qa/settings/route.ts
//
// 8 — QA settings (GET / PUT) over the qa_settings table. Durable, table-backed
// strictness per Series. This is the end-state that replaces the 8b per-request
// qa_override stopgap: PUT writes source/render_strictness to the same row that
// loadQaSettings already reads, so the value persists across uploads AND
// sessions, and BOTH the gate precheck and the generate path pick it up with no
// override body and no env flag.
//
// INTERNAL ONLY. The QA drawer is an internal tool; this route must never be
// customer-reachable. Access uses the same internal gate as qa_override
// (env QA_OVERRIDE_ENABLED=1, or header x-liten-internal === LITEN_INTERNAL_TOKEN).
// Non-internal callers get 403.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { qaOverrideAllowed } from '@/lib/shared/qa-override' // shared internal-traffic gate

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!qaOverrideAllowed(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const series = req.nextUrl.searchParams.get('silo')
             ?? req.nextUrl.searchParams.get('series')
  if (!series) {
    return NextResponse.json({ error: 'silo (series) required' }, { status: 400 })
  }

  const sb = supaOrNull()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const { data, error } = await sb.from('qa_settings')
    .select('source_strictness, render_strictness, qa_enabled')
    .eq('series', series)
    .single()

  // PGRST116 = no row yet; fall through to defaults rather than erroring.
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    silo:              series,
    source_strictness: data?.source_strictness ?? 5,
    render_strictness: data?.render_strictness ?? 5,
    qa_enabled:        data?.qa_enabled ?? true,
  })
}

export async function PUT(req: NextRequest) {
  if (!qaOverrideAllowed(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as any))
  const series = body.silo ?? body.series
  if (!series || typeof series !== 'string') {
    return NextResponse.json({ error: 'silo (series) required' }, { status: 400 })
  }

  const src = clampStrictness(body.source_strictness)
  const rnd = clampStrictness(body.render_strictness)
  if (src === null || rnd === null) {
    return NextResponse.json(
      { error: 'source_strictness and render_strictness must be 1-10' },
      { status: 400 },
    )
  }

  const sb = supaOrNull()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  // Upsert on the series key. Only the two strictness columns are written, so an
  // existing row's qa_enabled is preserved (ON CONFLICT updates just these); a
  // brand-new row takes the column default for qa_enabled.
  const { error } = await sb.from('qa_settings')
    .upsert(
      { series, source_strictness: src, render_strictness: rnd },
      { onConflict: 'series' },
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[qa/settings] ${series} → src=${src} rnd=${rnd}`)
  return NextResponse.json({ silo: series, source_strictness: src, render_strictness: rnd })
}

// ── helpers ──────────────────────────────────────────────────────

function supaOrNull() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function clampStrictness(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(10, Math.max(1, Math.round(n)))
}
