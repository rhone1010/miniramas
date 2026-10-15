import {createOrder as createProdigiOrder} from './prodigi-client'
import {getSku} from './sku-map'
import type {PrintOrderRow} from './db'
import {assetRuntime} from './upscale/runtime'
import {AssetsNotReadyError,enqueueOrderJobs,summarizeJobs} from './upscale/orders'
import {sha256} from './upscale/checks'
import {PipelineInactiveError,pipelineState} from './upscale/pipeline'
export class PlacementUncertainError extends Error {}
export {AssetsNotReadyError,PipelineInactiveError}

const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60   // Prodigi fetches within minutes; matches the previous asset URLs

/**
 * Shared placement path; the caller persists the result.
 *
 * THE PICTURES ARE NO LONGER MADE HERE. Upscaling, inspection and any human review happen in the queued,
 * resumable jobs (./upscale/process.ts), outside the Stripe request. This function:
 *   1. makes sure every order line has a job (idempotent),
 *   2. refuses unless EVERY job is approved (AssetsNotReadyError otherwise),
 *   3. re-reads each approved file and checks its hash against the job record before trusting it,
 *   4. only then places the Prodigi order, with the same idempotency key and items as before.
 * Nothing unapproved can reach Prodigi from here.
 */
export async function prepareAndPlacePrint(order:PrintOrderRow,squareTest:boolean,beforePlacement?:()=>Promise<void>):Promise<string>{
  const prodigiItems: Array<{
    sku:    string
    copies: number
    attributes?: Record<string,string>
    sizing: 'fillPrintArea' | 'fitPrintArea' | 'stretchToPrintArea'
    assets: Array<{ printArea: string; url: string }>
  }> = []

  // Nothing starts, not even creating jobs, while the pipeline is off or not ready (retry and approval paths come here too).
  const gate = await pipelineState()
  if (!gate.active) throw new PipelineInactiveError(gate)
  const rt = assetRuntime()
  const jobs = await enqueueOrderJobs(rt.store, order, squareTest)
  const summary = summarizeJobs(jobs, order.items.length)
  if (summary.state !== 'approved') throw new AssetsNotReadyError(summary.state, summary.detail)

  try {
    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i], job = jobs[i]
      console.log(`[print-fulfil] approved asset for renderId=${item.renderId} size=${item.size} job=${job.id}`)
      if (!job.final_path || !job.final_sha256) throw new Error('approved_job_without_file')
      const bytes = await rt.storage.get(job.final_path)
      if (sha256(bytes) !== job.final_sha256) throw new Error('asset_hash_mismatch')
      const signedUrl = await rt.storage.signedUrl(job.final_path, SIGNED_URL_SECONDS)

      const skuEntry = getSku(item.size, item.finish)
      prodigiItems.push({
        sku:    skuEntry.sku,
        copies: item.copies,
        attributes:skuEntry.attributes,
        sizing: skuEntry.defaultSizing,
        assets: [{ printArea: 'default', url: signedUrl }],
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[print-fulfil] asset verification failed:', msg)
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
