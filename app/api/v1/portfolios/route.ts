// app/api/v1/portfolios/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createPortfolioCheckout, type PortfolioSeries } from '@/lib/store/portfolio-checkout'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: list the signed-in user's portfolios (id, series, status).
// Used by My Collection to discover which portfolios to load.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ portfolios: [] })

  const { data, error } = await supabaseAdmin
    .from('portfolios')
    .select('id, series, size, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[api/v1/portfolios] list failed', error.message)
    return NextResponse.json({ portfolios: [] })
  }
  return NextResponse.json({ portfolios: data ?? [] })
}

const BAD_REQUEST = [
  'portfolio_purchase_requires_user', 'portfolio_empty_selection',
  'portfolio_over_capacity', 'portfolio_source_image_required', 'price_mismatch',
]
const VALID_SERIES = new Set<PortfolioSeries>(['portraits', 'halloween', 'groups', 'pets'])

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'portfolio_purchase_requires_user' }, { status: 401 })

  const series = typeof body.series === 'string' ? body.series : ''
  if (!VALID_SERIES.has(series as PortfolioSeries)) {
    return NextResponse.json({ error: 'portfolio_invalid_series' }, { status: 400 })
  }

  try {
    const result = await createPortfolioCheckout({
      userId: user.id,
      series: series as PortfolioSeries,
      selectedEffectIds: Array.isArray(body.selectedEffectIds) ? body.selectedEffectIds : [],
      sourceImageRef: typeof body.sourceImageRef === 'string' ? body.sourceImageRef : '',
      returnUrl: typeof body.returnUrl === 'string' ? body.returnUrl : '',
      clientPriceUsd: Number(body.clientPriceUsd),
      /* The composition block the browser already builds and, until now, threw
         away at this line. buildCheckoutPayload() has carried pose and
         aspect_ratio since the pose step shipped. */
      composition: {
        ...(typeof body.pose === 'string' ? { pose: body.pose } : {}),
        ...(typeof body.aspect_ratio === 'string' ? { aspect_ratio: body.aspect_ratio } : {}),
        ...(typeof body.subject === 'string' ? { subject: body.subject } : {}),
      },
    })
    return NextResponse.json({
      clientSecret:   result.clientSecret,
      publishableKey: result.publishableKey,
      sessionId:      result.sessionId,
      portfolioId:    result.portfolioId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/v1/portfolios] failed', msg)
    if (BAD_REQUEST.some((p) => msg.startsWith(p))) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: 'portfolio_checkout_failed', message: msg }, { status: 500 })
  }
}
