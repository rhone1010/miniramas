// store/skus.ts
// lib/store/skus.ts
//
// Read access for SKUs. Admin (write) flows aren't in scope for this chat;
// SKUs are seeded via SQL and edited in the DB.

import { supabaseAdmin } from '@/lib/supabase'
import type { Sku } from './types'

interface SkuRow {
  id:               string
  display_name:     string
  kind:             'single' | 'bundle'
  count:            number
  price_cents:      number
  stripe_price_id:  string
  active:           boolean
}

function rowToSku(row: SkuRow): Sku {
  return {
    id:            row.id,
    displayName:   row.display_name,
    kind:          row.kind,
    count:         row.count,
    priceCents:    row.price_cents,
    stripePriceId: row.stripe_price_id,
    active:        row.active,
  }
}

export async function listActiveSkus(): Promise<Sku[]> {
  const { data, error } = await supabaseAdmin
    .from('skus')
    .select('*')
    .eq('active', true)
    .order('price_cents', { ascending: true })
  if (error) throw new Error(`skus_query_failed: ${error.message}`)
  return ((data ?? []) as SkuRow[]).map(rowToSku)
}

export async function getSku(id: string): Promise<Sku | null> {
  const { data, error } = await supabaseAdmin
    .from('skus')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`sku_query_failed: ${error.message}`)
  return data ? rowToSku(data as SkuRow) : null
}
