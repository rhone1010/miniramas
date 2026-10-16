// POST /api/v1/gift/preview-pack/checkout { returnPath } -> { clientSecret, stripeSessionId, amountCents: 299, publishableKey }
// Embedded Stripe Checkout for one six-preview pack. Nothing is granted here: only verified payment creates a pack.
import { getUser } from '@/lib/store/auth'
import { getStripe } from '@/lib/store/stripe'
import { packCheckoutH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await getUser().catch(() => null)
  return user ? packCheckoutH(req, user, getStripe(), process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY) : signInRequired()
}
