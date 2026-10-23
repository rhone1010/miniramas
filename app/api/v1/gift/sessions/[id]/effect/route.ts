// POST /api/v1/gift/sessions/{id}/effect { effectId } -> SessionView. Product-first journey: choose the ONE effect.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { chooseEffectH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? chooseEffectH(req, user, giftDeps(), (await ctx.params).id) : signInRequired()
}
