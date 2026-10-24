import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { allProducts, catalogResponse, catalogVersion, fitFor, getProduct, getProductBySku, FIT_RULES } from './catalog'
import { SKU_MAP, LAUNCH_FAMILIES, getLaunchSku, allSkus, type PrintFinish, type PrintSize } from './sku-map'
import { printPlan } from './geometry'
import { GET } from '../../../app/api/v1/print/catalog/route'

const verified = JSON.parse(fs.readFileSync('docs/GOVERNANCE/prodigi-catalog-verified-2026-10-15.json', 'utf8')).products as Array<any>
const bySku = new Map(verified.map(v => [v.sku, v]))

describe('canonical catalog covers the verified inventory', () => {
  it('has exactly the 55 verified SKUs, no more, no fewer, each once', () => {
    const skus = allProducts().map(p => p.sku)
    expect(new Set(skus).size).toBe(skus.length)
    expect([...skus].sort()).toEqual([...bySku.keys()].sort())
    expect(skus.length).toBe(55)
  })
  it('every product matches Prodigi sandbox: its lab-file pixels equal the verified print area', () => {
    for (const p of allProducts()) {
      const v = bySku.get(p.sku); expect(v, p.sku).toBeTruthy()
      expect(p.requirements.finalPx, p.sku).toEqual({ w: v.printAreaPx.default.w, h: v.printAreaPx.default.h })
      expect(v.shipsToUS, p.sku).toBe(true)
    }
  })
  it('framed-canvas geometry is corrected: 8x12 is landscape-defined, the other rectangles are portrait, picture = area minus 54 px of wrap', () => {
    const g = (s: string) => getProduct('framed_canvas:' + s)!.requirements
    expect(g('8x12').skuOrientation).toBe('landscape'); expect(g('8x12').finalPx).toEqual({ w: 3654, h: 2454 }); expect(g('8x12').picturePx).toEqual({ w: 3600, h: 2400 })
    for (const s of ['12x18', '16x24', '20x30']) expect(g(s).skuOrientation).toBe('portrait')
    expect(g('8x12').wrapPx).toEqual({ left: 27, right: 27, top: 27, bottom: 27 })
    expect(g('8x12').rotatedFile).toBeNull()
  })
  it('mounted-frame pictures are the mount opening, not the frame, and canvas wrap is 27 px a side', () => {
    expect(getProduct('matted:12x12')!.requirements.picturePx).toEqual({ w: 2700, h: 2700 })
    expect(getProduct('canvas:12x18')!.requirements.wrapPx).toEqual({ left: 27, right: 27, top: 27, bottom: 27 })
    expect(getProduct('fine_art:12x18')!.requirements.wrapPx).toEqual({ left: 0, right: 0, top: 0, bottom: 0 })
  })
  it('never invents a safe area or claims a rotated file is verified', () => {
    for (const p of allProducts()) { expect(p.requirements.safeArea).toBeNull(); if (p.requirements.rotatedFile) expect(p.requirements.rotatedFile.verifiedWithProdigi).toBe(false) }
  })
})

describe('existing Print Shop behaviour and pricing are preserved', () => {
  it('every launch product maps to the same SKU, attributes and price as getLaunchSku', () => {
    const launch = allProducts().filter(p => p.status === 'launch' && (LAUNCH_FAMILIES as string[]).includes(p.family))
    expect(launch.length).toBe(LAUNCH_FAMILIES.reduce((n, f) => n + Object.keys(SKU_MAP[f]).length, 0))
    for (const p of launch) {
      const e = getLaunchSku(p.size as PrintSize, p.family as PrintFinish)
      expect(p.sku).toBe(e.sku); expect(p.retailCents).toBe(e.retailCents); expect(p.attributes).toEqual(e.attributes ?? {})
      expect(p.requirements.finalPx).toEqual(e.requiredPx); expect(p.artworkProfile).toBe('flat_print')
    }
  })
  it('the launch set is exactly fine art, premium, canvas and classic frame, and every sku-map entry appears with its price', () => {
    expect(new Set(allProducts().filter(p => p.status === 'launch' && (LAUNCH_FAMILIES as string[]).includes(p.family)).map(p => p.family))).toEqual(new Set(['fine_art', 'premium', 'canvas', 'framed']))
    for (const e of allSkus()) expect(getProductBySku(e.sku)?.retailCents).toBe(e.retailApproved === false ? null : e.retailCents)
  })
  it('picture and final sizes agree with printPlan on every launch product', () => {
    for (const p of allProducts().filter(x => x.status === 'launch' && (LAUNCH_FAMILIES as string[]).includes(x.family))) {
      const w = p.requirements.picturePx.w, h = p.requirements.picturePx.h
      const plan = printPlan(w, h, getLaunchSku(p.size as PrintSize, p.family as PrintFinish))
      expect(plan.front, p.sku).toEqual(p.requirements.picturePx); expect(plan.final, p.sku).toEqual(p.requirements.finalPx)
    }
  })
})

