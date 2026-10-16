// PUT /api/v1/gift/sessions/{id}/lines { lines } -> SessionView. Launch products only; geometry comes from the catalog.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { setLinesH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? setLinesH(req, user, giftDeps(), (await ctx.params).id) : signInRequired()
}
