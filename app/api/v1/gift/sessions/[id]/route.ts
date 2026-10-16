// GET /api/v1/gift/sessions/{id} -> SessionView.   DELETE -> 204 (removes the photo, masters, previews and rows now).
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { deleteSessionH, getSessionH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getUser().catch(() => null)
  return user ? getSessionH(user, giftDeps(), (await ctx.params).id) : signInRequired()
}
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getUser().catch(() => null)
  return user ? deleteSessionH(user, giftDeps(), (await ctx.params).id) : signInRequired()
}
