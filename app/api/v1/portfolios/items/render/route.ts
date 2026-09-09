// app/api/v1/portfolios/items/render/route.ts
// Renamed and behavior-fixed from baskets/items/render. On failure:
// retries the SAME preset (decideRetry, MAX_RETRY_ATTEMPTS=3) instead of
// substituting a different effect - per product spec section 13.
//
// Halloween still refused, not guessed - unchanged from basket version.
//
// 2026-09-07 — two changes, no change to the render work itself:
//
//   1. The render/watermark/upload functions moved verbatim to
//      lib/store/portfolio-render.ts so the cron poller and this route share
//      one implementation. This file now only triggers; it no longer defines.
//
//   2. This route is no longer open to the internet. It accepted any
//      portfolioItemId from any caller and started a paid render, shielded on
//      preview only by Vercel's deployment protection and not at all on
//      production. It now requires the internal shared secret.
//
// after() IS GONE. It never executed in this Vercel environment — a POST
// returned 202 in ~484ms with no outgoing requests and the render never ran.
// This route now does the work inside its own invocation and answers when the
// item is finished, so the caller learns the outcome and the platform has no
// opportunity to freeze anything mid-flight.
//
// IT ALSO CLAIMS. Two callers can now reach the same item: the dispatch that
// runs the moment a portfolio is activated, and the cron poller recovering
// what dispatch missed. The claim is a conditional update — 'pending' ->
// 'rendering' — so exactly one of them proceeds and an item is never rendered,
// or billed, twice. The claim stamps rendering_started_at (migration 028) so a
// row whose invocation dies can be told apart from one still working.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkInternalAuth } from '@/lib/store/internal-auth'
import { renderOnePortfolioItem } from '@/lib/store/portfolio-render'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = checkInternalAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const portfolioItemId = typeof body.portfolioItemId === 'string' ? body.portfolioItemId : ''
  if (!portfolioItemId) {
    return NextResponse.json({ error: 'portfolioItemId_required' }, { status: 400 })
  }

  /* Claim first. .select() returns the rows the update actually touched:
     one row means this invocation won it, zero means it was already taken —
     by the other caller, or by an earlier attempt of this one. */
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from('portfolio_items')
    .update({ status: 'rendering', rendering_started_at: new Date().toISOString() })
    .eq('id', portfolioItemId)
    .eq('status', 'pending')
    .select('id')
  if (claimErr) {
    console.error(`[portfolios/items/render] claim failed for ${portfolioItemId}:`, claimErr.message)
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }
  if (!claimed || claimed.length === 0) {
    /* Not an error. The item is already rendering, already done, or failed —
       whoever holds it will finish it. */
    return NextResponse.json({ rendered: false, reason: 'not_claimable' }, { status: 200 })
  }

  try {
    await renderOnePortfolioItem(portfolioItemId)
  } catch (err) {
    /* renderOnePortfolioItem writes its own failure state and does not
       normally throw. If it does, the row is still 'rendering' and no later
       caller would select it, so put it back for one. */
    console.error(`[portfolios/items/render] render threw for ${portfolioItemId}:`, err)
    await supabaseAdmin
      .from('portfolio_items')
      .update({ status: 'pending' })
      .eq('id', portfolioItemId)
      .eq('status', 'rendering')
    return NextResponse.json({ rendered: false, error: 'render_failed' }, { status: 500 })
  }

  return NextResponse.json({ rendered: true }, { status: 200 })
}
