// scripts/gift-generation-demo.ts
//
// ONE real NB2.1 generation per product shape through the real handlers, the real series route (in process) and the in-memory store, with simulated payment and no manufacturing:
// Photo -> Effect -> Product -> Generate -> Review -> Accept -> Cart -> Checkout -> Final Approval. It writes nothing to Supabase (the memory store stands in until migration 059 is applied)
// and never submits to Prodigi. Spends two model calls (Portraits 2:3 and 1:1). Output files go to the directory given.
//
//   npx tsx --env-file=<env file> scripts/gift-generation-demo.ts <photo.jpg> <outDir>

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createHash, randomUUID } from 'node:crypto'
import { memoryGiftStore } from '../lib/v1/gift/store'
import { generateMasterInProcess, watermarkPreview } from '../lib/v1/gift/real'
import { liveEffectIds } from '../lib/v1/gift/effects'
import { createSession, setLines, getSessionView, type GiftDeps } from '../lib/v1/gift/service'
import { chooseEffectH, startGenerationH, acceptGenerationH, getSessionH, setLinesH, finalizeOrderH, checkoutH } from '../lib/v1/gift/handlers'
import { confirmGiftOrder, DISCLOSURE, type GiftOrderDeps, type PrintOrdersPort } from '../lib/v1/gift/orders'

const U = '10000000-0000-4000-8000-0000000000d1'
const req = (b: unknown) => new Request('https://demo.test/api', { method: 'POST', body: JSON.stringify(b) })
const j = async (r: Response) => ({ status: r.status, body: await r.json() })

