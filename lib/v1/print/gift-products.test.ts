// The four Gift Shop products against the Prodigi sandbox verification record (docs/GOVERNANCE/prodigi-four-products-verified-2026-10-18.json): every SKU, the attributes
// Prodigi requires, the lab-file pixels per variant, and what the fulfilment path sends for each. The record is committed, so these run offline.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import { memoryJobStore, memoryStorage } from './upscale/store'
import { allProducts, catalogResponse, getProductBySku } from './catalog'
import { GIFT_ENABLED_FAMILIES, GIFT_MOCKUP_READY, GIFT_PRODUCT_HOLDS } from './gift-enablement'
import { GIFT_PRODUCT_FAMILIES, LAUNCH_FAMILIES, SKU_MAP, getSku, getLaunchSku, type PrintFinish, type PrintSize } from './sku-map'
import { templateFor } from '../gift/mockup'

const s = vi.hoisted(() => ({ place: vi.fn(), rt: null as any, gate: { flag: true, active: true, reason: null as any, problems: [] as string[] } }))
vi.mock('./prodigi-client', () => ({ createOrder: s.place }))
vi.mock('./upscale/runtime', () => ({ assetRuntime: () => s.rt }))
vi.mock('./upscale/pipeline', async () => ({ ...(await vi.importActual<typeof import('./upscale/pipeline')>('./upscale/pipeline')), pipelineState: async () => s.gate }))
import { prepareAndPlacePrint } from './fulfillment'
import { createHash } from 'node:crypto'

const record = JSON.parse(fs.readFileSync('docs/GOVERNANCE/prodigi-four-products-verified-2026-10-18.json', 'utf8'))
const SKUS = Object.keys(record.products) as string[]
const REQUIRED: Record<string, string[]> = { matted: ['color'], framed_canvas: ['color', 'wrap'], mug: [], card: [] }   // from the negative controls below

describe('the verification record itself', () => {
  it('covers 18 SKUs (8 matted, 8 framed canvas, the mug, the card), all shipping to the US, every quote with the chosen attributes accepted', () => {
    expect(SKUS.length).toBe(18)
    for (const sku of SKUS) { const p = record.products[sku]; expect(p.httpProduct, sku).toBe(200); expect(p.shipsToUS, sku).toBe(true); expect(p.quoteWithChosenAttributes.http, sku).toBe(200); expect(['CreatedWithIssues', 'Created'], sku).toContain(p.quoteWithChosenAttributes.outcome) }
  })
  it('records which attributes Prodigi REQUIRES: wrap and color for the framed canvas, color for the matted frame, nothing for the mug and the card', () => {
    const nc = record.negativeControls
    expect(nc['framed_canvas: no attributes'].http).toBe(400); expect(nc['framed_canvas: color only (no wrap)'].http).toBe(400)
    expect(nc['matted: no attributes'].http).toBe(400)
    expect(nc['mug: no attributes'].http).toBe(200); expect(nc['card: no attributes'].http).toBe(200)
  })
  it('MirrorWrap is a value Prodigi accepts for the framed canvas, in every frame colour, and an invented colour or mount colour is refused', () => {
    const nc = record.negativeControls
    for (const w of ['MirrorWrap', 'Black', 'ImageWrap', 'White']) expect(nc['framed_canvas: wrap ' + w].http).toBe(200)
    for (const c of ['black', 'brown', 'gold', 'natural', 'silver', 'white']) expect(nc['framed_canvas: color ' + c].http).toBe(200)
    expect(nc['framed_canvas: color purple'].http).toBe(400); expect(nc['matted: color black + mountColor Black'].outcome).toBe('NotAvailable')
    expect(nc['matted: color black + mountColor Snow white'].http).toBe(200)
  })
})

