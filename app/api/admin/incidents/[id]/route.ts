// app/api/admin/incidents/[id]/route.ts
//
// Renders one incident as the self-contained markdown document from the
// incident log spec. The panel's "Copy for Claude" button fetches this and
// puts it on the clipboard.
//
// The whole point: pasting this into a chat should answer every question a
// debugger would ask, with no follow-ups.

import { isAdmin } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

type Row = {
  incident_id: string; created_at: string; severity: string; surface: string
  component: string; series: string | null; preset: string | null
  summary: string; message: string | null; stack: string | null
  upstream: unknown; inputs: unknown; context: unknown; timeline: unknown
  qa_log_id: string | null; owner_key: string | null; correlation: unknown
  count: number; first_seen: string; last_seen: string
  status: string; notes: string | null
}

function block(title: string, body: string | null | undefined) {
  if (!body) return ''
  return `\n## ${title}\n${body}\n`
}

function json(v: unknown) {
  if (v == null) return null
  try { return '```json\n' + JSON.stringify(v, null, 2) + '\n```' } catch { return null }
}

function timeline(v: unknown) {
  if (!Array.isArray(v) || !v.length) return null
  return v.map((s) => {
    const step = s as Record<string, unknown>
    const t = String(step.t ?? '').padStart(7, ' ')
    const extra = Object.entries(step)
      .filter(([k]) => k !== 't' && k !== 'step')
      .map(([k, val]) => `${k}=${val}`)
      .join(' ')
    return `${t}ms  ${step.step}${extra ? '  ' + extra : ''}`
  }).join('\n')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return new Response('unauthorized', { status: 401 })

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('error_log').select('*').eq('incident_id', id).single()

  if (error || !data) return new Response('not found', { status: 404 })
  const r = data as Row

  // Recurrence is often the answer — 147 failures in two hours is a
  // different problem from 147 spread over a week.
  const spanMs = new Date(r.last_seen).getTime() - new Date(r.first_seen).getTime()
  const spanTxt = spanMs < 60_000 ? 'under a minute'
    : spanMs < 3_600_000 ? `${Math.round(spanMs / 60_000)} minutes`
    : spanMs < 86_400_000 ? `${Math.round(spanMs / 3_600_000)} hours`
    : `${Math.round(spanMs / 86_400_000)} days`

  const md = `# INCIDENT ${r.incident_id}
**Severity:** ${r.severity} · **Surface:** ${r.surface} · **Status:** ${r.status}
**First seen:** ${r.first_seen} · **Last seen:** ${r.last_seen} · **Count:** ${r.count}
**Component:** ${r.component}${r.series ? ` · **Series:** ${r.series}` : ''}${r.preset ? ` · **Finish:** ${r.preset}` : ''}

## SUMMARY
${r.summary}
${block('ENVIRONMENT', json(r.context))}${block('TIMELINE', timeline(r.timeline) ? '```\n' + timeline(r.timeline) + '\n```' : null)}${block('ERROR', r.message ? `${r.message}\n\n\`\`\`\n${r.stack || '(no stack)'}\n\`\`\`` : null)}${block('UPSTREAM', json(r.upstream))}${block('INPUTS (redacted)', json(r.inputs))}${block('CORRELATION', json({
    qa_log_id: r.qa_log_id, owner_key: r.owner_key, ...(r.correlation as object || {}),
  }))}
## RECURRENCE
${r.count} ${r.count === 1 ? 'occurrence' : 'occurrences'} over ${spanTxt}.
${r.count > 5 && spanMs < 7_200_000
  ? 'Concentrated in a short window — points at something upstream rather than at the prompt or the code path.'
  : r.count > 5
  ? 'Spread over time — points at a persistent condition rather than an incident.'
  : 'Too few occurrences to read a pattern.'}
${block('NOTES', r.notes)}
---
Prompt text is never logged. Where a prompt body is relevant it appears in
INPUTS as a hash and length only.
`

  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
