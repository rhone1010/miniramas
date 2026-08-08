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

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { EVENT_NAMES } from '@/lib/analytics/event-names'

export const runtime = 'nodejs'

const MAX_BATCH = 50
const MAX_PROPS_BYTES = 4096

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
  try {
    const h = await headers()
    const ua = (h.get('user-agent') || '').slice(0, 512)
    const country = h.get('x-vercel-ip-country') || null
    const device = deviceFrom(ua)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: true, accepted: 0 })
    }

    const batch: Incoming[] = Array.isArray(body)
      ? body
      : Array.isArray((body as { events?: unknown })?.events)
        ? ((body as { events: Incoming[] }).events)
        : []

    if (!batch.length) return NextResponse.json({ ok: true, accepted: 0 })

    const rows = batch.slice(0, MAX_BATCH).flatMap((e) => {
      const name = str(e.name, 64)
      if (!name || !EVENT_NAMES.has(name)) return []

      const anon = str(e.anon_id, 64)
      const sess = str(e.session_id, 64)
      if (!anon || !UUID_RE.test(anon)) return []
      if (!sess || !UUID_RE.test(sess)) return []

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

    if (!rows.length) return NextResponse.json({ ok: true, accepted: 0 })

    const { error } = await supabaseAdmin.from('events').insert(rows)
    if (error) {
      console.warn('[events] insert failed', error.message)
      return NextResponse.json({ ok: true, accepted: 0 })
    }

    return NextResponse.json({ ok: true, accepted: rows.length })
  } catch (err) {
    console.warn('[events] unexpected', err)
    return NextResponse.json({ ok: true, accepted: 0 })
  }
}
