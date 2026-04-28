// checkout-[sessionId]-route.ts
// app/api/v1/checkout/[sessionId]/route.ts
//
// GET: status of a purchase by Stripe session id. The /store/success page
// polls this until the status flips to 'paid', then routes to resultUrl
// (already includes the signed token) for singles or to /account for
// bundles.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }    from '@/lib/supabase'
import { signResultToken }  from '@/lib/store/resultToken'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await ctx.params
  if (!sessionId) {
    return NextResponse.json({ error: 'session_required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('purchases')
    .select(`
      id, status, sku_id, amount_cents, paid_at,
      entitlements ( id, status, locked_style, locked_variant, job_id )
    `)
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  if (error) {
    console.error('[api/v1/checkout/[sessionId]] read failed', error.message)
    return NextResponse.json({ error: 'read_failed' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const entitlements = ((data.entitlements ?? []) as Array<{
    id:             string
    status:         string
    locked_style:   string | null
    locked_variant: string | null
    job_id:         string | null
  }>).map((e) => ({
    id:            e.id,
    status:        e.status,
    lockedStyle:   e.locked_style,
    lockedVariant: e.locked_variant,
    jobId:         e.job_id,
  }))

  // Compute a signed result URL when there's exactly one entitlement that
  // has a jobId (single optimistic kickoff). For bundles or for the rare
  // case of zero/multiple jobIds, leave resultUrl null and let the client
  // route to /account.
  let resultUrl: string | null = null
  const withJob = entitlements.filter((e) => e.jobId)
  if (withJob.length === 1 && data.status === 'paid') {
    const jobId = withJob[0].jobId!
    const token = signResultToken(jobId)
    resultUrl = `/result/${jobId}?t=${encodeURIComponent(token)}`
  }

  return NextResponse.json({
    purchase: {
      id:           data.id,
      status:       data.status,
      skuId:        data.sku_id,
      amountCents:  data.amount_cents,
      paidAt:       data.paid_at,
      entitlements,
      resultUrl,
    },
  })
}
