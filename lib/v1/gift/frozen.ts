// lib/v1/gift/frozen.ts
//
// THE PURCHASED GEOMETRY, FROZEN. When a customer pays, the product they bought is the product as the canonical catalog described it
// AT CHECKOUT: its SKU, picture and final pixels, wrap, orientation, fixed attributes and catalog version. That description is copied
// into the order item (print_orders.items[i].frozen, a jsonb field the order already has, so no migration) and every later step
// (composition planning, the geometry the page shows, the product mockup) reads it from there. A catalog change after purchase can
// therefore never silently reinterpret what was bought.
//
// ORDERS CREATED BEFORE THIS EXISTED have no snapshot. For those, and only those, the product is resolved from today's catalog BUT only
// when today's catalog still sells that exact SKU under that product id; the result is labelled 'legacy_catalog' so the page and the
// handoff can tell. If the SKU no longer matches, nothing is guessed: the line is refused (geometry_snapshot_unavailable) and the
// order goes to Concierge. A snapshot that is present but does not match the order line (a different SKU or product) is refused too
// (geometry_snapshot_invalid), because that means the record was altered or corrupted.
//
// Pure functions, no I/O, so Codex can copy this file and tests run without a database.

import { allProducts, catalogVersion, type CanonicalProduct } from '../print/catalog'
import type { OrderLineRec, SessionRec } from './store'

export const FROZEN_SNAPSHOT_VERSION = 1

/** The customer-reviewed composition a line was sold with (recorded at checkout when compositions are reviewed before payment). Audit and identity: after a repair the live composition may be a successor. */
export interface CompositionPin { compositionId: string; previewId: string; attempt: number; repairSeq: number; artworkSha256: string | null; width: number | null; height: number | null; sku: string | null; approvedAt: string | null }

export interface FrozenLine {
  /** Present only on orders sold after compositions were reviewed before payment. */
  composition?: CompositionPin
  snapshotVersion: typeof FROZEN_SNAPSHOT_VERSION
  /** ISO time the snapshot was taken (checkout). */
  frozenAt: string
  /** catalogVersion() when it was taken. */
  catalogVersion: string
  /** The whole canonical product as sold: productId, sku, kind, family, size, attributes, requirements (picture/final px, wrap, orientation, aspect...). */
  product: CanonicalProduct
}

export function freezeLine(product: CanonicalProduct, nowMs: number, version: string = catalogVersion()): FrozenLine {
  return { snapshotVersion: FROZEN_SNAPSHOT_VERSION, frozenAt: new Date(nowMs).toISOString(), catalogVersion: version, product: structuredClone(product) }
}

/**
 * Whether a composed file has the shape of the PURCHASED product (its frozen final or picture area, within the 2% the lab accepts without
 * extension). Orientation is part of that: a landscape file never stands in for a portrait product. Unknown dimensions are not a mismatch
 * (older rows); a known wrong shape is.
 */
export function compositionFitsProduct(c: { width: number | null; height: number | null; plan?: Record<string, unknown> }, product: CanonicalProduct): boolean {
  const recorded = c.plan?.sku                                  // a composition made for another SKU (the line's product changed) is not this product's, even at the same shape
  if (typeof recorded === 'string' && recorded !== product.sku) return false
  if (!c.width || !c.height) return true
  const a = c.width / c.height, { finalPx, picturePx } = product.requirements
  return [finalPx, picturePx].some(t => Math.abs(a / (t.w / t.h) - 1) <= 0.02)
}

/** The session's chosen lines as order-line records, before any order exists (a DRAFT): the same line ids the paid order will carry. */
export function draftOrderLines(rec: Pick<SessionRec, 'id' | 'order_id' | 'lines'>, catalog: CanonicalProduct[] = allProducts()): OrderLineRec[] {
  return rec.lines.flatMap((l, i) => {
    const p = catalog.find(x => x.productId === l.productId && x.status === 'launch')
    return p ? [{ order_id: rec.order_id ?? '', line_index: i, session_id: rec.id, line_id: l.lineId, product_id: p.productId, sku: p.sku, copies: l.copies, corrections_used: 0 }] : []
  })
}

export type GeometrySource = 'frozen' | 'legacy_catalog'
export type ResolvedProduct =
  | { ok: true; source: GeometrySource; product: CanonicalProduct; catalogVersion: string | null; frozenAt: string | null }
  | { ok: false; reason: 'geometry_snapshot_invalid' | 'geometry_snapshot_unavailable' }

interface ItemLike { sku: string; frozen?: unknown }
interface LineLike { product_id: string; sku: string; line_index: number }

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
const px = (v: any) => !!v && num(v.w) && num(v.h)

/** A snapshot is trusted only when it is the right version and agrees with the order line on product id and SKU, and its geometry is complete. */
function valid(f: any, item: ItemLike, line: LineLike): f is FrozenLine {
  const p = f?.product
  return !!f && f.snapshotVersion === FROZEN_SNAPSHOT_VERSION && !!p && p.productId === line.product_id && p.sku === item.sku && item.sku === line.sku &&
    typeof f.catalogVersion === 'string' && !!p.requirements && px(p.requirements.finalPx) && px(p.requirements.picturePx) && num(p.requirements.pictureAspect) && !!p.requirements.wrapPx
}

/** What this purchased line is. `items` is the order's print items (index = the line's line_index). */
export function resolveFrozenProduct(items: ItemLike[], line: LineLike, catalog: CanonicalProduct[] = allProducts()): ResolvedProduct {
  const item = items[line.line_index]
  if (!item) return { ok: false, reason: 'geometry_snapshot_unavailable' }
  if (item.frozen !== undefined && item.frozen !== null) {
    return valid(item.frozen, item, line) ? { ok: true, source: 'frozen', product: item.frozen.product, catalogVersion: item.frozen.catalogVersion, frozenAt: item.frozen.frozenAt } : { ok: false, reason: 'geometry_snapshot_invalid' }
  }
  const current = catalog.find(p => p.productId === line.product_id && p.sku === line.sku && p.sku === item.sku)
  return current ? { ok: true, source: 'legacy_catalog', product: current, catalogVersion: null, frozenAt: null } : { ok: false, reason: 'geometry_snapshot_unavailable' }
}
