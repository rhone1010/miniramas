// Account uses the existing reusable Unlock balance and purchase records.
import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { collectionUnlockBalance, COLLECTION_UNLOCK_LOCK, COLLECTION_UNLOCK_OFFERS } from '@/lib/store/collection-unlocks'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ user: null }, { status: 401 })
  async function soft<T>(read: () => Promise<T>): Promise<T | null> {
    try { return await read() } catch { return null }
  }
  const [balance, ledger, purchases] = await Promise.all([
    soft(() => collectionUnlockBalance(user.id)),
    soft(async () => {
      const { data, error } = await supabaseAdmin.from('entitlements')
        .select('consumed_at,purchases!inner(status)')
        .eq('user_id', user.id).eq('locked_style', COLLECTION_UNLOCK_LOCK)
        .eq('status', 'consumed').eq('purchases.status', 'paid')
        .order('consumed_at', { ascending: false }).limit(40)
      if (error) throw error
      return (data ?? []).map(r => ({ delta: -1, reason: 'unlock', created_at: r.consumed_at }))
    }),
    soft(async () => {
      const { data, error } = await supabaseAdmin.from('purchases')
        .select('sku_id,amount_cents,status,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      return (data ?? []).map(r => {
        const offer = COLLECTION_UNLOCK_OFFERS.find(o => o.sku === r.sku_id)
        const label = offer ? `${offer.count} Collection Unlock${offer.count === 1 ? '' : 's'}`
          : r.sku_id === 'unlock_addon_1' ? 'Collection artwork unlock purchase'
          : r.sku_id === 'single' || String(r.sku_id || '').startsWith('basket_discover_') ? 'Crafted Collection'
          : 'Purchase'
        return { ...r, label }
      })
    }),
  ])
  return NextResponse.json({
    user: { id: user.id, email: user.email ?? null, since: (user as any).created_at ?? null },
    unlocks: balance === null ? null : { reusable: balance }, ledger, purchases,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

// ── DELETE ───────────────────────────────────────────────────
//
// Unchanged in behaviour. Two notes, both worth acting on before this is put
// in front of a customer:
//
//   1 · The forfeited count reads `entitlements`, which is the superseded
//       preview-then-unlock model. Under credits the number that matters is
//       credit_balances.balance, and this will report 0 while a customer
//       destroys a real balance.
//
//   2 · There is no confirmation here and no undo anywhere. A DELETE that
//       reaches this route has already happened. Whatever calls it needs to
//       be certain — the glass does not call it today.
export async function DELETE() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // What is actually being forfeited, under the model that governs.
  const { data: bal } = await supabaseAdmin
    .from('credit_balances')
    .select('balance')
    .eq('owner_key', user.id)
    .maybeSingle()

  const forfeitedCredits = bal?.balance ?? 0
  if (forfeitedCredits > 0) {
    console.warn(
      '[account/delete] forfeited_credits',
      `userId=${user.id}`,
      `credits=${forfeitedCredits}`,
    )
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('[account/delete] auth.admin.deleteUser failed', error.message)
    return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, forfeited: forfeitedCredits })
}
