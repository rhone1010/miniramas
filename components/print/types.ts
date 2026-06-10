// components/print/types.ts
//
// Shared types across the print purchase UI.

import type { PrintSize, PrintFinish } from '@/lib/v1/print/sku-map'

export type { PrintSize, PrintFinish }

/** A render the customer is buying a print of. */
export interface PrintSheetRender {
  id:    string   // stable renderId — used as storage key
  url:   string   // publicly fetchable URL (Supabase signed/public)
  title: string   // display label, e.g. "Bronze · Pedestal"
  style: string   // atmosphere, e.g. "Golden Hour"
}

export interface ShippingAddress {
  name:        string
  line1:       string
  line2:       string
  city:        string
  state:       string
  postcode:    string
  countryCode: string
}

/** Response from POST /api/v1/print/quote */
export interface QuoteResponse {
  retailSubtotalCents: number
  retailShippingCents: number
  retailTotalCents:    number
  currency:            string
  carrier:             string
  fulfillmentLab:      string
}

/** Size + finish option, surfaced by SizePicker. */
export interface SizeOption {
  size:        PrintSize
  finish:      PrintFinish
  label:       string         // "8×10" — display
  description: string         // "Enhanced Matte Art, 200gsm"
  retailUsd:   number         // 28.00
}

/** Status values mirrored from lib/v1/print/db.ts */
export type PrintOrderStatus =
  | 'created'
  | 'paid'
  | 'placed'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'error'

/** Single line item in a placed order. */
export interface PrintOrderItem {
  renderId:    string
  renderUrl:   string
  size:        PrintSize
  finish:      PrintFinish
  copies:      number
  retailCents: number
}

/** Summary used by PrintOrderCard. */
export interface PrintOrderSummary {
  id:                string
  status:            PrintOrderStatus
  items:             PrintOrderItem[]
  shippingAddress:   ShippingAddress
  shippingCarrier:   string | null
  trackingNumber:    string | null
  trackingUrl:       string | null
  retailTotalCents:  number
  createdAt:         string
  paidAt:            string | null
  placedAt:          string | null
  shippedAt:         string | null
  deliveredAt:       string | null
}
