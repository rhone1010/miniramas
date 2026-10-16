// GET /api/v1/gift/sessions/{id}/batches/{n} -> BatchView (always six previews; signed watermarked URLs when ready).
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { getBatchH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const user = await getUser().catch(() => null)
  const p = await ctx.params
  return user ? getBatchH(user, giftDeps(), p.id, p.n) : signInRequired()
}
