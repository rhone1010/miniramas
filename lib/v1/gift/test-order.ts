// Test helper only: the order items and lines a paid Gift order really has (real catalog SKUs, and by default the frozen snapshot
// checkout writes), so fixtures do not need a fake SKU the frozen-geometry resolver would rightly refuse.
import { getProduct } from '../print/catalog'
import { freezeLine } from './frozen'

type L = { lineId: string; productId: string; copies: number }
export function purchasedItems(lines: L[], opts: { snapshot?: boolean; catalogVersion?: string } = {}) {
  return lines.map(l => {
    const p = getProduct(l.productId)!
    return { renderId: `gift:${l.lineId}`, size: p.size, finish: p.family as string, copies: l.copies, sku: p.sku, retailCents: p.retailCents ?? 1000,
      ...(opts.snapshot === false ? {} : { frozen: freezeLine(p, 0, opts.catalogVersion ?? 'test-catalog') }) }
  })
}
export const purchasedLines = (lines: L[]) => lines.map(l => ({ lineId: l.lineId, productId: l.productId, sku: getProduct(l.productId)!.sku, copies: l.copies }))
