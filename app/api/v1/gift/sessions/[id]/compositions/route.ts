// POST /api/v1/gift/sessions/{id}/compositions -> SessionView. One composition per purchased line from the selected artwork
// (background extension only, never a crop). Idempotent and resumable.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { compositionsH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? compositionsH(user, giftDeps(), (await ctx.params).id) : signInRequired()
}
