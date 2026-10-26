// lib/v1/gift/scope.ts
//
// WHICH PRODUCTS A COMPOSITION IS FOR, before and after payment. Composing before payment is an OPTIONAL capability (deps.draftCompositions, env GIFT_COMPOSITIONS_BEFORE_PAYMENT=1), off in the approved journey (checkout, then compose). With it on, a
// composition exists while the session only has its chosen lines (a DRAFT: geometry from today's catalog, nothing frozen yet) and continues,
// with the same composition rows and the same line ids, after payment (PURCHASED: geometry from the snapshot frozen at checkout). Checkout checks the
// reviewed compositions against the product it is about to freeze and records them on the order (orders.ts), so the customer pays for exactly
// what they reviewed.
//
//   draft       no order, or an order still unpaid ('created'). Lines come from the session; products from the catalog.
//   purchased   the order is paid. Lines come from gift_order_lines; products from the frozen snapshot (frozen.ts).
//
// Nothing here releases anything to manufacturing: that still needs a paid order, every line approved, and the explicit order approval.

import { allProducts, type CanonicalProduct } from '../print/catalog'
import { resolveFrozenProduct, draftOrderLines } from './frozen'
import { GiftError, type GiftDeps } from './service'
import type { OrderInfo, OrderLineRec, SessionRec } from './store'

export type Phase = 'draft' | 'purchased'
export interface LineScope { line: OrderLineRec; product: CanonicalProduct; source: 'catalog' | 'frozen' | 'legacy_catalog'; catalogVersion: string | null }
export interface Scope { phase: Phase; order: OrderInfo | null; lines: LineScope[]; /** The customer's final approval is recorded: composition work is closed even though the order still awaits release (056). */ finalized?: boolean }

export async function scopeOf(deps: GiftDeps, rec: SessionRec): Promise<Scope> {
  const order = rec.order_id ? await deps.store.getOrder(rec.order_id) : null
  if (!order || order.status === 'created') {
    // The approved journey composes AFTER the Stripe test checkout. Composing before payment (a draft) exists but is OFF unless deps.draftCompositions is set,
    // so an unpaid customer can neither spend generation nor see a composition: the original rules apply. A Collection (owned artwork) session is always reviewed before payment, whatever the flag.
    if (!deps.draftCompositions && !rec.collection_preview_id) throw new GiftError(order ? 'order_not_paid' : 'order_payment_required')
    const catalog = allProducts()
    return { phase: 'draft', order, lines: draftOrderLines(rec, catalog).map(line => ({ line, product: catalog.find(p => p.productId === line.product_id)!, source: 'catalog' as const, catalogVersion: null })) }
  }
  const lines: LineScope[] = []
  for (const line of await deps.store.orderLines(order.id)) {
    const r = resolveFrozenProduct(order.items, line)
    if (!r.ok) throw new GiftError(r.reason)
    lines.push({ line, product: r.product, source: r.source, catalogVersion: r.catalogVersion })
  }
  return { phase: 'purchased', order, lines, finalized: !!(rec.final_approved_at ?? rec.approved_at) }
}

/** Composition work is open for a draft and for a paid order that still awaits artwork approval; never after approval or release. */
export function requireOpen(scope: Scope): void {
  if (scope.phase === 'purchased' && (scope.order!.status !== 'awaiting_artwork' || scope.finalized)) throw new GiftError('order_not_awaiting_artwork')
}
