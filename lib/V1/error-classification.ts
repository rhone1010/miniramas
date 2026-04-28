// error-classification.ts
// lib/v1/error-classification.ts
//
// Strict classifier for upstream-overload vs other failures. The point is to
// only show the "high demand" UI when we're confident the upstream API is
// overloaded — never on plain bugs, validation errors, or auth/billing issues
// (those would mask real problems).
//
// Categories:
//   upstream_overload  capacity / queue / 429 / 503 from Replicate or OpenAI
//   upstream_error     upstream returned an error that isn't capacity (4xx/5xx)
//   our_error          everything else (TypeError, validation we missed, etc.)

export type ErrorCategory = 'upstream_overload' | 'upstream_error' | 'our_error'

export interface ClassifiedError {
  category:        ErrorCategory
  originalMessage: string
  statusCode?:     number
}

const OVERLOAD_PATTERNS: RegExp[] = [
  /\boverloaded\b/i,
  /\bover capacity\b/i,
  /\bcapacity\b/i,
  /\bqueue (is )?full\b/i,
  /\btoo many requests\b/i,
  /\brate.?limit/i,
  /\bserver is busy\b/i,
  /\bserver busy\b/i,
  /\bserver_overloaded\b/i,
  /\bservice unavailable\b/i,
  /\btemporarily unavailable\b/i,
  /\bbackend (is )?busy\b/i,
  /\bplease (try|retry) (again )?later\b/i,
  /\binsufficient capacity\b/i,
]

// 4xx that means *we* did something wrong, NOT capacity.
const CLIENT_ERROR_STATUSES = new Set([400, 401, 403, 404, 422])

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as Record<string, unknown>

  // Direct numeric .status / .statusCode (Replicate SDK, fetch-style, axios)
  if (typeof e.status === 'number')      return e.status
  if (typeof e.statusCode === 'number')  return e.statusCode

  // Nested: response.status (axios)
  const response = e.response as Record<string, unknown> | undefined
  if (response) {
    if (typeof response.status === 'number') return response.status
  }

  // OpenAI v4 errors expose .status
  if (typeof e.status === 'string') {
    const n = parseInt(e.status, 10)
    if (Number.isFinite(n)) return n
  }

  return undefined
}

function extractMessage(err: unknown): string {
  if (!err) return ''
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string') return e.message
    if (typeof e.error === 'string') return e.error
  }
  try { return JSON.stringify(err) } catch { return String(err) }
}

function looksLikeOverloadMessage(msg: string): boolean {
  if (!msg) return false
  return OVERLOAD_PATTERNS.some((re) => re.test(msg))
}

export function classifyError(err: unknown): ClassifiedError {
  const message = extractMessage(err)
  const status  = extractStatus(err)

  // ── upstream_overload — high confidence only ──────────────────
  if (status === 429 || status === 503) {
    return { category: 'upstream_overload', originalMessage: message, statusCode: status }
  }
  if (status === 502 || status === 504) {
    // Bad gateway / timeout — treat as overload since the user-facing remedy is the same
    return { category: 'upstream_overload', originalMessage: message, statusCode: status }
  }
  if (looksLikeOverloadMessage(message)) {
    return { category: 'upstream_overload', originalMessage: message, statusCode: status }
  }

  // ── upstream_error — got a status code but it's not capacity ──
  if (typeof status === 'number') {
    if (CLIENT_ERROR_STATUSES.has(status) || (status >= 500 && status < 600)) {
      return { category: 'upstream_error', originalMessage: message, statusCode: status }
    }
  }

  // ── our_error — default ───────────────────────────────────────
  return { category: 'our_error', originalMessage: message, statusCode: status }
}
