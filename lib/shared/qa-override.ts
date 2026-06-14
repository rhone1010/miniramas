// lib/shared/qa-override.ts
//
// 8b — per-request QA strictness override (INTERNAL traffic only).
//
// Rich's QA drawer attaches
//   { qa_override: { source_strictness, render_strictness } }
// to generate and gate requests. This module is the single place that decides
// whether to honor it and re-derives the FULL threshold set through the same
// resolveSliders LUTs that loadQaSettings uses — so an override moves intake,
// fidelity, and aesthetic thresholds together, identically to a table-backed
// setting. There is no second threshold path; precheck and enforcement cannot
// drift.
//
// SAFETY — the override is ignored unless the request is internal. A customer
// must never be able to loosen their own gate. "Internal" means:
//   - env QA_OVERRIDE_ENABLED === '1'   (blanket-enable for dev / internal deploys)
//   - OR header x-liten-internal matching env LITEN_INTERNAL_TOKEN
// If neither holds, qa_override is silently dropped and the configured,
// table-backed strictness governs. Fail-safe is always toward the STRICTER
// (configured) gate, never looser.

import { resolveSliders, type ResolvedQaSettings } from '@/lib/shared/qa-log'

// Derive the series union straight from resolveSliders so we never import a
// type that might not be exported.
type QaSeries = Parameters<typeof resolveSliders>[0]['series']

/** True only for internal/trusted callers. Customer traffic always returns false. */
export function qaOverrideAllowed(req: Request): boolean {
  if (process.env.QA_OVERRIDE_ENABLED === '1') return true
  const tok = process.env.LITEN_INTERNAL_TOKEN
  if (tok && req.headers.get('x-liten-internal') === tok) return true
  return false
}

function clampStrictness(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(10, Math.max(1, Math.round(n)))
}

/**
 * Apply an optional qa_override to already-loaded settings.
 * Returns the (possibly re-derived) settings and whether an override took effect.
 * No-op — same settings object back — when not allowed, absent, malformed, or
 * equal to the current strictness.
 */
export function applyQaOverride(
  settings: ResolvedQaSettings,
  series: QaSeries,
  body: any,
  allowed: boolean,
): { settings: ResolvedQaSettings; overridden: boolean } {
  const ov = body?.qa_override
  if (!allowed || !ov || typeof ov !== 'object') {
    return { settings, overridden: false }
  }

  const src = clampStrictness(ov.source_strictness, settings.sourceStrictness)
  const rnd = clampStrictness(ov.render_strictness, settings.renderStrictness)

  if (src === settings.sourceStrictness && rnd === settings.renderStrictness) {
    return { settings, overridden: false }
  }

  const next = resolveSliders({
    series,
    sourceStrictness: src,
    renderStrictness: rnd,
    qaEnabled: settings.qaEnabled,
  })
  return { settings: next, overridden: true }
}
