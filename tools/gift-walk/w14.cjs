const { open, snap, report, photoPath, state, reset } = require('./lib.cjs')
;(async () => {
  await reset(); const { browser, page, problems } = await open()
  await page.goto('http://localhost:3777/gift-wizard.next.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  await page.locator('input[type=file]').first().setInputFiles(await photoPath())
  await page.getByText('Myself', { exact: false }).first().waitFor(); await page.getByText('Myself', { exact: false }).first().click()
  await page.waitForFunction(() => !document.getElementById('primary').disabled); await page.locator('#primary').click()
  await page.waitForFunction(() => document.getElementById('screen').dataset.view === 'effects'); await page.waitForTimeout(600)
  for (const name of ['Marionettes', 'Nesting Dolls', 'Tin Wind-Ups', 'Atomic Age Robot', 'Action Figure', 'Vinyl Figure']) { await page.getByRole('button', { name }).first().click(); await page.waitForTimeout(120) }
  console.log('primary before click:', await page.evaluate(() => document.getElementById('primary').textContent + ' disabled=' + document.getElementById('primary').disabled))
  await page.locator('#primary').click(); const t0 = Date.now()
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(700); const s = await state(); console.log(`t+${((Date.now() - t0) / 1000).toFixed(1)} previews=${JSON.stringify(s.previews.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {}))} view=${await page.evaluate(() => document.getElementById('screen').dataset.view)} lastLog=${s.log.slice(-1)[0]}`) }
  await browser.close()
})()
