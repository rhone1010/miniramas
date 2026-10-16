// POST /api/v1/gift/sessions/{id}/artwork { previewId } -> SessionView. Picks THE artwork (changeable until approval).
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { selectArtworkH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? selectArtworkH(req, user, giftDeps(), (await ctx.params).id) : signInRequired()
}
