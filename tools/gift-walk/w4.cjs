const { open, snap, report, photoPath, state, reset } = require('./lib.cjs')
;(async () => {
  await reset()
  const { browser, page, problems } = await open()
  await page.goto('http://localhost:3777/gift-wizard.next.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  await page.locator('input[type=file]').first().setInputFiles(await photoPath()); await page.waitForTimeout(3500)
  await page.getByText('Myself', { exact: false }).first().click(); await page.locator('#primary').click(); await page.waitForTimeout(2000)
  // pick six effects by clicking the first six tiles
  const tiles = page.locator('#screen button').filter({ hasText: /Marionettes|Nesting Dolls|Tin Wind-Ups|Atomic Age Robot|Action Figure|Vinyl Figure/ })
  console.log('tiles found', await tiles.count())
  for (const name of ['Marionettes', 'Nesting Dolls', 'Tin Wind-Ups', 'Atomic Age Robot', 'Action Figure', 'Vinyl Figure']) { await page.getByRole('button', { name }).first().click(); await page.waitForTimeout(250) }
  await snap(page, '05-six-picked'); await report(page, problems, 'six effects picked')
  const t0 = Date.now()
  await page.locator('#primary').click()
  for (const [i, ms] of [[1, 1200], [2, 3000], [3, 4000], [4, 4000], [5, 4000]]) {
    await page.waitForTimeout(ms)
    await snap(page, `06-crafting-${i}`)
    const s = await state()
    const imgs = await page.locator('#screen img').count()
    console.log(`t+${((Date.now() - t0) / 1000).toFixed(1)}s serverPreviews=${JSON.stringify(s.previews.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {}))} genCalls=${s.genCalls} imgsOnScreen=${imgs}`)
    await report(page, problems, 'crafting ' + i)
  }
  console.log('LOG', JSON.stringify((await state()).log.slice(-14), null, 0))
  await browser.close()
})()
