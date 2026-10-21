// The My Collection entrance over HTTP against the walk server (real handlers + memory store mirroring migration 057), then a browser reload of the resulting session.
const { open, snap, reset, BASE } = require('./lib.cjs')
const J = async (path, opts) => { const r = await fetch(BASE + path, opts); return { status: r.status, body: await r.json().catch(() => null) } }
const P = (path, body) => J(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
;(async () => {
  await reset()
  const { previewId } = (await J('/__walk/owned')).body
  const a = await P('/api/v1/gift/sessions/from-collection', { previewId }); const v = a.body
  console.log('from-collection ->', a.status, JSON.stringify({ entrance: v.entrance, collection: v.collection, batches: v.batches.map(b => [b.kind, b.complete, b.previews.length]), artwork: !!v.artworkPreviewId, nextBatch: v.nextBatch, masterAspect: v.masterAspect }))
  const b = await P('/api/v1/gift/sessions/from-collection', { previewId }); console.log('again ->', b.status, 'same session:', b.body.sessionId === v.sessionId)
  console.log('not mine ->', (await P('/api/v1/gift/sessions/from-collection', { previewId: '30000000-0000-4000-8000-0000000000bb' })).status)
  const sid = v.sessionId
  console.log('generation ->', (await P(`/api/v1/gift/sessions/${sid}/batches`, { idempotencyKey: 'walk-key-12345' })).body.error)
  console.log('framed (no approved scene) ->', (await J(`/api/v1/gift/sessions/${sid}/lines`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ lineId: 'x', productId: 'framed:12x18', copies: 1 }] }) })).body.error)
  console.log('fine art 12x18 + canvas 12x12 ->', (await J(`/api/v1/gift/sessions/${sid}/lines`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1 }, { lineId: 'b', productId: 'canvas:12x12', copies: 1 }] }) })).status)
  const pv = await J(`/api/v1/gift/sessions/${sid}/product-preview?productId=canvas:12x12`); console.log('product-preview canvas:12x12 ->', pv.status, JSON.stringify({ status: pv.body.status, renderer: pv.body.renderer, sceneId: pv.body.sceneId }))
  const pv2 = await J(`/api/v1/gift/sessions/${sid}/product-preview?productId=fine_art:12x18&provisional=1`); console.log('product-preview fine_art:12x18 provisional ->', pv2.status, JSON.stringify({ status: pv2.body.status, renderer: pv2.body.renderer }))
  await fetch(BASE + '/__walk/pay')
  let comps; for (let i = 0; i < 15; i++) { const r = await P(`/api/v1/gift/sessions/${sid}/compositions`); comps = r.body; if (r.status === 200 && comps.compositions.every(c => c.status === 'ready')) break; await new Promise(r => setTimeout(r, 2000)) }
  console.log('compositions', comps.compositions.map(c => [c.lineId, c.status, c.method, c.correctionsRemaining].join('/')))
  for (const c of comps.compositions) await P(`/api/v1/gift/sessions/${sid}/compositions/${c.compositionId}/approve`)
  const fin = await P(`/api/v1/gift/sessions/${sid}/finalize`); console.log('finalize ->', fin.status, JSON.stringify({ state: fin.body.order.state, manufacturing: fin.body.order.manufacturing, unlock: fin.body.order.unlockPortfolioId, entrance: fin.body.entrance }))
  const rs = (await J('/api/v1/gift/sessions')).body; console.log('restore ->', rs.current.entrance, rs.current.order.state, 'step', rs.resume.suggestedStep)
  const { browser, page, problems } = await open(); await page.goto(BASE + '/gift-wizard.next.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(4000)
  const ui = await page.evaluate(() => ({ view: document.getElementById('screen')?.dataset.view, text: document.getElementById('screen')?.innerText.replace(/\s+/g, ' ').slice(0, 200) })); console.log('BROWSER (current Wizard build) on a finalized collection session:', JSON.stringify(ui), 'problems:', problems.length ? problems.slice(0, 3) : 'none'); await snap(page, '90-collection-session-reload'); await browser.close()
})()
