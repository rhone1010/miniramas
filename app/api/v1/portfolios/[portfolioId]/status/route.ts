// app/api/v1/portfolios/[portfolioId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/store/auth'
import { PREVIEW_BUCKET } from '@/lib/store/preview'

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
    .select('id, user_id, series, size, status, free_unlocks')
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

  // Mint signed URLs for watermarked previews (24h TTL, same as pieces route).
  // Path is deterministic: watermarked/{series}/{previewId}.png
  const mappedItems = await Promise.all((items ?? []).map(async (i) => {
    let previewUrl: string | null = null
    if (i.preview_id && i.status === 'done') {
      const wmPath = `watermarked/${portfolio.series}/${i.preview_id}.png`
      const { data: signed } = await supabaseAdmin.storage
        .from(PREVIEW_BUCKET)
        .createSignedUrl(wmPath, SIGNED_URL_TTL)
      previewUrl = signed?.signedUrl ?? null
    }
    return {
      slot: i.slot,
      preset: i.preset,
      status: i.status,
      previewId: i.preview_id,
      previewUrl,
      attempts: i.attempts ?? 0,
    }
  }))

  return NextResponse.json({
    portfolioId: portfolio.id,
    series: portfolio.series,
    size: portfolio.size,
    status: portfolio.status,
    doneCount,
    freeUnlocks: portfolio.free_unlocks,
    items: mappedItems,
  })
}
