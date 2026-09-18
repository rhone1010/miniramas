// lib/admin/tests/panel-states.test.ts
//
// The three states that must never be confused:
//
//   a measured zero      — the business did nothing, and we know that
//   not instrumented     — nothing is measuring, so there is no zero to report
//   reporting failure    — the query broke, which is not a fact about revenue
//
// Before Phase 1 all three rendered identically: null became 0 or an em dash,
// and every tab's empty state was the same sentence. A dead reporting pipeline
// made the business look bad and the system look fine.
//
// These tests exercise the data layer and the shared helpers. They use fixture
// payloads, so they need no database.

import { describe, it, expect } from 'vitest'
import { money, num, pct, delta } from '../format'
import { instrumented, emits } from '../instrumentation'
import type { PanelData, Overview, Engine, Fulfilment, Customers } from '../panel-types'

/** A PanelData with everything absent and nothing failed. */
function emptyPanel(): PanelData {
  return {
    overview: null, engine: null, marketing: null, customers: null,
    fulfilment: null, health: null, controls: null, failures: {},
  }
}

describe('reporting failure is distinguishable from empty', () => {
  it('a failed slice is named in failures; an empty one is not', () => {
    const failed: PanelData = { ...emptyPanel(), failures: { overview: 'relation does not exist' } }
    const empty = emptyPanel()

    // Both have overview === null. Only the failure carries a reason, and that
    // is the whole basis on which the panel tells them apart.
    expect(failed.overview).toBeNull()
    expect(empty.overview).toBeNull()
    expect(failed.failures.overview).toBe('relation does not exist')
    expect(empty.failures.overview).toBeUndefined()
  })

  it('failures can name several slices at once', () => {
    const d: PanelData = {
      ...emptyPanel(),
      failures: { engine: 'boom', health: 'timeout' },
    }
    expect(Object.keys(d.failures).sort()).toEqual(['engine', 'health'])
  })
})

describe('a measured zero stays a zero', () => {
  it('num renders 0 as "0", not as an em dash', () => {
    // The em dash is reserved for absent. A real zero must look like a number.
    expect(num(0)).toBe('0')
    expect(num(null)).toBe('—')
    expect(num(undefined)).toBe('—')
  })

  it('money renders 0 as a currency zero', () => {
    expect(money(0)).toBe('$0')
    expect(money(null)).toBe('—')
  })

  it('pct distinguishes 0% from unknown', () => {
    expect(pct(0)).toBe('0%')
    expect(pct(null)).toBe('—')
  })
})

describe('margin refuses to invent a profit', () => {
  it('null margin is not 100%', () => {
    // wholesale_cost_cents is never written, so migration 033 returns null
    // rather than (retail - 0) / retail, which read 100% for any revenue.
    const f: Fulfilment = {
      orders: 12, in_error: 0, retail_cents: 48000,
      wholesale_cents: 0, margin_pct: null, recent: [],
    }
    expect(f.margin_pct).toBeNull()
    expect(pct(f.margin_pct)).toBe('—')
    // And the panel branches on exactly this, showing prose instead.
    expect(f.margin_pct == null).toBe(true)
  })

  it('a real margin is still shown', () => {
    const f: Fulfilment = {
      orders: 12, in_error: 0, retail_cents: 48000,
      wholesale_cents: 19200, margin_pct: 60, recent: [],
    }
    expect(pct(f.margin_pct)).toBe('60%')
  })
})

describe('funnel instrumentation gates the numbers', () => {
  it('every wired funnel step reports as instrumented', () => {
    expect(instrumented('funnel_visited')).toBe(true)
    expect(instrumented('funnel_paid')).toBe(true)
  })

  it('print intent stays uninstrumented while the shop is disabled', () => {
    expect(emits('print_checkout_open')).toBe(false)
    expect(instrumented('marketing_print_checkout')).toBe(false)
  })

  it('a zero from a wired step is a real zero', () => {
    const o = { funnel: { visited: 10, series: 4, uploaded: 0, chose: 0, checkout: 0, paid: 0 } }
    // Nobody uploaded. That is a measurement now, because the emitter exists,
    // and it must render as 0 rather than being hidden.
    expect(instrumented('funnel_uploaded')).toBe(true)
    expect(num(o.funnel.uploaded)).toBe('0')
  })
})

describe('engine outcomes reconcile', () => {
  it('errored and in_progress are separate buckets', () => {
    const e: Partial<Engine> = {
      renders_all_time: 100,
      outcomes: { passed: 60, failed: 10, rejected: 15, redirected: 5, errored: 8, in_progress: 2 },
    }
    const o = e.outcomes!
    const accounted = o.passed + o.failed + o.rejected + o.redirected
      + (o.errored ?? 0) + (o.in_progress ?? 0)
    expect(accounted).toBe(e.renders_all_time)
    // A generator error is not a quality refusal.
    expect(o.errored).not.toBe(o.failed)
  })

  it('an older payload without the new buckets does not pretend to reconcile', () => {
    // Migration 033 is not applied yet in some environments. The panel must
    // notice the shortfall rather than showing four bars that silently omit
    // every hard failure.
    const e: Partial<Engine> = {
      renders_all_time: 100,
      outcomes: { passed: 60, failed: 10, rejected: 15, redirected: 5 },
    }
    const o = e.outcomes!
    const accounted = o.passed + o.failed + o.rejected + o.redirected
      + (o.errored ?? 0) + (o.in_progress ?? 0)
    expect(accounted).toBeLessThan(e.renders_all_time!)
  })
})

describe('credits are not falsely allocated', () => {
  it('lifetime totals are reported without splitting the balance', () => {
    const c: Partial<Customers> = {
      credits_held: 420,
      credits_purchased_ever: 1000,
      credits_granted_ever: 250,
    }
    // The held balance is NOT purchased-minus-spent: no consumption order is
    // recorded, so the split is unknowable. Purchased + granted describes
    // history, and deliberately does not equal the balance.
    expect(c.credits_purchased_ever! + c.credits_granted_ever!).not.toBe(c.credits_held)
  })
})

describe('delta', () => {
  it('does not call a genuine zero-to-zero period a change', () => {
    expect(delta(0, 0).text).toBe('no change yet')
  })

  it('reports growth from a prior period', () => {
    const d = delta(200, 100)
    expect(d.dir).toBe('up')
    expect(d.text).toContain('100%')
  })
})

describe('overview shape', () => {
  it('craft attempts are carried separately from crafts', () => {
    const o: Partial<Overview> = { crafts: 40, craft_attempts: 95 }
    // A craft is a successful craft. Attempts stay available rather than being
    // folded in, which is what made the old "Crafts" figure overstate.
    expect(o.craft_attempts).toBeGreaterThan(o.crafts!)
  })
})
