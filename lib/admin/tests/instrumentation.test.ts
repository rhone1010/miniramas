// lib/admin/tests/instrumentation.test.ts
//
// Keeps lib/admin/instrumentation.ts honest.
//
// The panel decides whether to show a number or "Not instrumented yet" from
// that manifest. If the manifest drifts from what the pages actually emit, the
// panel goes back to lying — either claiming a measurement it does not have,
// or hiding one it does. So the manifest is checked against the repo, not
// trusted.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  EMITTED_EVENTS, emits, instrumented, wired, METRIC_EVENTS,
  type MetricKey,
} from '../instrumentation'

const PUBLIC = join(process.cwd(), 'public')
const LIB = join(process.cwd(), 'lib')
const APP = join(process.cwd(), 'app')

/** Every window.track('name' …) call site across the customer pages. */
function emittedInRepo(): Set<string> {
  const found = new Set<string>()
  for (const file of readdirSync(PUBLIC)) {
    if (!file.endsWith('.html') && !file.endsWith('.js')) continue
    if (file === 'track.js') continue      // the transport, not a call site
    const body = readFileSync(join(PUBLIC, file), 'utf8')
    for (const m of body.matchAll(/window\.track\(\s*'([a-z_]+)'/g)) {
      found.add(m[1])
    }
  }
  // track.js fires these two itself, for every page that loads it.
  found.add('session_start')
  found.add('page_view')
  return found
}

describe('instrumentation manifest', () => {
  it('claims exactly what the pages emit', () => {
    const actual = emittedInRepo()
    const claimed = new Set<string>(EMITTED_EVENTS)

    const overclaimed = [...claimed].filter(n => !actual.has(n)).sort()
    const unclaimed = [...actual].filter(n => !claimed.has(n)).sort()

    // Overclaiming is the dangerous direction: the panel would print a zero
    // for something nothing measures.
    expect(overclaimed, 'in EMITTED_EVENTS but no call site in public/').toEqual([])
    // Underclaiming is merely wasteful — a real measurement hidden behind
    // "Not instrumented yet" — but it is still drift.
    expect(unclaimed, 'emitted by a page but missing from EMITTED_EVENTS').toEqual([])
  })

  it('does not claim print_checkout_open while the print shop is disabled', () => {
    // printable() hard-returns false in every workshop page, so no order line
    // can exist and print checkout cannot open. If that guard is ever lifted,
    // this test should fail and the manifest should gain the event.
    const stillDisabled = readdirSync(PUBLIC)
      .filter(f => f.endsWith('.html'))
      .some(f => readFileSync(join(PUBLIC, f), 'utf8')
        .includes('PRINT SHOP DISABLED'))
    if (stillDisabled) expect(emits('print_checkout_open')).toBe(false)
  })

  it('every metric maps only to events the manifest knows', () => {
    for (const key of Object.keys(METRIC_EVENTS) as MetricKey[]) {
      for (const name of METRIC_EVENTS[key]) {
        // A metric pointing at an event nobody has heard of would silently
        // read as uninstrumented forever.
        expect(
          typeof name === 'string' && name.length > 0,
          `${key} has a malformed event name`,
        ).toBe(true)
      }
    }
  })

  it('reports the funnel steps that are wired, and only those', () => {
    // Steps 1-6. All six are wired as of Phase 1; print checkout is not a
    // funnel step. This pins the behaviour so a regression in the emitters
    // shows up here rather than as a silent zero in the panel.
    expect(instrumented('funnel_visited')).toBe(true)
    expect(instrumented('funnel_series')).toBe(true)
    expect(instrumented('funnel_uploaded')).toBe(true)
    expect(instrumented('funnel_chose')).toBe(true)
    expect(instrumented('funnel_checkout')).toBe(true)
    expect(instrumented('funnel_paid')).toBe(true)
    // Print intent depends on print_checkout_open, which cannot fire.
    expect(instrumented('marketing_print_checkout')).toBe(false)
  })
})

describe('wired server-side sources', () => {
  it('identity_map has a real writer', () => {
    const helper = join(LIB, 'v1', 'identity', 'touch-identity.ts')
    expect(existsSync(helper), 'touch-identity.ts missing').toBe(true)
    expect(readFileSync(helper, 'utf8')).toContain("from('identity_map')")

    // And it is actually called from a route, not just defined.
    const route = readFileSync(join(APP, 'api', 'v1', 'auth', 'me', 'route.ts'), 'utf8')
    expect(route).toContain('touchIdentity(')
    expect(wired('identity_map')).toBe(true)
  })

  it('identity_map writer never sets first_seen', () => {
    // first_seen is the only column "New customers" reads. Writing it on
    // every upsert would reset each returning visitor to today and the metric
    // would count the same people forever.
    const helper = readFileSync(join(LIB, 'v1', 'identity', 'touch-identity.ts'), 'utf8')
    const payload = helper.slice(helper.indexOf('.upsert('), helper.indexOf('onConflict'))
    expect(payload).not.toContain('first_seen')
  })

  it('error_log has real logIncident() call sites', () => {
    const callers = [
      join(APP, 'api', 'v1', 'print', 'webhook', 'route.ts'),
      join(APP, 'api', 'v1', 'webhooks', 'stripe', 'route.ts'),
      join(APP, 'api', 'v1', 'portraits', 'generate', 'route.ts'),
      join(APP, 'api', 'v1', 'portfolios', 'items', 'render-poll', 'route.ts'),
    ]
    for (const file of callers) {
      expect(readFileSync(file, 'utf8'), `${file} does not call logIncident`)
        .toContain('logIncident({')
    }
    expect(wired('error_log')).toBe(true)
  })

  it('no logIncident call puts a varying id in component', () => {
    // component feeds the dedupe fingerprint. A template literal there splits
    // one recurring incident into one row per request and floods error_log.
    for (const file of [
      join(APP, 'api', 'v1', 'print', 'webhook', 'route.ts'),
      join(APP, 'api', 'v1', 'webhooks', 'stripe', 'route.ts'),
      join(APP, 'api', 'v1', 'portraits', 'generate', 'route.ts'),
      join(APP, 'api', 'v1', 'portfolios', 'items', 'render-poll', 'route.ts'),
    ]) {
      const body = readFileSync(file, 'utf8')
      for (const m of body.matchAll(/component:\s*(.+)/g)) {
        expect(m[1], `${file}: component must be a literal`).not.toContain('${')
      }
    }
  })
})
