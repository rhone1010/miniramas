// app/api/v1/portfolios/items/render/route.ts
// Renamed and behavior-fixed from baskets/items/render. On failure:
// retries the SAME preset (decideRetry, MAX_RETRY_ATTEMPTS=3) instead of
// substituting a different effect - per product spec section 13.
//
// Halloween still refused, not guessed - unchanged from basket version.

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAppUrl } from '@/lib/store/stripe'
import { storeCleanOriginal, bakeWatermark, recordPreview } from '@/lib/store/preview'
import { decideRetry } from '@/lib/store/portfolio-replace'
import { styleIdForPreset } from '@/lib/store/portraits-style-lookup'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
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

async function renderOnePortfolioItem(portfolioItemId: string): Promise<void> {
  const { data: item, error: itemErr } = await supabaseAdmin
    .from('portfolio_items')
    .select('id, portfolio_id, slot, preset, status, attempts')
    .eq('id', portfolioItemId)
    .maybeSingle()
  if (itemErr || !item) {
    console.error(`[portfolios/items/render] portfolio_item not found: ${portfolioItemId}`)
    return
  }

  const { data: portfolio, error: portfolioErr } = await supabaseAdmin
    .from('portfolios')
    .select('id, series, source_image')
    .eq('id', item.portfolio_id)
    .maybeSingle()
  if (portfolioErr || !portfolio) {
    console.error(`[portfolios/items/render] portfolio not found for item ${portfolioItemId}`)
    return
  }

  if (portfolio.series !== 'portraits') {
    console.error(
      `[portfolios/items/render] series '${portfolio.series}' not wired - only 'portraits' ` +
      `is implemented. Item ${portfolioItemId} left in its current state.`,
    )
    return
  }

  const styleId = styleIdForPreset(item.preset)
  const appUrl = getAppUrl()

  let genResult: any
  let ok = false
  try {
    const res = await fetch(`${appUrl}/api/v1/portraits/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_image_b64: portfolio.source_image,
        style_id: styleId,
        preset_id: item.preset,
        framing: 'bust',
        scale: 'close_up',
      }),
    })
    genResult = await res.json()

    if (res.status === 403 && genResult?.code === 'age_restricted') {
      await failWholePortfolio(portfolio.id, 'age_restricted')
      return
    }
    ok = res.ok && genResult?.result?.ok && !!genResult?.result?.image_b64
      && genResult?.status !== 'redirected' && genResult?.status !== 'intake_rejected'
  } catch (e: any) {
    console.error(`[portfolios/items/render] fetch to generate failed for ${portfolioItemId}`, e)
    ok = false
  }

  if (!ok) {
    await handleItemFailure(portfolioItemId, portfolio.id, item.attempts,
      genResult?.error || genResult?.status || 'generate_failed')
    return
  }

  const imageB64: string = genResult.result.image_b64
  const previewId = crypto.randomUUID()
  const storagePath = await storeCleanOriginal(supabaseAdmin, previewId, imageB64, portfolio.series)

  let watermarked: string
  try {
    watermarked = await bakeWatermark(imageB64)
  } catch (e: any) {
    console.error(`[portfolios/items/render] watermark bake FAILED for ${portfolioItemId}`, e)
    await handleItemFailure(portfolioItemId, portfolio.id, item.attempts, 'watermark_failed')
    return
  }

  await recordPreview(supabaseAdmin, {
    previewId,
    email: `portfolio:${portfolio.id}`,
    ipHash: `portfolio:${portfolio.id}`,
    series: portfolio.series,
    preset: item.preset,
    resolution: '1k',
    storagePath,
  })

  await supabaseAdmin
    .from('portfolio_items')
    .update({ status: 'done', preview_id: previewId })
    .eq('id', portfolioItemId)

  await maybeFlipReady(portfolio.id)
  console.log(`[portfolios/items/render] done item=${portfolioItemId} preview=${previewId}`)
}

/** Retry SAME effect, per product spec section 13. No substitution. */
async function handleItemFailure(
  portfolioItemId: string, portfolioId: string, currentAttempts: number, reason: string,
): Promise<void> {
  const decision = decideRetry(currentAttempts)

  if (!decision.shouldRetry) {
    await supabaseAdmin
      .from('portfolio_items')
      .update({ status: 'failed', attempts: decision.attemptNumber, error: reason })
      .eq('id', portfolioItemId)
    await maybeFlipReady(portfolioId)
    return
  }

  await supabaseAdmin
    .from('portfolio_items')
    .update({ status: 'pending', attempts: decision.attemptNumber, error: reason })
    .eq('id', portfolioItemId)

  const appUrl = getAppUrl()
  await fetch(`${appUrl}/api/v1/portfolios/items/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolioItemId }),
  }).catch((err) => {
    console.error(`[portfolios/items/render] retry fetch failed for ${portfolioItemId}`, err)
  })
}

async function failWholePortfolio(portfolioId: string, reason: string): Promise<void> {
  await supabaseAdmin
    .from('portfolio_items')
    .update({ status: 'failed', error: reason })
    .eq('portfolio_id', portfolioId)
    .in('status', ['pending', 'rendering'])
  await supabaseAdmin.from('portfolios').update({ status: 'failed' }).eq('id', portfolioId)
  console.error(`[portfolios/items/render] whole portfolio failed: ${portfolioId} reason=${reason}`)
}

async function maybeFlipReady(portfolioId: string): Promise<void> {
  const { data: items, error } = await supabaseAdmin
    .from('portfolio_items')
    .select('status')
    .eq('portfolio_id', portfolioId)
  if (error || !items) return
  const stillWorking = items.some((i) => i.status === 'pending' || i.status === 'rendering')
  if (stillWorking) return
  await supabaseAdmin.from('portfolios').update({ status: 'ready' }).eq('id', portfolioId)
}
