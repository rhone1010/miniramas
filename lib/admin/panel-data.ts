// lib/admin/panel-data.ts
//
// Every number the control panel shows comes through here. The arithmetic
// lives in Postgres (migrations 017 and 033) so "revenue" means one thing in
// one place; this file only fetches and types it.

import { supabaseAdmin } from '@/lib/supabase'
import type {
  Overview, Engine, Marketing, Customers, Fulfilment, Health, Controls,
  PanelData, SliceKey,
} from './panel-types'

export type * from './panel-types'

/** A fetch that either produced data or explains why it did not. */
type Result<T> = { data: T | null; error: string | null }

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<Result<T>> {
  try {
    const { data, error } = await supabaseAdmin.rpc(fn, args)
    if (error) {
      console.error(`[panel] ${fn} failed:`, error.message)
      return { data: null, error: error.message }
    }
    return { data: data as T, error: null }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error'
    console.error(`[panel] ${fn} threw:`, message)
    return { data: null, error: message }
  }
}

export const getOverview   = (days = 7)  => rpc<Overview>('panel_overview',   { days })
export const getEngine     = (days = 30) => rpc<Engine>('panel_engine',       { days })
export const getMarketing  = (days = 7)  => rpc<Marketing>('panel_marketing', { days })
export const getCustomers  = ()          => rpc<Customers>('panel_customers')
export const getFulfilment = ()          => rpc<Fulfilment>('panel_fulfilment')
export const getHealth     = (days = 7)  => rpc<Health>('panel_health',       { days })
export const getControls   = ()          => rpc<Controls>('panel_controls')

export async function getAll(days = 7): Promise<PanelData> {
  // Every windowed slice takes the selected range. Engine used to be pinned
  // to 30 regardless, so the Range control steered three of seven tabs while
  // looking like it steered all of them.
  const [overview, engine, marketing, customers, fulfilment, health, controls] =
    await Promise.all([
      getOverview(days), getEngine(days), getMarketing(days),
      getCustomers(), getFulfilment(), getHealth(days), getControls(),
    ])

  const slices: Record<SliceKey, Result<unknown>> = {
    overview, engine, marketing, customers, fulfilment, health, controls,
  }

  const failures: Partial<Record<SliceKey, string>> = {}
  for (const key of Object.keys(slices) as SliceKey[]) {
    const err = slices[key].error
    if (err) failures[key] = err
  }

  return {
    overview:   overview.data,
    engine:     engine.data,
    marketing:  marketing.data,
    customers:  customers.data,
    fulfilment: fulfilment.data,
    health:     health.data,
    controls:   controls.data,
    failures,
  }
}


// Display helpers live in lib/admin/format.ts — kept separate so the client
// component can import them without dragging Supabase into the browser
// bundle. Re-exported here for server-side callers.
export { money, num, pct, secs, delta } from './format'