describe('the catalog agrees with Prodigi for every SKU', () => {
  it('each SKU is in the catalog with the chosen attributes, every one a value Prodigi lists, and exactly the REQUIRED attributes (nothing silently chosen)', () => {
    for (const sku of SKUS) {
      const p = getProductBySku(sku)!, rec = record.products[sku]; expect(p, sku).toBeTruthy()
      expect(p.attributes, sku).toEqual(rec.quoteWithChosenAttributes.attributes)
      expect(Object.keys(p.attributes).sort(), sku).toEqual(rec.family === 'mug' ? ['color', 'size'] : [...REQUIRED[rec.family]].sort())
      for (const [k, v] of Object.entries(p.attributes)) expect(rec.attributeOptions[k], `${sku} ${k}`).toContain(v)
    }
  })
  it('the lab-file pixels equal what Prodigi returns for the variant actually ordered (MirrorWrap for the framed canvas)', () => {
    for (const sku of SKUS) { const p = getProductBySku(sku)!, rec = record.products[sku]; expect(p.requirements.finalPx, sku).toEqual(rec.printAreaForChosenAttributes) }
  })
  it('framed canvas: the file is the picture plus 27 px a side for MirrorWrap, Black and White, and ImageWrap is a different, larger file the catalog does not use', () => {
    for (const sku of SKUS.filter(k => k.includes('FRA-CAN'))) {
      const rec = record.products[sku], p = getProductBySku(sku)!, a = rec.printAreaByWrap
      expect(a.MirrorWrap).toEqual(a.Black); expect(a.MirrorWrap).toEqual(a.White); expect(a.ImageWrap.w).toBeGreaterThan(a.MirrorWrap.w)
      expect(p.requirements.picturePx).toEqual({ w: a.MirrorWrap.w - 54, h: a.MirrorWrap.h - 54 }); expect(p.requirements.wrapPx).toEqual({ left: 27, right: 27, top: 27, bottom: 27 })
    }
  })
  it('matted frame: the file is the picture inside the mount, with the sizes Prodigi gives; the rectangles are portrait', () => {
    const w = (sku: string) => getProductBySku(sku)!.requirements
    expect(w('GLOBAL-CFPM-8X12').finalPx).toEqual({ w: 1800, h: 3000 }); expect(w('GLOBAL-CFPM-12X18').finalPx).toEqual({ w: 2418, h: 4218 })
    expect(w('GLOBAL-CFPM-16X24').finalPx).toEqual({ w: 3618, h: 6018 }); expect(w('GLOBAL-CFPM-20X30').finalPx).toEqual({ w: 4800, h: 7800 })
    for (const s of ['8X12', '12X18', '16X24', '20X30']) { expect(w('GLOBAL-CFPM-' + s).skuOrientation).toBe('portrait'); expect(w('GLOBAL-CFPM-' + s).picturePx).toEqual(w('GLOBAL-CFPM-' + s).finalPx) }
  })
  it('framed canvas 8x12 is released: presented as the landscape 12 x 8 its Prodigi print area describes, and no product has a hold', () => {
    expect(Object.keys(GIFT_PRODUCT_HOLDS)).toEqual([]); expect(getProductBySku('GLOBAL-FRA-CAN-8X12')).toMatchObject({ status: 'launch', disabledReason: null, label: '12 × 8″ landscape' })
    expect(record.products['GLOBAL-FRA-CAN-8X12'].productDimensions).toMatchObject({ width: 8, height: 12 }); expect(record.products['GLOBAL-FRA-CAN-8X12'].printAreaForChosenAttributes).toEqual({ w: 3654, h: 2454 })
  })
})

describe('launch gates', () => {
  it('what is sold: every Matted Frame, every Framed Canvas, the Mug and the Card, all priced', () => {
    expect(GIFT_ENABLED_FAMILIES).toEqual(['matted', 'framed_canvas', 'mug', 'card']); expect(GIFT_MOCKUP_READY).toEqual([])
    for (const f of GIFT_PRODUCT_FAMILIES) for (const e of Object.values(SKU_MAP[f] ?? {}) as any[]) if (e.retailApproved === false) expect(e.retailCents).toBe(0)
    const gift = allProducts().filter(p => ['matted', 'framed_canvas', 'mug', 'card'].includes(p.family))
    const sold = gift.filter(p => p.status === 'launch').map(p => p.productId).sort()
    expect(sold).toEqual([...['8x8', '12x12', '16x16', '20x20', '8x12', '12x18', '16x24', '20x30'].map(s => 'matted:' + s), ...['8x8', '12x12', '16x16', '20x20', '8x12', '12x18', '16x24', '20x30'].map(s => 'framed_canvas:' + s), 'mug:11oz', 'card:7x5'].sort())
    expect(gift.filter(p => p.status === 'launch').every(p => p.retailCents! > 0)).toBe(true)
    expect(gift.filter(p => p.status !== 'launch').every(p => p.productId.startsWith('card:'))).toBe(true)          // only the other card variants
  })
  it('a family can only be marked mockup-ready if the renderer can actually pick its template', () => {
    for (const f of GIFT_MOCKUP_READY) for (const p of allProducts().filter(x => x.family === f)) expect(templateFor(p), p.productId).not.toBeNull()
  })
  it('the four launch families and the Print Shop are unchanged: the Print Shop still refuses a gift product', () => {
    for (const f of ['matted', 'framed_canvas', 'mug', 'card'] as PrintFinish[]) expect(() => getLaunchSku((f === 'mug' ? '11oz' : f === 'card' ? '7x5' : '8x8') as PrintSize, f)).toThrow('print_product_unavailable')
    expect(allProducts().filter(p => p.status === 'launch' && (LAUNCH_FAMILIES as string[]).includes(p.family)).length).toBe(32)
    for (const c of (catalogResponse(null) as any).products.filter((p: any) => ['matted', 'framed_canvas'].includes(p.family))) expect(c.selectable, c.productId).toBe(false)          // the Print Shop never offers a Gift family, even a launched one
  })
})

