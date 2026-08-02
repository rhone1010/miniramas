// store/skus.ts
// lib/store/skus.ts
//
// Read access for SKUs. Admin (write) flows aren't in scope for this chat;
// SKUs are seeded via SQL and edited in the DB.
//
// CUI V24 · 2026-08-02 · credits, and the recommended block.
//
//   The kind union was 'single' | 'bundle', written before credits existed.
//   Migration 011 widened skus.kind to include 'credits' and five rows have
//   been sitting there since; the type simply never caught up, so anything
//   reading this had to widen it again itself.
//
//   `recommended` (migration 013) was not mapped at all, so the purchase
//   panel had no way to mark a block and every one looked the same. Exactly
//   one credits row carries it.

import { supabaseAdmin } from '@/lib/supabase'
import type { Sku } from './types'

interface SkuRow {
  id:               string
  display_name:     string
  kind:             'single' | 'bundle' | 'credits'
  count:            number
  price_cents:      number
  stripe_price_id:  string
  active:           boolean
  recommended:      boolean | null    // 013; null on rows predating it
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
    recommended:   row.recommended === true,
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
