// scripts/prodigi-sandbox-asset-check.ts
//
// SANDBOX-ONLY (refuses unless PRODIGI_ENV is sandbox): submits a test order per probe (a synthetic test pattern of the exact print-file size, never customer art), reads what Prodigi says about the
// assets (download, preparation, issues, the sizing it applied), then cancels the order and removes the temporary file. Sandbox orders are not printed or charged. Authorized by the owner 2026-10-23.
//
//   npx tsx --env-file=<env file> scripts/prodigi-sandbox-asset-check.ts

import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin as db } from '../lib/supabase'
import { createOrder, getOrder, cancelOrder, getEnv } from '../lib/v1/print/prodigi-client'
import { getProduct } from '../lib/v1/print/catalog'

// label: what we ask. A probe is a product id and the file size to send (swapping the sides tests the orientation).
const PROBES: Array<{ id: string; w: number; h: number; note: string }> = [
  { id: 'framed_canvas:8x12', w: 2454, h: 3654, note: 'PORTRAIT file (the listed 8 wide x 12 tall)' },
  { id: 'framed_canvas:8x12', w: 3654, h: 2454, note: 'LANDSCAPE file (the print area Prodigi returns)' },
  { id: 'framed_canvas:12x18', w: 3654, h: 5454, note: 'reference: a consistent framed canvas (portrait file)' },
  { id: 'mug:11oz', w: 2670, h: 1110, note: 'mug wrap file' },
  { id: 'card:7x5', w: 6118, h: 2161, note: 'card spread file' },
  { id: 'matted:12x18', w: 2418, h: 4218, note: 'matted frame: the picture inside the mount' },
]

async function pattern(w: number, h: number) {
  // a frame of colored edges (red top, green right, blue bottom, yellow left) and a diagonal, so any rotation, crop or fit would show in the prepared asset
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#ddd"/><rect width="${w}" height="40" fill="#e22"/><rect x="${w - 40}" width="40" height="${h}" fill="#2a2"/><rect y="${h - 40}" width="${w}" height="40" fill="#22e"/><rect width="40" height="${h}" fill="#ea2"/><line x1="0" y1="0" x2="${w}" y2="${h}" stroke="#000" stroke-width="12"/><text x="120" y="220" font-size="160" font-family="Arial">TOP-LEFT ${w}x${h}</text></svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer()
}

async function main() {
  const env = getEnv(); if (env.env !== 'sandbox') throw new Error('refused: not the Prodigi sandbox')
  const stamp = Date.now(), made: string[] = [], files: string[] = []
  for (const [i, pr] of PROBES.entries()) {
    const p = getProduct(pr.id)!; const path = `fixture/prodigi-check-${stamp}-${i}.jpg`
    try {
      const body = await pattern(pr.w, pr.h)
      const up = await db.storage.from('previews').upload(path, body, { contentType: 'image/jpeg', upsert: true }); if (up.error) throw new Error('upload ' + up.error.message); files.push(path)
      const url = (await db.storage.from('previews').createSignedUrl(path, 3600)).data!.signedUrl
      const res = await createOrder({
        shippingMethod: 'Budget', merchantReference: `cc-asset-check-${stamp}-${i}`, idempotencyKey: `cc-asset-check-${stamp}-${i}-${randomUUID().slice(0, 8)}`,
        recipient: { name: 'Sandbox Test', email: 'sandbox-test@liten.invalid', address: { line1: '1 Test Street', postalOrZipCode: '95476', countryCode: 'US', townOrCity: 'Sonoma', stateOrCounty: 'CA' } },
        items: [{ sku: p.sku, copies: 1, sizing: 'fitPrintArea', attributes: p.attributes, assets: [{ printArea: 'default', url }] } as any],
      } as any)
      made.push(res.order.id)
      let last: any = res.order
      for (let k = 0; k < 12; k++) { await new Promise(r => setTimeout(r, 4000)); last = (await getOrder(res.order.id)).order; if (last.status.details.printReadyAssetsPrepared !== 'NotStarted' && last.status.details.downloadAssets !== 'InProgress') break }
      console.log(JSON.stringify({ probe: pr.id, note: pr.note, sent: `${pr.w}x${pr.h}`, outcome: res.outcome, stage: last.status.stage, details: last.status.details, issues: last.status.issues, itemStatus: last.items?.map((x: any) => ({ status: x.status, sizing: x.sizing, assets: x.assets })) }))
    } catch (e: any) { console.log(JSON.stringify({ probe: pr.id, note: pr.note, error: String(e?.message ?? e).slice(0, 300), body: e?.body ? JSON.stringify(e.body).slice(0, 600) : undefined })) }
  }
  for (const id of made) { try { console.log('cancel', id, JSON.stringify(await cancelOrder(id))) } catch (e: any) { console.log('cancel', id, 'not cancelled:', String(e?.message ?? e).slice(0, 120)) } }
  if (files.length) await db.storage.from('previews').remove(files)
  console.log('temporary files removed', files.length)
}
main().catch(e => { console.error('asset-check failed:', e instanceof Error ? e.message : e); process.exit(1) })
