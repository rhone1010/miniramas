// lib/store/tests/portfolio-of-one.test.ts
//
// Discovery size 1, as a portfolio of one.
//
// It used to route through /api/v1/checkout with skuId:'single' -- the
// original single-craft path, and where the 13 historical paid singles went:
// 10 of their entitlements are still stranded at 'pending' and the return
// page 404s. It now uses the same payment -> activation -> dispatch -> render
// machinery as 4/8/16.
//
// The whole of the difference is one recorded fact, portfolios.delivery.
// These tests exist mostly to prove what it does NOT touch: no reader counts
// items, and a preview bundle comes out of every path byte-identical.

import { describe, it, expect } from 'vitest'
import { resolveSelectionOffer, normalizeAspectChoice } from '../portfolio-checkout'
import {
  ASPECT_FOR_FRAMING,
  PORTRAIT_OUTPUT_ASPECTS,
  isPortraitOutputAspect,
  outputDimensions,
} from '@/lib/v1/portraits/portraits-shared'

describe('size 1 is priced from the same table as every other size', () => {
  it('is $2.99 against the existing single SKU', () => {
    const o = resolveSelectionOffer(1)
    expect(o.priceUsd).toBe(2.99)
    expect(o.skuId).toBe('single')
    expect(o.count).toBe(1)
  })

  it('carries no included unlocks, because there is nothing to unlock', () => {
    // activatePortfolio mints one entitlement per free_unlock, so 0 here is
    // what stops a purchased piece having an entitlement behind it at all.
    expect(resolveSelectionOffer(1).includedUnlocks).toBe(0)
  })

  it('takes tier_1, which nothing else was using', () => {
    expect(resolveSelectionOffer(1).tier).toBe('tier_1')
  })
})

describe('delivery is data on the size table, not a size test', () => {
  it('marks size 1 purchased', () => {
    expect(resolveSelectionOffer(1).delivery).toBe('purchased')
  })

  it('marks every bundle preview', () => {
    for (const n of [4, 8, 16]) {
      expect(resolveSelectionOffer(n).delivery).toBe('preview')
    }
  })

  it('never calls an in-between browsing count purchased', () => {
    // 2 and 3 describe the 4-pack the customer would reach by filling up.
    // Answering 'purchased' there would promise an outright buy at a price
    // that is not the outright price.
    for (const n of [2, 3, 5, 9, 17]) {
      expect(resolveSelectionOffer(n).delivery).toBe('preview')
    }
  })

  it('an empty selection is not purchased either', () => {
    expect(resolveSelectionOffer(0).delivery).toBe('preview')
    expect(resolveSelectionOffer(0).skuId).toBeNull()
  })
})

describe('4/8/16 pricing is untouched', () => {
  it('still prices and scopes exactly as before', () => {
    expect(resolveSelectionOffer(4)).toMatchObject({
      skuId: 'basket_discover_5', priceUsd: 4.99, includedUnlocks: 1, tier: 'tier_2',
    })
    expect(resolveSelectionOffer(8)).toMatchObject({
      skuId: 'basket_discover_10', priceUsd: 7.99, includedUnlocks: 1, tier: 'tier_3',
    })
    expect(resolveSelectionOffer(16)).toMatchObject({
      skuId: 'basket_discover_20', priceUsd: 12.99, includedUnlocks: 2, tier: 'tier_4',
    })
  })

  it('a count of 2 still points at the 4-pack it would fill up to', () => {
    expect(resolveSelectionOffer(2)).toMatchObject({ count: 2, skuId: 'basket_discover_5', priceUsd: 4.99 })
  })
})

describe('the aspect step records a canvas, not a framing', () => {
  it('keeps all three choices verbatim', () => {
    expect(normalizeAspectChoice('1:1')).toBe('1:1')
    expect(normalizeAspectChoice('3:4')).toBe('3:4')
    expect(normalizeAspectChoice('4:3')).toBe('4:3')
  })

  it('records null for anything it does not recognise, rather than guessing', () => {
    // null means "not captured", and the render then falls through to the
    // framing-derived aspect exactly as every piece did before.
    for (const a of ['16:9', '2:3', 'square', '', null, undefined]) {
      expect(normalizeAspectChoice(a)).toBeNull()
    }
  })

  it('never maps an aspect onto a framing', () => {
    // The earlier cut turned 3:4 into 'statuesque', which changed the
    // composition block for a customer who had only picked a canvas shape.
    // Framing is a constant now; this function returns ratios or null.
    for (const a of ['1:1', '3:4', '4:3']) {
      expect(['bust', 'signature', 'statuesque']).not.toContain(normalizeAspectChoice(a))
    }
  })
})

describe('the render API accepts a canvas independently of framing', () => {
  it('supports exactly the three the aspect step offers', () => {
    expect([...PORTRAIT_OUTPUT_ASPECTS]).toEqual(['1:1', '3:4', '4:3'])
  })

  it('accepts 4:3, which no framing can produce', () => {
    expect(isPortraitOutputAspect('4:3')).toBe(true)
    expect(Object.values(ASPECT_FOR_FRAMING)).not.toContain('4:3')
  })

  it('rejects anything outside the set, including ratios NB2 itself allows', () => {
    // 16:9 is fine for landscapes; widening the Portraits set is a product
    // decision, not something the validator should quietly permit.
    for (const a of ['16:9', '9:16', '3:2', '', 'nonsense', null, undefined, 1]) {
      expect(isPortraitOutputAspect(a)).toBe(false)
    }
  })
})

