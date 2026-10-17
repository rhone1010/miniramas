// lib/v1/gift/order-kind.ts
//
// How the Print Shop recognises a Gift Wizard order, with no imports so the print modules can use it freely.
// A gift order's item renderIds are `gift:{sessionId}:{lineId}`: the picture does not exist when the order is placed, so
// there is no renderUrl; the print job reads the customer's APPROVED composition for that line instead.

export const GIFT_RENDER_PREFIX = 'gift:'

/** Stripe metadata.kind of a Gift Wizard product order. */
export const GIFT_ORDER_KIND = 'gift_order'

export const giftRenderId = (sessionId: string, lineId: string) => `${GIFT_RENDER_PREFIX}${sessionId}:${lineId}`

export function parseGiftRenderId(renderId: string): { sessionId: string; lineId: string } | null {
  const m = /^gift:([0-9a-f-]{36}):([\w-]{1,40})$/i.exec(renderId)
  return m ? { sessionId: m[1], lineId: m[2] } : null
}

export const isGiftOrder = (order: { items?: Array<{ renderId: string }> }): boolean =>
  (order.items?.length ?? 0) > 0 && order.items!.every(i => i.renderId.startsWith(GIFT_RENDER_PREFIX))
