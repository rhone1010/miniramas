// lib/v1/print/upscale/orders.ts
//
// Order-level view of upscale jobs: create them for an order, and say whether the order may go to Prodigi.
// No database client, provider or storage is imported here; the store is passed in.

import { getSku } from '../sku-map'
import type { PrintOrderRow } from '../db'
import { isGiftOrder } from '../../gift/order-kind'
import { isWorking, type AssetJob, type JobStore } from './store'

export type OrderAssetState = 'approved' | 'pending' | 'review' | 'rejected' | 'failed'

export interface OrderAssetSummary { state: OrderAssetState; detail: string }

/** Thrown when an order is asked to go to Prodigi before every picture is approved. Never an error to retry blindly. */
export class AssetsNotReadyError extends Error {
  constructor(public state: Exclude<OrderAssetState, 'approved'>, public detail: string) { super(`asset_not_ready:${state}:${detail}`) }
}

/** Idempotent. The same order enqueued twice yields the same jobs, so a retried webhook cannot double the work. */
export async function enqueueOrderJobs(store: JobStore, order: PrintOrderRow, squareTest: boolean): Promise<AssetJob[]> {
  // A Gift Wizard order whose artwork is not yet approved has no picture to prepare: nothing may be queued, whoever asks.
  if (order.status === 'awaiting_artwork') throw new Error('order_awaiting_artwork')
  const kind = isGiftOrder(order) ? 'gift' : squareTest ? 'owned' : 'url'
  const jobs: AssetJob[] = []
  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i]
    jobs.push(await store.enqueue({
      order_id: order.id, item_index: i, render_id: item.renderId, sku: getSku(item.size, item.finish).sku,
      size: item.size, finish: item.finish, source_kind: kind,
    }))
  }
  return jobs
}

/**
 * Whether an order may be placed. Worst news first: one failed or rejected line holds the whole order,
 * because Prodigi takes the order as a unit and a half-printed order is worse than a late one.
 */
export function summarizeJobs(jobs: AssetJob[], expected: number): OrderAssetSummary {
  const present = new Set(jobs.map(j => j.item_index))
  if (jobs.length < expected || [...Array(expected).keys()].some(i => !present.has(i))) return { state: 'pending', detail: 'jobs_missing' }
  const by = (s: AssetJob['status']) => jobs.filter(j => j.status === s)
  if (by('failed').length) return { state: 'failed', detail: by('failed').map(j => `${j.item_index}:${j.error ?? 'failed'}`).join(';') }
  if (by('rejected').length) return { state: 'rejected', detail: by('rejected').map(j => String(j.item_index)).join(',') }
  if (by('review').length) return { state: 'review', detail: by('review').map(j => `${j.item_index}:${j.review_reason ?? 'review'}`).join(';') }
  if (jobs.some(j => isWorking(j.status))) return { state: 'pending', detail: 'in_progress' }
  return { state: 'approved', detail: `${jobs.length} approved` }
}
