const { open, snap, photoPath, state, reset } = require('./lib.cjs')
const vp = process.argv[2] === 'mobile' ? { width: 390, height: 844 } : process.argv[2] === 'tablet' ? { width: 820, height: 1180 } : { width: 1300, height: 720 }
const tag = process.argv[2] || 'laptop'
const probe = async (page, label) => {
  const r = await page.evaluate(() => {
    const b = document.getElementById('primary'); const rect = b?.getBoundingClientRect()
    const scrollers = [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 100 }).map(e => (e.id || e.className || e.tagName).toString().slice(0, 24))
    return { view: document.getElementById('screen')?.dataset.view, primary: b ? { text: b.textContent.trim().slice(0, 28), disabled: b.disabled, top: Math.round(rect.top), bottom: Math.round(rect.bottom), inView: rect.top >= 0 && rect.bottom <= innerHeight && rect.width > 0 } : null, pageScrollsX: document.documentElement.scrollWidth > innerWidth + 1, pageH: document.documentElement.scrollHeight, innerH: innerHeight, nestedScrollers: scrollers }
  })
  console.log(`[${tag}] ${label}: ${JSON.stringify(r)}`)
  await snap(page, `20-${tag}-${label.replace(/\W+/g, '-')}`)
}
;(async () => {
  await reset(); const { browser, page, problems } = await open(vp)
  await page.goto('http://localhost:3777/gift-wizard.next.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  await probe(page, 'photo')
  await page.locator('input[type=file]').first().setInputFiles(await photoPath())
  await page.getByText('Myself', { exact: false }).first().waitFor(); await page.getByText('Myself', { exact: false }).first().click()
  await page.waitForFunction(() => !document.getElementById('primary').disabled); await probe(page, 'recipient'); await page.locator('#primary').click()
  await page.waitForFunction(() => document.getElementById('screen').dataset.view === 'effects'); await page.waitForTimeout(800); await probe(page, 'effects')
  for (const name of ['Marionettes', 'Nesting Dolls', 'Tin Wind-Ups', 'Atomic Age Robot', 'Action Figure', 'Vinyl Figure']) { await page.getByRole('button', { name }).first().click({ timeout: 8000 }).catch(e => console.log('could not click', name, String(e).slice(0, 80))); await page.waitForTimeout(120) }
  await probe(page, 'effects-six-picked')
  await page.locator('#primary').click(); await page.waitForTimeout(1500); await probe(page, 'crafting')
  await page.waitForFunction(() => document.getElementById('primary')?.textContent.includes('Use This Artwork') && !document.getElementById('primary').disabled, null, { timeout: 60000 }); await page.waitForTimeout(500); await probe(page, 'review')
  await page.getByRole('button', { name: 'Tin Wind-Ups' }).first().click(); await page.waitForTimeout(400); await probe(page, 'focus')
  await page.locator('#primary').click(); await page.waitForTimeout(2000); await probe(page, 'products')
  await page.getByRole('button', { name: 'Choose This Gift' }).first().click(); await page.waitForTimeout(2000); await probe(page, 'configuration')
  await page.locator('#primary').click({ timeout: 8000 }).catch(e => console.log('CANNOT CLICK Add to Cart:', String(e).split('\n')[0].slice(0, 120))); await page.waitForTimeout(2000); await probe(page, 'cart')
  await page.locator('#primary').click({ timeout: 8000 }).catch(e => console.log('CANNOT CLICK Next Checkout:', String(e).split('\n')[0].slice(0, 120))); await page.waitForTimeout(1500); await probe(page, 'checkout')
  await browser.close()
})()
