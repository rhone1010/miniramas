// lib/errors/log-incident.ts
//
// Long-form error capture. One call from any catch block.
//
// Writes to public.error_log (migration 016) via the log_incident() function,
// which dedupes on fingerprint — a repeating failure becomes one row with a
// count, not a thousand rows.
//
// Redaction happens HERE, before insert. A secret that reaches the table has
// already leaked.

import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export type Surface = 'engine' | 'route' | 'client' | 'webhook' | 'build'
export type Severity = 'fatal' | 'error' | 'warn'

export type TimelineStep = {
  t: number
  step: string
  outcome?: string
  [k: string]: unknown
}

export type IncidentInput = {
  surface: Surface
  component: string
  summary: string
  severity?: Severity
  error?: unknown
  series?: string | null
  preset?: string | null
  upstream?: Record<string, unknown> | null
  inputs?: Record<string, unknown> | null
  context?: Record<string, unknown> | null
  timeline?: TimelineStep[] | null
  qaLogId?: string | null
  ownerKey?: string | null
  correlation?: Record<string, unknown> | null
}

// ── Redaction ───────────────────────────────────────────────
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-[A-Za-z0-9_-]{8,}/g,            'sk-[REDACTED]'],
  [/whsec_[A-Za-z0-9_-]{8,}/g,         'whsec_[REDACTED]'],
  [/rk_live_[A-Za-z0-9_-]{8,}/g,       'rk_live_[REDACTED]'],
  [/sk_live_[A-Za-z0-9_-]{8,}/g,       'sk_live_[REDACTED]'],
  [/eyJ[A-Za-z0-9_-]{20,}/g,           '[REDACTED_JWT]'],
  [/Bearer\s+[A-Za-z0-9._-]{8,}/gi,    'Bearer [REDACTED]'],
  [/([?&](?:token|key|apikey|api_key|signature)=)[^&\s"']+/gi, '$1[REDACTED]'],
  [/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gi, '[IMAGE_DATA_STRIPPED]'],
]

export function redact<T>(value: T): T {
  if (value == null) return value
  if (typeof value === 'string') {
    let s: string = value
    for (const [re, sub] of SECRET_PATTERNS) s = s.replace(re, sub)
    return s as unknown as T
  }
  if (Array.isArray(value)) return value.map(redact) as unknown as T
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/^(authorization|cookie|api[_-]?key|password|secret|email)$/i.test(k)) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = redact(v)
      }
    }
    return out as unknown as T
  }
  return value
}

// ── Fingerprint ─────────────────────────────────────────────
// component + normalised message + top 3 stack frames. Numbers, uuids and
// hex blobs are stripped so "timed out after 61183ms" and "after 60042ms"
// collapse into one incident.
function fingerprint(component: string, message: string, stack: string): string {
  const norm = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b[0-9a-f]{16,}\b/gi, '<hex>')
    .replace(/\d+/g, '<n>')
    .slice(0, 300)
  const frames = stack.split('\n').slice(1, 4).map((l) => l.trim()).join('|')
  return crypto.createHash('sha256')
    .update(`${component}::${norm}::${frames}`)
    .digest('hex')
    .slice(0, 32)
}

function incidentId(): string {
  const d = new Date()
  const day = d.toISOString().slice(0, 10)
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `INC-${day}-${rand}`
}

function baseContext(): Record<string, unknown> {
  return {
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    deployment: process.env.VERCEL_DEPLOYMENT_ID || null,
    region: process.env.VERCEL_REGION || null,
    node: process.version,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
    prodigi_env: process.env.PRODIGI_ENV || null,
  }
}

/**
 * Record an incident. Never throws — a failure to log must not become a
 * second failure. Returns the incident id, or null if logging failed.
 */
export async function logIncident(input: IncidentInput): Promise<string | null> {
  try {
    const err = input.error
    const message = redact(
      err instanceof Error ? err.message
        : typeof err === 'string' ? err
        : err ? JSON.stringify(err).slice(0, 2000)
        : input.summary
    )
    const stack = redact(err instanceof Error && err.stack ? err.stack : '')

    const fp = fingerprint(input.component, message, stack)
    const id = incidentId()

    const { data, error } = await supabaseAdmin.rpc('log_incident', {
      p_incident_id: id,
      p_severity:    input.severity || 'error',
      p_surface:     input.surface,
      p_component:   input.component,
      p_summary:     redact(input.summary).slice(0, 500),
      p_message:     message.slice(0, 4000),
      p_stack:       stack.slice(0, 12000),
      p_fingerprint: fp,
      p_series:      input.series || null,
      p_preset:      input.preset || null,
      p_upstream:    input.upstream ? redact(input.upstream) : null,
      p_inputs:      input.inputs ? redact(input.inputs) : null,
      p_context:     { ...baseContext(), ...(input.context ? redact(input.context) : {}) },
      p_timeline:    input.timeline || null,
      p_qa_log_id:   input.qaLogId || null,
      p_owner_key:   input.ownerKey || null,
      p_correlation: input.correlation ? redact(input.correlation) : null,
    })

    if (error) {
      console.error('[log-incident] write failed', error.message)
      return null
    }
    return (data as string) || id
  } catch (e) {
    console.error('[log-incident] unexpected', e)
    return null
  }
}

/**
 * Timeline builder. Records elapsed ms from construction, which is what
 * turns "it broke" into "it broke 61 seconds in, at pass 1".
 */
export class Timeline {
  private t0 = Date.now()
  private steps: TimelineStep[] = []

  mark(step: string, extra?: Record<string, unknown>): this {
    this.steps.push({ t: Date.now() - this.t0, step, ...(extra || {}) })
    return this
  }

  get(): TimelineStep[] {
    return this.steps
  }
}
