// lib/v1/print/upscale/runtime.ts
//
// Production wiring: the real Supabase store and storage, the real source loader, settings, providers
// and inspection, and the notification that routes a job needing a person into the existing Concierge
// record (support_messages) and the existing print-order notices (order-email.ts via markWithheld/markError).
//
// Server-only. Nothing here is imported by a browser bundle. Tests of the processor never import this file.

import { supabaseAdmin } from '@/lib/supabase'
import { getPrintOrderById, markError, markWithheld, type PrintOrderRow } from '../db'
import { ownedPrintSource } from '../owned-source'
import { loadSettings } from './settings'
import { makeProvider } from './providers'
import { inspectUpscale } from './qa'
import { supabaseJobStore, supabaseStorage, type AssetJob, type AssetStorage, type JobStore } from './store'
import type { ProcessDeps } from './process'

export interface AssetRuntime { store: JobStore; storage: AssetStorage }

let cached: AssetRuntime | null = null
export function assetRuntime(): AssetRuntime {
  return (cached ??= { store: supabaseJobStore(supabaseAdmin), storage: supabaseStorage(supabaseAdmin) })
}

/** Order text a person can act on, in the order's own words. */
const reasonText = (reason: string) => reason.split(',').map(r => ({
  qa_uncertain: 'the visual inspection could not confirm the enlargement matches the artwork',
  qa_defect: 'the visual inspection found a defect in the enlargement',
  qa_unavailable: 'the visual inspection could not run',
  qa_disabled: 'automatic inspection is switched off',
  source_quality_below_floor: 'the artwork has low native detail for this print size (informational only)',
  human_approval_required: 'every job is set to wait for a person',
  possible_duplicate_charge: 'a provider call may have been charged twice',
  submit_state_unresolved: 'it could not be confirmed whether the upscale was already requested',
} as Record<string, string>)[r.split(':')[0]] ?? r).join('; ')

/**
 * A job needs a person. Two records, both existing mechanisms:
 *  - support_messages row (the Concierge record), id = job id so a repeat is a no-op;
 *  - the order moves to 'withheld' (review) or 'error' (failed), which sends the existing studio and customer notices.
 * The customer's artwork is never regenerated and nothing is refunded here.
 */
export async function notifyAttention(job: AssetJob): Promise<void> {
  const order = await getPrintOrderById(job.order_id)
  if (!order) return
  const why = job.status === 'failed' ? (job.error ?? 'failed') : (job.review_reason ?? 'review')
  const ref = order.prodigi_merchant_ref || order.id
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const row = await supabaseAdmin.from('support_messages').insert({
    id: job.id,
    user_id: order.owner_key && uuid.test(order.owner_key) ? order.owner_key : null,
    reply_to: order.customer_email,
    subject: `Print artwork needs review: order ${ref}`,
    body: job.status === 'failed'
      ? `Preparing print file ${job.item_index + 1} of order ${ref} failed (${why}). Nothing was sent to the print lab. The studio will resolve it.`
      : `Print file ${job.item_index + 1} of order ${ref} is waiting for a person: ${reasonText(why)}. Nothing has been sent to the print lab.`,
    context: { kind: 'print_asset_review', order_id: order.id, job_id: job.id, item_index: job.item_index, sku: job.sku, status: job.status, reasons: why, warnings: job.warnings },
  })
  if (row.error && row.error.code !== '23505') console.error('[print-assets] concierge record failed:', row.error.message)
  if (['paid', 'withheld'].includes(order.status) || (order.status === 'error' && job.status === 'failed')) {
    if (job.status === 'failed') await markError(order.stripe_session_id, `asset_failed:${why}`).catch(() => {})
    else await markWithheld(order.stripe_session_id, `asset_review:${why}`).catch(() => {})
  }
}

export function productionDeps(orderCache = new Map<string, PrintOrderRow | null>()): ProcessDeps {
  const rt = assetRuntime()
  const orderOf = async (id: string) => {
    if (!orderCache.has(id)) orderCache.set(id, await getPrintOrderById(id))
    return orderCache.get(id) ?? null
  }
  return {
    store: rt.store,
    storage: rt.storage,
    async loadSource(job) {
      const order = await orderOf(job.order_id)
      if (!order) throw new Error('order_missing')
      if (job.source_kind === 'owned') return (await ownedPrintSource(order.owner_key!, job.render_id)).bytes
      if (job.source_kind === 'gift') return (await import('../../gift/print-source')).loadApprovedComposition(order, job)
      const item = order.items[job.item_index]
      const res = await fetch(item.renderUrl)
      if (!res.ok) throw new Error('fetch render failed: ' + res.status)
      return Buffer.from(await res.arrayBuffer())
    },
    layoutOf: async job => job.source_kind === 'gift' ? (await import('../../gift/print-source')).approvedLayout(await orderOf(job.order_id) ?? { id: job.order_id }, job) : null,
    loadSettings: job => loadSettings({ from: (t: string) => supabaseAdmin.from(t) as any }, job.sku, job.finish),
    provider: name => makeProvider(name),
    inspect: input => inspectUpscale(input),
    context: inspectionContext,
    onAttention: notifyAttention,
  }
}

/** Best-effort context for the inspector: which series and effect this artwork is. Never blocks a job. */
export async function inspectionContext(job: AssetJob): Promise<{ series?: string; effect?: string }> {
  try {
    const { data } = await supabaseAdmin.from('preview_ledger').select('series,preset').eq('id', job.render_id).maybeSingle()
    return { series: data?.series ?? undefined, effect: data?.preset ?? undefined }
  } catch { return {} }
}
