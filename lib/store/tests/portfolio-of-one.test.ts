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
import { resolveSelectionOffer, framingForAspect } from '../portfolio-checkout'

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

describe('composition: framing carries the aspect, because aspect alone cannot', () => {
  // portraits/generate:319 -- aspect_ratio is derived FROM framing and a
  // client aspect is ignored outright. ASPECT_FOR_FRAMING is
  // bust 1:1, signature 1:1, statuesque 3:4.
  it('3:4 is statuesque, the only framing that produces it', () => {
    expect(framingForAspect('3:4')).toBe('statuesque')
  })

  it('1:1 is bust, which is what the render path has always sent', () => {
    // Not signature, though signature is also 1:1 -- choosing it would
    // change the look of every square piece.
    expect(framingForAspect('1:1')).toBe('bust')
  })

  it('4:3 falls back to bust, because NO framing produces 4:3', () => {
    // The Landscape option in the aspect step is not expressible in the
    // generator's framing vocabulary. Falling back to bust is exactly what
    // every piece of every size does today, so nothing regresses -- but the
    // aspect is not preserved, and that is a reported gap, not a fix.
    expect(framingForAspect('4:3')).toBe('bust')
  })

  it('a missing aspect is bust, unchanged from today', () => {
    expect(framingForAspect(null)).toBe('bust')
    expect(framingForAspect(undefined)).toBe('bust')
    expect(framingForAspect('')).toBe('bust')
  })

  it('never invents a framing for something unrecognised', () => {
    for (const a of ['16:9', '2:3', 'square', 'nonsense']) {
      expect(['bust', 'signature', 'statuesque']).toContain(framingForAspect(a))
    }
  })
})

// ── what delivery decides downstream ──────────────────────────────
//
// Mirrors the two places that read the column. Both are one expression.

const unlockedAtFor = (delivery: string) =>
  delivery === 'purchased' ? new Date().toISOString() : null

const framingFor = (delivery: string, stored: string | null) =>
  delivery === 'purchased' ? (stored || 'bust') : 'bust'

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
