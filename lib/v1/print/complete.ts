// lib/v1/print/complete.ts
//
// Places a paid order with Prodigi once every one of its pictures is approved. Called by the asset poller
// (a few minutes after payment) and by the admin approval action (the moment a person approves).
//
// It re-checks everything the Stripe webhook checked at payment time, because hours or days may have passed:
// the order must still be waiting, the account still cleared, and no refund recorded. Sandbox orders
// (their jobs read the owned original, which only the sandbox flow does) additionally re-run the existing
// Stripe verification (retry.ts) and the sandbox-only guard.
// Placement itself is prepareAndPlacePrint(), unchanged: same idempotency key, same items.
//
// ACTIVATION GATE: nothing here does anything unless the pipeline is active (pipeline.ts). It also RESUMES orders
// that were paid while the pipeline was off: those were held with a 'print_pipeline_' note, and are queued here,
// after the same account and refund checks, once the pipeline is switched on.

import { supabaseAdmin as db } from '@/lib/supabase'
import { canFulfil, getPrintOrderById, markError, markPlaced } from './db'
import { prepareAndPlacePrint, PlacementUncertainError } from './fulfillment'
import { AssetsNotReadyError, enqueueOrderJobs } from './upscale/orders'
import { assetRuntime } from './upscale/runtime'
import { isPipelineHold, pipelineState, sourceOfHold } from './upscale/pipeline'
import { requireSandboxPrint } from './owned-source'
import { verifyRetryPayment } from './retry'

export type CompleteResult =
  | { status: 'placed'; prodigiOrderId: string }
  | { status: 'pending' | 'blocked' | 'skipped'; reason: string }

/** An order waiting on its pictures: paid, held by the pipeline gate, or held or errored by an asset. */
function waitingForAssets(order: { status: string; error_message: string | null }): boolean {
  if (order.status === 'paid') return true
  if (order.status === 'withheld') return (order.error_message ?? '').startsWith('asset_review') || isPipelineHold(order.error_message)
  if (order.status === 'error') return (order.error_message ?? '').startsWith('asset_failed')
  return false
}

const RECHECK_REFUSALS = /^(order_no_longer_eligible|fulfilment_not_cleared|order_refunded|refund_check_unavailable)$/

/** Throws one of the RECHECK_REFUSALS. Shared by queuing and placing so a refunded or uncleared order never costs money. */
async function recheck(orderId: string, ownerKey: string | null) {
  if (!(await canFulfil(ownerKey))) throw new Error('fulfilment_not_cleared')
  const refunded = await db.from('print_order_notifications').select('id').eq('order_id', orderId).eq('kind', 'refunded').limit(1)
  if (refunded.error) throw new Error('refund_check_unavailable')
  if (refunded.data?.length) throw new Error('order_refunded')
}

export async function completePrintOrder(orderId: string): Promise<CompleteResult> {
  // The flag decides only whether work starts. With it off this returns before reading anything.
  const gate = await pipelineState()
  if (!gate.active) return { status: 'skipped', reason: `pipeline_${gate.reason}` }

  const order = await getPrintOrderById(orderId)
  if (!order) return { status: 'skipped', reason: 'order_missing' }
  if (order.prodigi_order_id || order.placed_at) return { status: 'skipped', reason: 'already_placed' }
  if (!waitingForAssets(order)) return { status: 'skipped', reason: `status_${order.status}` }

  const rt = assetRuntime()
  const jobs = await rt.store.listForOrder(order.id)
  if (!jobs.length) {
    // Paid while the pipeline was off (or not ready): queue it now, after the same checks, never twice (enqueue is idempotent).
    if (!isPipelineHold(order.error_message)) return { status: 'skipped', reason: 'no_jobs' }
    try { await recheck(order.id, order.owner_key) } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return RECHECK_REFUSALS.test(msg) ? { status: 'blocked', reason: msg } : { status: 'blocked', reason: 'recheck_failed' }
    }
    await enqueueOrderJobs(rt.store, order, sourceOfHold(order.error_message) === 'owned')
    return { status: 'pending', reason: 'queued_after_activation' }
  }
  const sandbox = jobs.some(j => j.source_kind === 'owned')

  let prodigiOrderId: string
  try {
    prodigiOrderId = await prepareAndPlacePrint(order, sandbox, async () => {
      const current = await getPrintOrderById(orderId)
      if (!current || current.prodigi_order_id || current.placed_at || !waitingForAssets(current)) throw new Error('order_no_longer_eligible')
      await recheck(orderId, current.owner_key)
      if (sandbox) { requireSandboxPrint(); await verifyRetryPayment(current) }
    })
  } catch (err) {
    if (err instanceof AssetsNotReadyError) return { status: err.state === 'pending' ? 'pending' : 'blocked', reason: err.message }
    const msg = err instanceof Error ? err.message : String(err)
    // Not started because the pipeline is not active (it was switched off between the check above and now): leave everything as it is.
    if (msg.startsWith('print_pipeline_inactive')) return { status: 'skipped', reason: msg }
    // A refusal from the re-checks is the guard working: leave the order exactly as it is.
    if (RECHECK_REFUSALS.test(msg)) return { status: 'blocked', reason: msg }
    await markError(order.stripe_session_id, err instanceof PlacementUncertainError ? `placement_uncertain: ${msg}` : msg).catch(() => {})
    return { status: 'blocked', reason: msg }
  }
  await markPlaced({ sessionId: order.stripe_session_id, prodigiOrderId, wholesaleCents: null })
  return { status: 'placed', prodigiOrderId }
}
