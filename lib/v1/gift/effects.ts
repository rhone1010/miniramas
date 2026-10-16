// lib/v1/gift/effects.ts
//
// Which effects a Gift Wizard batch may use, per series, and the hybrid selection that fills a batch to six.
// Reads the existing engine catalogs, so no effect list is restated here:
//   portraits  lib/v1/portraits/effect-registry.ts  (silo order, only body 'live', gendered variants collapsed as the wizard does)
//   pets       lib/v1/pets/pets-discovery-data.json  (the Discovery order) intersected with PETS_35 (what the engine can render)
//   groups     lib/v1/groups/groups-effects.ts       (single-photo effects only: a wizard session has one photograph)
// Groups' room order lives in the generated public/groups-registry.js, which server code cannot import, so Groups fills
// in catalog order. The browser still shows its own registry order; this only decides auto-filled slots.

import { SILOS, EFFECTS, isOfferable } from '../portraits/effect-registry'
import petsDiscovery from '../pets/pets-discovery-data.json'
import { PETS_35 } from '../pets/pets-catalog-35'
import { GROUPS_EFFECTS, GROUPS_EFFECT_IDS } from '../groups/groups-effects'
import { BATCH_SIZE } from './policy'
import type { Series } from './types'

export class EffectSelectionError extends Error {
  constructor(public code: 'invalid_effect_selection' | 'effect_already_used' | 'not_enough_effects') { super(code) }
}

/** The effects a series can use right now, in fill order. */
export function liveEffectIds(series: Series): string[] {
  if (series === 'portraits') {
    const live = EFFECTS.filter(isOfferable)
    const ids = new Set(live.map(e => e.id))
    const bySilo = SILOS.flatMap(s => live.filter(e => e.category === s.id))
    // A gendered variant (x_woman) collapses into its base (x) when both exist: one tile, resolved by the subject later.
    return bySilo.map(e => e.id).filter(id => !(id.endsWith('_woman') && ids.has(id.slice(0, -6))))
  }
  if (series === 'pets') {
    return (petsDiscovery.effects as Array<{ id: string; body: string }>).filter(e => e.body === 'live' && Object.hasOwn(PETS_35, e.id)).map(e => e.id)
  }
  return GROUPS_EFFECT_IDS.filter(id => GROUPS_EFFECTS[id].intake === 'group_photo')
}

/**
 * Hybrid selection. The customer picked 0 to 6 effects; the server returns exactly six: their picks first, in order,
 * then unused live effects in fill order. Never repeats an effect already used in this session, never repeats within a batch.
 */
export function fillEffects(series: Series, picked: readonly string[] | undefined, used: readonly string[]): string[] {
  const live = liveEffectIds(series)
  const chosen = [...(picked ?? [])]
  if (chosen.length > BATCH_SIZE || new Set(chosen).size !== chosen.length || chosen.some(id => typeof id !== 'string' || !live.includes(id))) {
    throw new EffectSelectionError('invalid_effect_selection')
  }
  const usedSet = new Set(used)
  if (chosen.some(id => usedSet.has(id))) throw new EffectSelectionError('effect_already_used')
  const rest = live.filter(id => !usedSet.has(id) && !chosen.includes(id))
  const six = [...chosen, ...rest].slice(0, BATCH_SIZE)
  if (six.length < BATCH_SIZE) throw new EffectSelectionError('not_enough_effects')
  return six
}

export const remainingEffectCount = (series: Series, used: readonly string[]) => liveEffectIds(series).filter(id => !used.includes(id)).length
