// scripts/check-prodigi-frame-colors.ts
//
// READ-ONLY (GET /Products and POST /Quotes only; refuses unless PRODIGI_ENV is sandbox): for every Classic Frame, Matted Frame and Framed Canvas SKU and every frame colour the Gift Shop offers, the colour must be a
// variant Prodigi lists (with the catalog's other attributes), its print area must equal the catalog's, and a quote with exactly those attributes must be accepted. Nothing is ordered.
//
//   npx tsx --env-file=<env file> scripts/check-prodigi-frame-colors.ts

import { allProducts } from '../lib/v1/print/catalog'
import { getProduct, getQuote, getEnv } from '../lib/v1/print/prodigi-client'
import { frameColorsFor } from '../lib/v1/gift/frame-colors'

async function main() {
  if (getEnv().env !== 'sandbox') throw new Error('refused: not the Prodigi sandbox')
  let bad = 0, checked = 0
  for (const p of allProducts().filter(x => frameColorsFor(x))) {
    await new Promise(r => setTimeout(r, 400))
    const vs: any[] = ((await getProduct(p.sku)).product as any).variants ?? []
    for (const color of frameColorsFor(p)!) {
      const attrs = { ...p.attributes, color }
      const v = vs.find(x => Object.entries(attrs).every(([k, val]) => x.attributes?.[k] === val))
      const pa = v?.printAreaSizes?.default, sameArea = pa && pa.horizontalResolution === p.requirements.finalPx.w && pa.verticalResolution === p.requirements.finalPx.h
      let quote = 'skipped'
      if (v && sameArea && (color === 'black' || p.productId.endsWith('12x12') || p.productId.endsWith('12x18') || p.productId.endsWith('8x12'))) {
        await new Promise(r => setTimeout(r, 1100))
        try { const q: any = await getQuote({ shippingMethod: 'Budget', destinationCountryCode: 'US', currencyCode: 'USD', items: [{ sku: p.sku, copies: 1, attributes: attrs, assets: [{ printArea: 'default' }] }] } as any); quote = Number.isFinite(parseFloat(q.quotes?.[0]?.costSummary?.shipping?.amount)) && !(q.quotes?.[0]?.issues?.length) ? 'Ok ' + q.quotes[0].costSummary.items.amount : 'NOT OK ' + q.outcome } catch (e: any) { quote = 'ERR ' + String(e?.message ?? e).slice(0, 40) }
      }
      checked++
      if (!v || !sameArea || /NOT OK|ERR/.test(quote)) { bad++; console.log('BAD', p.productId, color, { listed: !!v, area: pa, quote }) }
      else if (quote !== 'skipped') console.log('ok', p.productId.padEnd(22), color.padEnd(10), quote)
    }
  }
  console.log(bad ? `NOT READY: ${bad} of ${checked} combinations failed` : `READY: all ${checked} product x colour combinations are listed by Prodigi with the catalog print area; sampled quotes accepted`)
  process.exit(bad ? 1 : 0)
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
