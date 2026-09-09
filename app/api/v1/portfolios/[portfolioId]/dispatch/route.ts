// app/api/v1/portfolios/[portfolioId]/dispatch/route.ts
//
// Start every outstanding render for one paid portfolio, now.
//
// WHY THIS EXISTS. Until this route, the only thing that started a Discovery
// render was the cron poller: three items per tick, one after another, every
// two minutes. A four-pack's fourth image could be four minutes behind the
// first, and none of that delay bought anything — it was a recovery
// mechanism doing a scheduler's job.
//
// THE LIFECYCLE PROBLEM THIS AVOIDS. The previous attempt fired the same
// requests from inside the Stripe webhook without awaiting them, and relied
// on after() for the work itself. Neither survives: Vercel may freeze an
// invocation once its response is sent, so work that has not been awaited is
// not work that has been done. That is why nothing rendered.
//
// This route awaits Promise.allSettled over the fan-out, and each child
// answers only when its item is finished. So the parent cannot return before
// its children have been accepted and run — there is no fire-and-forget step
// anywhere in the chain. The browser is free to leave: the invocation is
// already accepted server-side, the items it started are independent
// invocations of their own, and anything it misses is what cron is for.
//
// NO STAGGER. Portraits spreads its starts by 3.5s to spread the burst to
// NB2 (portraits.html:6898). Rich removed that constraint for Discovery on
// 2026-09-09: a purchased batch of 4, 8 or 16 starts at once. Nothing here
// delays item 2.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/store/auth'
import { getAppUrl } from '@/lib/store/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* The fan-out is parallel, so the wall clock is one render, not N of them —
   measured at 11.6-25.8s in production. 300 is the ceiling this platform
   allows and leaves room for a slow one without ever being the binding
   constraint on batch size. */
export const maxDuration = 300

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ portfolioId: string }> },
) {
  const { portfolioId } = await ctx.params

  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const { data: portfolio, error: portfolioErr } = await supabaseAdmin
    .from('portfolios')
    .select('id, user_id, series, status')
    .eq('id', portfolioId)
    .maybeSingle()
  if (portfolioErr) return NextResponse.json({ error: 'portfolio_query_failed' }, { status: 500 })
  if (!portfolio) return NextResponse.json({ error: 'portfolio_not_found' }, { status: 404 })
  if (portfolio.user_id !== user.id) return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })

  /* 'generating' is the only state worth dispatching, and it is the proof of
     payment: activatePortfolio sets it, and it only runs once confirmPurchase
     has said the money moved. A caller cannot start unbought work by asking. */
  if (portfolio.status !== 'generating') {
    return NextResponse.json(
      { dispatched: 0, reason: 'portfolio_not_generating', status: portfolio.status },
      { status: 200 },
    )
  }

  /* Same series guard the poller uses: renderOnePortfolioItem returns early
     for anything but portraits, so dispatching them would claim rows the
     render cannot advance. */
  if (portfolio.series !== 'portraits') {
    return NextResponse.json(
      { dispatched: 0, reason: 'series_not_wired', series: portfolio.series },
      { status: 200 },
    )
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('portfolio_items')
    .select('id')
    .eq('portfolio_id', portfolio.id)
    .eq('status', 'pending')
    .order('slot', { ascending: true })
  if (itemsErr) return NextResponse.json({ error: 'items_query_failed' }, { status: 500 })

  const pending = items ?? []
  if (pending.length === 0) {
    return NextResponse.json({ dispatched: 0, reason: 'nothing_pending' }, { status: 200 })
  }

  /* Same stance the Stripe webhook takes on a missing signing secret: an
     unconfigured deployment refuses rather than firing a fan-out that every
     child will reject. */
  if (!process.env.CRON_SECRET) {
    console.error('[dispatch] CRON_SECRET not set — refusing to dispatch')
    return NextResponse.json({ error: 'internal_auth_not_configured' }, { status: 503 })
  }

  const appUrl = getAppUrl()
  const startedAt = Date.now()

  /* All of them, at once. Each is its own invocation with its own 300s and
     its own memory, so a slow or failed one costs only itself. The claim
     lives in the child, so a cron tick landing mid-flight takes nothing. */
  const results = await Promise.allSettled(
    pending.map((item) =>
      fetch(`${appUrl}/api/v1/portfolios/items/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          /* items/render is secret-gated (checkInternalAuth). This is the
             only caller that reaches it over HTTP; the cron poller calls
             renderOnePortfolioItem in-process and needs no header. */
          Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
        },
        body: JSON.stringify({ portfolioItemId: item.id }),
      }).then(async (res) => {
        if (!res.ok) {
          const body = (await res.text().catch(() => '')).slice(0, 200)
          throw new Error(`HTTP ${res.status} ${body}`)
        }
        return res.json().catch(() => ({}))
      }),
    ),
  )

  let rendered = 0
  let skipped = 0
  let failed = 0
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      failed++
      console.error(`[dispatch] item ${pending[i].id} failed:`, r.reason?.message ?? r.reason)
    } else if (r.value?.rendered) {
      rendered++
    } else {
      skipped++
    }
  })

  const summary = {
    portfolioId: portfolio.id,
    dispatched: pending.length,
    rendered,
    skipped,
    failed,
    ms: Date.now() - startedAt,
  }
  console.log('[dispatch]', JSON.stringify(summary))
  return NextResponse.json(summary, { status: 200 })
}
