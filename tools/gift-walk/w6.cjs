const { open, snap, report, photoPath, state, reset } = require('./lib.cjs')
exports.toProducts = async (page, problems) => {
  await page.goto('http://localhost:3777/gift-wizard.next.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  await page.locator('input[type=file]').first().setInputFiles(await photoPath()); await page.waitForTimeout(3500)
  await page.getByText('Myself', { exact: false }).first().click(); await page.waitForFunction(() => !document.getElementById('primary').disabled); await page.locator('#primary').click(); await page.waitForFunction(() => document.getElementById('screen').dataset.view === 'effects'); await page.waitForTimeout(800)
  for (const name of ['Marionettes', 'Nesting Dolls', 'Tin Wind-Ups', 'Atomic Age Robot', 'Action Figure', 'Vinyl Figure']) { await page.getByRole('button', { name }).first().click(); await page.waitForTimeout(150) }
  await page.locator('#primary').click()
  await page.waitForFunction(() => document.querySelectorAll('#screen img').length >= 6, null, { timeout: 60000 })
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Tin Wind-Ups' }).first().click(); await page.waitForTimeout(500)
  await page.waitForFunction(() => !document.getElementById('primary').disabled, null, { timeout: 10000 }).catch(() => console.log('WALL: choosing an artwork did not enable the primary action'))
  await page.locator('#primary').click(); await page.waitForTimeout(2500)
}
if (require.main === module) (async () => {
  await reset(); const { browser, page, problems } = await open()
  await exports.toProducts(page, problems)
  await snap(page, '09-products'); await report(page, problems, 'products')
  await page.getByRole('button', { name: 'Choose This Gift' }).first().click(); await page.waitForTimeout(3500)
  await snap(page, '10-configuration'); await report(page, problems, 'configuration (Fine Art Print)')
  console.log('imgs on screen:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#screen img, #right img')].map(i => ({ src: i.src.replace('http://localhost:3777', '').slice(0, 90), w: i.naturalWidth })))))
  const s = await state(); console.log('LOG', JSON.stringify(s.log.slice(-8)))
  await browser.close()
})()
