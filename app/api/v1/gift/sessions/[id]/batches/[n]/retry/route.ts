// POST /api/v1/gift/sessions/{id}/batches/{n}/retry -> BatchResponse. Runs only failed or unfinished previews; no new charge.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { retryBatchH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const user = await getUser().catch(() => null)
  const p = await ctx.params
  return user ? retryBatchH(user, giftDeps(), p.id, p.n) : signInRequired()
}
