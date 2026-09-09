// app/api/v1/portfolios/[portfolioId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/store/auth'
import { PREVIEW_BUCKET, lockedPreviewPath } from '@/lib/store/preview'

const SIGNED_URL_TTL = 60 * 60 * 24   // 24h — a browsing session's worth

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ portfolioId: string }> },
) {
  /* params is a Promise in this Next.js -- read it as a plain object
     and every segment is undefined, which reached Postgres as the
     literal string "undefined". Same shape checkout/[sessionId]
     already uses. */
  const { portfolioId } = await ctx.params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const { data: portfolio, error: portfolioErr } = await supabaseAdmin
    .from('portfolios')
    .select('id, user_id, series, size, status, free_unlocks, aspect_ratio')
    .eq('id', portfolioId)
    .maybeSingle()
  if (portfolioErr) return NextResponse.json({ error: 'portfolio_status_query_failed' }, { status: 500 })
  if (!portfolio) return NextResponse.json({ error: 'portfolio_not_found' }, { status: 404 })
  if (portfolio.user_id !== user.id) return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('portfolio_items')
    .select('slot, preset, status, preview_id, attempts')
    .eq('portfolio_id', portfolio.id)
    .order('slot', { ascending: true })
  if (itemsErr) return NextResponse.json({ error: 'portfolio_items_query_failed' }, { status: 500 })

  const doneCount = (items ?? []).filter((i) => i.status === 'done').length

  /* WHICH PIECES ARE PAID FOR. Same read the unlocks route performs
     (unlocks/route.ts:66-77): preview_ledger.unlocked_at is what the unlock
     route stamps, so it is the one authority on whether this piece has been
     bought. storage_path comes back with it — the recorded location of the
     clean master, which is better than rebuilding the path from the series
     and hoping the two agree. */
  const previewIds = (items ?? []).map((i) => i.preview_id).filter(Boolean) as string[]
  const ledger = new Map<string, { unlocked: boolean; storagePath: string | null }>()
  if (previewIds.length > 0) {
    const { data: rows, error: ledgerErr } = await supabaseAdmin
      .from('preview_ledger')
      .select('id, unlocked_at, storage_path')
      .in('id', previewIds)
    if (ledgerErr) return NextResponse.json({ error: 'preview_ledger_query_failed' }, { status: 500 })
    for (const r of rows ?? []) {
      ledger.set(r.id, { unlocked: !!r.unlocked_at, storagePath: r.storage_path ?? null })
    }
  }

  const signed = async (path: string): Promise<string | null> => {
    const { data } = await supabaseAdmin.storage
      .from(PREVIEW_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL)
    return data?.signedUrl ?? null
  }

  const mappedItems = await Promise.all((items ?? []).map(async (i) => {
    let previewUrl: string | null = null
    let unlocked = false

    if (i.preview_id && i.status === 'done') {
      const led = ledger.get(i.preview_id)
      unlocked = led?.unlocked ?? false

      if (unlocked) {
        /* PAID FOR, SO IT GETS THE REAL THING. Until now this route signed
           the baked watermark for every done item without asking, and the
           client only ever saw a clean image because the unlock response
           handed it the bytes directly -- held in memory, lost on reload.
           So a customer who had paid was shown a watermarked image again
           every time they came back to the page. */
        const cleanPath = led?.storagePath ?? `${portfolio.series}/${i.preview_id}.png`
        previewUrl = await signed(cleanPath)
      } else {
        /* LOCKED. The derivative, or the retired bake for anything not yet
           backfilled -- and if neither object is there, nothing.

           THE RULE THIS ENFORCES: the clean master is never signed for a
           locked piece. Not as a fallback, not when the derivative is
           missing, not when both are missing. A tile with no art is a
           blemish; a full-resolution unpaid image is the product. */
        previewUrl = await signed(lockedPreviewPath(portfolio.series, i.preview_id))
        if (!previewUrl) {
          previewUrl = await signed(`watermarked/${portfolio.series}/${i.preview_id}.png`)
          if (previewUrl) {
            console.warn(`[portfolios/status] no derivative for ${i.preview_id} — served the retired bake`)
          } else {
            console.error(`[portfolios/status] no locked art at all for ${i.preview_id} — sending null`)
          }
        }
      }
    }

    return {
      slot: i.slot,
      preset: i.preset,
      status: i.status,
      previewId: i.preview_id,
      previewUrl,
      unlocked,
      attempts: i.attempts ?? 0,
    }
  }))

  return NextResponse.json({
    portfolioId: portfolio.id,
    series: portfolio.series,
    size: portfolio.size,
    /* The canvas the customer bought. Portfolio-level: every item of a
       portfolio shares it. Null for the six that predate migration 030 and
       for every preview bundle, and the client falls back to the card
       ratio exactly as it did before. */
    aspectRatio: portfolio.aspect_ratio ?? null,
    status: portfolio.status,
    doneCount,
    freeUnlocks: portfolio.free_unlocks,
    items: mappedItems,
  })
}
