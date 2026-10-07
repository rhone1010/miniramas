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
  return { balance: { included, reusable, total: included + reusable } }
}
