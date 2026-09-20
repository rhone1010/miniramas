import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Display-only review contract. Never imported by checkout or fulfillment.
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') return new NextResponse(null, { status: 404 })
  const offers = [
    { count: 1, cents: 299 }, { count: 3, cents: 799 },
    { count: 5, cents: 1299 }, { count: 10, cents: 1999 },
  ]
  const base = { uiOnly: true, checkoutEnabled: false, offers }
  const user = await getUser()
  if (!user) return NextResponse.json({ ...base, balance: null, lockedCount: null, all: null })
  try {
    const read = async (query: any): Promise<any[]> => {
      const { data, error } = await query
      if (error) throw new Error('collection_read_failed')
      return data ?? []
    }
    const portfolios = await read(supabaseAdmin.from('portfolios')
      .select('id,purchase_id').eq('user_id', user.id))
    const purchases = await read(supabaseAdmin.from('purchases')
      .select('id').eq('user_id', user.id).eq('status', 'paid'))
    const paid = new Set(purchases.map(p => p.id))
    const scoped = new Set(portfolios.map(p => p.purchase_id))
    const ents = await read(supabaseAdmin.from('entitlements')
      .select('purchase_id,locked_style,locked_variant').eq('user_id', user.id).eq('status', 'available'))
    const included = ents.filter(e => paid.has(e.purchase_id) && scoped.has(e.purchase_id)).length
    // No reusable package entitlements have been introduced by this UI deployment.
    // Do not treat unrelated generation credits or bound single unlocks as reusable.
    const reusable = ents.filter(e => paid.has(e.purchase_id) &&
      e.locked_style === 'discovery_unlock_credit' && e.locked_variant === null).length
    const items = portfolios.length ? await read(supabaseAdmin.from('portfolio_items')
      .select('preview_id').in('portfolio_id', portfolios.map(p => p.id)).eq('status', 'done')) : []
    const ids = [...new Set(items.map(i => i.preview_id).filter(Boolean))]
    const ledger = ids.length ? await read(supabaseAdmin.from('preview_ledger')
      .select('id,unlocked_at').in('id', ids)) : []
    const lockedCount = ledger.filter(r => r.unlocked_at === null).length
    const rateCents = lockedCount >= 20 ? 159 : 179
    return NextResponse.json({ ...base, balance: { included, reusable, total: included + reusable },
      lockedCount, all: lockedCount >= 10 ? { count: lockedCount, rateCents, cents: lockedCount * rateCents } : null })
  } catch {
    return NextResponse.json({ ...base, balance: null, lockedCount: null, all: null, unavailable: true })
  }
}
