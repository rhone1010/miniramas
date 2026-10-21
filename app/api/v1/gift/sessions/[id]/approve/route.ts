// POST /api/v1/gift/sessions/{id}/approve -> SessionView. DEPRECATED ALIAS of /finalize, kept for clients written before the split. It is approval-only: it can no longer release
// an order to manufacturing (that is the operator's scripts/gift-release-order.ts). New clients call /finalize.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { approveOrderH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? approveOrderH(user, giftDeps(), (await ctx.params).id) : signInRequired()
}
