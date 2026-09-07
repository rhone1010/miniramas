// app/api/v1/portfolios/[portfolioId]/activate/route.ts
//
// Re-run activation for a portfolio whose purchase is paid but whose row is
// still 'pending'. Added 2026-09-06 after a paid portfolio sat at 'pending'
// with no render jobs and nothing to show for it.
//
// WHY THIS EXISTS. Activation happens in exactly one place — the Stripe
// webhook, which calls activatePortfolio after confirmPurchase
// (webhooks/stripe/route.ts:71-78). That is a single delivery to a single
// URL, and two ordinary things break it:
//
//   · the webhook never arrives. A Vercel preview sits behind deployment
//     protection, so Stripe's POST is answered with a 302 to the SSO page
//     and the route never runs. Production is configured; a branch preview
//     is not.
//   · it arrives and activatePortfolio throws. The webhook catches
//     everything past signature verification and only logs
//     (webhooks/stripe/route.ts:52-57) — deliberately, so Stripe stops
//     retrying — which means the reason is in a log the browser cannot see.
//
// In both cases the customer has paid and the portfolio never starts. This
// route lets the page that is already polling ask for activation again, and
// RETURNS the failure instead of swallowing it.
//
// Idempotent because activatePortfolio is: it returns immediately unless the
// portfolio is 'pending' (portfolio-checkout.ts:240), so calling this on an
// already-running portfolio does nothing. It never charges anything and
// never creates work twice.
//
// It does NOT trust the caller about payment. The purchase must already be
// 'paid' in our own database — the same row Stripe's webhook writes — so
// this cannot be used to start work that was not bought.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/store/auth'
import { getStripe } from '@/lib/store/stripe'
import { confirmPurchase } from '@/lib/store/entitlements'
import { activatePortfolio } from '@/lib/store/portfolio-checkout'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ portfolioId: string }> },
) {
  /* params is a Promise in this Next.js — the same shape status/ and
     unlocks/ already use. */
  const { portfolioId } = await ctx.params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const { data: portfolio, error: portfolioErr } = await supabaseAdmin
    .from('portfolios')
    .select('id, user_id, purchase_id, status')
    .eq('id', portfolioId)
    .maybeSingle()
  if (portfolioErr) {
    return NextResponse.json({ error: 'portfolio_query_failed', detail: portfolioErr.message }, { status: 500 })
  }
  if (!portfolio) return NextResponse.json({ error: 'portfolio_not_found' }, { status: 404 })
  if (portfolio.user_id !== user.id) return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })

  // Already running or finished — nothing to do, and say so plainly.
  if (portfolio.status !== 'pending') {
    return NextResponse.json({ ok: true, status: portfolio.status, activated: false })
  }

  // The purchase, not the caller, decides whether this is allowed.
  const { data: purchase, error: purchaseErr } = await supabaseAdmin
    .from('purchases')
    .select('id, status, stripe_session_id')
    .eq('id', portfolio.purchase_id)
    .maybeSingle()
  if (purchaseErr) {
    return NextResponse.json({ error: 'purchase_query_failed', detail: purchaseErr.message }, { status: 500 })
  }
  if (!purchase) return NextResponse.json({ error: 'purchase_not_found' }, { status: 404 })

  /* ── The purchase is still 'pending' — ask Stripe, not the caller ──────
     Confirmed 2026-09-06: a paid portfolio sat at 'pending' because the
     webhook never arrived, so confirmPurchase never ran and nothing in our
     database knew the money had moved. The customer had paid.

     A webhook is the right way to hear about a payment the customer walked
     away from. It is the wrong single point of failure for the customer who
     is sitting here looking at the page, because delivery can fail for
     reasons that have nothing to do with them — a preview behind deployment
     protection answers Stripe's POST with a 302 to an SSO page.

     So the session is read back from Stripe, which is authoritative, and
     confirmPurchase runs from here if the payment really did complete. Both
     paths converge on the same function and confirmPurchase is idempotent
     by charge id (entitlements.ts:313), so the webhook arriving late finds
     the work already done and does nothing. */
  if (purchase.status !== 'paid') {
    if (!purchase.stripe_session_id) {
      return NextResponse.json(
        { error: 'payment_pending', purchaseStatus: purchase.status, detail: 'no stripe session on purchase' },
        { status: 402 },
      )
    }
    let paymentStatus = 'unknown'
    try {
      const session = await getStripe().checkout.sessions.retrieve(purchase.stripe_session_id)
      paymentStatus = session.payment_status ?? 'unknown'
      if (session.payment_status === 'paid') {
        const chargeId =
          (typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id) || session.id
        await confirmPurchase({
          stripeSessionId: purchase.stripe_session_id,
          stripeChargeId:  chargeId,
        })
        console.log(
          `[portfolios/activate] confirmed purchase ${purchase.id} from Stripe ` +
          `(webhook had not landed) session=${purchase.stripe_session_id}`,
        )
      }
    } catch (e: any) {
      console.error(`[portfolios/activate] stripe reconcile failed for ${portfolioId}:`, e?.message || e)
      return NextResponse.json(
        { error: 'reconcile_failed', detail: e?.message || String(e) },
        { status: 500 },
      )
    }

    if (paymentStatus !== 'paid') {
      /* Genuinely not paid — the customer is mid-checkout, or abandoned it.
         The caller polls, so this is a "not yet", not a failure. */
      return NextResponse.json(
        { error: 'payment_pending', purchaseStatus: purchase.status, stripePaymentStatus: paymentStatus },
        { status: 402 },
      )
    }
  }

  try {
    await activatePortfolio(purchase.id)
  } catch (e: any) {
    /* The whole point of this route: the webhook logs this and returns 200,
       so the reason never reaches anyone looking at the problem. Here it
       goes back in the response. */
    console.error(`[portfolios/activate] failed for ${portfolioId}:`, e?.message || e)
    return NextResponse.json(
      { error: 'activate_failed', detail: e?.message || String(e) },
      { status: 500 },
    )
  }

  const { data: after } = await supabaseAdmin
    .from('portfolios')
    .select('status')
    .eq('id', portfolioId)
    .maybeSingle()

  console.log(`[portfolios/activate] portfolio=${portfolioId} status=${after?.status ?? 'unknown'}`)
  return NextResponse.json({ ok: true, status: after?.status ?? null, activated: true })
}
