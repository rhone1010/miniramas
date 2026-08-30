// lib/store/discovery-catalog.ts
// Implements CENG_DISCOVERY_ENGINE_SPEC.md section 3 (56-position map)
// and section 4 (variant resolution) for the Portraits catalog.
//
// FINDING, confirmed against effect-registry.ts read live this session:
// the 8 silos there are IDENTICAL to the wireframe's silo nav (Earth &
// Ore, Light & Glass, etc.) and each silo has exactly 7 canonical
// effects once gendered pairs collapse to one entry - e.g. elizabethan +
// elizabethan_woman is ONE canonical effect ("elizabethan") with a
// variantPolicy of gender_presented, not two map positions. 8 x 7 = 56,
// matching the spec's minimap exactly. This is the existing Portraits
// catalog, not a new taxonomy - no new data was invented to build this.
//
// ONE REAL GAP, not silently papered over: made_by_hand's 7th canonical
// slot was 'beaded', confirmed dead this session (not in
// portraits-bodies.ts, excluded in portfolio-replace's predecessor).
// That silo currently has only 6 live canonical effects, not 7. This
// file represents that slot as null rather than reusing the dead id or
// inventing a placeholder - CUI's minimap needs to handle a null cell
// (render empty/disabled) until a replacement effect is authored.
//
// HALLOWEEN/GROUPS/PETS ARE NOT INCLUDED. Their catalogs were not read
// live this session (same discipline as everywhere else tonight) - this
// file covers Portraits only. Extending the map to other series needs
// their registries confirmed first, not guessed from this shape.

import { SILOS } from '@/lib/v1/portraits/effect-registry'

export type SiloId =
  | 'earth_ore' | 'light_glass' | 'living_world' | 'made_by_hand'
  | 'artists_gallery' | 'ink_paper' | 'fantasy_future' | 'another_age'

export interface CatalogMapEntry {
  mapIndex: number // 0..55
  seriesId: 'portraits'
  siloId: SiloId
  effectId: string | null // null = known gap, not a guess
}

export interface SiloBoundary {
  siloId: string
  label: string
  startIndex: number
  endIndex: number
}

// Silo order matches effect-registry.ts's SILOS array order exactly.
const SILO_ORDER: SiloId[] = [
  'another_age', 'earth_ore', 'light_glass', 'living_world',
  'made_by_hand', 'artists_gallery', 'ink_paper', 'fantasy_future',
]

// Canonical effect id per silo, in the order they appear in
// effect-registry.ts. Gendered pairs (id + id_woman) are already
// collapsed to the base id here - the _woman variant is not a separate
// entry, per spec section 4 ("do not expose an extra selectable effect
// count").
const CANONICAL_BY_SILO: Record<SiloId, Array<string | null>> = {
  another_age: [
    'elizabethan', 'renaissance', 'deco_twenties', 'victorian',
    'samurai', 'wild_west', 'persian_court',
  ],
  earth_ore: [
    'bronze', 'iron', 'stone', 'jade', 'ebony', 'reclaimed_bronze', 'petrified_wood',
  ],
  light_glass: [
    'cast_glass', 'stained_glass', 'ice', 'mercury', 'neon', 'sea_glass', 'polished_gold',
  ],
  living_world: [
    'driftwood_resin', 'coral', 'tidewood', 'lichen_granite',
    'petal_sculpture', 'sand_form', 'sandstone',
  ],
  made_by_hand: [
    'plushy', 'chocolate', 'balloon_face', 'quilted', 'origami', 'porcelain',
    null, // beaded - confirmed dead this session, not reused
  ],
  artists_gallery: [
    'impressionist', 'watercolour', 'charcoal_chalk', 'sheet_music',
    'pencil_sketch', 'oil_impasto', 'linocut',
  ],
  ink_paper: [
    'folded_book', 'magic_energy', 'ukiyo_e', 'cubism',
    'art_deco', 'art_nouveau', 'daguerreotype',
  ],
  fantasy_future: [
    'dragon_skin', 'fire_face', 'retro_robot', 'forest_guardian',
    'clockwork', 'starfield', 'crystallized',
  ],
}

let _map: CatalogMapEntry[] | null = null
let _silos: SiloBoundary[] | null = null

export function getPortraitsCatalogMap(): CatalogMapEntry[] {
  if (_map) return _map
  const entries: CatalogMapEntry[] = []
  let mapIndex = 0
  for (const siloId of SILO_ORDER) {
    for (const effectId of CANONICAL_BY_SILO[siloId]) {
      entries.push({ mapIndex, seriesId: 'portraits', siloId, effectId })
      mapIndex++
    }
  }
  _map = entries
  return entries
}

const siloLabelMap = new Map(SILOS.map((s) => [s.id, s.label]))

export function getPortraitsSiloBoundaries(): SiloBoundary[] {
  if (_silos) return _silos
  const boundaries: SiloBoundary[] = []
  let offset = 0
  for (const siloId of SILO_ORDER) {
    const count = CANONICAL_BY_SILO[siloId].length
    boundaries.push({
      siloId,
      label: siloLabelMap.get(siloId) ?? siloId,
      startIndex: offset,
      endIndex: offset + count - 1,
    })
    offset += count
  }
  _silos = boundaries
  return boundaries
}

/** For variant resolution (spec section 4) - given a canonical effect id
 *  and a resolved presentation ('male'|'female'), returns the actual
 *  engine effect id to render. Falls back to the canonical id itself for
 *  non-gendered effects. Female-suffix pattern confirmed against the
 *  real another_age entries this session (elizabethan_woman etc.) -
 *  NOT confirmed for any silo outside another_age, since no other silo
 *  in the registry currently has _woman-suffixed pairs.
 */
export function resolveVariantEffectId(
  canonicalEffectId: string,
  presentation: 'male' | 'female' | null,
): string {
  if (presentation === 'female') {
    return `${canonicalEffectId}_woman`
  }
  return canonicalEffectId
}
