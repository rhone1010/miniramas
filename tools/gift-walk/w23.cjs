// refresh-safe recovery in the browser: pay for a gift whose artwork must be GENERATED (slow), then watch the screen, refresh mid-preparation, leave and return
const { open, snap, state, reset, BASE } = require('./lib.cjs')
const { toProducts } = require('./w6.cjs')
;(async () => {
  await reset(); const { browser, page, problems } = await open()
  await toProducts(page, problems)
  await page.locator('button', { hasText: 'Classic Framed Print' }).first().click(); await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Choose This Gift' }).first().click(); await page.waitForTimeout(2500)
  await page.locator('button', { hasText: /16.{0,3}×.{0,3}24/ }).first().click(); await page.waitForTimeout(2000)
  await page.locator('#primary').click(); await page.waitForTimeout(1500)
  await fetch(BASE + '/__walk/pay')
  const sample = async (label) => { const i = await page.evaluate(() => ({ primary: (() => { const b = document.getElementById('primary'); return b ? b.textContent.trim() + (b.disabled ? ' [DISABLED]' : ' [enabled]') : null })(), screen: document.getElementById('screen').innerText.replace(/\s+/g, ' ').slice(0, 130) })); const s = await (await fetch(BASE + '/api/v1/gift/sessions')).json(); const c = s.current.compositions[0]
    console.log(label.padEnd(26), 'server=' + c.state.padEnd(11), 'screen=' + JSON.stringify(i.screen), i.primary) }
  const t0 = Date.now(); await page.goto(BASE + '/gift-wizard.next.html', { waitUntil: 'domcontentloaded' })
  for (const ms of [600, 900]) { await page.waitForTimeout(ms); await sample(`load +${((Date.now() - t0) / 1000).toFixed(1)}s`) }
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800); await sample(`REFRESH +${((Date.now() - t0) / 1000).toFixed(1)}s`)
  await page.goto(BASE + '/gifts.next.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400)
  await page.goto(BASE + '/gift-wizard.next.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(900); await sample(`left + back +${((Date.now() - t0) / 1000).toFixed(1)}s`)
  for (const ms of [2500, 3000, 3000]) { await page.waitForTimeout(ms); await sample(`later +${((Date.now() - t0) / 1000).toFixed(1)}s`) }
  console.log('paid generations by the server (6 previews + compositions):', (await state()).genCalls, '| compositions rows:', (await state()).comps)
  await browser.close()
})()
