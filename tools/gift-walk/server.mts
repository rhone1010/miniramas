// LOCAL WALK SERVER (scratch, not committed). Serves the real public/ files and mounts the REAL Gift route handlers on an in-memory store, a fake signed-in user, a fake generator
// (a sample painting with a per-effect tint and a realistic delay), the real scene/calibrated renderers and the real composition pipeline (outpaint stubbed as mirror).
// Fakes: auth, database, storage, generation, Stripe. Nothing leaves this machine.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.test'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'inert'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'inert'
process.env.GIFT_COMPOSITIONS_BEFORE_PAYMENT = process.env.GIFT_COMPOSITIONS_BEFORE_PAYMENT ?? '1'
const ROOT = process.cwd(), PORT = Number(process.env.PORT || 3777), BASE = `http://localhost:${PORT}`
const USER = { id: '10000000-0000-4000-8000-000000000001' }

const { memoryGiftStore } = await import('../../lib/v1/gift/store.ts')
const H = await import('../../lib/v1/gift/handlers.ts')
const { composeWithPrintShop } = await import('../../lib/v1/gift/compose.ts')
const { realMockupRenderer } = await import('../../lib/v1/gift/mockup-real.ts')
const { catalogResponse } = await import('../../lib/v1/print/catalog.ts')
const { liveEffectIds } = await import('../../lib/v1/gift/effects.ts')

const store = memoryGiftStore(), files = new Map<string, Buffer>()
const SAMPLE = fs.readFileSync(process.env.WALK_ARTWORK || path.join(ROOT, 'public/gift-wizard/assets/preview-2.jpg'))
const effectIds = liveEffectIds('portraits')
let genCalls = 0
const generate = async (i: { effectId: string; aspect: string }) => {
  genCalls++
  const [w, h] = i.aspect.split(':').map(Number)
  const idx = Math.max(0, effectIds.indexOf(i.effectId))
  await new Promise(r => setTimeout(r, 2500 + Math.random() * 5000))                   // NB2 takes a while
  const img = await sharp(SAMPLE).resize(Math.round(1024 * w / Math.max(w, h)), Math.round(1024 * h / Math.max(w, h)), { fit: 'cover' }).modulate({ hue: idx * 37 % 360, saturation: 1 + (idx % 3) * 0.15 }).png().toBuffer()
  return { imageB64: img.toString('base64') }
}
const watermark = async (b64: string) => {
  const src = Buffer.from(b64, 'base64'), m = await sharp(src).metadata()
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}"><text x="50%" y="52%" text-anchor="middle" font-size="${Math.round((m.width || 800) / 9)}" fill="rgba(255,255,255,0.45)" font-family="sans-serif" transform="rotate(-24 ${(m.width || 800) / 2} ${(m.height || 800) / 2})">LITEN CO · PREVIEW</text></svg>`)
  return sharp(src).composite([{ input: svg }]).jpeg({ quality: 82 }).toBuffer()
}
const deps: any = {
  draftCompositions: process.env.GIFT_COMPOSITIONS_BEFORE_PAYMENT === '1', store, generate, watermark, compose: composeWithPrintShop, mockup: realMockupRenderer,
  storage: { put: async (p: string, b: Buffer) => { files.set(p, b) }, get: async (p: string) => files.get(p) ?? null, remove: async (ps: string[]) => { for (const p of ps) files.delete(p) }, signedUrl: async (p: string) => (files.has(p) ? `https://walk.supabase.co/__files/${p}` : null), list: async (x: string) => [...files.keys()].filter(k => k.startsWith(x)) },
  analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), kick: async () => ({}),
}

const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const log: string[] = []
async function toWeb(req: http.IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  return new Request(BASE + req.url, { method: req.method, headers: req.headers as any, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body })
}
async function send(res: http.ServerResponse, r: Response) { res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())) }

