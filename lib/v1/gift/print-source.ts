// lib/v1/gift/print-source.ts
//
// The print job source for a Gift Wizard order: the customer's APPROVED composition for that order line.
// The job never reads a client URL and never the raw master: only a composition the customer approved, for the artwork they
// selected, on an order that has been approved and not refunded. (The composition already has the product's aspect, so the
// existing print composition step adds nothing; upscaling, QA and placement then run exactly as for any order.)

import { createHash } from 'node:crypto'
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
  if (comp.generation_id) {
    // An accepted generation prints as exactly the picture the customer approved: the stored file must still hash to the generation's sha256 and to the pin recorded at checkout. The file is then
    // used as is (it already has the product's exact shape, so print preparation adds nothing to it and only the upscale follows).
    const gen = await store.getGeneration(session.id, comp.generation_id)
    const pinned = (comp.plan as { artworkSha256?: string }).artworkSha256
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (!gen || gen.status !== 'ready' || !gen.accepted_at || !gen.sha256 || digest !== gen.sha256 || digest !== pinned) throw new Error('gift_generation_changed')
    const orderRow = await store.getOrder(order.id)
    const pin = (orderRow?.items[job.item_index]?.frozen as { composition?: { artworkSha256?: string | null } } | undefined)?.composition
    if (pin?.artworkSha256 && pin.artworkSha256 !== digest) throw new Error('gift_generation_changed')
  }
  return bytes
}

export async function loadApprovedComposition(order: Pick<PrintOrderRow, 'id'>, job: Pick<AssetJob, 'render_id' | 'item_index'>): Promise<Buffer> {
  const [{ supabaseAdmin }, { supabaseGiftStore }, { supabaseGiftStorage }] = await Promise.all([import('@/lib/supabase'), import('./store'), import('./real')])
  return loadApprovedCompositionWith(supabaseGiftStore(supabaseAdmin), supabaseGiftStorage(supabaseAdmin), order, job)
}
