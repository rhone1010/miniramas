// lib/v1/wallpapers/store.ts
//
// The wallpaper store's engine-side knowledge: what a wallpaper costs, what
// a legitimate filename looks like, and whether a file actually exists in
// the bucket.
//
// Shared by the credit gate (pricing) and the purchase route (all three).
// The price formula lives HERE and nowhere else - the gate carried its own
// copy for one day and that is one day longer than two copies of a price
// should exist.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const WALLPAPER_BUCKET = 'wallpapers'
export const WALLPAPER_SECTIONS = ['general', 'halloween'] as const
export type WallpaperSection = (typeof WALLPAPER_SECTIONS)[number]

// ── PRICE ────────────────────────────────────────────────────────────
//
// Rich, 23 August, confirmed 24 August: one for 3 credits, five for 10.
// Every full five costs ten and the remainder costs three each:
//   1=3  2=6  3=9  4=12  5=10  6=13  7=16  10=20
export function wallpaperTotal(n: number): number | null {
  const count = Math.floor(Number(n))
  if (!Number.isFinite(count) || count < 1) return null
  return Math.floor(count / 5) * 10 + (count % 5) * 3
}

// ── FILENAMES ────────────────────────────────────────────────────────
//
// <index>_<token>_<token>_....jpg - four-digit index, lowercase snake
// tokens, .jpg. The grammar (SPEC-WALLPAPER-STORE section 2-3) is
// world/mood/energy/palette[/twist] for general and subject-led for
// halloween, but THIS CHECK IS DELIBERATELY SHAPE-ONLY. The bucket listing
// is the authority on which files exist; the regex only refuses input that
// could never be a wallpaper name, so a path traversal or a stray upload
// name fails fast without a storage call.
export const WALLPAPER_FILENAME_RE = /^\d{4}(_[a-z0-9]+){3,6}\.jpg$/

export interface WallpaperItem {
  section: WallpaperSection
  filename: string
}

/** studio/<section>/<filename> - the clean file's path in the bucket, and
 *  the value written to collection_pieces.image_path. Matches cleanUrl in
 *  wallpaper-registry.js; if either side changes shape the other must. */
export function wallpaperPath(item: WallpaperItem): string {
  return `studio/${item.section}/${item.filename}`
}

/** Best-effort human label off the filename: "Cosmos - Dream" from
 *  0000_cosmos_dream_stillness_aurora.jpg. Falls back to the stem. The
 *  tokens are stored raw in meta regardless, so a bad guess here costs a
 *  label, never information. */
export function wallpaperLabel(filename: string): string {
  const stem = filename.replace(/\.jpg$/, '')
  const tokens = stem.split('_').slice(1)
  if (tokens.length < 2) return stem
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return `${cap(tokens[0])} - ${cap(tokens[1])}`
}

export function wallpaperMeta(item: WallpaperItem): Record<string, unknown> {
  const stem = item.filename.replace(/\.jpg$/, '')
  const parts = stem.split('_')
  return {
    kind: 'studio_wallpaper',
    section: item.section,
    filename: item.filename,
    index: parts[0] ?? null,
    tokens: parts.slice(1),
  }
}

// ── EXISTENCE ────────────────────────────────────────────────────────
//
// The bucket listing per section, cached in module memory. Both sections
// are ~500 files, well under the 1000-row page, so one list call covers a
// section. The cache is short-lived and A MISS RE-LISTS ONCE before
// refusing, so a wallpaper uploaded five minutes ago is purchasable without
// a deploy.
const LIST_TTL_MS = 10 * 60 * 1000
const cache: Partial<Record<WallpaperSection, { at: number; names: Set<string> }>> = {}

async function listSection(
  db: SupabaseClient,
  section: WallpaperSection,
  force = false,
): Promise<Set<string> | null> {
  const hit = cache[section]
  if (!force && hit && Date.now() - hit.at < LIST_TTL_MS) return hit.names

  const { data, error } = await db.storage
    .from(WALLPAPER_BUCKET)
    .list(`studio/${section}`, { limit: 1000 })

  if (error || !data) {
    console.error(`[wallpapers] bucket list failed for ${section}:`, error?.message)
    // A stale cache beats a refusal caused by a storage blip.
    return hit?.names ?? null
  }

  const names = new Set(data.map(o => o.name))
  cache[section] = { at: Date.now(), names }
  return names
}

export interface ValidationResult {
  ok: boolean
  /** Items that failed, with why. Empty when ok. */
  rejected: Array<{ filename: string; reason: string }>
}

/** Every item checked BEFORE anything is written or charged. A basket with
 *  one bad name refuses whole - partially fulfilling a purchase and
 *  charging for the part that worked is a support ticket with arithmetic
 *  in it. */
export async function validateItems(
  db: SupabaseClient,
  items: WallpaperItem[],
): Promise<ValidationResult> {
  const rejected: ValidationResult['rejected'] = []

  const seen = new Set<string>()
  for (const it of items) {
    const key = `${it.section}/${it.filename}`
    if (!WALLPAPER_SECTIONS.includes(it.section)) {
      rejected.push({ filename: it.filename, reason: 'bad_section' }); continue
    }
    if (!WALLPAPER_FILENAME_RE.test(it.filename)) {
      rejected.push({ filename: it.filename, reason: 'bad_filename' }); continue
    }
    if (seen.has(key)) {
      // The same file twice is almost certainly a double-tap. Refusing names
      // it rather than silently charging for one - the glass should dedupe,
      // and if it did not, the customer should not pay for the bug.
      rejected.push({ filename: it.filename, reason: 'duplicate' }); continue
    }
    seen.add(key)
  }
  if (rejected.length) return { ok: false, rejected }

  for (const section of WALLPAPER_SECTIONS) {
    const wanted = items.filter(i => i.section === section)
    if (!wanted.length) continue

    let names = await listSection(db, section)
    if (names && wanted.some(i => !names!.has(i.filename))) {
      // Could be a genuinely bad name, could be a file newer than the
      // cache. One forced re-list settles it.
      names = await listSection(db, section, true)
    }
    if (!names) {
      for (const i of wanted) rejected.push({ filename: i.filename, reason: 'bucket_unavailable' })
      continue
    }
    for (const i of wanted) {
      if (!names.has(i.filename)) rejected.push({ filename: i.filename, reason: 'not_found' })
    }
  }

  return { ok: rejected.length === 0, rejected }
}
