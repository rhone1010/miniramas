import { chromium } from 'playwright'

const URL = 'http://localhost:8768/discovery-consolidated-draft.html'

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(2000)

  // Set gender first (required for cards to be clickable)
  const genderBtn = await page.$('.toggle-btn[data-gender="man"]')
  if (genderBtn) {
    await genderBtn.click()
    await page.waitForTimeout(500)
    console.log('Gender set to man')
  }

  // Select 4 effects via JS (clicking cards requires complex DOM state)
  await page.evaluate(() => {
    const allKeys = window.allCatalogKeys ? window.allCatalogKeys() : []
    for (let i = 0; i < Math.min(4, allKeys.length); i++) {
      SELECTED.push(allKeys[i])
      syncSelect(allKeys[i].key, 'select')
    }
    lockTier()
    updateCollectionSummary()
  })
  await page.waitForTimeout(500)

  // Check SELECTED count
  const selCount = await page.evaluate(() => window.SELECTED ? window.SELECTED.length : 0)
  console.log(`SELECTED count: ${selCount}`)

  // Navigate to Review
  const reviewBtn = await page.$('.btn-review.on')
  if (reviewBtn) {
    await reviewBtn.click()
    await page.waitForTimeout(500)
    console.log('Navigated to Review')
  }

  // Navigate to Pose
  const nextPose = await page.$('button.btn-create.on')
  if (nextPose) {
    await nextPose.click()
    await page.waitForTimeout(500)
    console.log('Navigated to Pose')
  }

  // Navigate to Aspect
  const nextAspect = await page.$('#btnPoseNext')
  if (nextAspect) {
    await nextAspect.click()
    await page.waitForTimeout(500)
    console.log('Navigated to Aspect')
  }

  // Screenshot the Aspect view with Craft button
  await page.screenshot({ path: 'screenshot-aspect-craft-btn.png', fullPage: false })
  console.log('Saved screenshot-aspect-craft-btn.png')

  // Check if Craft button exists and is enabled
  const craftBtn = await page.$('#btnCraft')
  if (craftBtn) {
    const text = await craftBtn.textContent()
    const disabled = await craftBtn.isDisabled()
    const visible = await craftBtn.isVisible()
    const hasOn = await craftBtn.evaluate(el => el.classList.contains('on'))
    console.log(`Craft button: text="${text}", disabled=${disabled}, visible=${visible}, hasOn=${hasOn}`)

    // Click it — should attempt a fetch (will fail against static server, but we can check the loading state)
    // Intercept the fetch to see what payload it would send
    await page.evaluate(() => {
      window._lastCheckoutFetch = null
      const origFetch = window.fetch
      window.fetch = function(url, opts) {
        window._lastCheckoutFetch = { url, body: opts ? JSON.parse(opts.body) : null }
        // Return a fake error response so the UI shows the error state
        return Promise.resolve({
          status: 500,
          json: function() { return Promise.resolve({ error: 'test_mode_no_server' }) }
        })
      }
    })

    if (hasOn) {
      await craftBtn.click()
      await page.waitForTimeout(1000)

      const fetchData = await page.evaluate(() => window._lastCheckoutFetch)
      console.log('Fetch intercepted:', JSON.stringify(fetchData, null, 2))

      // Check loading/error state
      await page.screenshot({ path: 'screenshot-checkout-error.png', fullPage: false })
      console.log('Saved screenshot-checkout-error.png')

      const errorEl = await page.$('#checkoutError')
      if (errorEl) {
        const errText = await errorEl.textContent()
        console.log(`Error shown: "${errText}"`)
      }

      // Check button was restored
      const btnText2 = await craftBtn.textContent()
      const disabled2 = await craftBtn.isDisabled()
      console.log(`After error - button text="${btnText2}", disabled=${disabled2}`)
    }
  } else {
    console.log('Craft button not found!')
  }

  // Also test: check startCheckout is a real function now (not stub)
  const isStub = await page.evaluate(() => {
    return startCheckout.toString().indexOf('TASK 6 WIRES THIS') !== -1
  })
  console.log(`startCheckout is stub: ${isStub}`)

  // Check buildCheckoutPayload matches what fetch receives
  const clientPayload = await page.evaluate(() => window.buildCheckoutPayload())
  console.log('buildCheckoutPayload():', JSON.stringify(clientPayload, null, 2))

  await browser.close()
  console.log('Done')
})()
