// lib/v1/print/db.ts
//
// DB helpers for the `print_orders` table.
//
// All server-side; uses the service-role Supabase client so RLS is bypassed
// (we trust webhook/server context here, not browser-facing).
//
// The order row's lifecycle, in normal happy path:
//   create()       → status='created'   (checkout endpoint)
//   markPaid()     → status='paid'      (Stripe webhook, after signature verify)
//   markPlaced()   → status='placed'    (Stripe webhook, after Prodigi /Orders OK)
//   updateShipping(status='shipped')    (Prodigi callback or status poll)
//   updateShipping(status='delivered')  (Prodigi callback or status poll)
//
// Failure path:
//   markError(msg) → status='error'     (asset pipeline or Prodigi rejection)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PrintSize, PrintFinish } from './sku-map'

export type PrintOrderStatus =
  | 'created'
  | 'paid'
  | 'placed'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'error'

export interface PrintOrderItem {
  renderId:    string         // stable id for grouping; used as storage key prefix
  renderUrl:   string         // publicly fetchable source URL (we fetch this in the webhook)
  size:        PrintSize
  finish:      PrintFinish
  copies:      number
  sku:         string
  retailCents: number
}

export interface ShippingAddress {
  name:        string
  line1:       string
  line2?:      string
  city:        string
  state?:      string
  postcode:    string
  countryCode: string
}

export interface PrintOrderRow {
  id:                     string
  stripe_session_id:      string
  stripe_payment_intent:  string | null
  prodigi_order_id:       string | null
  prodigi_merchant_ref:   string | null
  status:                 PrintOrderStatus
  error_message:          string | null
  customer_email:         string
  shipping_address:       ShippingAddress
  items:                  PrintOrderItem[]
  retail_subtotal_cents:  number
  retail_shipping_cents:  number
  retail_total_cents:     number
  wholesale_cost_cents:   number | null
  shipping_method:        string
  shipping_carrier:       string | null
  tracking_number:        string | null
  tracking_url:           string | null
  created_at:             string
  paid_at:                string | null
  placed_at:              string | null
  shipped_at:             string | null
  delivered_at:           string | null
  updated_at:             string
}

// ── CLIENT ────────────────────────────────────────────────────
let _sb: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (_sb) return _sb
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) {
    throw new Error('print/db: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  _sb = createClient(url, service, { auth: { persistSession: false } })
  return _sb
}

// ── CREATE ────────────────────────────────────────────────────
export async function createPrintOrder(input: {
  stripeSessionId:     string
  customerEmail:       string
  shippingAddress:     ShippingAddress
  items:               PrintOrderItem[]
  retailSubtotalCents: number
  retailShippingCents: number
  retailTotalCents:    number
  shippingMethod:      string
  prodigiMerchantRef:  string
}): Promise<PrintOrderRow> {
  const { data, error } = await sb()
    .from('print_orders')
    .insert({
      stripe_session_id:     input.stripeSessionId,
      customer_email:        input.customerEmail,
      shipping_address:      input.shippingAddress,
      items:                 input.items,
      retail_subtotal_cents: input.retailSubtotalCents,
      retail_shipping_cents: input.retailShippingCents,
      retail_total_cents:    input.retailTotalCents,
      shipping_method:       input.shippingMethod,
      prodigi_merchant_ref:  input.prodigiMerchantRef,
      status:                'created',
    })
    .select()
    .single<PrintOrderRow>()
  if (error || !data) throw new Error(`createPrintOrder: ${error?.message}`)
  return data
}

// ── READ ──────────────────────────────────────────────────────
export async function getPrintOrderBySessionId(sessionId: string): Promise<PrintOrderRow | null> {
  const { data, error } = await sb()
    .from('print_orders')
    .select('*')
    .eq('stripe_session_id', sessionId)
    .maybeSingle<PrintOrderRow>()
  if (error) throw new Error(`getPrintOrderBySessionId: ${error.message}`)
  return data
}

export async function getPrintOrderById(id: string): Promise<PrintOrderRow | null> {
  const { data, error } = await sb()
    .from('print_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle<PrintOrderRow>()
  if (error) throw new Error(`getPrintOrderById: ${error.message}`)
  return data
}

export async function getPrintOrderByProdigiId(prodigiOrderId: string): Promise<PrintOrderRow | null> {
  const { data, error } = await sb()
    .from('print_orders')
    .select('*')
    .eq('prodigi_order_id', prodigiOrderId)
    .maybeSingle<PrintOrderRow>()
  if (error) throw new Error(`getPrintOrderByProdigiId: ${error.message}`)
  return data
}

// ── UPDATE ────────────────────────────────────────────────────
export async function markPaid(sessionId: string, paymentIntentId: string): Promise<void> {
  const { error } = await sb()
    .from('print_orders')
    .update({
      status:                'paid',
      paid_at:               new Date().toISOString(),
      stripe_payment_intent: paymentIntentId,
    })
    .eq('stripe_session_id', sessionId)
  if (error) throw new Error(`markPaid: ${error.message}`)
}

export async function markPlaced(input: {
  sessionId:      string
  prodigiOrderId: string
  wholesaleCents: number | null
}): Promise<void> {
  const update: Record<string, unknown> = {
    status:           'placed',
    placed_at:        new Date().toISOString(),
    prodigi_order_id: input.prodigiOrderId,
  }
  if (input.wholesaleCents !== null) update.wholesale_cost_cents = input.wholesaleCents
  const { error } = await sb()
    .from('print_orders')
    .update(update)
    .eq('stripe_session_id', input.sessionId)
  if (error) throw new Error(`markPlaced: ${error.message}`)
}

export async function markError(sessionId: string, message: string): Promise<void> {
  const { error } = await sb()
    .from('print_orders')
    .update({
      status:        'error',
      error_message: message.slice(0, 1000),  // bound to avoid runaway logs
    })
    .eq('stripe_session_id', sessionId)
  if (error) throw new Error(`markError: ${error.message}`)
}

export async function updateShipping(input: {
  prodigiOrderId:  string
  status:          PrintOrderStatus
  carrier?:        string
  trackingNumber?: string
  trackingUrl?:    string
}): Promise<void> {
  const update: Record<string, unknown> = { status: input.status }
  if (input.carrier)        update.shipping_carrier = input.carrier
  if (input.trackingNumber) update.tracking_number  = input.trackingNumber
  if (input.trackingUrl)    update.tracking_url     = input.trackingUrl
  if (input.status === 'shipped')   update.shipped_at   = new Date().toISOString()
  if (input.status === 'delivered') update.delivered_at = new Date().toISOString()

  const { error } = await sb()
    .from('print_orders')
    .update(update)
    .eq('prodigi_order_id', input.prodigiOrderId)
  if (error) throw new Error(`updateShipping: ${error.message}`)
}
