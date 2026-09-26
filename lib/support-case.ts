import { supabaseAdmin as db } from '@/lib/supabase'

export const ISSUES = ['likeness', 'details', 'quality', 'other'] as const
export const REMEDIES = ['redo', 'refund', 'contact'] as const
export class CaseError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function read(query: any) {
  const { data, error } = await query
  if (error) throw new CaseError('context_unavailable', 503)
  return data
}

// No client-supplied price, ownership, purchase or status is authoritative.
// Stable IDs are retained for a later authorized remedy; this module executes none.
export async function verifyCase(userId: string, input: any) {
  if (!ISSUES.includes(input?.issue) || !REMEDIES.includes(input?.remedy)) throw new CaseError('invalid_case')
  const art = input?.artwork
  if (!art || !uuid.test(art.id)) throw new CaseError('invalid_artwork')
  let artwork: any
  const links = new Map<string, Set<string>>()
  const link = (id: string | null, role: string) => {
    if (!id) return
    if (!links.has(id)) links.set(id, new Set())
    links.get(id)!.add(role)
  }
  if (art.kind === 'portfolio') {
    if (!uuid.test(art.portfolioId)) throw new CaseError('invalid_artwork')
    const portfolio = await read(db.from('portfolios').select('id,series,purchase_id')
      .eq('id', art.portfolioId).eq('user_id', userId).maybeSingle())
    if (!portfolio) throw new CaseError('artwork_not_found', 404)
    const item = await read(db.from('portfolio_items').select('slot,preset,status,preview_id')
      .eq('portfolio_id', portfolio.id).eq('preview_id', art.id).maybeSingle())
    if (!item || item.status !== 'done') throw new CaseError('artwork_not_found', 404)
    artwork = { kind: 'portfolio', id: item.preview_id, portfolioId: portfolio.id,
      slot: item.slot, preset: item.preset, series: portfolio.series }
    link(portfolio.purchase_id, 'craft')
    const entitlements = await read(db.from('entitlements').select('purchase_id')
      .eq('user_id', userId).eq('locked_variant', art.id).eq('status', 'consumed'))
    for (const e of entitlements || []) link(e.purchase_id, 'unlock')
    const sets = await read(db.from('collection_unlock_sets').select('purchase_id,fulfilled_at')
      .eq('user_id', userId).contains('preview_ids', [art.id]))
    for (const set of sets || []) if (set.fulfilled_at) link(set.purchase_id, 'collection_set')
  } else if (art.kind === 'piece') {
    const piece = await read(db.from('collection_pieces').select('id,series,preset')
      .eq('id', art.id).eq('owner_key', userId).maybeSingle())
    if (!piece) throw new CaseError('artwork_not_found', 404)
    artwork = { kind: 'piece', id: piece.id, series: piece.series, preset: piece.preset }
    // Older pieces have no reliable per-piece purchase relation. Preserve that
    // fact rather than matching by price/date or treating an arbitrary order as proof.
  } else throw new CaseError('invalid_artwork')
  const purchases = links.size ? await read(db.from('purchases')
    .select('id,sku_id,status,amount_cents,created_at').eq('user_id', userId).in('id', [...links.keys()])) : []
  const now = new Date().toISOString()
  return { version: 1, kind: 'make_it_right', customer_id: userId, artwork,
    purchases: (purchases || []).map((p: any) => ({ ...p, roles: [...links.get(p.id)!] })),
    purchase_context: purchases?.length ? 'verified_links' : 'requires_review',
    issue: input.issue, requested_remedy: input.remedy, status: 'requested',
    created_at: now, updated_at: now,
    events: [{ at: now, actor: userId, decision: 'requested', remedy: input.remedy }] }
}
