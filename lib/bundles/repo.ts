// bundles/repo.ts
// lib/bundles/repo.ts
//
// Supabase fetch/write helpers for bundles. All callers are server-side
// (admin routes use service role key).

import { supabaseAdmin } from '@/lib/supabase'
import type { Bundle, BundleInput, BundleItem } from './types'
import type { SceneStyle, SceneVariant } from '@/lib/v1/group-generator'
import { VARIANTS_BY_STYLE } from '@/lib/v1/group-generator'

const VALID_STYLES = Object.keys(VARIANTS_BY_STYLE) as SceneStyle[]

function isValidStyle(s: unknown): s is SceneStyle {
  return typeof s === 'string' && (VALID_STYLES as string[]).includes(s)
}

function isValidVariant(style: SceneStyle, v: unknown): v is SceneVariant {
  if (typeof v !== 'string') return false
  return VARIANTS_BY_STYLE[style].some((x) => x.key === v)
}

interface BundleRow {
  id:            string
  slug:          string
  name:          string
  tagline:       string | null
  price_cents:   number
  display_order: number
  is_active:     boolean
}

interface BundleItemRow {
  id:             string
  bundle_id:      string
  position:       number
  mode:           'fixed' | 'choose'
  fixed_style:    string | null
  fixed_variant:  string | null
  choose_label:   string | null
  choose_options: unknown
}

function rowToBundle(row: BundleRow, items: BundleItem[]): Bundle {
  return {
    id:           row.id,
    slug:         row.slug,
    name:         row.name,
    tagline:      row.tagline,
    priceCents:   row.price_cents,
    displayOrder: row.display_order,
    isActive:     row.is_active,
    items,
  }
}

function rowToItem(row: BundleItemRow): BundleItem {
  if (row.mode === 'fixed') {
    return {
      id:           row.id,
      position:     row.position,
      mode:         'fixed',
      fixedStyle:   (row.fixed_style ?? undefined) as SceneStyle | undefined,
      fixedVariant: (row.fixed_variant ?? undefined) as SceneVariant | undefined,
    }
  }
  return {
    id:            row.id,
    position:      row.position,
    mode:          'choose',
    chooseLabel:   row.choose_label ?? undefined,
    chooseOptions: Array.isArray(row.choose_options)
      ? (row.choose_options as BundleItem['chooseOptions'])
      : [],
  }
}

async function loadItemsForBundles(bundleIds: string[]): Promise<Map<string, BundleItem[]>> {
  if (bundleIds.length === 0) return new Map()
  const { data, error } = await supabaseAdmin
    .from('bundle_items')
    .select('*')
    .in('bundle_id', bundleIds)
    .order('position', { ascending: true })
  if (error) throw new Error(`bundle_items_query_failed: ${error.message}`)

  const map = new Map<string, BundleItem[]>()
  for (const row of (data ?? []) as BundleItemRow[]) {
    if (!map.has(row.bundle_id)) map.set(row.bundle_id, [])
    map.get(row.bundle_id)!.push(rowToItem(row))
  }
  return map
}

// ── PUBLIC READ ──────────────────────────────────────────────────

export async function listActiveBundles(): Promise<Bundle[]> {
  const { data, error } = await supabaseAdmin
    .from('bundles')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) throw new Error(`bundles_query_failed: ${error.message}`)

  const rows = (data ?? []) as BundleRow[]
  const itemsByBundle = await loadItemsForBundles(rows.map((r) => r.id))
  return rows.map((r) => rowToBundle(r, itemsByBundle.get(r.id) ?? []))
}

// ── ADMIN READ ───────────────────────────────────────────────────

export async function listAllBundles(): Promise<Bundle[]> {
  const { data, error } = await supabaseAdmin
    .from('bundles')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(`bundles_query_failed: ${error.message}`)

  const rows = (data ?? []) as BundleRow[]
  const itemsByBundle = await loadItemsForBundles(rows.map((r) => r.id))
  return rows.map((r) => rowToBundle(r, itemsByBundle.get(r.id) ?? []))
}

