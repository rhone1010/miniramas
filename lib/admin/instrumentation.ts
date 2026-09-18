// lib/admin/instrumentation.ts
//
// Which behavioural events the application actually emits today.
//
// A metric whose source events are not emitted must read "Not instrumented
// yet" rather than zero — a zero is a measurement, and we have not measured
// anything. This file is the record of what has been wired.
//
// No imports, no runtime dependencies: the client component reads it, so
// anything it touches gets bundled into the browser.
//
// Kept honest by lib/admin/tests/instrumentation.test.ts, which greps
// public/ for window.track() call sites and fails if this list drifts from
// what the pages really do. Add an emitter, add it here, or the test breaks.

/**
 * Event names the customer application emits.
 *
 * Wired 2026-09-18 across the eight workshop pages, the foyer and Discovery.
 *
 * NOT here, deliberately:
 *   print_checkout_open — unreachable. printable() in every workshop page
 *   hard-returns false ("PRINT SHOP DISABLED -- coming soon", Rich 2026-08-25),
 *   so an order line can never exist and print checkout can never open.
 *   Claiming it as instrumented would put a permanent zero on the Print intent
 *   tile, which is the exact failure this file exists to prevent.
 */
export const EMITTED_EVENTS = [
  // track.js fires these two on load for every page that loads it.
  'session_start',
  'page_view',
  // Wired 2026-09-18, Admin Phase 1.
  'series_view',
  'nav_click',
  'printshop_open',
  'upload_complete',
  'effect_add',
  'checkout_open',
  'purchase_complete',
] as const

const EMITTED: ReadonlySet<string> = new Set(EMITTED_EVENTS)

export function emits(name: string): boolean {
  return EMITTED.has(name)
}

/**
 * The events each panel metric is computed from. A metric is instrumented
 * only when every event it depends on is emitted somewhere.
 */
export const METRIC_EVENTS = {
  funnel_visited:           ['session_start'],
  funnel_series:            ['series_view'],
  funnel_uploaded:          ['upload_complete'],
  funnel_chose:             ['effect_add'],
  funnel_checkout:          ['checkout_open'],
  funnel_paid:              ['purchase_complete'],
  marketing_visits:         ['session_start'],
  marketing_series_views:   ['series_view'],
  marketing_printshop:      ['printshop_open'],
  marketing_print_checkout: ['print_checkout_open'],
  marketing_paid:           ['purchase_complete'],
  marketing_rooms:          ['series_view'],
  marketing_pages:          ['nav_click'],
} as const

export type MetricKey = keyof typeof METRIC_EVENTS

/** True when every event this metric counts is emitted by the application. */
export function instrumented(metric: MetricKey): boolean {
  return METRIC_EVENTS[metric].every(emits)
}

/**
 * Server-side writers the panel depends on that are not behavioural events.
 * A table with no writer reports nothing, and nothing is not zero.
 *
 * Add a name here only once the writer actually exists in the repo. The same
 * test that guards EMITTED_EVENTS checks these.
 */
export const WIRED_SOURCES: ReadonlySet<string> = new Set([
  // identity_map — upsert on first touch. Wired 2026-09-18.
  'identity_map',
  // error_log — logIncident() call sites. Wired 2026-09-18.
  'error_log',
])

export function wired(source: 'identity_map' | 'error_log'): boolean {
  return WIRED_SOURCES.has(source)
}
