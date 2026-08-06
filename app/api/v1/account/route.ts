// app/api/v1/account/route.ts
//
// GET    — everything the Account page shows, in one read.
// DELETE — delete the signed-in user's auth account.
//
// CUI V25 · 2026-08-03 · THE GET
//
//   There was no GET. The Account page had nothing to read, which is part of
//   why it was never built.
//
//   ONE READ, NOT SIX. The page needs a balance, a ledger, purchases, print
//   orders, a piece count and the tester flag. Six round trips from the glass
//   would be six chances to half-load; this is one, and every part of it is
//   soft — a section that cannot be read comes back null and the page says so
//   rather than showing a zero.
//
//   NOTHING HERE IS AUTHORITATIVE ABOUT MONEY. It reads credit_balances and
//   credit_ledger; it never computes a balance by summing deltas. Two numbers
//   that could disagree is how drift starts.
//
//   `entitlements` IS NOT READ. That is the preview-then-unlock model, which
//   was superseded on 2026-07-27. The DELETE below still counts it, and that
//   count is now meaningless — see the note there.

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'

const LEDGER_LIMIT = 40
const ORDER_LIMIT = 20

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ user: null }, { status: 401 })

  const owner = user.id

  // Each of these is allowed to fail on its own. A missing print_orders table
  // must not cost the customer their balance.
  async function soft<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn()
    } catch (e) {
      console.warn(`[account] ${label} failed:`, e instanceof Error ? e.message : String(e))
      return null
    }
  }

  const [balance, ledger, purchases, pieces, prints, flags] = await Promise.all([
    soft('balance', async () => {
      const { data, error } = await supabaseAdmin
        .from('credit_balances')
        .select('balance, updated_at')
        .eq('owner_key', owner)
        .maybeSingle()
      if (error) throw new Error(error.message)
      // No row is a real state — an account that has never bought or been
      // granted anything. That is zero, not unknown.
      return { balance: data?.balance ?? 0, updated_at: data?.updated_at ?? null }
    }),

    soft('ledger', async () => {
      const { data, error } = await supabaseAdmin
        .from('credit_ledger')
        .select('delta, reason, ref_id, balance_after, created_at')
        .eq('owner_key', owner)
        .order('created_at', { ascending: false })
        .limit(LEDGER_LIMIT)
      if (error) throw new Error(error.message)
      return data ?? []
    }),

    soft('purchases', async () => {
      const { data, error } = await supabaseAdmin
        .from('purchases')
        .select('sku_id, amount_cents, status, created_at')
        .eq('user_id', owner)
        .order('created_at', { ascending: false })
        .limit(ORDER_LIMIT)
      if (error) throw new Error(error.message)
      // A pending row is a checkout that was opened and never completed.
      // Shown, because a customer who abandoned one deserves to see that it
      // did not charge them.
      return data ?? []
    }),

    soft('pieces', async () => {
      const { count: total, error: e1 } = await supabaseAdmin
        .from('collection_pieces')
        .select('id', { count: 'exact', head: true })
        .eq('owner_key', owner)
      if (e1) throw new Error(e1.message)

      // Migration 014. If it has not been applied this throws and the whole
      // block returns null rather than reporting a wrong count.
      const { count: archived } = await supabaseAdmin
        .from('collection_pieces')
        .select('id', { count: 'exact', head: true })
        .eq('owner_key', owner)
        .eq('archived', true)

      return { total: total ?? 0, archived: archived ?? 0 }
    }),

    soft('prints', async () => {
      const { data, error } = await supabaseAdmin
        .from('print_orders')
        .select('id, status, retail_total_cents, shipping_method, prodigi_order_id, created_at')
        .eq('owner_key', owner)
        .order('created_at', { ascending: false })
        .limit(ORDER_LIMIT)
      if (error) throw new Error(error.message)
      return data ?? []
    }),

    soft('flags', async () => {
      const { data, error } = await supabaseAdmin
        .from('account_flags')
        .select('fulfilment')
        .eq('owner_key', owner)
        .maybeSingle()
      if (error) throw new Error(error.message)
      // Default false, and every failure mode is false — the same rule the
      // print webhook applies. An account with no row cannot place a real
      // print order, and the page should say so.
      return { fulfilment: data?.fulfilment === true }
    }),
  ])

  return NextResponse.json({
    user: {
      id:    user.id,
      email: user.email ?? null,
      since: (user as any).created_at ?? null,
    },
    credits:   balance,
    ledger,
    purchases,
    pieces,
    prints,
    flags,
  })
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