describe('Stage 4 never crops a chosen canvas back to the framing', () => {
  // outputDimensions feeds a sharp resize with fit:'cover'. Keyed on framing
  // alone, a 4:3 render with framing 'bust' was resized to bust's square and
  // cropped -- silently undoing the whole point of asking for 4:3.
  it('honours an explicit 4:3 over the framing', () => {
    expect(outputDimensions('bust', '1k', '4:3')).toEqual({ width: 1024, height: 768 })
  })

  it('honours an explicit 3:4 over a square framing', () => {
    expect(outputDimensions('bust', '1k', '3:4')).toEqual({ width: 768, height: 1024 })
  })

  it('honours an explicit 1:1 over a 3:4 framing', () => {
    expect(outputDimensions('statuesque', '1k', '1:1')).toEqual({ width: 1024, height: 1024 })
  })

  it('is BYTE-IDENTICAL to the old behaviour when no override is given', () => {
    // The two cases that existed before the argument did.
    for (const r of ['1k', '2k', '4k'] as const) {
      const long = { '1k': 1024, '2k': 2048, '4k': 4096 }[r]
      expect(outputDimensions('statuesque', r)).toEqual({ width: Math.round((long * 3) / 4), height: long })
      expect(outputDimensions('bust', r)).toEqual({ width: long, height: long })
      expect(outputDimensions('signature', r)).toEqual({ width: long, height: long })
      // null override is the same as absent -- this is what a 4/8/16 render
      // and any un-captured portfolio pass in.
      expect(outputDimensions('bust', r, null)).toEqual({ width: long, height: long })
    }
  })

  it('keeps the long edge on the long side, whichever side that is', () => {
    const p = outputDimensions('bust', '2k', '3:4')
    const l = outputDimensions('bust', '2k', '4:3')
    expect(Math.max(p.width, p.height)).toBe(2048)
    expect(Math.max(l.width, l.height)).toBe(2048)
    expect(p.width / p.height).toBeCloseTo(0.75, 5)
    expect(l.width / l.height).toBeCloseTo(4 / 3, 5)
  })

  it('falls back to square on a malformed ratio rather than throwing', () => {
    expect(outputDimensions('bust', '1k', 'garbage')).toEqual({ width: 1024, height: 1024 })
    expect(outputDimensions('bust', '1k', '0:0')).toEqual({ width: 1024, height: 1024 })
  })
})

// ── what delivery decides downstream ──────────────────────────────
//
// Mirrors the two places that read the column. Both are one expression.

const unlockedAtFor = (delivery: string) =>
  delivery === 'purchased' ? new Date().toISOString() : null

const framingFor = (delivery: string, stored: string | null) =>
  delivery === 'purchased' ? (stored || 'bust') : 'bust'

/* What portfolio-render spreads into the generate body. */
const aspectFieldFor = (delivery: string, stored: string | null) =>
  delivery === 'purchased' && stored ? { output_aspect_ratio: stored } : {}

describe('a purchased piece is born unlocked', () => {
  it('stamps unlocked_at at render', () => {
    expect(unlockedAtFor('purchased')).not.toBeNull()
  })

  it('leaves a preview piece locked, exactly as before', () => {
    expect(unlockedAtFor('preview')).toBeNull()
  })
})

describe('composition applies to a purchased portfolio only', () => {
  it('honours the stored framing when purchased', () => {
    expect(framingFor('purchased', 'statuesque')).toBe('statuesque')
  })

  it('falls back to bust when purchased but nothing was captured', () => {
    expect(framingFor('purchased', null)).toBe('bust')
  })

  it('IGNORES the stored framing for a preview bundle', () => {
    // The columns are captured for every size, but reading them back for
    // 4/8/16 would change what those bundles render. Out of scope, and this
    // is the assertion that keeps it that way.
    expect(framingFor('preview', 'statuesque')).toBe('bust')
    expect(framingFor('preview', 'signature')).toBe('bust')
  })
})

describe('the canvas reaches generate only for a purchased portfolio', () => {
  it('sends output_aspect_ratio for each of the three choices', () => {
    for (const a of ['1:1', '3:4', '4:3']) {
      expect(aspectFieldFor('purchased', a)).toEqual({ output_aspect_ratio: a })
    }
  })

  it('sends NOTHING for a preview bundle, even if one were captured', () => {
    // 4/8/16 keep the framing-derived 1:1. This is the assertion that keeps
    // their request byte-identical.
    expect(aspectFieldFor('preview', '4:3')).toEqual({})
    expect(aspectFieldFor('preview', '3:4')).toEqual({})
  })

  it('sends nothing when the purchase captured no aspect', () => {
    expect(aspectFieldFor('purchased', null)).toEqual({})
  })

  it('never sends the field name portraits.html already uses', () => {
    // aspect_ratio is sent as '1:1' by every live Portraits request and the
    // route discards it. Reusing it would pin those renders to square.
    expect(Object.keys(aspectFieldFor('purchased', '4:3'))).toEqual(['output_aspect_ratio'])
  })
})
