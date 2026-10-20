const { open, photoPath, reset, BASE } = require('./lib.cjs')
const { toProducts } = require('./w6.cjs')
;(async () => {
  await reset(); const { browser, page, problems } = await open()
  await toProducts(page, problems)
  const sid = await page.evaluate(() => new URL(location.href).searchParams.get('sessionId') || '')
  const cur = await (await fetch(BASE + '/api/v1/gift/sessions')).json(); const id = cur.current.sessionId
  const products = ['fine_art:8x8', 'fine_art:12x12', 'fine_art:8x12', 'fine_art:12x18', 'premium:12x12', 'premium:12x18', 'framed:12x12', 'framed:12x18', 'canvas:8x8', 'canvas:12x12', 'canvas:12x18', 'matted:8x8', 'mug:11oz']
  for (const p of products) {
    const t = Date.now(); const r = await (await fetch(`${BASE}/api/v1/gift/sessions/${id}/product-preview?productId=${p}`)).json()
    console.log(p.padEnd(15), r.status.padEnd(20), r.renderer || r.reason || '', r.sceneId || '', r.extension !== undefined ? 'ext=' + r.extension : '', `${Date.now() - t}ms`)
  }
  await browser.close()
})()
