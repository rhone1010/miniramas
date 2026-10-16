// POST /api/v1/gift/sessions/{id}/compositions/{lineId}/correct -> SessionView. The ONE free correction per line;
// 409 correction_limit afterwards (further changes go to Concierge).
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { correctH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; ref: string }> }) {
  const user = await getUser().catch(() => null)
  const p = await ctx.params
  return user ? correctH(user, giftDeps(), p.id, p.ref) : signInRequired()
}
