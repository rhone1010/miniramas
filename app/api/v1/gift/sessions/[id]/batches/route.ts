// POST /api/v1/gift/sessions/{id}/batches { idempotencyKey, effectIds? } -> BatchResponse
// Reserves the next batch (free, free, then paid from a verified pack) and generates it. Repeating the key returns the
// same batch and runs only what is unfinished. 202 'partial' means some previews are still missing: POST .../retry.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { startBatchH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? startBatchH(req, user, giftDeps(), (await ctx.params).id) : signInRequired()
}
