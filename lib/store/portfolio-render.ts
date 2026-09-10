// lib/store/portfolio-render.ts
//
// The render/watermark/upload work for one portfolio item.
//
// MOVED VERBATIM out of app/api/v1/portfolios/items/render/route.ts on
// 2026-09-07. Not rewritten: renderOnePortfolioItem, handleItemFailure,
// failWholePortfolio and maybeFlipReady are byte-identical to the versions
// that shipped in that route, only relocated and exported.
//
// Why it moved. The trigger changed, not the work. Two callers now need the
// same implementation — the cron poller (items/render-poll) and the original
// POST route — and one implementation shared from lib/store is how every
// other shared piece in this codebase is arranged (portfolio-checkout.ts,
// preview.ts, portfolio-replace.ts). Exporting it from the route file instead
// would have left the single implementation sitting behind a Next.js route
// convention, so it came here rather than being duplicated.

import { supabaseAdmin } from '@/lib/supabase'
import { getAppUrl } from '@/lib/store/stripe'
import { storeCleanOriginal, makeLockedPreview, lockedPreviewPath, recordPreview, PREVIEW_BUCKET } from '@/lib/store/preview'
import { decideRetry } from '@/lib/store/portfolio-replace'
import { styleIdForPreset } from '@/lib/store/portraits-style-lookup'
import crypto from 'crypto'

export async function renderOnePortfolioItem(portfolioItemId: string): Promise<void> {
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
      .select('id, series, source_image, delivery, pose, framing, subject, aspect_ratio')
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

    /* Read once, used three times below. The column is the authority --
       nothing here counts items or tests size. */
    const purchased = portfolio.delivery === 'purchased'

    const styleId = styleIdForPreset(item.preset)
    const appUrl = getAppUrl()

    let genResult: any
    let ok = false
    try {
      const res = await fetch(`${appUrl}/api/v1/portraits/generate`, {
        method: 'POST',
        /* generate returns clean output only to an authorized caller. This
           is the server's own render of a paid portfolio, so it presents the
           internal secret -- the same one items/render and the cron poller
           check. Nothing else about the request changes. */
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
        },
        body: JSON.stringify({
          source_image_b64: portfolio.source_image,
          style_id: styleId,
          preset_id: item.preset,
          /* COMPOSITION APPLIES TO A PURCHASED PORTFOLIO ONLY.
             The columns are captured for every size, but reading them back
             for 4/8/16 would change what those bundles render -- their
             pieces have always come out bust/close_up/1:1 -- and that was
             explicitly out of scope. So a preview bundle keeps the literal
             values it has always sent, byte for byte, and only a purchased
             single honours what the customer chose.
             Honouring it for bundles later is this one condition. */
          /* Framing is 'bust' for every size. Discovery has no framing step
             and all three of its aspect choices use the Bust composition
             block, so this is the literal value 4/8/16 have always sent. */
          framing: purchased ? (portfolio.framing || 'bust') : 'bust',
          scale: 'close_up',
          /* THE CANVAS, CARRIED SEPARATELY FROM THE COMPOSITION. Only a
             purchased portfolio sends it, so a preview bundle's request is
             byte-identical to what it has always been and keeps rendering
             at the framing-derived 1:1.

             Deliberately not `aspect_ratio`: portraits.html sends that as
             '1:1' on every request and depends on the route discarding it
             (portraits.html:6742). output_aspect_ratio is a new field
             nothing else sends. Absent -> the route's existing
             ASPECT_FOR_FRAMING behaviour, unchanged. */
          ...(purchased && portfolio.aspect_ratio
            ? { output_aspect_ratio: portfolio.aspect_ratio }
            : {}),
          ...(purchased && portfolio.pose    ? { pose: portfolio.pose }       : {}),
          ...(purchased && portfolio.subject ? { subject: portfolio.subject } : {}),
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

    /* FAIL CLOSED, exactly as the bake did. A locked piece may only ever be
       shown its derivative; if there is no derivative there is nothing this
       item is allowed to display, and the clean master is not a substitute.
       So a failure here fails the item rather than marking it done. */
    let lockedPreview: Buffer
    try {
      lockedPreview = await makeLockedPreview(imageB64)
    } catch (e: any) {
      console.error(`[portfolios/items/render] locked-preview build FAILED for ${portfolioItemId}`, e)
      await handleItemFailure(portfolioItemId, portfolio.id, item.attempts, 'locked_preview_failed')
      return
    }

    // Two objects per piece now:
    //   clean master  {series}/{previewId}.png            -- unlock, print, and
    //                                                        an unlocked tile
    //   locked view   locked/{series}/{previewId}.jpg     -- what a locked
    //                                                        browser may see
    // The retired bake at watermarked/{series}/{previewId}.png is no longer
    // written; existing ones stay put as the fallback for un-backfilled rows.
    const lockedPath = lockedPreviewPath(portfolio.series, previewId)
    const { error: lockedUpErr } = await supabaseAdmin.storage
      .from(PREVIEW_BUCKET)
      .upload(lockedPath, lockedPreview, {
        contentType: 'image/jpeg',
        upsert: true,
      })
    if (lockedUpErr) {
      console.error(`[portfolios/items/render] locked-preview upload FAILED for ${portfolioItemId}:`, lockedUpErr.message)
      await handleItemFailure(portfolioItemId, portfolio.id, item.attempts, 'locked_preview_upload_failed')
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
      /* BOUGHT OUTRIGHT MEANS BORN UNLOCKED. This is the only place the
         delivery model changes what gets written, and it is one field: a
         purchased piece has no unlock step and no entitlement behind it, so
         stamping unlocked_at here is what makes /status serve the clean
         master and the client show Download instead of Unlock. Neither of
         those needed a change. */
      unlockedAt: purchased ? new Date().toISOString() : null,
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