async function main() {
  const [photoPath, outDir] = process.argv.slice(2); if (!photoPath || !outDir) throw new Error('usage: <photo> <outDir>')
  fs.mkdirSync(outDir, { recursive: true })
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const gift: GiftDeps = {
    store, generate: generateMasterInProcess, watermark: watermarkPreview, compose: undefined as any,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { for (const p of ps) files.delete(p) }, signedUrl: async p => 'memory://' + p },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null, subjectGender: 'unknown' }), kick: async () => ({}),
  } as GiftDeps
  process.env.GIFT_NEW_SESSION_FLOW = 'generations'
  const photo = (await sharp(fs.readFileSync(photoPath)).rotate().jpeg().toBuffer()).toString('base64')
  const v = await createSession(gift, { userId: U, imageB64: photo }); const sid = v.sessionId
  console.log('1 session', { flow: v.flow, series: v.source.series, next: v.generations?.allowance.next })
  const effect = liveEffectIds('portraits')[0]
  console.log('2 effect', (await j(await chooseEffectH(req({ effectId: effect }), { id: U }, gift, sid))).body.generations.effectId)
  const made: Record<string, any> = {}
  for (const [i, productId] of ['fine_art:12x18', 'canvas:12x12'].entries()) {
    const t0 = Date.now()
    const r = await j(await startGenerationH(req({ productId, idempotencyKey: `demo-key-${i + 1}-${Date.now()}` }), { id: U }, gift, sid))
    const g = r.body.generation
    console.log('3 generate', productId, { http: r.status, status: r.body.status, seconds: Math.round((Date.now() - t0) / 1000), w: g?.width, h: g?.height, ratio: g && (g.width / g.height).toFixed(5), conform: g?.conform, quality: g?.quality, sha256: g?.sha256?.slice(0, 16) })
    if (g?.status !== 'ready') { console.log('   not delivered:', JSON.stringify(r.body).slice(0, 300)); continue }
    const clean = files.get(`gift/${sid}/masters/${g.generationId}.png`)!
    console.log('   stored file hash matches:', createHash('sha256').update(clean).digest('hex') === g.sha256)
    fs.writeFileSync(path.join(outDir, `${productId.replace(':', '_')}-preview.jpg`), files.get(`gift/${sid}/previews/${g.generationId}.jpg`)!)
    made[productId] = g
    console.log('4 accept', (await j(await acceptGenerationH({ id: U }, gift, sid, g.generationId))).body.generation.accepted)
    const dup = await j(await startGenerationH(req({ productId, idempotencyKey: `demo-key-${i + 1}-other` }), { id: U }, gift, sid))
    console.log('   duplicate request reuses it:', dup.body.reused, dup.body.generation.generationId === g.generationId)
  }
  const ids = Object.keys(made); if (ids.length < 2) throw new Error('not all generations delivered')
  const lines = ids.map((p, i) => ({ lineId: 'ln' + i, productId: p, copies: 1, generationId: made[p].generationId }))
  const cart = await j(await setLinesH(req({ lines }), { id: U }, gift, sid))
  console.log('5 cart', cart.status, cart.body.lines?.map((l: any) => l.generationId?.slice(0, 8)))
  // simulated payment: the unpaid order the real checkout creates, then the Stripe "paid" confirmation
  const sessions = new Map<string, any>(); let n = 0
  const stripe: any = { checkout: { sessions: {
    create: async (p: any) => { const id = 'cs_demo_session' + String(++n).padStart(4, '0'); const s = { id, status: 'open', client_secret: 'secret', payment_status: 'unpaid', mode: 'payment', currency: 'usd', metadata: p.metadata, params: p, amount_total: p.line_items.reduce((t: number, l: any) => t + l.price_data.unit_amount * l.quantity, 0), payment_intent: null }; sessions.set(id, s); return s },
    retrieve: async (id: string) => sessions.get(id), expire: async () => {}, listLineItems: async (id: string) => ({ has_more: false, data: sessions.get(id).params.line_items.map((l: any) => ({ amount_total: l.price_data.unit_amount * l.quantity })) }) } } }
  const printOrders: PrintOrdersPort = {
    async create(i) { const id = randomUUID(); store.orders.set(id, { id, status: 'created', paid_at: null, stripe_session_id: i.stripeSessionId, stripe_payment_intent: null, retail_total_cents: i.retailTotalCents, retail_shipping_cents: i.retailShippingCents, items: i.items as any, prodigi_order_id: null, placed_at: null, customer_email: i.customerEmail } as any); return { id } },
    async updateUnpaid() { return true } }
  const orderDeps: GiftOrderDeps & { gift: GiftDeps } = { store, stripe, printOrders, quote: async () => ({ outcome: 'Ok', quotes: [{ costSummary: { shipping: { amount: '6.85', currency: 'USD' } } }] }) as any, canFulfil: async () => true, publishableKey: 'pk_demo', gift }
  const co = await j(await checkoutH(req({ email: 'demo@example.test', shippingAddress: { name: 'Demo', line1: '1 Main St', city: 'Sonoma', postcode: '95476', countryCode: 'us' }, disclosureAccepted: true, disclosureVersion: DISCLOSURE.version, returnPath: '/gift-wizard' }), { id: U }, orderDeps, sid))
  console.log('6 checkout', co.status, co.body.totals)
  const sess = sessions.get(co.body.stripeSessionId); sess.payment_status = 'paid'; sess.status = 'complete'; sess.payment_intent = 'pi_demo'
  await confirmGiftOrder(orderDeps, co.body.stripeSessionId, U)
  const order = [...store.orders.values()][0]
  console.log('   pinned on the order:', order.items.map(i => { const c = (i.frozen as any).composition; return { generationId: c.generationId.slice(0, 8), sha: c.artworkSha256.slice(0, 16), w: c.width, h: c.height } }))
  const fin = await j(await finalizeOrderH({ id: U }, gift, sid))
  console.log('7 final approval', fin.status, { state: fin.body.order?.state, manufacturing: fin.body.order?.manufacturing, orderStatus: order.status })
  const after = await j(await getSessionH({ id: U }, gift, sid))
  console.log('8 allowance', after.body.generations.allowance, 'items', after.body.generations.items.map((g: any) => [g.productId, g.status, g.kind, g.accepted]))
  void setLines; void getSessionView
}
main().catch(e => { console.error('demo failed:', e instanceof Error ? e.stack : e); process.exit(1) })