export async function getBundleById(id: string): Promise<Bundle | null> {
  const { data, error } = await supabaseAdmin
    .from('bundles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`bundle_query_failed: ${error.message}`)
  if (!data) return null

  const itemsByBundle = await loadItemsForBundles([data.id])
  return rowToBundle(data as BundleRow, itemsByBundle.get(data.id) ?? [])
}

// ── VALIDATION ───────────────────────────────────────────────────

export interface ValidationError {
  field:   string
  message: string
}

export function validateBundleInput(input: unknown): ValidationError[] {
  const errors: ValidationError[] = []
  if (!input || typeof input !== 'object') {
    return [{ field: 'body', message: 'Body must be an object' }]
  }
  const b = input as Partial<BundleInput>

  if (typeof b.slug !== 'string' || !/^[a-z0-9-]+$/.test(b.slug)) {
    errors.push({ field: 'slug', message: 'Slug must match /^[a-z0-9-]+$/' })
  }
  if (typeof b.name !== 'string' || b.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' })
  }
  if (b.tagline != null && typeof b.tagline !== 'string') {
    errors.push({ field: 'tagline', message: 'Tagline must be a string or null' })
  }
  if (typeof b.priceCents !== 'number' || !Number.isInteger(b.priceCents) || b.priceCents < 0) {
    errors.push({ field: 'priceCents', message: 'Price must be a non-negative integer (cents)' })
  }
  if (typeof b.displayOrder !== 'number' || !Number.isInteger(b.displayOrder)) {
    errors.push({ field: 'displayOrder', message: 'Display order must be an integer' })
  }
  if (typeof b.isActive !== 'boolean') {
    errors.push({ field: 'isActive', message: 'isActive must be a boolean' })
  }
  if (!Array.isArray(b.items) || b.items.length === 0) {
    errors.push({ field: 'items', message: 'Bundle must have at least one item' })
    return errors
  }

  b.items.forEach((item, i) => {
    if (!item || typeof item !== 'object') {
      errors.push({ field: `items[${i}]`, message: 'Item must be an object' })
      return
    }
    if (item.mode !== 'fixed' && item.mode !== 'choose') {
      errors.push({ field: `items[${i}].mode`, message: 'Mode must be "fixed" or "choose"' })
      return
    }
    if (item.mode === 'fixed') {
      if (!isValidStyle(item.fixedStyle)) {
        errors.push({ field: `items[${i}].fixedStyle`, message: 'Invalid style' })
      } else if (!isValidVariant(item.fixedStyle, item.fixedVariant)) {
        errors.push({ field: `items[${i}].fixedVariant`, message: 'Invalid variant for style' })
      }
    } else {
      const opts = item.chooseOptions
      if (!Array.isArray(opts) || opts.length === 0) {
        errors.push({ field: `items[${i}].chooseOptions`, message: 'Choose item needs at least one option' })
        return
      }
      opts.forEach((opt, j) => {
        if (!opt || typeof opt !== 'object') {
          errors.push({ field: `items[${i}].chooseOptions[${j}]`, message: 'Option must be an object' })
          return
        }
        if (!isValidStyle(opt.style)) {
          errors.push({ field: `items[${i}].chooseOptions[${j}].style`, message: 'Invalid style' })
        } else if (!isValidVariant(opt.style, opt.variant)) {
          errors.push({ field: `items[${i}].chooseOptions[${j}].variant`, message: 'Invalid variant for style' })
        }
        if (typeof opt.label !== 'string' || opt.label.trim().length === 0) {
          errors.push({ field: `items[${i}].chooseOptions[${j}].label`, message: 'Option label is required' })
        }
      })
    }
  })

  return errors
}

// ── ADMIN WRITES ─────────────────────────────────────────────────

async function replaceItems(bundleId: string, items: BundleInput['items']): Promise<void> {
  const { error: delErr } = await supabaseAdmin
    .from('bundle_items')
    .delete()
    .eq('bundle_id', bundleId)
  if (delErr) throw new Error(`bundle_items_delete_failed: ${delErr.message}`)

  if (items.length === 0) return

  const rows = items.map((item, idx) => ({
    bundle_id:      bundleId,
    position:       idx,
    mode:           item.mode,
    fixed_style:    item.mode === 'fixed' ? item.fixedStyle ?? null : null,
    fixed_variant:  item.mode === 'fixed' ? item.fixedVariant ?? null : null,
    choose_label:   item.mode === 'choose' ? item.chooseLabel ?? null : null,
    choose_options: item.mode === 'choose' ? item.chooseOptions ?? [] : null,
  }))
  const { error: insErr } = await supabaseAdmin.from('bundle_items').insert(rows)
  if (insErr) throw new Error(`bundle_items_insert_failed: ${insErr.message}`)
}

export async function createBundle(input: BundleInput): Promise<Bundle> {
  const { data, error } = await supabaseAdmin
    .from('bundles')
    .insert({
      slug:          input.slug,
      name:          input.name,
      tagline:       input.tagline,
      price_cents:   input.priceCents,
      display_order: input.displayOrder,
      is_active:     input.isActive,
    })
    .select()
    .single()
  if (error) throw new Error(`bundle_insert_failed: ${error.message}`)

  await replaceItems(data.id, input.items)
  const created = await getBundleById(data.id)
  if (!created) throw new Error('bundle_not_found_after_insert')
  return created
}

export async function updateBundle(id: string, input: BundleInput): Promise<Bundle> {
  const { error } = await supabaseAdmin
    .from('bundles')
    .update({
      slug:          input.slug,
      name:          input.name,
      tagline:       input.tagline,
      price_cents:   input.priceCents,
      display_order: input.displayOrder,
      is_active:     input.isActive,
    })
    .eq('id', id)
  if (error) throw new Error(`bundle_update_failed: ${error.message}`)

  await replaceItems(id, input.items)
  const updated = await getBundleById(id)
  if (!updated) throw new Error('bundle_not_found_after_update')
  return updated
}

export async function deleteBundle(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('bundles').delete().eq('id', id)
  if (error) throw new Error(`bundle_delete_failed: ${error.message}`)
}

export async function reorderBundles(order: { id: string; displayOrder: number }[]): Promise<void> {
  // Run sequentially — small N, simple, no transaction edge cases.
  for (const entry of order) {
    const { error } = await supabaseAdmin
      .from('bundles')
      .update({ display_order: entry.displayOrder })
      .eq('id', entry.id)
    if (error) throw new Error(`bundle_reorder_failed: ${error.message}`)
  }
}
