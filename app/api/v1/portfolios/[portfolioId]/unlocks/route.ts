// app/api/v1/portfolios/[portfolioId]/unlocks/route.ts
//
// GET returns unlock entitlement state for a portfolio:
//   - includedTotal:       free unlocks bundled with the portfolio purchase
//   - includedRemaining:   how many of those are still available
//   - additionalAvailable: available entitlements from OTHER purchases (extra credits)
//   - items:               per-slot unlock status (which effects are unlocked)
//
// Auth required, owner check.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/store/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: { portfolioId: string } },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  // ── Portfolio row ──────────────────────────────────────────────
  const { data: portfolio, error: portfolioErr } = await supabaseAdmin
    .from('portfolios')
    .select('id, user_id, purchase_id, free_unlocks, status')
    .eq('id', params.portfolioId)
    .maybeSingle()
  if (portfolioErr) return NextResponse.json({ error: 'portfolio_query_failed' }, { status: 500 })
  if (!portfolio) return NextResponse.json({ error: 'portfolio_not_found' }, { status: 404 })
  if (portfolio.user_id !== user.id) return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })

  // ── Entitlements from THIS portfolio's purchase ────────────────
  const { data: ownEnts, error: ownErr } = await supabaseAdmin
    .from('entitlements')
    .select('id, status')
    .eq('purchase_id', portfolio.purchase_id)
  if (ownErr) return NextResponse.json({ error: 'entitlements_query_failed' }, { status: 500 })

  const includedTotal = portfolio.free_unlocks ?? 0
  const includedRemaining = (ownEnts ?? []).filter((e) => e.status === 'available').length

  // ── Additional entitlements from OTHER purchases ───────────────
  const { data: otherEnts, error: otherErr } = await supabaseAdmin
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'available')
    .neq('purchase_id', portfolio.purchase_id)
  if (otherErr) return NextResponse.json({ error: 'additional_entitlements_query_failed' }, { status: 500 })
  const additionalAvailable = otherEnts ?? 0

  // ── Portfolio items + unlock status from preview_ledger ────────
  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('portfolio_items')
    .select('slot, preset, status, preview_id')
    .eq('portfolio_id', portfolio.id)
    .order('slot', { ascending: true })
  if (itemsErr) return NextResponse.json({ error: 'items_query_failed' }, { status: 500 })

  // Batch-fetch unlocked_at from preview_ledger for all items that have a preview_id
  const previewIds = (items ?? []).map((i) => i.preview_id).filter(Boolean) as string[]
  let unlockedSet = new Set<string>()
  if (previewIds.length > 0) {
    const { data: ledgerRows } = await supabaseAdmin
      .from('preview_ledger')
      .select('id, unlocked_at')
      .in('id', previewIds)
      .not('unlocked_at', 'is', null)
    for (const row of ledgerRows ?? []) {
      unlockedSet.add(row.id)
    }
  }

  return NextResponse.json({
    portfolioId: portfolio.id,
    includedTotal,
    includedRemaining,
    additionalAvailable,
    items: (items ?? []).map((i) => ({
      slot: i.slot,
      preset: i.preset,
      renderStatus: i.status,
      previewId: i.preview_id ?? null,
      unlocked: i.preview_id ? unlockedSet.has(i.preview_id) : false,
    })),
  })
}
