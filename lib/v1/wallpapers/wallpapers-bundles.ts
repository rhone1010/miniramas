// lib/v1/wallpapers/wallpapers-bundles.ts
//
// SETS. A bundle crafts several effects from one silo in a single press.
//
// The wallpaper grid is 3 rows of 5: fourteen effects and one upsell card.
// Pressing the card queues a portion of that silo's fourteen — five or
// seven — rather than revealing more tiles.
//
// ── WHY THIS IS A ROUTE CONCERN AND NOT A GLASS ONE ────────────────────
//
// The glass could fire five single-render calls itself. It should not.
// Pricing is per bundle, so there has to be one credit decision, not five
// racing each other — and partial failure needs one policy applied in one
// place rather than five callers each deciding what to do about a missing
// image.
//
// ── PARTIAL FAILURE ────────────────────────────────────────────────────
//
// A bundle of five where one render fails is the normal case, not the
// exception, and there are only three honest answers: ship four and refund
// one, re-render the failure, or hold the whole bundle. That is a refund
// policy question and Rich has not ruled on it.
//
// Until he does, this ships what succeeded and reports the rest
// individually — `results` carries a row per effect with its own ok flag,
// so the caller can see exactly which one failed and the Concierge has
// something specific to act on. Nothing here decides a refund.

import type { WallpaperSiloId } from './wallpapers-shared'

export type BundleSize = 5 | 7

export interface WallpaperBundle {
  id:    string
  label: string
  silo:  WallpaperSiloId
  size:  BundleSize
}

/**
 * How many renders a bundle contains.
 *
 * Five and seven, not ten or fourteen. A bundle that covers the whole silo
 * leaves nothing to buy afterwards, and fourteen NB2 calls behind one press
 * is several minutes of a customer watching a spinner.
 */
export const BUNDLE_SIZES: BundleSize[] = [5, 7]

/**
 * Pick which effects a bundle contains.
 *
 * Takes the silo's effects in catalog order. Deliberately NOT random: two
 * customers buying the same bundle should get the same set, and a customer
 * buying twice should be able to tell what they already own.
 *
 * `exclude` skips effects the customer already has, so a second bundle
 * from the same silo is new work rather than a repeat.
 */
export function pickBundleEffects(input: {
  siloEffectIds: string[]
  size:          BundleSize
  exclude?:      string[]
}): string[] {
  const owned = new Set(input.exclude || [])
  const available = input.siloEffectIds.filter(id => !owned.has(id))
  return available.slice(0, input.size)
}
