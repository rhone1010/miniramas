// lib/store/discovery-session.ts
// Implements CENG_DISCOVERY_ENGINE_SPEC.md sections 2, 5, 6, 8, 17.
//
// NOTE on validation scope: effectId is checked for basic shape only
// (non-empty string), NOT checked against a live catalog. Catalog
// membership validation would need effect-registry.ts (Portraits-only,
// confirmed this session) or equivalent for Halloween/Groups/Pets,
// which are not confirmed live. Per spec section 18 ("do not fabricate
// effects"), the safer choice is to accept any well-formed ID here and
// let catalog-membership checks happen at whatever layer actually reads
// the per-series registry - not invent a fake cross-series catalog here
// to validate against.

import { supabaseAdmin } from '@/lib/supabase'
import { resolveSelectionOffer, type SelectionOffer, type Tier } from './portfolio-checkout'

export interface DiscoverySession {
  sessionId: string
  userId: string | null
  sourceAssetId: string
  currentSeriesId: string
  currentSiloId: string | null
  selectedEffectIds: string[]
  visitedEffectIds: string[]
  curatorRecommendedEffectIds: string[]
  createdAt: string
  updatedAt: string
}

export interface TierChangeEvent {
  previousTier: Tier | null
  currentTier: Tier | null
  direction: 'up' | 'down' | 'none'
}

export interface MutationResult {
  session: DiscoverySession
  offer: SelectionOffer
  tierChange: TierChangeEvent
}

interface SessionRow {
  session_id: string
  user_id: string | null
  source_asset_id: string
  current_series_id: string
  current_silo_id: string | null
  selected_effect_ids: string[]
  visited_effect_ids: string[]
  curator_recommended_effect_ids: string[]
  created_at: string
  updated_at: string
}

function rowToSession(row: SessionRow): DiscoverySession {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    sourceAssetId: row.source_asset_id,
    currentSeriesId: row.current_series_id,
    currentSiloId: row.current_silo_id,
    selectedEffectIds: row.selected_effect_ids ?? [],
    visitedEffectIds: row.visited_effect_ids ?? [],
    curatorRecommendedEffectIds: row.curator_recommended_effect_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const TIER_ORDER: Record<Tier, number> = {
  tier_1: 1, tier_2: 2, tier_3: 3, tier_4: 4, complete: 5,
}

function computeTierChange(previous: Tier | null, current: Tier | null): TierChangeEvent {
  if (previous === current) return { previousTier: previous, currentTier: current, direction: 'none' }
  if (previous === null) return { previousTier: null, currentTier: current, direction: current ? 'up' : 'none' }
  if (current === null) return { previousTier: previous, currentTier: null, direction: 'down' }
  const dir = TIER_ORDER[current] > TIER_ORDER[previous] ? 'up' : 'down'
  return { previousTier: previous, currentTier: current, direction: dir }
}

export async function createSession(args: {
  userId?: string | null
  sourceAssetId: string
  seriesId: string
}): Promise<DiscoverySession> {
  if (!args.sourceAssetId) throw new Error('discovery_source_asset_required')
  if (!args.seriesId) throw new Error('discovery_series_required')

  const { data, error } = await supabaseAdmin
    .from('discovery_sessions')
    .insert({
      user_id: args.userId ?? null,
      source_asset_id: args.sourceAssetId,
      current_series_id: args.seriesId,
      current_silo_id: null,
      selected_effect_ids: [],
      visited_effect_ids: [],
      curator_recommended_effect_ids: [],
    })
    .select()
    .single()
  if (error) throw new Error(`discovery_session_create_failed: ${error.message}`)
  return rowToSession(data as SessionRow)
}

export async function getSession(sessionId: string): Promise<DiscoverySession | null> {
  const { data, error } = await supabaseAdmin
    .from('discovery_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error(`discovery_session_read_failed: ${error.message}`)
  return data ? rowToSession(data as SessionRow) : null
}

export async function updateNavigation(
  sessionId: string, seriesId: string, siloId: string | null,
): Promise<DiscoverySession> {
  const { data, error } = await supabaseAdmin
    .from('discovery_sessions')
    .update({ current_series_id: seriesId, current_silo_id: siloId, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .select()
    .single()
  if (error) throw new Error(`discovery_session_navigate_failed: ${error.message}`)
  return rowToSession(data as SessionRow)
}

/** Core mutation, shared by select/remove/toggle. Idempotent per effectId. */
async function mutateSelection(
  sessionId: string,
  effectId: string,
  op: 'select' | 'remove' | 'toggle',
): Promise<MutationResult> {
  if (!effectId) throw new Error('discovery_effect_id_required')

  const existing = await getSession(sessionId)
  if (!existing) throw new Error('discovery_session_not_found')

  const wasSelected = existing.selectedEffectIds.includes(effectId)
  const willSelect = op === 'select' ? true : op === 'remove' ? false : !wasSelected

  const previousOffer = resolveSelectionOffer(existing.selectedEffectIds.length)

  let newSelected: string[]
  if (willSelect && !wasSelected) {
    // Preserve selection order - append. No duplicates, per spec section 5.
    newSelected = [...existing.selectedEffectIds, effectId]
  } else if (!willSelect && wasSelected) {
    // Compact order (spec section 5: "removing effects compacts selection
    // order unless a stable historical order is required elsewhere" - no
    // requirement for stable order has been specified, so compacting).
    newSelected = existing.selectedEffectIds.filter((id) => id !== effectId)
  } else {
    // No-op: select-when-already-selected, or remove-when-not-selected.
    // Idempotent per spec section 5 - return current state unchanged.
    newSelected = existing.selectedEffectIds
  }

  const newVisited = existing.visitedEffectIds.includes(effectId)
    ? existing.visitedEffectIds
    : [...existing.visitedEffectIds, effectId]

  const { data, error } = await supabaseAdmin
    .from('discovery_sessions')
    .update({
      selected_effect_ids: newSelected,
      visited_effect_ids: newVisited,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .select()
    .single()
  if (error) throw new Error(`discovery_session_mutate_failed: ${error.message}`)

  const session = rowToSession(data as SessionRow)
  const offer = resolveSelectionOffer(session.selectedEffectIds.length)
  const tierChange = computeTierChange(previousOffer.tier, offer.tier)

  return { session, offer, tierChange }
}

export async function selectEffect(sessionId: string, effectId: string): Promise<MutationResult> {
  return mutateSelection(sessionId, effectId, 'select')
}

export async function removeEffect(sessionId: string, effectId: string): Promise<MutationResult> {
  return mutateSelection(sessionId, effectId, 'remove')
}

export async function toggleEffect(sessionId: string, effectId: string): Promise<MutationResult> {
  return mutateSelection(sessionId, effectId, 'toggle')
}