describe('what the fulfilment path sends to Prodigi for each of the 18 SKUs (the Prodigi call is a stub)', () => {
  const FILE = Buffer.from('print-file-bytes'), sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
  beforeEach(() => { s.place.mockReset().mockResolvedValue({ order: { id: 'sandbox-reference' } }); s.gate = { flag: true, active: true, reason: null, problems: [] } })
  for (const sku of SKUS) it(sku, async () => {
    const p = getProductBySku(sku)!
    const order: any = { id: 'order-1', stripe_session_id: 'cs_x', owner_key: 'o', prodigi_merchant_ref: 'ref', customer_email: 'c@example.test', shipping_method: 'Budget', shipping_address: { name: 'C', line1: 'S', city: 'T', postcode: '12345', countryCode: 'US' }, items: [{ renderId: 'gift:s:a', size: p.size, finish: p.family, copies: 1, sku: p.sku }] }
    const store = memoryJobStore(), storage = memoryStorage(); s.rt = { store, storage }
    const job = await store.enqueue({ order_id: 'order-1', item_index: 0, render_id: 'gift:s:a', sku: p.sku, size: p.size, finish: p.family, source_kind: 'owned' })
    await storage.put(`${job.id}/final.jpg`, FILE, 'image/jpeg'); Object.assign(store.jobs.get(job.id)!, { status: 'approved', final_path: `${job.id}/final.jpg`, final_sha256: sha(FILE) })
    await prepareAndPlacePrint(order, true)
    const sent = s.place.mock.calls[0][0].items[0]
    expect(sent).toMatchObject({ sku: p.sku, copies: 1, attributes: record.products[sku].quoteWithChosenAttributes.attributes, sizing: 'fitPrintArea' }); expect(sent.assets).toEqual([{ printArea: 'default', url: expect.any(String) }])
    expect(getSku(p.size as PrintSize, p.family as PrintFinish).requiredPx).toEqual(record.products[sku].printAreaForChosenAttributes)
  })
  it('an order for a sold SKU is never placed as a different product', async () => {
    const p = getProductBySku('GLOBAL-MUG-W')!
    const order: any = { id: 'order-1', stripe_session_id: 'cs_x', owner_key: 'o', customer_email: 'c@example.test', shipping_method: 'Budget', shipping_address: { name: 'C', line1: 'S', city: 'T', postcode: '12345', countryCode: 'US' }, items: [{ renderId: 'g', size: p.size, finish: p.family, copies: 1, sku: 'GLOBAL-FAP-8X8' }] }
    const store = memoryJobStore(), storage = memoryStorage(); s.rt = { store, storage }
    const job = await store.enqueue({ order_id: 'order-1', item_index: 0, render_id: 'g', sku: p.sku, size: p.size, finish: p.family, source_kind: 'owned' })
    await storage.put(`${job.id}/final.jpg`, FILE, 'image/jpeg'); Object.assign(store.jobs.get(job.id)!, { status: 'approved', final_path: `${job.id}/final.jpg`, final_sha256: sha(FILE) })
    await expect(prepareAndPlacePrint(order, true)).rejects.toThrow('item_sku_changed'); expect(s.place).not.toHaveBeenCalled()
  })
})
