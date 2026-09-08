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
// NOTE ON after(): this route's after() callback does not execute in this
// Vercel environment — a POST returns 202 in ~484ms with no outgoing requests
// and the render never runs. That is why items/render-poll exists and is the
// reliable path. after() is left in place rather than removed because
// removing it is a behaviour change to a route that is now secret-gated and
// effectively unused; see the PR for the recommendation to retire it.

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
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

  after(() => {
    renderOnePortfolioItem(portfolioItemId).catch((err) => {
      console.error(`[portfolios/items/render] unhandled error for ${portfolioItemId}`, err)
    })
  })

  return NextResponse.json({ accepted: true }, { status: 202 })
}
