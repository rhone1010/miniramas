import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { PREVIEW_BUCKET } from '@/lib/store/preview'
import { bakeFoyerWatermark } from '@/lib/v1/foyer/foyer-watermark'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Deliver existing collection previews with the exact Foyer treatment without
// rewriting shared storage or exposing an unpaid clean master to the browser.
export async function GET(_request: Request, ctx: {
  params: Promise<{ portfolioId: string; previewId: string }>
}) {
  const user = await getUser()
  if (!user) return new NextResponse(null, { status: 401 })
  const { portfolioId, previewId } = await ctx.params
  try {
    const { data: portfolio, error: pe } = await supabaseAdmin.from('portfolios')
      .select('id,user_id').eq('id', portfolioId).maybeSingle()
    if (pe) throw pe
    if (!portfolio || portfolio.user_id !== user.id) return new NextResponse(null, { status: 404 })
    const { data: item, error: ie } = await supabaseAdmin.from('portfolio_items')
      .select('id').eq('portfolio_id', portfolioId).eq('preview_id', previewId)
      .eq('status', 'done').maybeSingle()
    if (ie) throw ie
    if (!item) return new NextResponse(null, { status: 404 })
    const { data: ledger, error: le } = await supabaseAdmin.from('preview_ledger')
      .select('storage_path,unlocked_at').eq('id', previewId).maybeSingle()
    if (le) throw le
    if (!ledger?.storage_path) return new NextResponse(null, { status: 404 })
    const { data: original, error: oe } = await supabaseAdmin.storage
      .from(PREVIEW_BUCKET).download(ledger.storage_path)
    if (oe || !original) throw oe || new Error('missing_original')
    const source = Buffer.from(await original.arrayBuffer())
    // Owned pieces stay clean, including an unlock completed after /status.
    const image = ledger.unlocked_at ? source : await sharp(Buffer.from(
      await bakeFoyerWatermark(source.toString('base64')), 'base64',
    )).toColourspace('srgb').jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer()
    const format = ledger.unlocked_at ? (await sharp(image).metadata()).format : 'jpeg'
    return new NextResponse(new Uint8Array(image), { headers: {
      'Content-Type': format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch {
    // A failed watermark must never fall back to the unmarked original.
    return new NextResponse(null, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