describe('nothing unapproved is enabled', () => {
  it('framed-canvas and matted rectangles stay disabled, with no price, pending retail approval', () => {
    const rects = allProducts().filter(x => (x.family === 'framed_canvas' || x.family === 'matted') && ['8x12', '12x18', '16x24', '20x30'].includes(x.size))
    expect(rects.length).toBe(8)
    for (const p of rects) { expect(p.status).toBe('disabled'); expect(p.retailCents).toBeNull(); expect(p.disabledReason).toBe(p.productId === 'framed_canvas:8x12' ? 'orientation_unverified' : 'retail_price_pending') }
  })
  it('the mug and the 7x5 Mohawk card are built, visible, priced at nothing until approved, and disabled; each has its own artwork profile', () => {
    for (const [id, profile] of [['mug:11oz', 'mug_wrap'], ['card:7x5', 'card_spread']] as const) {
      const p = getProduct(id)!; expect(p.status).toBe('disabled'); expect(p.retailCents).toBeNull(); expect(p.disabledReason).toBe('retail_price_pending'); expect(p.artworkProfile).toBe(profile)
    }
    expect(getProduct('mug:11oz')!.requirements.finalPx).toEqual({ w: 2670, h: 1110 }); expect(getProduct('mug:11oz')!.requirements.picturePx).toEqual({ w: 910, h: 910 })
    expect(getProduct('card:7x5')!.requirements.finalPx).toEqual({ w: 6118, h: 2161 }); expect(getProduct('card:7x5')!.requirements.picturePx).toEqual({ w: 1500, h: 2100 })
  })
  it('every disabled product has a reason, every launch product has none, and nothing disabled is ever selectable', () => {
    for (const p of catalogResponse({ width: 2048, height: 2048 }).products) {
      if (p.status === 'launch') expect(p.disabledReason).toBeNull()
      else { expect(p.disabledReason).toBeTruthy(); expect(p.selectable).toBe(false) }
    }
  })
  it('no wholesale or supplier cost appears anywhere in the response', () => {
    expect(JSON.stringify(catalogResponse())).not.toMatch(/wholesale|shipping|cost|margin/i)
  })
})

describe('artwork fit', () => {
  it('a square artwork fits squares exactly and marks 2:3 prints unavailable under the current 20% rule', () => {
    expect(fitFor({ width: 2048, height: 2048 }, getProduct('fine_art:12x12')!).fit).toBe('exact')
    const r = fitFor({ width: 2048, height: 2048 }, getProduct('fine_art:12x18')!)
    expect(r.fit).toBe('unavailable'); expect(r.extensionFraction).toBeCloseTo(0.5, 3)
    expect(catalogResponse({ width: 2048, height: 2048 }).products.find(p => p.productId === 'fine_art:12x18')!.selectable).toBe(false)
  })
  it('a landscape artwork fits the same rectangle turned, with no change in fit', () => {
    expect(fitFor({ width: 3000, height: 2000 }, getProduct('fine_art:12x18')!).fit).toBe('exact')
    expect(fitFor({ width: 2000, height: 3000 }, getProduct('fine_art:12x18')!).fit).toBe('exact')
  })
  it('classifies resample within 2% and extend within 20%', () => {
    expect(fitFor({ width: 1000, height: 1490 }, getProduct('fine_art:12x18')!).fit).toBe('resample')
    expect(fitFor({ width: 1000, height: 1250 }, getProduct('fine_art:12x18')!).fit).toBe('extend')
    expect(FIT_RULES).toEqual({ resampleMaxFraction: 0.02, extendMaxFraction: 0.20 })
  })
})

describe('versioning and the endpoint', () => {
  it('the catalog version is stable and changes when anything changes', () => {
    expect(catalogVersion()).toBe(catalogVersion()); expect(catalogVersion()).toMatch(/^[0-9a-f]{12}$/)
    const p = allProducts(); p[0].retailCents = (p[0].retailCents ?? 0) + 1; expect(catalogVersion(p)).not.toBe(catalogVersion())
  })
  it('allProducts returns copies: callers cannot change the table', () => {
    const a = allProducts(); a[0].retailCents = 1; a[0].status = 'launch'; expect(allProducts()[0].retailCents).not.toBe(1)
  })
  it('GET returns the contract, read-only, with no artwork fit unless dimensions are given', async () => {
    const res = await GET(new Request('http://x/api/v1/print/catalog')); expect(res.status).toBe(200)
    const b = await res.json(); expect(b.contractVersion).toBe(1); expect(b.catalogVersion).toMatch(/^[0-9a-f]{12}$/); expect(b.artwork).toBeNull()
    expect(b.products.length).toBe(55); expect(b.products.every((p: any) => p.artworkFit === undefined)).toBe(true)
  })
  it('GET with artwork dimensions adds the fit; invalid dimensions are refused', async () => {
    const b = await (await GET(new Request('http://x/api/v1/print/catalog?width=1000&height=1500'))).json()
    expect(b.artwork).toEqual({ width: 1000, height: 1500 }); expect(b.products.find((p: any) => p.productId === 'fine_art:12x18').artworkFit.fit).toBe('exact')
    expect(b.products.find((p: any) => p.productId === 'fine_art:12x12').selectable).toBe(false)
    for (const bad of ['?width=0&height=10', '?width=abc&height=10', '?width=100']) expect((await GET(new Request('http://x/api/v1/print/catalog' + bad))).status).toBe(400)
  })
})
