const { open, snap, report, state, BASE } = require('./lib.cjs')
;(async () => {
  const { browser, page, problems } = await open()
  await page.goto(BASE + '/gift-wizard.next.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(3000)
  await snap(page, '35-restored-paid'); await report(page, problems, 'restored paid session')
  const before = (await state()).log.length
  await page.getByRole('button', { name: /Try again/ }).first().click().catch(e => console.log('no Try again button', String(e).slice(0, 60)))
  for (const ms of [1500, 4000, 8000]) { await page.waitForTimeout(ms); const s = await state(); console.log(`+${ms} comps=${s.comps} newLog=${s.log.slice(-4).join(' | ').slice(0, 300)}`); await report(page, problems, 'after Try again +' + ms) }
  await snap(page, '36-after-try-again')
  await browser.close()
})()
