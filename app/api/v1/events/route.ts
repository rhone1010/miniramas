// app/api/v1/events/route.ts
//
// Analytics ingest. Accepts a batch of events from the browser, validates
// every name against a closed list, enriches server-side, and writes to
// public.events (migration 015).
//
// Design rules:
//   - NEVER fails loudly. Analytics must not break a craft. Always 200.
//   - Client-supplied identity is advisory only; user_id comes from the
//     session, never from the request body.
//   - Unknown event names are dropped silently (they're almost always a
//     stale deploy, not an attack).
//
// DIAGNOSTIC MODE: while EVENTS_DEBUG=1 is set, the response includes a
// `debug` field naming exactly why rows were dropped. Remove the env var
// (or leave it unset) and the route goes quiet again. No behaviour changes
// either way — the response is always 200.

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { EVENT_NAMES } from '@/lib/analytics/event-names'

export const runtime = 'nodejs'

const MAX_BATCH = 50
const MAX_PROPS_BYTES = 4096
const DEBUG = process.env.EVENTS_DEBUG === '1'

type Incoming = {
  name?: unknown
  anon_id?: unknown
  session_id?: unknown
  owner_key?: unknown
  series?: unknown
  props?: unknown
  path?: unknown
  referrer?: unknown
  utm?: unknown
  ts?: unknown
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function str(v: unknown, max = 512): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  return s.slice(0, max)
}

function deviceFrom(ua: string): string {
  const s = ua.toLowerCase()
  if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet'
  if (/mobi|android|iphone|ipod/.test(s)) return 'mobile'
  return 'desktop'
}

export async function POST(req: Request) {
  const dropped: string[] = []

  try {
    const h = await headers()
    const ua = (h.get('user-agent') || '').slice(0, 512)
    const country = h.get('x-vercel-ip-country') || null
    const device = deviceFrom(ua)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: true, accepted: 0, ...(DEBUG && { debug: 'bad_json' }) })
    }

    const batch: Incoming[] = Array.isArray(body)
      ? body
      : Array.isArray((body as { events?: unknown })?.events)
        ? ((body as { events: Incoming[] }).events)
        : []

    if (!batch.length) {
      return NextResponse.json({ ok: true, accepted: 0, ...(DEBUG && { debug: 'empty_batch' }) })
    }

    const rows = batch.slice(0, MAX_BATCH).flatMap((e) => {
      const name = str(e.name, 64)
      if (!name) { dropped.push('missing_name'); return [] }
      if (!EVENT_NAMES.has(name)) { dropped.push(`unknown_name:${name}`); return [] }

      const anon = str(e.anon_id, 64)
      const sess = str(e.session_id, 64)
      if (!anon || !UUID_RE.test(anon)) { dropped.push('bad_anon_id'); return [] }
      if (!sess || !UUID_RE.test(sess)) { dropped.push('bad_session_id'); return [] }

      let props: Record<string, unknown> = {}
      if (e.props && typeof e.props === 'object' && !Array.isArray(e.props)) {
        const raw = JSON.stringify(e.props)
        if (raw.length <= MAX_PROPS_BYTES) props = e.props as Record<string, unknown>
      }

      let utm: Record<string, unknown> | null = null
      if (e.utm && typeof e.utm === 'object' && !Array.isArray(e.utm)) {
        utm = e.utm as Record<string, unknown>
      }

      return [{
        name,
        anon_id: anon,
        session_id: sess,
        owner_key: str(e.owner_key, 128),
        series: str(e.series, 64),
        props,
        path: str(e.path, 512),
        referrer: str(e.referrer, 512),
        utm,
        device,
        ua,
        country,
      }]
    })

    if (!rows.length) {
      return NextResponse.json({ ok: true, accepted: 0, ...(DEBUG && { debug: { stage: 'validation', dropped } }) })
    }

    const { error } = await supabaseAdmin.from('events').insert(rows)
    if (error) {
      console.warn('[events] insert failed', error.message)
      return NextResponse.json({
        ok: true,
        accepted: 0,
        ...(DEBUG && { debug: { stage: 'insert', message: error.message, details: error.details, hint: error.hint, code: error.code } }),
      })
    }

    return NextResponse.json({ ok: true, accepted: rows.length })
  } catch (err) {
    console.warn('[events] unexpected', err)
    return NextResponse.json({
      ok: true,
      accepted: 0,
      ...(DEBUG && { debug: { stage: 'exception', message: err instanceof Error ? err.message : String(err) } }),
    })
  }
}
