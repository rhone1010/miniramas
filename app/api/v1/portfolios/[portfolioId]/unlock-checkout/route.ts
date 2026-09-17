// app/api/v1/portfolios/[portfolioId]/unlock-checkout/route.ts
//
// The additional Discovery unlock, $2.99, one piece. Phase 1 A4.
//
// WHY IT IS NOT /api/v1/checkout. That route's cart branch builds a HOSTED
// session through createCartCheckout and answers { url }; Discovery's modal
// needs a clientSecret, and the shared cart also prices n=1 at 399c from
// VOLUME_LADDER. Both belong to the legacy pieces cart and neither is
// changed. This is Discovery's own path, embedded like every other
// Discovery checkout, priced from the seeded unlock_addon_1 SKU.
//
// The portfolio is in the URL and the preview in the body; both are checked
// against this signed-in customer's own rows before Stripe is called.

import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { createDiscoveryUnlockCheckout } from '@/lib/store/discovery-unlock'
import { safeReturnBase } from '@/lib/store/portfolio-checkout'
import { getAppUrl } from '@/lib/store/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* Caller error, not ours: answer 400 and say which. Anything else is a 500
   and is logged. */
const BAD_REQUEST = new Set([
  'unlock_portfolio_required',
  'unlock_preview_required',
  'unlock_portfolio_not_found',
  'unlock_preview_not_in_portfolio',
  'unlock_preview_not_found',
  'unlock_preview_not_ready',
  'unlock_already_unlocked',
  'unlock_preview_portfolio_mismatch',
])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ portfolioId: string }> },
) {
  const { portfolioId } = await params

  let body: { previewId?: unknown; returnUrl?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unlock_requires_user' }, { status: 401 })

  const previewId = typeof body.previewId === 'string' ? body.previewId : ''
  if (!previewId) return NextResponse.json({ error: 'unlock_preview_required' }, { status: 400 })

  /* Same open-redirect guard the portfolio checkout uses: same host, or a
     fallback we own. The unlock returns to the collection the customer is
     already looking at. */
  const returnBase = safeReturnBase(
    typeof body.returnUrl === 'string' ? body.returnUrl : '',
    getAppUrl(),
  )

  /* __D1_REDIRECT_RETURN__ THE PARAMETERS ARE THE WHOLE POINT OF THE RETURN.
     `redirect_on_completion: 'if_required'` means card and Link finish inside
     the modal and never come here -- but Klarna, Cash App Pay and Amazon Pay
     have to leave the page, and they come back to exactly this URL. Sent bare,
     it told the client nothing: the return handler reads `paid` and
     `session_id`, found neither, and returned. unlock-confirm was never
     called, and on a branch deployment the webhook cannot call it either,
     because activateDiscoveryUnlock is not on main. The customer paid $2.99
     and the image stayed locked -- the 2026-09-17 failure exactly, reached
     through the one door its mitigation did not cover.

     The portfolio path has always appended these (portfolio-checkout.ts:249).
     This is the same two parameters on the same shape of URL, so redirect
     completion converges on the embedded path's proven
     unlock-confirm -> requestUnlock sequence instead of a second one. */
  const returnUrl = returnBase + (returnBase.includes('?') ? '&' : '?')
    + 'paid=1&session_id={CHECKOUT_SESSION_ID}'

  try {
    const result = await createDiscoveryUnlockCheckout({
      userId: user.id,
      portfolioId,
      previewId,
      returnUrl,
    })
    return NextResponse.json({
      clientSecret:    result.clientSecret,
      publishableKey:  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY,
      sessionId:       result.sessionId,
      purchaseId:      result.purchaseId,
      priceCents:      result.priceCents,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'unlock_wrong_owner') {
      return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })
    }
    if (BAD_REQUEST.has(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    console.error(`[portfolios/unlock-checkout] failed portfolio=${portfolioId} preview=${previewId}: ${msg}`)
    return NextResponse.json({ error: 'unlock_checkout_failed', message: msg }, { status: 500 })
  }
}
