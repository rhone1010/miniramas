import {preparePrintAsset} from './asset-pipeline'
import {createOrder as createProdigiOrder} from './prodigi-client'
import {ownedPrintSource} from './owned-source'
import {getSku} from './sku-map'
import type {PrintOrderRow} from './db'
export class PlacementUncertainError extends Error {}
/** Shared preparation and placement path; caller persists the result. */
export async function prepareAndPlacePrint(order:PrintOrderRow,squareTest:boolean,beforePlacement?:()=>Promise<void>):Promise<string>{
  // ── Asset pipeline per item ────────────────────────────────
  const prodigiItems: Array<{
    sku:    string
    copies: number
    attributes?: Record<string,string>
    sizing: 'fillPrintArea' | 'fitPrintArea' | 'stretchToPrintArea'
    assets: Array<{ printArea: string; url: string }>
  }> = []

  try {
    for (const item of order.items) {
      console.log(`[print-webhook] preparing asset for renderId=${item.renderId} size=${item.size}`)
      // 1. Fetch source render
      let sourceB64: string
      if (squareTest) {
        const source = await ownedPrintSource(order.owner_key!, item.renderId)
        sourceB64 = source.bytes.toString('base64')
      } else {
        const res = await fetch(item.renderUrl)
        if (!res.ok) throw new Error('fetch render failed: ' + res.status)
        sourceB64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      }

      // 2. Upscale + upload + signed URL
      const asset = await preparePrintAsset({
        imageB64: sourceB64,
        renderId: item.renderId,
        size:     item.size,
        finish:   item.finish,
      })

      const skuEntry = getSku(item.size, item.finish)
      prodigiItems.push({
        sku:    skuEntry.sku,
        copies: item.copies,
        attributes:skuEntry.attributes,
        sizing: skuEntry.defaultSizing,
        assets: [{ printArea: 'default', url: asset.signedUrl }],
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[print-webhook] asset pipeline failed:', msg)
    throw new Error(`asset_pipeline: ${msg}`)
  }

  // ── Place Prodigi order ────────────────────────────────────
  if(beforePlacement)await beforePlacement()
  try {
    const prodigiRes = await createProdigiOrder({
      shippingMethod:    order.shipping_method as 'Budget' | 'Standard' | 'Express' | 'Overnight',
      idempotencyKey:    order.stripe_session_id,                      // dedupe duplicate webhook firings
      merchantReference: order.prodigi_merchant_ref || order.stripe_session_id,
      recipient: {
        name:  order.shipping_address.name,
        email: order.customer_email,
        address: {
          line1:           order.shipping_address.line1,
          line2:           order.shipping_address.line2,
          postalOrZipCode: order.shipping_address.postcode,
          countryCode:     order.shipping_address.countryCode.toUpperCase(),
          townOrCity:      order.shipping_address.city,
          stateOrCounty:   order.shipping_address.state,
        },
      },
      items: prodigiItems,
    })

    return prodigiRes.order.id
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[print-webhook] Prodigi order placement failed:', msg)
    throw new PlacementUncertainError(`prodigi: ${msg}`)
  }
}
