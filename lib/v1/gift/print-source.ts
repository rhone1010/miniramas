// lib/v1/gift/print-source.ts
//
// The print job source for a Gift Wizard order: the customer's APPROVED composition for that order line.
// The job never reads a client URL and never the raw master: only a composition the customer approved, for the artwork they
// selected, on an order that has been approved and not refunded. (The composition already has the product's aspect, so the
// existing print composition step adds nothing; upscaling, QA and placement then run exactly as for any order.)

import type { PrintOrderRow } from '../print/db'
import type { AssetJob } from '../print/upscale/store'
import { parseGiftRenderId } from './order-kind'
import type { GiftStorage } from './service'
import type { GiftStore } from './store'

export async function loadApprovedCompositionWith(store: GiftStore, storage: GiftStorage, order: Pick<PrintOrderRow, 'id'>, job: Pick<AssetJob, 'render_id' | 'item_index'>): Promise<Buffer> {
  const parsed = parseGiftRenderId(job.render_id)
  if (!parsed) throw new Error('gift_render_id_invalid')
  const session = await store.sessionForOrder(order.id)
  if (!session || session.id !== parsed.sessionId) throw new Error('gift_session_mismatch')
  if (session.refunded_at || session.refund_requested_at) throw new Error('gift_order_not_releasable')
  if (!session.approved_at || !session.artwork_preview_id) throw new Error('gift_artwork_not_approved')
  const line = (await store.orderLines(order.id)).find(l => l.line_index === job.item_index)
  if (!line || line.line_id !== parsed.lineId) throw new Error('gift_line_mismatch')
  const comp = (await store.listCompositions(session.id)).find(c => c.line_id === line.line_id && c.preview_id === session.artwork_preview_id && c.status === 'approved')
  if (!comp?.composed_path) throw new Error('gift_composition_not_approved')
  const bytes = await storage.get(comp.composed_path)
  if (!bytes) throw new Error('gift_composition_missing')
  return bytes
}

export async function loadApprovedComposition(order: Pick<PrintOrderRow, 'id'>, job: Pick<AssetJob, 'render_id' | 'item_index'>): Promise<Buffer> {
  const [{ supabaseAdmin }, { supabaseGiftStore }, { supabaseGiftStorage }] = await Promise.all([import('@/lib/supabase'), import('./store'), import('./real')])
  return loadApprovedCompositionWith(supabaseGiftStore(supabaseAdmin), supabaseGiftStorage(supabaseAdmin), order, job)
}
