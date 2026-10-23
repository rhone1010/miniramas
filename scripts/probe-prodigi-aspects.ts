// scripts/probe-prodigi-aspects.ts
//
// READ-ONLY census of the Prodigi SANDBOX catalog by picture shape: for each product family, which SKUs exist whose size is 1:1, 2:3 (portrait) or 3:2 (landscape). GET /Products/{sku} only: it never
// calls POST /Orders or POST /Quotes, and refuses to run unless PRODIGI_ENV is 'sandbox'. Nothing is invented: a SKU is "found" only if Prodigi answers Ok for that exact string.
//
//   npx tsx --env-file=<env file> scripts/probe-prodigi-aspects.ts [out.json]

import fs from 'node:fs'
import { getProduct } from '../lib/v1/print/prodigi-client'

const FAMILIES: Record<string, string> = { fine_art: 'GLOBAL-FAP', premium: 'GLOBAL-HPR', canvas: 'GLOBAL-CAN', classic_frame: 'GLOBAL-CFP', framed_canvas: 'GLOBAL-FRA-CAN' }
const sizes: Array<{ w: number; h: number; shape: '1:1' | '2:3' | '3:2' }> = []
for (let s = 4; s <= 60; s += 2) sizes.push({ w: s, h: s, shape: '1:1' })
for (let k = 2; k <= 20; k++) { sizes.push({ w: 2 * k, h: 3 * k, shape: '2:3' }); sizes.push({ w: 3 * k, h: 2 * k, shape: '3:2' }) }

async function main() {
  if ((process.env.PRODIGI_ENV || 'sandbox').toLowerCase() !== 'sandbox') throw new Error('refused: PRODIGI_ENV is not sandbox')
  const found: Array<{ family: string; sku: string; shape: string; size: string; dims: unknown }> = []
  let asked = 0
  for (const [family, prefix] of Object.entries(FAMILIES)) {
    for (const s of sizes) {
      const sku = `${prefix}-${s.w}X${s.h}`
      asked++
      try {
        const r = await getProduct(sku)
        if (r.outcome === 'Ok') { const p: any = r.product; found.push({ family, sku, shape: s.shape, size: `${s.w}x${s.h}`, dims: { productDimensions: p?.productDimensions, printAreaSizes: p?.printAreaSizes ?? null } }) }
      } catch (e: any) { if (!/404|NotFound|not found/i.test(String(e?.message ?? e))) console.error(sku, String(e?.message ?? e).slice(0, 80)) }
    }
  }
  const summary: Record<string, Record<string, string[]>> = {}
  for (const f of found) ((summary[f.family] ??= {})[f.shape] ??= []).push(f.size)
  const out = { probedAt: new Date().toISOString(), env: 'sandbox', skusAsked: asked, summary, found }
  fs.writeFileSync(process.argv[2] || 'prodigi-aspect-probe.json', JSON.stringify(out, null, 1))
  console.log(JSON.stringify({ skusAsked: asked, summary }, null, 1))
}
main().catch(e => { console.error('probe-prodigi-aspects:', e instanceof Error ? e.message : e); process.exit(1) })
