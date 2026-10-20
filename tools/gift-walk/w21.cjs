// the two backend contracts over real HTTP on the real handlers: (1) provisional previews for mismatched shapes, (2) durable composition state through start / refresh / second request / completion
const fs = require('fs')
const { open, photoPath, reset, state, BASE, OUT } = require('./lib.cjs')
const { toProducts } = require('./w6.cjs')
const j = async (u, init) => { const r = await fetch(BASE + u, init); const ct = r.headers.get('content-type') || ''; return { status: r.status, body: ct.includes('json') ? await r.json() : null, ms: 0 } }
;(async () => {
  await reset(); const { browser, page, problems } = await open()
  await toProducts(page, problems)                                     // through the real UI: upload, six previews, favorite chosen
  const sid = (await j('/api/v1/gift/sessions')).body.current.sessionId
  console.log('--- 1. provisional previews (the favorite is square)')
  for (const p of ['fine_art:12x18', 'framed:16x24', 'canvas:12x18', 'premium:8x12', 'fine_art:8x8']) {
    const t = Date.now(); const r = (await j(`/api/v1/gift/sessions/${sid}/product-preview?productId=${encodeURIComponent(p)}&provisional=1`)).body
    console.log(p.padEnd(15), r.status.padEnd(12), r.renderer || '', r.provisional ? JSON.stringify({ bars: r.provisional.bars, final: r.provisional.finalComposition }) : '', `${Date.now() - t}ms`)
    if (r.url) { const img = await fetch(BASE + new URL(r.url).pathname); fs.writeFileSync(OUT + '60-provisional-' + p.replace(':', '-') + '.jpg', Buffer.from(await img.arrayBuffer())) }
  }
  console.log('without the flag:', (await j(`/api/v1/gift/sessions/${sid}/product-preview?productId=${encodeURIComponent('fine_art:12x18')}`)).body.status)
  console.log('--- 2. durable composition state')
  await j(`/api/v1/gift/sessions/${sid}/lines`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ lineId: 'g1', productId: 'framed:16x24', copies: 1 }, { lineId: 'g2', productId: 'fine_art:8x8', copies: 1 }] }) })
  await fetch(BASE + '/__walk/pay'); const view = async () => (await j(`/api/v1/gift/sessions/${sid}`)).body.compositions.map(c => `${c.lineId}:${c.state}${c.preparingSince ? '@' + c.preparingSince.slice(11, 19) : ''}`).join(' ')
  const resume = async () => JSON.stringify((await j('/api/v1/gift/sessions')).body.resume.compositions)
  console.log('before start      ', await view(), '| resume', await resume())
  const t0 = Date.now(); const first = fetch(BASE + `/api/v1/gift/sessions/${sid}/compositions`, { method: 'POST' })
  await new Promise(r => setTimeout(r, 900))
  console.log('refresh at +0.9s  ', await view(), '| resume', await resume())
  const t1 = Date.now(); const second = await j(`/api/v1/gift/sessions/${sid}/compositions`, { method: 'POST' })
  console.log(`second POST answered in ${Date.now() - t1}ms, status ${second.status}, states:`, second.body.compositions.map(c => c.lineId + ':' + c.state).join(' '), '| paid generations so far:', (await state()).genCalls)
  const done = await first; console.log(`first POST finished after ${((Date.now() - t0) / 1000).toFixed(1)}s status ${done.status}`)
  console.log('after             ', await view(), '| resume', await resume())
  await browser.close()
})()
