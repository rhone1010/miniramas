// POST /api/v1/gift/sessions/{id}/refund-request { reason? } -> 201 { requestId, state, message }
// A full-refund request to Concierge. Nothing is manufactured while it is open. The refund itself is issued in Stripe and recorded
// only after the Stripe webhook verifies it.
import { getUser } from '@/lib/store/auth'
import { giftDeps, conciergePort } from '@/lib/v1/gift/real'
import { refundRequestH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? refundRequestH(req, user, { ...giftDeps(), concierge: conciergePort() }, (await ctx.params).id) : signInRequired()
}
