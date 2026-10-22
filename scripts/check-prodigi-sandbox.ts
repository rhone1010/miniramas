// scripts/check-prodigi-sandbox.ts
//
// READ-ONLY readiness check of the Prodigi SANDBOX for every configuration Gift Wizard may sell (every launch product: purchasability no longer depends on mockup photography): GET /Products/{sku} and POST /Quotes for a US delivery.
// It never calls POST /Orders and refuses to run unless PRODIGI_ENV is 'sandbox'. Output: SKU, product found, quote outcome, shipping. No keys are printed.
//
//   npx tsx --env-file=.env.local scripts/check-prodigi-sandbox.ts

import { allProducts } from '../lib/v1/print/catalog'
import { getProduct, getQuote, getEnv } from '../lib/v1/print/prodigi-client'

async function main() {
  if ((process.env.PRODIGI_ENV || 'sandbox').toLowerCase() !== 'sandbox') throw new Error('refused: PRODIGI_ENV is not sandbox')
  console.log(JSON.stringify({ prodigiEnv: getEnv() }))
  const sellable = new Set(allProducts().filter(p => p.status === 'launch').map(p => p.productId))
  let bad = 0
  for (const p of allProducts().filter(x => sellable.has(x.productId))) {
    let product = 'missing', quote = 'n/a', shipping = ''
    try { const r = await getProduct(p.sku); product = r.outcome } catch (e: any) { product = 'ERR ' + String(e?.message ?? e).slice(0, 60) }
    try { const q: any = await getQuote({ shippingMethod: 'Standard', destinationCountryCode: 'US', currencyCode: 'USD', items: [{ sku: p.sku, copies: 1, attributes: p.attributes, assets: [{ printArea: 'default' }] }] })
      shipping = q.quotes?.[0]?.costSummary?.shipping?.amount ?? ''
      // Checkout needs a quote with a numeric shipping amount (orders.ts). Prodigi answers 'CreatedWithIssues' for a quote that carries no artwork URL; listed issues are the real warning.
      quote = Number.isFinite(parseFloat(shipping)) && !(q.quotes[0].issues?.length) && ['Ok', 'Created', 'CreatedWithIssues'].includes(q.outcome) ? 'Ok' : `NOT OK (${q.outcome}${q.quotes?.[0]?.issues?.length ? ', issues' : ''})` } catch (e: any) { quote = 'ERR ' + String(e?.message ?? e).slice(0, 60) }
    if (product !== 'Ok' || quote !== 'Ok') bad++
    console.log(p.productId.padEnd(16), p.sku.padEnd(18), 'product:', product.padEnd(8), 'quote:', quote.padEnd(8), shipping)
  }
  console.log(bad ? `NOT READY: ${bad} configuration(s) failed` : 'READY: every sellable configuration is known to the Prodigi sandbox and quotes')
  process.exit(bad ? 1 : 0)
}
main().catch(e => { console.error('check-prodigi-sandbox:', e instanceof Error ? e.message : e); process.exit(1) })
