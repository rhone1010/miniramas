// scripts/test-prodigi.ts
//
// Sandbox smoke test for the Prodigi integration.
//
// Run:  npx tsx scripts/test-prodigi.ts <publicly_accessible_image_url>
//
// Verifies, in order:
//   1. Env + auth are configured correctly
//   2. The SKU you plan to use resolves via GET /Products
//   3. A US-bound quote returns sensible shipping + total
//   4. A sandbox order is created end-to-end and re-fetchable
//
// Sandbox orders are NOT charged and NOT printed.
// This script REFUSES to run against PRODIGI_ENV=live as a safety net.
//
// For the image URL:
//   ANY publicly fetchable image works. The point of this test is to confirm
//   the API plumbing, not to print a real render. Suggested quick options:
//     - A Wikipedia image URL
//     - https://prodigi.com/img/products/hero/enhanced-matte-art.jpg (Prodigi's own)
//     - A Supabase Storage public URL if you have one
//   Avoid Replicate output URLs — they expire and Prodigi will fail to fetch.

import {
  getEnv,
  getProduct,
  getQuote,
  createOrder,
  getOrder,
  ProdigiError,
} from '../lib/v1/print/prodigi-client'
import { TEST_SKU, getSku } from '../lib/v1/print/sku-map'

const imageUrl = process.argv[2]
if (!imageUrl) {
  console.error('Usage: npx tsx scripts/test-prodigi.ts <publicly_accessible_image_url>')
  console.error('')
  console.error('The URL must be reachable from the public internet — Prodigi')
  console.error('servers will GET it directly. For a quick sanity check try:')
  console.error('  https://prodigi.com/img/products/hero/enhanced-matte-art.jpg')
  process.exit(1)
}

function logErr(prefix: string, err: unknown) {
  if (err instanceof ProdigiError) {
    console.error(`  ${prefix} Prodigi error ${err.status}`)
    console.error('  body:', JSON.stringify(err.body, null, 2))
  } else if (err instanceof Error) {
    console.error(`  ${prefix} ${err.message}`)
  } else {
    console.error(`  ${prefix}`, err)
  }
}

async function main() {
  console.log('━'.repeat(60))
  console.log('Prodigi sandbox smoke test')
  console.log('━'.repeat(60))

  // ── 1. Env ────────────────────────────────────────────────
  console.log('\n[1/4] Environment')
  let env
  try {
    env = getEnv()
  } catch (err) {
    logErr('✗', err)
    console.error('  → Check .env.local has PRODIGI_KEY_SANDBOX set.')
    process.exit(1)
  }
  console.log('  env:    ', env.env)
  console.log('  baseUrl:', env.baseUrl)
  if (env.env === 'live') {
    console.error('  ⚠  Running against LIVE. Refusing — this script is sandbox-only.')
    console.error('     Unset PRODIGI_ENV or set it to "sandbox" to proceed.')
    process.exit(1)
  }
  console.log('  ✓ sandbox configured')

  // ── 2. Product lookup ────────────────────────────────────
  console.log('\n[2/4] Product lookup —', TEST_SKU)
  try {
    const { product } = await getProduct(TEST_SKU)
    console.log('  ✓ SKU resolves')
    console.log('  description:', (product as any).description)
    console.log('  dimensions: ', JSON.stringify((product as any).productDimensions))
  } catch (err) {
    logErr('✗', err)
    console.error('  → If 404: the SKU has changed. Check sku-map.ts against the catalog.')
    process.exit(1)
  }

  // ── 3. Quote ─────────────────────────────────────────────
  console.log('\n[3/4] Quote — 1× 8×10 EMA to US (Budget)')
  try {
    const quote = await getQuote({
      shippingMethod:         'Budget',
      destinationCountryCode: 'US',
      currencyCode:           'USD',
      items: [{
        sku:    TEST_SKU,
        copies: 1,
        assets: [{ printArea: 'default' }],
      }],
    })
    const q = quote.quotes[0]
    if (!q) throw new Error('Empty quote response')
    const items    = q.costSummary.items
    const shipping = q.costSummary.shipping
    console.log('  ✓ quote returned')
    console.log('  carrier:    ', q.shipments[0]?.carrier?.name, q.shipments[0]?.carrier?.service)
    console.log('  items:      ', `${items.amount} ${items.currency}`)
    console.log('  shipping:   ', `${shipping.amount} ${shipping.currency}`)
    console.log('  total:      ', `${(Number(items.amount) + Number(shipping.amount)).toFixed(2)} ${items.currency}`)
    console.log('  lab:        ', q.shipments[0]?.fulfillmentLocation?.labCode)
  } catch (err) {
    logErr('✗', err)
    process.exit(1)
  }

  // ── 4. Order ─────────────────────────────────────────────
  console.log('\n[4/4] Sandbox order — 1× 8×10')
  console.log('  image URL:', imageUrl)
  const entry          = getSku('8x10', 'unframed')
  const idempotencyKey = `smoke-${Date.now()}`

  let orderId = ''
  try {
    const res = await createOrder({
      shippingMethod:    'Budget',
      idempotencyKey,
      merchantReference: idempotencyKey,
      recipient: {
        name:  'Sandbox Test',
        email: 'sandbox-test@example.com',
        address: {
          line1:           '14 Test Place',
          postalOrZipCode: '94952',
          countryCode:     'US',
          townOrCity:      'Petaluma',
          stateOrCounty:   'CA',
        },
      },
      items: [{
        sku:    entry.sku,
        copies: 1,
        sizing: entry.defaultSizing,
        assets: [{ printArea: 'default', url: imageUrl }],
      }],
    })
    orderId = res.order.id
    console.log('  ✓ order created')
    console.log('  order id:', orderId)
    console.log('  stage:   ', res.order.status.stage)
    console.log('  details: ', JSON.stringify(res.order.status.details))
  } catch (err) {
    logErr('✗', err)
    if (err instanceof ProdigiError && err.status === 400) {
      console.error('  → Most common cause: image URL not publicly fetchable.')
      console.error('    Prodigi servers must GET the URL directly. Replicate URLs')
      console.error('    expire; serve from your own storage instead.')
    }
    process.exit(1)
  }

  // ── Round-trip ────────────────────────────────────────────
  console.log('\n  Re-fetching order after 2s to confirm round-trip…')
  await new Promise(r => setTimeout(r, 2000))
  try {
    const fetched = await getOrder(orderId)
    console.log('  ✓ re-fetch ok')
    console.log('  stage on re-fetch:', fetched.order.status.stage)
  } catch (err) {
    logErr('✗', err)
    // Non-fatal — order was created, just re-fetch failed
  }

  console.log('\n' + '━'.repeat(60))
  console.log('All checks passed. Sitting 1 complete.')
  console.log('')
  console.log('Next (Sitting 2):')
  console.log('  - Supabase Storage bucket for upscaled print files')
  console.log('  - Asset pipeline: render → Stability upscale → upload → signed URL')
  console.log('  - Stripe webhook → /v4.0/Orders with the signed URL')
  console.log('  - print_orders DB table for status tracking')
  console.log('━'.repeat(60))
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
