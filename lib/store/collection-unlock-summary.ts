import { supabaseAdmin } from '@/lib/supabase'
import { collectionUnlockBalance } from './collection-unlocks'

// The same account/portfolio scope used by Collection's existing review.
export async function collectionUnlockSummary(userId: string) {
  const read = async (query: any): Promise<any[]> => {
    const { data, error } = await query
    if (error) throw new Error('collection_read_failed')
    return data ?? []
  }
  const portfolios = await read(supabaseAdmin.from('portfolios')
    .select('id,purchase_id').eq('user_id', userId))
  const purchases = await read(supabaseAdmin.from('purchases')
    .select('id').eq('user_id', userId).eq('status', 'paid'))
  const paid = new Set(purchases.map(p => p.id))
  const scoped = new Set(portfolios.map(p => p.purchase_id))
  const ents = await read(supabaseAdmin.from('entitlements')
    .select('purchase_id,locked_style,locked_variant').eq('user_id', userId).eq('status', 'available'))
  const included = ents.filter(e => paid.has(e.purchase_id) && scoped.has(e.purchase_id)).length
  const reusable = await collectionUnlockBalance(userId)
  const items = portfolios.length ? await read(supabaseAdmin.from('portfolio_items')
    .select('portfolio_id,slot,preview_id').in('portfolio_id', portfolios.map(p => p.id)).eq('status', 'done')) : []
  const ids = [...new Set(items.map(i => i.preview_id).filter(Boolean))]
  const ledger = ids.length ? await read(supabaseAdmin.from('preview_ledger')
    .select('id,email,storage_path,unlocked_at').in('id', ids)) : []
  const eligible = ledger.filter(r => r.unlocked_at === null && r.storage_path &&
    items.some(i => i.preview_id === r.id && r.email === `portfolio:${i.portfolio_id}:${i.slot}`))
  const lockedCount = eligible.length
  const rateCents = lockedCount >= 20 ? 159 : 179
  return { balance: { included, reusable, total: included + reusable }, lockedCount,
    all: lockedCount >= 10 ? { count: lockedCount, rateCents, cents: lockedCount * rateCents } : null }
}