http.createServer(async (req, res) => {
  const url = new URL(req.url!, BASE), p = url.pathname, started = Date.now()
  try {
    if (p === '/__walk/pay') { // simulate verified payment of the CURRENT session's cart (Stripe is not available here): same records a real confirmed order has
      const { purchasedItems, purchasedLines } = await import('../../lib/v1/gift/test-order.ts'); const { randomUUID } = await import('node:crypto')
      const rec = [...store.sessions.values()].at(-1)!; const lines = rec.lines.map((l: any) => ({ lineId: l.lineId, productId: l.productId, copies: l.copies })); const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
      store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: purchasedItems(lines), prodigi_order_id: null, placed_at: null } as any)
      await store.linkOrder(rec.id, USER.id, orderId, '2026-10-18-3'); await store.confirmOrder({ sessionId: rec.id, orderId, userId: USER.id, stripeSessionId: cs, paymentIntent: 'pi_walk', lines: purchasedLines(lines) })
      res.writeHead(200, { 'content-type': 'application/json' }); return void res.end(JSON.stringify({ paid: true, orderId })) }
    if (p === '/__walk/state') { res.writeHead(200, { 'content-type': 'application/json' }); return void res.end(JSON.stringify({ genCalls, sessions: store.sessions.size, previews: store.previews.map(x => x.status), lines: store.sessions.size ? [...store.sessions.values()][0].lines : [], comps: store.compositions.length, orders: store.orders.size, log: log.slice(-40) })) }
    if (p.startsWith('/__files/')) { const b = files.get(decodeURIComponent(p.slice(9))); if (!b) { res.writeHead(404); return void res.end() } res.writeHead(200, { 'content-type': p.endsWith('.png') ? 'image/png' : 'image/jpeg', 'cache-control': 'no-store' }); return void res.end(b) }
    if (p.startsWith('/api/')) {
      const web = await toWeb(req); let r: Response | null = null; let m: RegExpMatchArray | null
      if (p === '/api/v1/auth/me') r = Response.json({ user: { id: USER.id, email: 'walker@example.test' } })
      else if (p === '/api/v1/print/catalog') r = Response.json(catalogResponse(null))
      else if (p === '/api/v1/gift/sessions' && req.method === 'POST') r = await H.createSessionH(web, USER, deps)
      else if (p === '/api/v1/gift/sessions' && req.method === 'GET') r = await H.restoreSessionH(USER, deps)
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)$/))) r = req.method === 'DELETE' ? await H.deleteSessionH(USER, deps, m[1]) : await H.getSessionH(USER, deps, m[1])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/lines$/))) r = await H.setLinesH(web, USER, deps, m[1])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/batches$/))) r = await H.startBatchH(web, USER, deps, m[1])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/batches\/(\d+)$/))) r = await H.getBatchH(USER, deps, m[1], m[2])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/batches\/(\d+)\/retry$/))) r = await H.retryBatchH(USER, deps, m[1], m[2])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/artwork$/))) r = await H.selectArtworkH(web, USER, deps, m[1])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/compositions$/))) r = await H.compositionsH(USER, deps, m[1])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/compositions\/([^/]+)\/approve$/))) r = await H.approveCompositionH(USER, deps, m[1], m[2])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/compositions\/([^/]+)\/correct$/))) r = await H.correctH(USER, deps, m[1], m[2])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/product-preview$/))) r = await H.productPreviewH(web, USER, deps, m[1])
      else if ((m = p.match(/^\/api\/v1\/gift\/sessions\/([^/]+)\/lines\/([^/]+)\/mockup$/))) r = await H.mockupH(web, USER, deps, m[1], m[2])
      else if (p.includes('/checkout')) r = Response.json({ error: 'checkout_unavailable' }, { status: 503 })
      else r = Response.json({ error: 'walk_server_route_missing', path: p }, { status: 404 })
      log.push(`${req.method} ${p}${url.search} -> ${r.status} ${Date.now() - started}ms`)
      return void await send(res, r)
    }
    // static: the real public/ tree
    let rel = decodeURIComponent(p); if (rel.endsWith('/')) rel += 'index.html'
    const file = path.join(ROOT, 'public', rel)
    if (file.startsWith(path.join(ROOT, 'public')) && fs.existsSync(file) && fs.statSync(file).isFile()) { res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); return void fs.createReadStream(file).pipe(res) }
    log.push(`404 ${p}`); res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found: ' + p)
  } catch (e: any) { log.push(`500 ${p}: ${String(e?.message ?? e).slice(0, 200)}`); res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'walk_server_error', message: String(e?.message ?? e) })) }
}).listen(PORT, () => console.log('walk server on ' + BASE))
