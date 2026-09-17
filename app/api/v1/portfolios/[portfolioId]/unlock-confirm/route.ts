// app/api/v1/portfolios/[portfolioId]/unlock-confirm/route.ts
//
// THE LESSON THIS ROUTE EXISTS TO CARRY:
//
//   A PREVIEW-CREATED PAYMENT FLOW MUST NOT DEPEND FOR COMPLETION ON CODE
//   THAT EXISTS ONLY IN PREVIEW WHILE STRIPE DELIVERS TO PRODUCTION/main.
//
// On 2026-09-17 a customer paid $2.99 twice and neither piece unlocked.
// Nothing was wrong with the price, the session, the metadata or the
// entitlement: all six unlock sessions minted correctly and the rows were
// bound exactly as designed. The confirmation handler was simply in another
// building. Stripe delivers checkout.session.completed to the PRODUCTION
// endpoint, Production serves `main`, and activateDiscoveryUnlock lives only
// on the feature branch -- so the webhook answered 200, logged nothing, and
// the bound entitlement stayed 'pending' forever. The unlock route then did
// its job and refused: 409 no_entitlement.
//
// So confirmation no longer depends on a webhook reaching the right
// deployment. The customer's own browser, talking to the deployment that
// served it, asks this route to confirm -- and this route asks STRIPE, which
// is the authority on whether money moved. The Production webhook still runs
// and still confirms; both paths converge on the same idempotent
// activateDiscoveryUnlock, so whichever arrives first wins and the other is a
// no-op. lib/store/tests/deployment-contract.test.ts asserts the general rule
// so this cannot regress quietly.
//
// FAILS CLOSED. Every check below refuses rather than assumes, and none of
// them trusts the client: the session id is the only thing the browser
// supplies, and it is worthless without a purchase row we wrote ourselves
// under this customer's id.

import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { getStripe } from '@/lib/store/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { confirmPurchase } from '@/lib/store/entitlements'
import { activateDiscoveryUnlock } from '@/lib/store/discovery-unlock'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ portfolioId: string }> },
) {
  const { portfolioId } = await params

  let body: { sessionId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unlock_requires_user' }, { status: 401 })

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  if (!sessionId) return NextResponse.json({ error: 'session_required' }, { status: 400 })

  const stripe = getStripe()

  // ── 1. Stripe is the authority on whether money moved ────────
  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[unlock-confirm] session ${sessionId} could not be read: ${msg}`)
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
  }
  if (session.payment_status !== 'paid') {
    /* Not an error -- the customer may be mid-payment, or closed the modal.
       The client polls, exactly as the portfolio path does. */
    return NextResponse.json({ confirmed: false, reason: 'not_paid', paymentStatus: session.payment_status })
  }
  if (session.metadata?.kind !== 'discovery_unlock') {
    console.warn(`[unlock-confirm] session ${sessionId} is not a discovery unlock (kind=${session.metadata?.kind})`)
    return NextResponse.json({ error: 'wrong_session_kind' }, { status: 400 })
  }

  /* Metadata is context, so it is checked for CONSISTENCY, never trusted as
     permission. The permission check is the purchase row below. */
  if (session.metadata?.portfolioId && session.metadata.portfolioId !== portfolioId) {
    console.warn(`[unlock-confirm] session ${sessionId} names portfolio ${session.metadata.portfolioId}, asked about ${portfolioId}`)
    return NextResponse.json({ error: 'identity_mismatch' }, { status: 400 })
  }

  // ── 2. The purchase we wrote, and whose it is ────────────────
  const { data: purchase, error: purErr } = await supabaseAdmin
    .from('purchases')
    .select('id, user_id, status')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  if (purErr) {
    console.error(`[unlock-confirm] purchase lookup failed session=${sessionId}: ${purErr.message}`)
    return NextResponse.json({ error: 'confirm_failed' }, { status: 500 })
  }
  if (!purchase) {
    console.error(`[unlock-confirm] PAID session ${sessionId} has no purchase row — money taken, nothing to bind`)
    return NextResponse.json({ error: 'purchase_not_found' }, { status: 404 })
  }
  /* THE AUTHORIZATION CHECK. A session id is guessable in principle; a
     purchase row written under this customer's id is not. */
  if (purchase.user_id !== user.id) {
    console.warn(`[unlock-confirm] user ${user.id} asked to confirm purchase ${purchase.id} owned by ${purchase.user_id}`)
    return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })
  }

  // ── 3. Mark paid, then activate. Both idempotent. ────────────
  try {
    const chargeId =
      (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id) || session.id
    await confirmPurchase({ stripeSessionId: sessionId, stripeChargeId: chargeId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[unlock-confirm] confirmPurchase failed session=${sessionId} purchase=${purchase.id}: ${msg}`)
    return NextResponse.json({ error: 'confirm_failed', message: msg }, { status: 500 })
  }

  try {
    const res = await activateDiscoveryUnlock({ stripeSessionId: sessionId })
    console.log(
      `[unlock-confirm] session=${sessionId} purchase=${purchase.id} ` +
      `activated=${res.activated}${res.reason ? ' reason=' + res.reason : ''}`,
    )
    /* activated:false is not failure -- a duplicate delivery, or the webhook
       having already done it, both land here and both mean the entitlement
       is ready. The client retries the unlock either way. */
    return NextResponse.json({
      confirmed: true,
      activated: res.activated,
      reason:    res.reason ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      `[unlock-confirm] ACTIVATION FAILED after a PAID session=${sessionId} purchase=${purchase.id}: ${msg}. ` +
      `The customer has paid and the unlock is not spendable. Reconcile by hand.`,
    )
    return NextResponse.json({ error: 'activation_failed', message: msg }, { status: 500 })
  }
}
