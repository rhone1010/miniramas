// lib/admin/panel-data.ts
//
// Every number the control panel shows comes through here. The arithmetic
// lives in Postgres (migration 017) so "revenue" means one thing in one
// place; this file only fetches and types it.

import { supabaseAdmin } from '@/lib/supabase'
import type {
  Overview, Engine, Marketing, Customers, Fulfilment, Health, Controls,
} from './panel-types'

export type * from './panel-types'

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


// Display helpers live in lib/admin/format.ts — kept separate so the client
// component can import them without dragging Supabase into the browser
// bundle. Re-exported here for server-side callers.
export { money, num, pct, secs, delta } from './format'
