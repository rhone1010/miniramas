// POST /api/v1/gift/sessions/{id}/approve -> SessionView. Every line approved: creates the one unlocked My Collection piece and
// releases the order to the existing fulfilment pipeline (which still runs its own account, payment, upscale, QA and Prodigi checks).
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { approveOrderH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? approveOrderH(user, giftDeps(), (await ctx.params).id) : signInRequired()
}
