const { open, snap, report, photoPath, state, reset } = require('./lib.cjs')
;(async () => {
  await reset(); const { browser, page, problems } = await open()
  await page.goto('http://localhost:3777/gift-wizard.next.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  await page.locator('input[type=file]').first().setInputFiles(await photoPath())
  await page.getByText('Myself', { exact: false }).first().waitFor(); await page.getByText('Myself', { exact: false }).first().click()
  await page.waitForFunction(() => !document.getElementById('primary').disabled); await page.locator('#primary').click()
  await page.waitForFunction(() => document.getElementById('screen').dataset.view === 'effects'); await page.waitForTimeout(600)
  for (const name of ['Marionettes', 'Nesting Dolls', 'Tin Wind-Ups', 'Atomic Age Robot', 'Action Figure', 'Vinyl Figure']) { await page.getByRole('button', { name }).first().click(); await page.waitForTimeout(120) }
  await page.locator('#primary').click(); await page.waitForTimeout(2500)
  console.log('server mid-generation:', JSON.stringify((await state()).previews.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {})))
  // THE ORIGINAL COMPLAINT: leave the Wizard while previews are generating (click Gifts in the masthead), then come back
  await page.getByRole('button', { name: 'Gifts' }).first().click(); await page.waitForTimeout(400); await page.locator('a', { hasText: 'Gift Collection' }).first().click();
  await page.waitForTimeout(2500); console.log('now at', page.url().replace('http://localhost:3777', '')); await snap(page, '16-left-wizard'); 
  await page.waitForTimeout(7000)
  console.log('server after wait:', JSON.stringify((await state()).previews.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {})))
  await page.goBack({ waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(3500)
  console.log('after Back at', page.url().replace('http://localhost:3777', '')); await snap(page, '17-returned-via-back'); await report(page, problems, 'returned with browser Back')
  console.log('landing links:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('a,button')].filter(a => a.offsetParent).map(a => a.textContent.trim().slice(0, 30) + ' -> ' + (a.getAttribute('href')||'btn')).slice(4, 24)))); await page.goto('http://localhost:3777/gift-wizard.next.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(3500)
  await snap(page, '18-returned-via-url'); await report(page, problems, 'returned by opening the Wizard again')
  console.log('LOG', JSON.stringify((await state()).log.slice(-8)))
  await browser.close()
})()
