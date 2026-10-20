// continues a paid session (run w17 first, same server): Review Your Gifts -> compositions prepared -> Final Approval
const { open, snap, report, state, BASE } = require('./lib.cjs')
;(async () => {
  const { browser, page, problems } = await open()
  await page.goto(BASE + '/gift-wizard.next.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500)
  await report(page, problems, 'return to paid session')
  const t0 = Date.now(); await page.locator('#primary').click()
  for (const ms of [800, 1500, 3000, 5000, 8000]) {
    await page.waitForTimeout(ms); const s = await state()
    console.log(`t+${((Date.now() - t0) / 1000).toFixed(1)}s serverCompositions=${s.comps} log=${s.log.slice(-2).join(' | ').slice(0, 200)}`)
    await snap(page, `34-preparing-${ms}`); await report(page, problems, 'after Review Your Gifts +' + ms)
  }
  console.log('imgs:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#screen img, #right img')].map(i => i.src.replace('http://localhost:3777', '').slice(0, 110)))))
  await browser.close()
})()
