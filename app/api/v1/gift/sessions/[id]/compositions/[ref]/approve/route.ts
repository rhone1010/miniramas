// POST /api/v1/gift/sessions/{id}/compositions/{compositionId}/approve -> SessionView.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { approveCompositionH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; ref: string }> }) {
  const user = await getUser().catch(() => null)
  const p = await ctx.params
  return user ? approveCompositionH(user, giftDeps(), p.id, p.ref) : signInRequired()
}
