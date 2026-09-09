// app/api/v1/portfolios/items/render-poll/route.ts
//
// The reliable trigger for portfolio renders. Vercel Cron calls this on a
// schedule; it finds real, activated, waiting work and runs it.
//
// RECOVERY, NOT THE SCHEDULE. The fast path is now
// /portfolios/[portfolioId]/dispatch, which the client calls the moment a
// paid portfolio is activated and which starts every outstanding item at
// once. This tick exists for what that misses: a customer who closed the tab
// before dispatch landed, a dispatch that failed, and rows stranded at
// 'rendering' by an invocation that died mid-render. Its three-per-tick limit
// is therefore a recovery pace, not a customer-visible schedule.
//
// WHY IT EXISTS AT ALL. Rendering used to be triggered by after() inside
// items/render. Measured on production 2026-09-07: that POST returns 202 in
// ~484ms and Vercel records "No outgoing requests" — the callback never runs.
// It has never run in this environment. Nothing else ever started a render,
// which is why paid portfolios sat at 'generating' with attempts=0 and no
// error, indefinitely.
//
// A poller does not depend on the platform honouring a background callback.
// The work is in the database; every tick asks what is outstanding and does
// some of it. A missed tick costs latency, not the job.
//
// WHAT IT PICKS UP. portfolio_items at 'pending' whose portfolio is
// 'generating' and series 'portraits'. All three conditions matter:
//   · 'generating' means activatePortfolio ran, which means the purchase was
//     confirmed paid. A 'pending' portfolio has not been paid for and its
//     items must never render.
//   · 'portraits' because renderOnePortfolioItem returns early for every
//     other series (portfolio-render.ts). Selecting them would claim rows the
//     render cannot advance, stranding them at 'rendering' forever.
//
// CLAIMING. Two ticks overlap whenever a render outlasts the cron interval,
// which is the normal case here. Each item is claimed with a conditional
// update — set 'rendering' where the row is still 'pending' — and skipped
// unless that update actually matched a row. Postgres serialises the two
// writers, so exactly one tick wins and no item is ever rendered (or billed)
// twice. 'rendering' is not a new state: failWholePortfolio and
// maybeFlipReady already treat it as work in flight.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkInternalAuth } from '@/lib/store/internal-auth'
import { renderOnePortfolioItem } from '@/lib/store/portfolio-render'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/* At most this many items per tick, and stop STARTING new ones once this much
   of the budget is gone — a render takes tens of seconds to a few minutes, so
   beginning one near the ceiling just gets it killed mid-flight and strands
   the row at 'rendering'. Whatever is left waits for the next tick, which is
   two minutes away. */
const MAX_ITEMS_PER_TICK = 3
const STOP_STARTING_AFTER_MS = 120_000

/* A row is stranded, not working, after this long at 'rendering'.
   Derived, not picked: items/render carries maxDuration = 300, so no
   invocation holding a claim can still be alive past 300 seconds. Doubling
   that covers cold start, clock skew and the gap between the claim write and
   the render actually beginning. The asymmetry argues for erring long —
   reclaiming too early means two NB2 renders and two charges for one image,
   reclaiming too late costs only minutes on a row that is already dead.
   Approved 2026-09-09. */
const STALE_RENDERING_MS = 600_000

export async function GET(req: NextRequest) {
  const auth = checkInternalAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const startedAt = Date.now()

  /* RECLAIM FIRST. An item is claimed by flipping 'pending' -> 'rendering'.
     If the invocation holding it dies — timeout, deploy mid-flight, a cold
     start that never finishes — nothing else would ever select it again,
     because every scan looks for 'pending'. A paid image would sit there for
     good, with no error and no retry. Put anything older than the threshold
     back so the scan below can pick it up; attempts is untouched, so
     decideRetry still governs how many real tries it gets. */
  const staleBefore = new Date(Date.now() - STALE_RENDERING_MS).toISOString()
  const { data: reclaimedRows, error: reclaimErr } = await supabaseAdmin
    .from('portfolio_items')
    .update({ status: 'pending', rendering_started_at: null })
    .eq('status', 'rendering')
    .lt('rendering_started_at', staleBefore)
    .select('id')
  if (reclaimErr) console.error('[render-poll] stale reclaim failed:', reclaimErr.message)
  const reclaimed = reclaimedRows?.length ?? 0
  if (reclaimed > 0) {
    console.warn(`[render-poll] reclaimed ${reclaimed} item(s) stranded at 'rendering' for over ${STALE_RENDERING_MS / 1000}s`)
  }

  /* Two queries rather than one embedded join. PostgREST can filter on an
     embedded resource, but the embed is named after the foreign key and this
     schema has no migration in the repo to name it from. Two plain queries
     cannot be wrong about a relationship name. */
  const { data: portfolios, error: portfolioErr } = await supabaseAdmin
    .from('portfolios')
    .select('id')
    .eq('status', 'generating')
    .eq('series', 'portraits')
  if (portfolioErr) {
    console.error('[render-poll] portfolio query failed:', portfolioErr.message)
    return NextResponse.json({ error: 'portfolio_query_failed' }, { status: 500 })
  }

  const portfolioIds = (portfolios ?? []).map((p) => p.id)
  if (portfolioIds.length === 0) {
    return NextResponse.json({ reclaimed, scanned: 0, claimed: 0, rendered: 0, skipped: 0 })
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('portfolio_items')
    .select('id')
    .eq('status', 'pending')
    .in('portfolio_id', portfolioIds)
    .order('slot', { ascending: true })
    .limit(MAX_ITEMS_PER_TICK)
  if (itemsErr) {
    console.error('[render-poll] item query failed:', itemsErr.message)
    return NextResponse.json({ error: 'item_query_failed' }, { status: 500 })
  }

  const scanned = (items ?? []).length
  let claimed = 0
  let rendered = 0
  let failed = 0
  let skipped = 0

  for (const item of items ?? []) {
    if (Date.now() - startedAt > STOP_STARTING_AFTER_MS) {
      skipped++
      continue
    }

    /* The claim. .select() makes the update return the rows it actually
       touched: one row means this tick won it, zero means another tick took
       it between the read above and now. */
    const { data: claimedRows, error: claimErr } = await supabaseAdmin
      .from('portfolio_items')
      .update({ status: 'rendering', rendering_started_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select('id')
    if (claimErr) {
      console.error(`[render-poll] claim failed for ${item.id}:`, claimErr.message)
      skipped++
      continue
    }
    if (!claimedRows || claimedRows.length === 0) {
      skipped++
      continue
    }

    claimed++
    try {
      await renderOnePortfolioItem(item.id)
      rendered++
    } catch (err) {
      /* renderOnePortfolioItem writes its own failure state and does not
         normally throw. If it does, the row is still at 'rendering' and would
         never be picked up again, so put it back to 'pending' for the next
         tick — decideRetry still governs how many real attempts it gets. */
      failed++
      console.error(`[render-poll] render threw for ${item.id}:`, err)
      await supabaseAdmin
        .from('portfolio_items')
        .update({ status: 'pending' })
        .eq('id', item.id)
        .eq('status', 'rendering')
    }
  }

  const summary = { reclaimed, scanned, claimed, rendered, failed, skipped, ms: Date.now() - startedAt }
  console.log('[render-poll]', JSON.stringify(summary))
  return NextResponse.json(summary)
}
