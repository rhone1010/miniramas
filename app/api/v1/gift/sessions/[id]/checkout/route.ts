// POST /api/v1/gift/sessions/{id}/checkout { email, shippingAddress, shippingMethod?, disclosureAccepted: true, returnPath }
// Purchase BEFORE generation: embedded Stripe Checkout for the session's saved products (catalog prices + a Prodigi shipping quote).
// The order is created as a Print Shop order awaiting artwork; nothing personalised is generated until payment is verified.
import { getUser } from '@/lib/store/auth'
import { giftOrderDeps } from '@/lib/v1/gift/real'
import { checkoutH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? checkoutH(req, user, await giftOrderDeps(), (await ctx.params).id) : signInRequired()
}
