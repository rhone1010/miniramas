// The legacy {size, finish} Print Shop routes (/api/v1/print/source, /quote, /checkout) read the ONE canonical catalog, so all eight families are sold from the same table as the Gift Shop
// and the old four-family exclusion is gone. The routes are the real handlers; Stripe, Prodigi, the database and the owned-artwork reader are stand-ins, nothing is paid or sent.
// Prices: the four Gift families are launched but a product is sold only with an approved price. The rectangles, the mug and the card have none yet, so world() gives them the PROPOSED prices
// from docs/GOVERNANCE/GIFT-FOUR-PRODUCTS-2026-10-18.md for the tests that need a sellable one, and the last test checks the real, unpriced state.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  piece: { width: 1024, height: 1024, art: 'https://signed.test/owned.png' },
  create: vi.fn(), orders: [] as any[], quote: vi.fn(), webhookUrl: 'https://x.test/api/v1/print/webhook',
}))
vi.mock('@/lib/store/auth', () => ({ getUser: async () => ({ id: '10000000-0000-4000-8000-000000000001' }) }))
vi.mock('@/lib/v1/print/owned-source', () => ({
  ownedPrintPreview: async () => ({ ...h.piece, id: 'x', serverId: 'x', series: 'portraits', name: 'x', format: 'square', printTestVerified: true }),
  ownedPrintSource: async () => ({}), requireSandboxPrint: () => {},
}))
vi.mock('@/lib/v1/print/db', () => ({ canFulfil: async () => true, createPrintOrder: async (o: any) => { h.orders.push(o); return { id: 'order-1' } } }))
vi.mock('@/lib/v1/print/stripe-client', () => ({
  getStripe: () => ({
    webhookEndpoints: { list: async () => ({ data: [{ status: 'enabled', url: h.webhookUrl, enabled_events: ['checkout.session.completed'] }] }) },
    checkout: { sessions: { create: async (p: any) => { h.create(p); return { id: 'cs_test_1', url: 'https://stripe.test/pay', client_secret: 'sec' } } } },
  }),
}))
vi.mock('@/lib/v1/print/prodigi-client', () => ({ getQuote: async (q: any) => { h.quote(q); return { quotes: [{ costSummary: { shipping: { amount: '6.85' } }, shipments: [{ carrier: { service: 'Budget' } }], shipmentMethod: 'Budget' }] } } }))

const PROPOSED: Record<string, number> = { 'GLOBAL-CFPM-8X12': 9900, 'GLOBAL-CFPM-12X18': 12900, 'GLOBAL-CFPM-16X24': 14900, 'GLOBAL-CFPM-20X30': 18900, 'GLOBAL-FRA-CAN-12X18': 11900, 'GLOBAL-FRA-CAN-16X24': 15900, 'GLOBAL-FRA-CAN-20X30': 21900, 'GLOBAL-MUG-W': 1900, 'GLOBAL-GRE-MOH-7X5-BLA': 700 }
async function world(priced: boolean) {
  vi.resetModules(); process.env.VERCEL_ENV = 'preview'
  const skuMap = await import('./sku-map')
  if (priced) for (const f of ['matted', 'framed_canvas', 'mug', 'card']) for (const e of Object.values(skuMap.SKU_MAP[f as 'matted']) as any[]) if (e.retailApproved === false) { delete e.retailApproved; e.retailCents = PROPOSED[e.sku] }
  const [source, quote, checkout] = await Promise.all([import('../../../app/api/v1/print/source/route'), import('../../../app/api/v1/print/quote/route'), import('../../../app/api/v1/print/checkout/route')])
  return { source, quote, checkout }
}
const post = (route: { POST: (r: Request) => Promise<Response> }, body: unknown) => route.POST(new Request('https://x.test/api/v1/print/checkout', { method: 'POST', body: JSON.stringify(body) }))
const CHECKOUT = (items: any[]) => ({ items, email: 'ada@example.test', shippingAddress: { name: 'Ada', line1: '1 Main St', city: 'Sonoma', postcode: '95476', countryCode: 'US' }, successUrl: 'https://x.test/ok', cancelUrl: 'https://x.test/no', embedded: true, testPrint: true })

beforeEach(() => { h.create.mockClear(); h.quote.mockClear(); h.orders.length = 0; h.piece = { width: 1024, height: 1024, art: 'https://signed.test/owned.png' } })

