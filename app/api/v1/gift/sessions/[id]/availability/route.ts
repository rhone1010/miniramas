// GET /api/v1/gift/sessions/{id}/availability -> AvailabilityView. For the shared Product Studio: per product, whether it is purchasable, what adaptation the selected artwork needs, how it will be
// previewed (an approved scene, or the exact product-shaped artwork) and the approval basis. Shape and photography never make a product unavailable. Contract: lib/v1/gift/availability.ts.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { availabilityH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? availabilityH(user, giftDeps(), (await ctx.params).id) : signInRequired()
}
