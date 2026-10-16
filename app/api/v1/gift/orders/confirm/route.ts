// POST /api/v1/gift/orders/confirm { stripeSessionId } -> { confirmed, session? }
// Re-verifies the Stripe session with Stripe (the webhook runs the same code). Idempotent. Never trusts the browser.
import { getUser } from '@/lib/store/auth'
import { giftOrderDeps } from '@/lib/v1/gift/real'
import { orderConfirmH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await getUser().catch(() => null)
  if (!user) return signInRequired()
  const deps = await giftOrderDeps()
  return orderConfirmH(req, user, { stripe: deps.stripe, store: deps.store }, deps.gift)
}
