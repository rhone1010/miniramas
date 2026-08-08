// lib/admin/panel-data.ts
//
// Every number the control panel shows comes through here. The arithmetic
// lives in Postgres (migration 017) so "revenue" means one thing in one
// place; this file only fetches and types it.

import { supabaseAdmin } from '@/lib/supabase'

export type Overview = {
  days: number
  revenue_cents: number
  revenue_prior_cents: number
  crafts: number
  crafts_prior: number
  prints: number
  prints_prior: number
  customers: number
  customers_prior: number
  credits_held: number
  orders_in_error: number
  orders_in_error_oldest: string | null
  funnel: {
    visited: number; series: number; uploaded: number
    chose: number; checkout: number; paid: number
  }
}

export type Engine = {
  days: number
  renders_all_time: number
  renders_recent: number
  first_pass_pct: number | null
  kept_pieces: number
  cost_per_kept: number | null
  renders_per_kept: number | null
  outcomes: { passed: number; failed: number; rejected: number; redirected: number }
  by_finish: Array<{
    finish: string; crafted: number; first_pct: number | null
    avg_attempts: number | null; likeness: number | null; cost_each: number | null
  }>
}

export type Marketing = {
  days: number
  headline: {
    visits: number; people: number; series_views: number
    printshop: number; print_checkout: number
  }
  sources:   Array<{ source: string; visits: number; paid: number }>
  campaigns: Array<{ content: string; campaign: string; visits: number; paid: number }>
  rooms:     Array<{ room: string; n: number }>
  pages:     Array<{ target: string; n: number }>
}

export type Customers = {
  total: number
  crafted_only: number
  repeat: number
  credits_held: number
  people: Array<{
    owner_key: string; email: string | null; first_seen: string
    credits: number; pieces: number; prints: number
    spent_cents: number; purchases: number
  }>
}

export type Fulfilment = {
  orders: number
  in_error: number
  retail_cents: number
  wholesale_cents: number
  margin_pct: number | null
  recent: Array<{
    id: string; status: string; created_at: string
    customer_email: string; owner_key: string | null
    retail_total_cents: number; prodigi_order_id: string | null
    tracking_url: string | null; error_message: string | null
    items: unknown
  }>
}

export type Health = {
  days: number
  median_ms: number | null
  p95_ms: number | null
  failure_pct: number | null
  open_incidents: number
  hourly: Array<{ hour: number; avg_s: number; n: number; fails: number }>
  incidents: Array<{
    incident_id: string; severity: string; surface: string; component: string
    summary: string; count: number; first_seen: string; last_seen: string; status: string
  }>
}

export type Controls = {
  qa_settings: Array<{
    series: string; source_strictness: number; render_strictness: number
    qa_enabled: boolean; updated_at: string
  }>
  flags:   Array<{ owner_key: string; fulfilment: boolean; note: string | null; updated_at: string }>
  prompts: Array<{ engine_id: string; created_at: string; score: number | null; iterations: number | null }>
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const { data, error } = await supabaseAdmin.rpc(fn, args)
  if (error) {
    console.error(`[panel] ${fn} failed:`, error.message)
    return null
  }
  return data as T
}

export const getOverview   = (days = 7)  => rpc<Overview>('panel_overview',   { days })
export const getEngine     = (days = 30) => rpc<Engine>('panel_engine',       { days })
export const getMarketing  = (days = 7)  => rpc<Marketing>('panel_marketing', { days })
export const getCustomers  = ()          => rpc<Customers>('panel_customers')
export const getFulfilment = ()          => rpc<Fulfilment>('panel_fulfilment')
export const getHealth     = (days = 7)  => rpc<Health>('panel_health',       { days })
export const getControls   = ()          => rpc<Controls>('panel_controls')

export async function getAll(days = 7) {
  const [overview, engine, marketing, customers, fulfilment, health, controls] =
    await Promise.all([
      getOverview(days), getEngine(30), getMarketing(days),
      getCustomers(), getFulfilment(), getHealth(days), getControls(),
    ])
  return { overview, engine, marketing, customers, fulfilment, health, controls }
}

export type PanelData = Awaited<ReturnType<typeof getAll>>

// Display helpers live in lib/admin/format.ts — kept separate so the client
// component can import them without dragging Supabase into the browser
// bundle. Re-exported here for server-side callers.
export { money, num, pct, secs, delta } from './format'
