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
import { storeCleanOriginal, bakeWatermark, recordPreview, PREVIEW_BUCKET } from '@/lib/store/preview'
import { decideRetry } from '@/lib/store/portfolio-replace'
import { styleIdForPreset } from '@/lib/store/portraits-style-lookup'
import { internalHeaders } from '@/lib/store/internal-fetch'
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
  try {
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
      .select('id, series, source_image, composition')
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

    /* The composition block, one per portfolio (migration 025). Absent on
       every portfolio bought before that migration, and absent until it is
       applied — an empty block renders exactly as this route did before,
       because the fallbacks below are the values it used to hardcode. */
    const comp = (portfolio.composition ?? {}) as Record<string, unknown>
    const compStr = (k: string): string | undefined =>
      typeof comp[k] === 'string' && comp[k] ? (comp[k] as string) : undefined

    let genResult: any
    let ok = false
    try {
      const res = await fetch(`${appUrl}/api/v1/portraits/generate`, {
        method: 'POST',
        headers: internalHeaders({ 'Content-Type': 'application/json' }),
        /* Ported in shape from portraits.html:6807-6824 payloadFor(). What
           Discovery collects travels; what it does not collect is omitted, so
           /portraits/generate applies its documented defaults rather than a
           value invented here.

           framing keeps 'bust' as its fallback deliberately. The route's own
           default is 'signature' (portraits-shared.ts:311) and dropping the
           field would silently recompose every Discovery piece. Note for Rich,
           not fixed here: framing is authoritative over aspect_ratio at
           generate/route.ts:252-253, so the customer's Shape choice does not
           currently reach the render. That is a design call, not plumbing. */
        body: JSON.stringify({
          source_image_b64: portfolio.source_image,
          style_id: styleId,
          preset_id: item.preset,
          framing: compStr('framing') ?? 'bust',
          scale: compStr('scale') ?? 'close_up',
          pose: compStr('pose'),
          aspect_ratio: compStr('aspect_ratio'),
          subject: compStr('subject'),
          location: compStr('location'),
          resolution: compStr('resolution'),
          focal: comp.focal ?? undefined,
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

    // Persist the watermarked bytes alongside the clean original.
    // Clean original lives at {series}/{previewId}.png (for unlock/print).
    // Watermarked lives at watermarked/{series}/{previewId}.png (for preview display).
    const wmPath = `watermarked/${portfolio.series}/${previewId}.png`
    const { error: wmUpErr } = await supabaseAdmin.storage
      .from(PREVIEW_BUCKET)
      .upload(wmPath, Buffer.from(watermarked, 'base64'), {
        contentType: 'image/png',
        upsert: true,
      })
    if (wmUpErr) {
      console.error(`[portfolios/items/render] watermark upload FAILED for ${portfolioItemId}:`, wmUpErr.message)
      await handleItemFailure(portfolioItemId, portfolio.id, item.attempts, 'watermark_upload_failed')
      return
    }

    /* THE SLOT IS PART OF THE KEY, and it has to be. preview_ledger has a
       UNIQUE constraint on email (uq_preview_ledger_email), and this wrote
       `portfolio:{id}` for every item of a portfolio — identical for all of
       them. So the first item inserted its ledger row and every other item
       was rejected as a duplicate. recordPreview logs that and returns
       false (preview.ts:91-94), the route ignored the answer, and the item
       was still marked done.

       The damage is invisible until the customer tries to unlock: the
       unlock route resolves the clean original through preview_ledger
       (unlock/route.ts:51-57), so for a portfolio of four, three pieces
       would answer preview_not_found for a preview that is sitting in
       storage. Proved against the live database 2026-09-07 — a second
       insert with the same email is rejected outright.

       Verified rather than assumed now: a preview nobody can unlock is not
       a finished piece, so a failed ledger write fails the item. */
    const ledgered = await recordPreview(supabaseAdmin, {
      previewId,
      email: `portfolio:${portfolio.id}:${item.slot}`,
      ipHash: `portfolio:${portfolio.id}:${item.slot}`,
      series: portfolio.series,
      preset: item.preset,
      resolution: '1k',
      storagePath,
    })
    if (!ledgered) {
      console.error(`[portfolios/items/render] ledger write failed for ${portfolioItemId} — not marking done`)
      await handleItemFailure(portfolioItemId, portfolio.id, item.attempts, 'ledger_write_failed')
      return
    }

    await supabaseAdmin
      .from('portfolio_items')
      .update({ status: 'done', preview_id: previewId })
      .eq('id', portfolioItemId)

    await maybeFlipReady(portfolio.id)
    console.log(`[portfolios/items/render] done item=${portfolioItemId} preview=${previewId}`)
  } catch (e: any) {
    console.error(`[portfolios/items/render] top-level failure for ${portfolioItemId}:`, e)
    await supabaseAdmin
      .from('portfolio_items')
      .update({ status: 'failed', error: e?.message || 'unhandled_error' })
      .eq('id', portfolioItemId)
      .catch((dbErr: any) => {
        console.error(`[portfolios/items/render] ALSO failed to write error to DB for ${portfolioItemId}:`, dbErr)
      })
  }
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
    headers: internalHeaders({ 'Content-Type': 'application/json' }),
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
