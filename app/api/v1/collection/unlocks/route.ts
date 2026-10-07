import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { COLLECTION_UNLOCK_OFFERS, createCollectionUnlockCheckout, fulfillCollectionUnlocks } from '@/lib/store/collection-unlocks'
import { collectionUnlockSummary } from '@/lib/store/collection-unlock-summary'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Never expose payable controls before the checkout persistence migration exists.
    const { error } = await supabaseAdmin.from('collection_unlock_checkouts').select('attempt_id').limit(0)
    if (error) throw new Error('unlock_wallet_unavailable')
    const user = await getUser()
    const summary = user ? await collectionUnlockSummary(user.id) : { balance: null, lockedCount: null, all: null }
    return NextResponse.json({ checkoutEnabled: true,
      offers: COLLECTION_UNLOCK_OFFERS.map(({ count, cents }) => ({ count, cents })),
      ...summary,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'unlock_wallet_unavailable' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unlock_requires_user' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  try {
    if (body.sessionId) {
      if (typeof body.sessionId !== 'string') return NextResponse.json({ error: 'invalid_session' }, { status: 400 })
      return NextResponse.json(await fulfillCollectionUnlocks(body.sessionId, user.id))
    }
    if (!COLLECTION_UNLOCK_OFFERS.some(o => o.count === body.count)) {
      return NextResponse.json({ error: 'invalid_unlock_quantity' }, { status: 400 })
    }
    const url = new URL(request.url)
    const returnPath = typeof body.returnPath === 'string' &&
      ['/pets/discovery', '/discovery'].includes(body.returnPath) ? body.returnPath : '/discovery'
    const returnUrl = `${url.origin}${returnPath}?collection_unlock_session={CHECKOUT_SESSION_ID}`
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY) throw new Error('stripe_not_configured')
    return NextResponse.json({ ...await createCollectionUnlockCheckout(user.id, body.count, returnUrl),
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY })
  } catch {
    return NextResponse.json({ error: 'unlock_payment_unavailable' }, { status: 503 })
  }
}