describe('/api/v1/print/source offers every sellable size of every family for the owned artwork', () => {
  it('a square piece: six families (the mug and the card have no approved price yet), the squares of matted frame and framed canvas, prices from the catalog', async () => {
    const W = await world(false), res = await W.source.GET(new Request('https://x.test/api/v1/print/source?piece=00000000-0000-4000-8000-000000000000'))
    const body = await res.json(); expect(res.status).toBe(200)
    expect(body.catalog.map((f: any) => f.id)).toEqual(['fine_art', 'premium', 'canvas', 'framed', 'matted', 'framed_canvas'])
    const matted = body.catalog.find((f: any) => f.id === 'matted'); expect(matted.sizes.map((s: any) => [s.size, s.cents, s.compatibility])).toEqual([['8x8', 9400, 'recommended'], ['12x12', 10900, 'recommended'], ['16x16', 12900, 'recommended'], ['20x20', 14900, 'recommended']])
  })
  it('with approved prices a square piece also offers the mug (the panel is square) and not the card; a 2:3 piece offers the card and the rectangles and not the mug', async () => {
    const W = await world(true)
    let body = await (await W.source.GET(new Request('https://x.test/api/v1/print/source?piece=00000000-0000-4000-8000-000000000000'))).json()
    expect(body.catalog.map((f: any) => f.id)).toEqual(['fine_art', 'premium', 'canvas', 'framed', 'matted', 'framed_canvas', 'mug'])
    expect(body.catalog.find((f: any) => f.id === 'mug').sizes).toEqual([{ size: '11oz', finish: 'mug', cents: 1900, label: '11 oz White Mug', compatibility: 'recommended' }])
    h.piece = { width: 1024, height: 1536, art: 'https://signed.test/owned.png' }
    body = await (await W.source.GET(new Request('https://x.test/api/v1/print/source?piece=00000000-0000-4000-8000-000000000000'))).json()
    expect(body.catalog.map((f: any) => f.id)).toEqual(['fine_art', 'premium', 'canvas', 'framed', 'matted', 'framed_canvas', 'card'])
    expect(body.catalog.find((f: any) => f.id === 'card').sizes[0]).toMatchObject({ size: '7x5', cents: 700, compatibility: 'extension' })
    expect(body.catalog.find((f: any) => f.id === 'framed_canvas').sizes.map((s: any) => s.size)).toEqual(['8x8', '12x12', '16x16', '20x20', '12x18', '16x24', '20x30'])      // 8x12 stays held (orientation_unverified)
  })
})

describe('/api/v1/print/quote and /checkout sell all eight families', () => {
  it('quotes every family from the catalog price and SKU', async () => {
    const W = await world(true)
    const res = await post(W.quote, { items: [{ size: '8x8', finish: 'matted', copies: 1 }, { size: '11oz', finish: 'mug', copies: 2 }, { size: '7x5', finish: 'card', copies: 1 }, { size: '12x18', finish: 'framed_canvas', copies: 1 }], destination: { countryCode: 'US' } })
    expect(res.status).toBe(200); expect(h.quote.mock.calls[0][0].items.map((i: any) => i.sku)).toEqual(['GLOBAL-CFPM-8X8', 'GLOBAL-MUG-W', 'GLOBAL-GRE-MOH-7X5-BLA', 'GLOBAL-FRA-CAN-12X18'])
    expect(h.quote.mock.calls[0][0].items[3].attributes).toEqual({ color: 'black', wrap: 'MirrorWrap' })
  })
  it('a square owned artwork buys a mug and a framed canvas in one cart: owned artwork as the source, Stripe amounts and the order from the catalog', async () => {
    const W = await world(true)
    const res = await post(W.checkout, CHECKOUT([{ renderId: 'r1', renderUrl: 'ignored', size: '11oz', finish: 'mug', copies: 2 }, { renderId: 'r1', renderUrl: 'ignored', size: '8x8', finish: 'framed_canvas', copies: 1 }]))
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200)
    const stripe = h.create.mock.calls[0][0]
    expect(stripe.line_items.slice(0, 2).map((l: any) => [l.price_data.unit_amount, l.quantity])).toEqual([[1900, 2], [7900, 1]])
    expect(h.orders[0].items.map((i: any) => [i.sku, i.finish, i.size, i.renderUrl, i.retailCents])).toEqual([['GLOBAL-MUG-W', 'mug', '11oz', 'https://signed.test/owned.png', 1900], ['GLOBAL-FRA-CAN-8X8', 'framed_canvas', '8x8', 'https://signed.test/owned.png', 7900]])      // the renderUrl is the OWNED artwork, never the client's
    expect(h.orders[0].retailSubtotalCents).toBe(1900 * 2 + 7900)
  })
  it('refuses what the artwork cannot become, by the same rules the file is made with, and never crops: a square piece cannot be a card; a tall piece cannot be a mug', async () => {
    const W = await world(true)
    let res = await post(W.checkout, CHECKOUT([{ renderId: 'r1', renderUrl: 'x', size: '7x5', finish: 'card', copies: 1 }])); expect(res.status).toBe(409); expect(await res.json()).toEqual({ error: 'incompatible_print_aspect' })
    h.piece = { width: 1024, height: 1536, art: 'https://signed.test/owned.png' }
    res = await post(W.checkout, CHECKOUT([{ renderId: 'r1', renderUrl: 'x', size: '11oz', finish: 'mug', copies: 1 }])); expect(res.status).toBe(409); expect(await res.json()).toEqual({ error: 'incompatible_print_aspect' })
    res = await post(W.checkout, CHECKOUT([{ renderId: 'r1', renderUrl: 'x', size: '7x5', finish: 'card', copies: 1 }])); expect(res.status, JSON.stringify(await res.clone().json())).toBe(200)       // 2:3 into 5:7 is a bounded extension
    expect(h.create).toHaveBeenCalledTimes(1)
  })
  it('with the real, unapproved prices the mug, the card and the unpriced rectangles are refused as unavailable; nothing reaches Stripe', async () => {
    const W = await world(false)
    for (const [size, finish] of [['11oz', 'mug'], ['7x5', 'card'], ['12x18', 'matted'], ['12x18', 'framed_canvas'], ['8x12', 'framed_canvas']]) {
      const res = await post(W.checkout, CHECKOUT([{ renderId: 'r1', renderUrl: 'x', size, finish, copies: 1 }])); expect(res.status, finish + size).toBe(409); expect(await res.json()).toEqual({ error: 'print_product_unavailable' })
    }
    expect((await post(W.quote, { items: [{ size: '11oz', finish: 'mug', copies: 1 }], destination: { countryCode: 'US' } })).status).toBe(400)
    expect(h.create).not.toHaveBeenCalled()
  })
})
