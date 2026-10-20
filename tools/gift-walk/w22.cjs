// full paid journey for one configuration with the CURRENT Wizard: node w22.cjs "Classic Framed Print" "16 × 24"
// upload -> six previews -> favorite -> product -> size -> Add to Cart -> (simulated verified payment) -> reload -> what the customer can do at Final Approval
const { open, snap, report, state, reset, BASE } = require('./lib.cjs')
const { toProducts } = require('./w6.cjs')
const [product, size] = [process.argv[2] || 'Classic Framed Print', process.argv[3] || '16 × 24']
const tag = (product + '-' + size).replace(/\W+/g, '-')
;(async () => {
  await reset(); const { browser, page, problems } = await open()
  await toProducts(page, problems)
  if (product !== 'Fine Art Print') { await page.locator('button', { hasText: product }).first().click(); await page.waitForTimeout(500) }
  await page.getByRole('button', { name: 'Choose This Gift' }).first().click(); await page.waitForTimeout(2500)
  await page.locator('button', { hasText: new RegExp(size.split(' ').join('.{0,3}')) }).first().click(); await page.waitForTimeout(2500)
  console.log('CONFIG screen:', (await page.locator('#screen').innerText()).replace(/\s+/g, ' ').slice(0, 200)); await snap(page, `70-${tag}-config`)
  await page.locator('#primary').click(); await page.waitForTimeout(2000)
  await fetch(BASE + '/__walk/pay')
  await page.goto(BASE + '/gift-wizard.next.html', { waitUntil: 'networkidle' })
  for (const ms of [2500, 6000, 6000]) { await page.waitForTimeout(ms)
    const info = await page.evaluate(() => { const b = document.getElementById('primary'); return { view: document.getElementById('screen').dataset.view, primary: b ? b.textContent.trim() + (b.disabled ? ' [DISABLED]' : ' [enabled]') : null, screen: document.getElementById('screen').innerText.replace(/\s+/g, ' ').slice(0, 170), imgs: [...document.querySelectorAll('#screen img')].map(i => i.src.split('/').slice(-3).join('/').slice(0, 60)) } })
    console.log(`+${ms}ms`, JSON.stringify(info)) }
  await snap(page, `71-${tag}-final-approval`)
  const s = await (await fetch(BASE + '/api/v1/gift/sessions')).json(); const c = s.current.compositions[0]
  console.log('SERVER composition:', JSON.stringify({ state: c.state, status: c.status, method: c.method, previewUrl: !!c.previewUrl }))
  const m = await (await fetch(`${BASE}/api/v1/gift/sessions/${s.current.sessionId}/lines/${c.lineId}/mockup`)).json()
  console.log('SERVER mockup:', JSON.stringify({ renderer: m.renderer, scene: m.scene && m.scene.sceneId, templateId: m.templateId, watermarked: m.watermarked }))
  await browser.close()
})()
