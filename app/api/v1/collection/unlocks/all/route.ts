import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { createCollectionSetCheckout, fulfillCollectionSet } from '@/lib/store/collection-unlock-set'

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unlock_requires_user' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  try {
    if (body.sessionId) {
      if (typeof body.sessionId !== 'string') return NextResponse.json({ error: 'invalid_session' }, { status: 400 })
      return NextResponse.json(await fulfillCollectionSet(body.sessionId, user.id))
    }
    if (!Number.isInteger(body.count) || body.count < 10) return NextResponse.json({ error: 'invalid_unlock_quantity' }, { status: 400 })
    const returnPath = ['/pets/discovery', '/discovery'].includes(body.returnPath) ? body.returnPath : '/discovery'
    const returnUrl = `${new URL(request.url).origin}${returnPath}?collection_unlock_set_session={CHECKOUT_SESSION_ID}`
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY) throw new Error('stripe_not_configured')
    return NextResponse.json({ ...await createCollectionSetCheckout(user.id, body.count, returnUrl),
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY })
  } catch {
    return NextResponse.json({ error: 'unlock_payment_unavailable' }, { status: 503 })
  }
}
