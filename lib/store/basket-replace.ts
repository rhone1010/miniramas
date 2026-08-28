// lib/store/basket-replace.ts
//
// Picks a replacement preset when a basket_item's render fails, per the
// locked rule: "render failures auto-replace silently, always...
// disclosed once at basket confirm, not per-swap."
//
// Built against catalogs actually read this session, not guessed:
//   - Portraits: lib/v1/portraits/effect-registry.ts - EFFECTS, isOfferable
//   - Halloween: lib/v1/halloween/halloween-catalog.ts - HALLOWEEN_MAIN_ORDER
//
// Groups and Pets are NOT wired here. groups-effects.ts and
// pets-catalog-35.ts exist but weren't read this session - their id
// lists aren't confirmed, and this file refuses rather than guess at
// their shape. Since no basket SKU currently offers Groups/Pets
// (only single/basket_discover_5/10/20, all Portraits+Halloween scope
// per the locked ruling), this isn't blocking anything today.
//
// 'beaded' excluded explicitly: effect-registry.ts still marks it
// body:'live' but it does not exist in portraits-bodies.ts (confirmed
// 27 Aug - 62 real bodies, matching the 08-23 carryover's own count).
// The registry is otherwise correct; this is the one known drift.
//
// This file is plain ASCII throughout, on purpose. A previous version
// of this file was corrupted by a patch script that read/wrote it under
// the wrong codepage (cp1252 instead of UTF-8) - the corruption did not
// throw an error at patch time, only later, when Vercel's build tried
// to parse the resulting invalid UTF-8. Keeping this file free of any
// non-ASCII character removes that whole failure class regardless of
// which tool touches it next.

import { EFFECTS, isOfferable } from '@/lib/v1/portraits/effect-registry'
import { HALLOWEEN_MAIN_ORDER } from '@/lib/v1/halloween/halloween-catalog'

export type ReplaceableSeries = 'portraits' | 'halloween'

function isReplaceableSeries(series: string): series is ReplaceableSeries {
  return series === 'portraits' || series === 'halloween'
}

// 'beaded' excluded explicitly - see file header for why.
const KNOWN_REGISTRY_DRIFT = new Set(['beaded'])

/** All live, offerable preset ids for a series, in a stable order. */
function livePool(series: ReplaceableSeries): string[] {
  if (series === 'portraits') {
    return EFFECTS.filter(isOfferable)
      .map((e) => e.id)
      .filter((id) => !KNOWN_REGISTRY_DRIFT.has(id))
  }
  // halloween
  return HALLOWEEN_MAIN_ORDER
}

/**
 * Returns a preset id not already present in `exclude`, or null if the
 * series' whole live pool is exhausted (all presets already in the
 * basket - rare, but possible for Halloween's smaller catalog once a
 * few swaps have happened on a 20-piece basket).
 *
 * Throws on an unrecognized/unwired series (groups/pets) rather than
 * silently returning null - a silent null here would look identical to
 * "pool exhausted" to the caller, which is a different, more common
 * case that should be handled differently (see complete/route.ts).
 */
export function pickReplacement(series: string, exclude: string[]): string | null {
  if (!isReplaceableSeries(series)) {
    throw new Error(`basket_replace_series_not_wired: ${series}`)
  }
  const excludeSet = new Set(exclude)
  const pool = livePool(series)
  for (const id of pool) {
    if (!excludeSet.has(id)) return id
  }
  return null
}
